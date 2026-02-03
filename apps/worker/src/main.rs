use redis::Commands;
use serde::{Deserialize, Serialize};
use num_cpus;
use sysinfo::{System, Pid};

use std::{
    fs,
    process::{Command, Stdio},
    sync::Arc,
    thread,
    time::{Duration, Instant},
};

/* ================= JOB ================= */

#[derive(Deserialize, Serialize, Clone)]
struct Job {
    id: String,
    input: String,
    base: String,
    created_at: u64,
}

/* ================= GPU ================= */

fn has_gpu() -> bool {
    Command::new("nvidia-smi")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .is_ok()
}

/* ================= MAIN ================= */

fn main() {

    println!("🚀 Nexus Worker Booting");

    // std::env::set_var("RUST_BACKTRACE", "1");

    let redis_url =
        std::env::var("REDIS_URL")
            .unwrap_or("redis://127.0.0.1:6379".into());

    let client =
        redis::Client::open(redis_url)
            .expect("Redis connect failed");

    let client = Arc::new(client);

    let mut con = client.get_connection().unwrap();

    let workers = calc_workers(&mut con);

    println!("⚙️ Workers: {}", workers);

    let gpu = has_gpu();

    println!("🖥 GPU: {}", gpu);

    /* Spawn workers */
    for i in 0..workers {

        let client = client.clone();
        let gpu = gpu;

        thread::spawn(move || {
            worker_loop(i, client, gpu);
        });
    }

    /* Monitor */
    thread::spawn(|| monitor());

    /* Keep alive */
    loop {
        thread::sleep(Duration::from_secs(60));
    }
}

/* ================= AUTO SCALE ================= */

fn calc_workers(con: &mut redis::Connection) -> usize {

    let cpu = num_cpus::get();

    let queue: i64 =
        con.llen("video_jobs").unwrap_or(0);

    let mut workers = cpu;

    if queue > 10 { workers += 2; }
    if queue > 50 { workers += 4; }
    if queue > 100 { workers += 6; }

    workers.min(16).max(2)
}

/* ================= LOOP ================= */

fn worker_loop(
    id: usize,
    client: Arc<redis::Client>,
    gpu: bool,
) {

    let mut con =
        client.get_connection().unwrap();

    println!("🧵 Worker {} ready", id);

    loop {

        let res: redis::RedisResult<(String,String)> =
            con.brpop("video_jobs", 0.0);

        if let Ok((_, data)) = res {

            let job: Job =
                match serde_json::from_str(&data) {
                    Ok(j) => j,
                    Err(e) => {
                        eprintln!("❌ Bad job {}", e);
                        continue;
                    }
                };

            println!("▶ {} processing", job.id);

            let start = Instant::now();

            let result =
                process_video(&job, gpu);

            let dur =
                start.elapsed().as_secs();

            if dur > 1800 {
                eprintln!("⏱ Timeout {}", job.id);
            }

            if let Err(e) = result {

                eprintln!("❌ {} {}", job.id, e);

                let _: () = con.lpush(
                    "failed_jobs",
                    serde_json::to_string(&job).unwrap()
                ).unwrap();

            } else {

                println!("✅ {}", job.id);

            }
        }
    }
}

/* ================= PIPELINE ================= */

fn process_video(
    job: &Job,
    gpu: bool,
) -> Result<(), String> {

    let base = &job.base;

    let hls = format!("{}/hls", base);
    let thumbs = format!("{}/thumbs", base);
    let preview = format!("{}/preview", base);

    fs::create_dir_all(&hls).ok();
    fs::create_dir_all(&thumbs).ok();
    fs::create_dir_all(&preview).ok();

    if !fs::metadata(&job.input).is_ok() {
        return Err("Missing input".into());
    }

    gen_thumbs(&job.input, &thumbs)?;
    gen_preview(&job.input, &preview)?;

    if gpu {
        gen_hls_gpu(&job.input, &hls)
            .or_else(|_| gen_hls_cpu(&job.input, &hls))?;
    } else {
        gen_hls_cpu(&job.input, &hls)?;
    }

    write_meta(job)?;

    Ok(())
}

