package ffmpeg

import (
	"os/exec"
)

func GenerateHLS(input, outputDir string) error {
	cmd := exec.Command(
		"ffmpeg",
		"-y",
		"-i", input,

		// ---------- 1080p ----------
		"-map", "0:v:0", "-map", "0:a:0",
		"-c:v:0", "libx264",
		"-b:v:0", "5000k",
		"-s:v:0", "1920x1080",

		// ---------- 720p ----------
		"-map", "0:v:0", "-map", "0:a:0",
		"-c:v:1", "libx264",
		"-b:v:1", "2800k",
		"-s:v:1", "1280x720",

		// ---------- 480p ----------
		"-map", "0:v:0", "-map", "0:a:0",
		"-c:v:2", "libx264",
		"-b:v:2", "1400k",
		"-s:v:2", "854x480",

		// ---------- 144p ----------
		"-map", "0:v:0", "-map", "0:a:0",
		"-c:v:2", "libx264",
		"-b:v:2", "100k",
		"-s:v:2", "256x144",

		// common encoding
		"-preset", "veryfast",
		"-profile:v", "main",
		"-g", "48",
		"-keyint_min", "48",
		"-sc_threshold", "0",
		"-c:a", "aac",
		"-b:a", "128k",

		// HLS
		"-hls_time", "2",
		"-hls_playlist_type", "vod",
		"-hls_flags", "independent_segments",

		// VARIANT STREAMS
		"-var_stream_map",
		"v:0,a:0,name:1080p v:1,a:1,name:720p v:2,a:2,name:480p v:3,a:3,name:144p",

		"-master_pl_name", "master.m3u8",
		"-f", "hls",
		outputDir+"/%v/index.m3u8",
	)

	return cmd.Run()
}