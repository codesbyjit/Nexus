"use client";

import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import Link from "next/link";

type Video = {
  videoId: string;
  hlsUrl: string;
  title?: string;
  description?: string;
  thumbnailUrl?: string;
};

type QualityLevel = { index: number; label: string };

export default function Home() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);

  const [levels, setLevels] = useState<QualityLevel[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);

  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<NodeJS.Timeout>();

  /* ---------------- FETCH VIDEOS ---------------- */
  useEffect(() => {
    // fetch("http://localhost:4000/videos")
    fetch("https://api.codesbyjit.site/videos")
      .then((r) => r.json())
      .then(setVideos)
      .catch(console.error);
  }, []);

  /* ---------------- HLS SETUP ---------------- */
  useEffect(() => {
    if (!selectedVideo || !videoRef.current) return;

    const video = videoRef.current;
    const url = selectedVideo.hlsUrl.trim();

    hlsRef.current?.destroy();
    hlsRef.current = null;

    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = url;
      video.play();
      setIsPlaying(true);
      return;
    }

    if (!Hls.isSupported()) return;

    const hls = new Hls({
      enableWorker: true,
      backBufferLength: 60,
    });

    hlsRef.current = hls;
    hls.loadSource(url);
    hls.attachMedia(video);

    hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
      const q = data.levels.map((l, i) => ({
        index: i,
        label: `${l.height}p`,
      }));

      setLevels([{ index: -1, label: "Auto" }, ...q]);
      setCurrentLevel(-1);
      video.play();
      setIsPlaying(true);
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

    const t = () => setProgress(video.currentTime);
    const d = () => setDuration(video.duration || 0);

    video.addEventListener("timeupdate", t);
    video.addEventListener("loadedmetadata", d);

    return () => {
      video.removeEventListener("timeupdate", t);
      video.removeEventListener("loadedmetadata", d);
    };
  }, [selectedVideo]);

  /* ---------------- CONTROLS ---------------- */
  const togglePlay = () => {
    if (!videoRef.current) return;
    videoRef.current.paused ? videoRef.current.play() : videoRef.current.pause();
    setIsPlaying(!isPlaying);
  };

  const changeQuality = (level: number) => {
    if (!hlsRef.current) return;
    hlsRef.current.currentLevel = level;
    setCurrentLevel(level);
  };

  const seekTo = (t: number) => {
    if (videoRef.current) videoRef.current.currentTime = t;
  };

  const showTempControls = () => {
    setShowControls(true);
    clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => setShowControls(false), 3000);
  };

  /* ---------------- UI ---------------- */
  return (
    <div className="min-h-screen bg-black text-white">
      {/* HEADER */}
      <header className="h-16 px-6 flex items-center justify-between border-b border-white/10">
        <h1 className="text-2xl font-bold text-red-500">Nexus</h1>
        <Link
          href="/upload"
          className="bg-red-500 hover:bg-red-600 px-4 py-2 rounded text-sm font-semibold"
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
                  className="cursor-pointer bg-[#111827] rounded-lg overflow-hidden hover:scale-105 transition"
                >
                  {/* THUMBNAIL */}
                  {v.thumbnailUrl ? (
                    <img
                      src={v.thumbnailUrl}
                      alt={v.title || "thumbnail"}
                      className="h-40 w-full object-cover"
                    />
                  ) : (
                    <div className="h-40 bg-linear-to-br from-gray-700 to-gray-900 flex items-center justify-center">
                      <span className="text-sm opacity-70">ANIME</span>
                    </div>
                  )}

                  <div className="p-2">
                    <p className="text-sm font-medium truncate">
                      {v.title || v.videoId}
                    </p>
                    {v.description && (
                      <p className="text-xs opacity-60 truncate">
                        {v.description}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* PLAYER */}
            <div
              className="lg:col-span-3 relative bg-black rounded-lg"
              onMouseMove={showTempControls}
              onMouseLeave={() => setShowControls(false)}
            >
              <video
                ref={videoRef}
                className="w-full rounded-lg"
                onClick={togglePlay}
              />

              {showControls && (
                <div className="absolute bottom-0 left-0 right-0 bg-black/70 px-3 py-2 flex items-center gap-3">
                  <button onClick={togglePlay}>
                    {isPlaying ? "❚❚" : "►"}
                  </button>

                  <input
                    type="range"
                    min={0}
                    max={duration}
                    value={progress}
                    onChange={(e) => seekTo(+e.target.value)}
                    className="flex-1"
                  />

                  <span className="text-xs">
                    {Math.floor(progress / 60)}:
                    {("0" + Math.floor(progress % 60)).slice(-2)}
                  </span>

                  <select
                    value={currentLevel}
                    onChange={(e) => changeQuality(+e.target.value)}
                    className="bg-black text-xs"
                  >
                    {levels.map((l) => (
                      <option key={l.index} value={l.index}>
                        {l.label}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() =>
                      document.fullscreenElement
                        ? document.exitFullscreen()
                        : videoRef.current?.requestFullscreen()
                    }
                  >
                    ⛶
                  </button>
                </div>
              )}
            </div>

            {/* SIDEBAR */}
            <aside className="bg-[#111827] rounded-lg p-4">
              <h3 className="font-semibold mb-3">Episodes</h3>
              <ul className="space-y-2 max-h-100 overflow-y-auto">
                {videos.map((v) => (
                  <li
                    key={v.videoId}
                    onClick={() => setSelectedVideo(v)}
                    className={`cursor-pointer px-3 py-2 rounded text-sm ${
                      selectedVideo.videoId === v.videoId
                        ? "bg-red-500"
                        : "bg-white/5 hover:bg-white/10"
                    }`}
                  >
                    {v.title || v.videoId}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => setSelectedVideo(null)}
                className="mt-4 w-full bg-white/10 hover:bg-white/20 py-2 rounded text-sm"
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