/* ================= THUMBS ================= */

fn gen_thumbs(
    input: &str,
    out: &str,
) -> Result<(), String> {

    for s in [1280, 640, 320] {

        let f = format!("{}/{}.webp", out, s);

        if fs::metadata(&f).is_ok() {
            continue;
        }

        let st = Command::new("ffmpeg")
            .args([
                "-y",
                "-i", input,
                "-vf",
                &format!("thumbnail,scale={}:-1", s),
                "-frames:v", "1",
                &f
            ])
            .status()
            .map_err(|e| e.to_string())?;

        if !st.success() {
            return Err("thumb".into());
        }
    }

    Ok(())
}

/* ================= PREVIEW ================= */

fn gen_preview(
    input: &str,
    out: &str,
) -> Result<(), String> {

    let f = format!("{}/preview.mp4", out);

    if fs::metadata(&f).is_ok() {
        return Ok(());
    }

    let mut cmd = Command::new("ffmpeg");

    cmd.args([
        "-y",
        "-ss","0",
        "-t","8",
        "-i", input,
        "-vf","scale=854:-1",
        "-c:v","libx264",
        "-crf","26",
        "-movflags","+faststart",
        &f
    ]);

    run_cmd(cmd)
}

/* ================= HLS ================= */

fn gen_hls_gpu(i:&str,o:&str)->Result<(),String>{
    run_ffmpeg(i,o,true)
}

fn gen_hls_cpu(i:&str,o:&str)->Result<(),String>{
    run_ffmpeg(i,o,false)
}

/* ================= FFMPEG ================= */

fn run_ffmpeg(
    input: &str,
    out: &str,
    gpu: bool,
) -> Result<(), String> {

    let enc = if gpu { "h264_nvenc" } else { "libx264" };
    let preset = if gpu { "p5" } else { "veryfast" };

    let mut cmd = Command::new("ffmpeg");

    cmd.arg("-y");

    if gpu {
        cmd.args([
            "-hwaccel","cuda",
            "-hwaccel_output_format","cuda",
        ]);
    }

    cmd.args([
        "-i", input,

        "-c:v", enc,
        "-preset", preset,
        "-profile:v","main",
        "-b:v","2500k",
        "-maxrate","2800k",
        "-bufsize","5000k",

        "-g","48",
        "-keyint_min","48",
        "-sc_threshold","0",

        "-c:a","aac",
        "-b:a","128k",

        "-hls_time","6",
        "-hls_playlist_type","vod",
        "-hls_flags","independent_segments",

        "-hls_segment_filename",
        &format!("{}/seg_%03d.ts", out),

        "-f","hls",
        &format!("{}/index.m3u8", out),
    ]);

    run_cmd(cmd)
}

/* ================= RUN WITH TIMEOUT ================= */

fn run_cmd(
    mut cmd: Command
) -> Result<(), String> {

    let mut child = cmd.spawn()
        .map_err(|e| e.to_string())?;

    let start = Instant::now();
    let limit = Duration::from_secs(1800);

    loop {

        if let Some(s) = child.try_wait().unwrap() {

            if s.success() {
                return Ok(());
            } else {
                return Err("ffmpeg".into());
            }
        }

        if start.elapsed() > limit {

            child.kill().ok();

            return Err("timeout".into());
        }

        thread::sleep(Duration::from_secs(2));
    }
}

/* ================= META ================= */

fn write_meta(job:&Job)->Result<(),String>{

    let m = format!(r#"{{
"id":"{}",
"preview":true,
"qualities":["auto"]
}}"#, job.id);

    let p = format!("{}/meta.json", job.base);

    fs::write(p, m)
        .map_err(|e| e.to_string())
}

/* ================= MONITOR ================= */

fn monitor(){

    let mut sys = System::new_all();

    loop{

        sys.refresh_all();

        let pid =
            Pid::from(std::process::id() as usize);

        if let Some(p) = sys.process(pid) {

            println!(
                "📊 RAM {}MB | CPU {:.1}%",
                p.memory()/1024,
                p.cpu_usage()
            );
        }

        thread::sleep(Duration::from_secs(60));
    }
}
