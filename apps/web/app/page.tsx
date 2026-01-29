"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import Link from "next/link";
import NextImage from "next/image";

type Video = {
  videoId: string;
  hlsUrl: string;
  title?: string;
  description?: string;
  thumbnailUrl?: string;
};

type QualityLevel = {
  index: number;
  label: string;
};

export default function Home() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  const [levels, setLevels] = useState<QualityLevel[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [usingNativeHls, setUsingNativeHls] = useState(false);

  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const hideControlsTimeout = useRef<NodeJS.Timeout | null>(null);

  const apiBase =
    process.env.NEXT_PUBLIC_API_ENDPOINT ?? "http://localhost:4000";

  /* ---------------- FETCH VIDEOS ---------------- */
  useEffect(() => {
    fetch(`${apiBase}/videos`)
      .then((r) => r.json())
      .then((data: Video[]) => {
        setVideos(data);

        data.forEach((v) => {
          if (v.thumbnailUrl) {
            const img = new window.Image(); // or HTMLImageElement
            img.src = v.thumbnailUrl;
          }
        });
      })
      .catch(console.error);
  }, [apiBase]);

  /* ---------------- HLS PLAYER ---------------- */
  useEffect(() => {
    if (!selectedVideo || !videoRef.current) return;
    const video = videoRef.current;
    const src = selectedVideo.hlsUrl.trim();

    setLevels([]);
    setCurrentLevel(-1);
    setIsPlaying(false);
    setProgress(0);
    setDuration(0);
    setUsingNativeHls(false);

    hlsRef.current?.destroy();
    hlsRef.current = null;

    video.pause();
    video.removeAttribute("src");
    video.load();

    // Native HLS (Safari / iOS)
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      setUsingNativeHls(true);
      video.src = src;
      video.play();
      setIsPlaying(true);
      return;
    }

    // hls.js (Chrome/Firefox/Edge)
    if (!Hls.isSupported()) return;
    setUsingNativeHls(false);

    const hls = new Hls({
      maxBufferLength: 20,
      maxMaxBufferLength: 40,
      backBufferLength: 10,
      startLevel: -1,
      capLevelToPlayerSize: true,
      enableWorker: true,
      lowLatencyMode: false,
    });

    hlsRef.current = hls;
    hls.attachMedia(video);
    hls.loadSource(src);

    hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
      const q = data.levels.map((l, i) => ({
        index: i,
        label: l.height
          ? `${l.height}p (${Math.round(l.bitrate / 1000)} kbps)`
          : `Level ${i}`,
      }));
      setLevels([{ index: -1, label: "Auto" }, ...q]);
      setCurrentLevel(-1);
      video.play();
      setIsPlaying(true);
    });

    hls.on(Hls.Events.LEVEL_SWITCHED, () => {
      setCurrentLevel(hls.currentLevel);
    });

    hls.on(Hls.Events.ERROR, (_, data) => {
      console.error("HLS error", data);
      if (data.fatal) hls.destroy();
    });

    return () => {
      hls.destroy();
      hlsRef.current = null;
    };
  }, [selectedVideo]);

  /* ---------------- VIDEO EVENTS ---------------- */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTime = () => setProgress(video.currentTime);
    const onMeta = () => setDuration(video.duration || 0);

    video.addEventListener("timeupdate", onTime);
    video.addEventListener("loadedmetadata", onMeta);

    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadedmetadata", onMeta);
    };
  }, [selectedVideo]);

  /* ---------------- PAUSE/PLAY NETWORK CONTROL ---------------- */
  useEffect(() => {
    const video = videoRef.current;
    const hls = hlsRef.current;
    if (!video || !hls) return;

    const onPause = () => hls.stopLoad();
    const onPlay = () => hls.startLoad();

    video.addEventListener("pause", onPause);
    video.addEventListener("play", onPlay);

    return () => {
      video.removeEventListener("pause", onPause);
      video.removeEventListener("play", onPlay);
    };
  }, [selectedVideo]);

  /* ---------------- CONTROLS ---------------- */
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    v.paused ? v.play() : v.pause();
    setIsPlaying(!v.paused);
  };

  const seekTo = (t: number) => {
    if (videoRef.current) videoRef.current.currentTime = t;
  };

  const changeQuality = (level: number) => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.currentLevel = level;
    setCurrentLevel(level);
  };

  const toggleFullscreen = () => {
    const el = videoRef.current;
    if (!el) return;

    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (el.requestFullscreen) {
      el.requestFullscreen();
    } else if ((el as any).webkitRequestFullscreen) {
      (el as any).webkitRequestFullscreen();
    }
  };

  const showTempControls = () => {
    setShowControls(true);
    if (hideControlsTimeout.current)
      clearTimeout(hideControlsTimeout.current);
    hideControlsTimeout.current = setTimeout(
      () => setShowControls(false),
      2500
    );
  };

  /* ---------------- UI ---------------- */
  return (
    <div className="min-h-screen bg-black text-white">
      <header className="h-16 px-6 flex items-center justify-between border-b border-white/10">
        <h1 className="text-2xl font-bold text-red-500">Nexus</h1>
        <Link
          href="/upload"
          className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded-md text-sm font-semibold"
        >
          Upload
        </Link>
      </header>

      <main className="p-6">
        {!selectedVideo ? (
          <>
            <h2 className="text-xl font-semibold mb-4">Latest Videos</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {videos.map((v) => (
                <div
                  key={v.videoId}
                  onClick={() => setSelectedVideo(v)}
                  className="cursor-pointer bg-zinc-900 rounded-lg overflow-hidden hover:scale-105 transition"
                >
                  {v.thumbnailUrl ? (
                    <div className="relative h-40 w-full">
                      <NextImage
                        src={v.thumbnailUrl!}
                        alt={v.title ?? v.videoId}
                        fill
                        style={{ objectFit: "cover" }}
                        placeholder="blur"
                        blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVQYV2NkYGBg+M+ABQz0DwAFxwJCPtZ3EwAAAABJRU5ErkJggg=="
                        loading="lazy"
                      />
                    </div>
                  ) : (
                    <div className="h-40 flex items-center justify-center opacity-50">
                      NO THUMB
                    </div>
                  )}
                  <div className="p-2 text-sm truncate">
                    {v.title ?? v.videoId}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div
              className="lg:col-span-3 relative"
              onMouseMove={showTempControls}
              onClick={showTempControls}
            >
              <video
                ref={videoRef}
                className="w-full aspect-video bg-black"
                onClick={togglePlay}
                controls={false}
                playsInline
                preload="metadata"
              />

              {/* CUSTOM CONTROLS */}
              <div
                className={`absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black/80 transition-opacity ${showControls ? "opacity-100" : "opacity-0"
                  }`}
              >
                <input
                  type="range"
                  min={0}
                  max={duration}
                  value={progress}
                  onChange={(e) => seekTo(+e.target.value)}
                  className="w-full mb-2"
                />

                <div className="flex justify-between items-center text-sm">
                  <button onClick={togglePlay}>
                    {isPlaying ? "❚❚" : "►"}
                  </button>

                  {!usingNativeHls && levels.length > 1 && (
                    <select
                      value={currentLevel}
                      onChange={(e) => changeQuality(+e.target.value)}
                      className="bg-black border border-white/20 rounded px-2 py-1 text-xs"
                    >
                      {levels.map((l) => (
                        <option key={l.index} value={l.index}>
                          {l.label}
                        </option>
                      ))}
                    </select>
                  )}

                  <button onClick={toggleFullscreen}>⛶</button>
                </div>
              </div>
            </div>

            <aside className="bg-zinc-900 rounded-xl p-4">
              <h3 className="mb-3 font-semibold">Episodes</h3>
              <ul className="space-y-2 max-h-[60vh] overflow-y-auto">
                {videos.map((v) => (
                  <li
                    key={v.videoId}
                    onClick={() => setSelectedVideo(v)}
                    className={`px-3 py-2 rounded cursor-pointer ${selectedVideo.videoId === v.videoId
                      ? "bg-red-500"
                      : "bg-white/5 hover:bg-white/10"
                      }`}
                  >
                    {v.title ?? v.videoId}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => setSelectedVideo(null)}
                className="mt-4 w-full bg-white/10 py-2 rounded"
              >
                ← Back
              </button>
            </aside>
          </div>
        )}
      </main>
    </div>
  );
}
