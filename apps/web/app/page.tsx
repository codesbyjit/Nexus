/* eslint-disable react-hooks/exhaustive-deps */
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
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
            const img = new window.Image();
            img.src = v.thumbnailUrl;
          }
        });
      })
      .catch((err) => {
        console.error("Failed to fetch videos:", err);
        setError("Failed to load videos. Please try again later.");
      });
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
    setError(null);
    setIsLoading(true);

    hlsRef.current?.destroy();
    hlsRef.current = null;

    video.pause();
    video.removeAttribute("src");
    video.load();

    // Native HLS (Safari / iOS)
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      setUsingNativeHls(true);
      video.src = src;
      video.play().then(() => {
        setIsPlaying(true);
        setIsLoading(false);
      }).catch((err) => {
        console.error("Native HLS playback error:", err);
        setError("Failed to play video. Please try again.");
        setIsLoading(false);
      });
      return;
    }

    // hls.js (Chrome/Firefox/Edge)
    if (!Hls.isSupported()) {
      setError("Your browser does not support HLS playback.");
      setIsLoading(false);
      return;
    }
    
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
      video.play().then(() => {
        setIsPlaying(true);
        setIsLoading(false);
      }).catch((err) => {
        console.error("HLS playback error:", err);
        setError("Failed to play video. Please try again.");
        setIsLoading(false);
      });
    });

    hls.on(Hls.Events.LEVEL_SWITCHED, () => {
      setCurrentLevel(hls.currentLevel);
    });

    hls.on(Hls.Events.ERROR, (event, data) => {
      console.error("HLS error:", data);
      
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            console.error("Network error - attempting to recover");
            setError("Network error. Attempting to reconnect...");
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.error("Media error - attempting to recover");
            setError("Media error. Attempting to recover...");
            hls.recoverMediaError();
            break;
          default:
            console.error("Fatal error - cannot recover");
            setError("Fatal playback error. Please try another video.");
            hls.destroy();
            setIsLoading(false);
            break;
        }
      } else {
        // Non-fatal errors
        if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
          console.warn("Non-fatal network error");
        }
      }
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
    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);

    video.addEventListener("timeupdate", onTime);
    video.addEventListener("loadedmetadata", onMeta);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("canplay", onCanPlay);

    return () => {
      video.removeEventListener("timeupdate", onTime);
      video.removeEventListener("loadedmetadata", onMeta);
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("canplay", onCanPlay);
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
    if (v.paused) {
      v.play().catch(console.error);
    } else {
      v.pause();
    }
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

  const toggleMute = () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setIsMuted(v.muted);
  };

  const changeVolume = (val: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.volume = val;
    setVolume(val);
    if (val === 0) setIsMuted(true);
    else if (isMuted) setIsMuted(false);
  };

  const showTempControls = () => {
    setShowControls(true);
    if (hideControlsTimeout.current)
      clearTimeout(hideControlsTimeout.current);
    hideControlsTimeout.current = setTimeout(
      () => setShowControls(false),
      3000
    );
  };

  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  /* ---------------- UI ---------------- */
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-black text-white">
      <header className="h-16 px-6 flex items-center justify-between border-b border-white/10 backdrop-blur-sm bg-black/20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-red-500 to-red-400 bg-clip-text text-transparent">
            Nexus
          </h1>
        </div>
        <Link
          href="/upload"
          className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all shadow-lg shadow-red-500/20 hover:shadow-red-500/40"
        >
          + Upload Video
        </Link>
      </header>

      <main className="p-6">
        {error && !selectedVideo && (
          <div className="max-w-2xl mx-auto mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {!selectedVideo ? (
          <>
            <div className="mb-6">
              <h2 className="text-2xl font-bold mb-2">Latest Videos</h2>
              <p className="text-gray-400">Discover amazing content</p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
              {videos.map((v) => (
                <div
                  key={v.videoId}
                  onClick={() => setSelectedVideo(v)}
                  className="group cursor-pointer rounded-xl overflow-hidden hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-2xl hover:shadow-red-500/20"
                >
                  <div className="relative">
                    {v.thumbnailUrl ? (
                      <div className="relative h-40 sm:h-48 w-full bg-gray-800">
                        <NextImage
                          src={v.thumbnailUrl}
                          alt={v.title ?? v.videoId}
                          fill
                          style={{ objectFit: "cover" }}
                          placeholder="blur"
                          blurDataURL="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9AAAAFUlEQVQYV2NkYGBg+M+ABQz0DwAFxwJCPtZ3EwAAAABJRU5ErkJggg=="
                          loading="lazy"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                          <div className="w-14 h-14 bg-red-500/90 rounded-full flex items-center justify-center shadow-xl">
                            <svg className="w-6 h-6 ml-1" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="h-40 sm:h-48 bg-gradient-to-br from-gray-800 to-gray-900 flex items-center justify-center">
                        <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="bg-gradient-to-br from-gray-800 to-gray-900 p-3">
                    <p className="text-sm font-medium line-clamp-2 group-hover:text-red-400 transition-colors">
                      {v.title ?? v.videoId}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div
              className="lg:col-span-3 relative rounded-xl overflow-hidden shadow-2xl"
              onMouseMove={showTempControls}
              onMouseLeave={() => setShowControls(false)}
            >
              <video
                ref={videoRef}
                className="w-full aspect-video bg-black"
                onClick={togglePlay}
                controls={false}
                playsInline
                preload="metadata"
              />

              {/* LOADING SPINNER */}
              {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                  <div className="w-16 h-16 border-4 border-red-500/30 border-t-red-500 rounded-full animate-spin" />
                </div>
              )}

              {/* ERROR MESSAGE */}
              {error && (
                <div className="absolute top-4 left-4 right-4 p-4 bg-red-500/90 backdrop-blur-sm rounded-lg text-white text-sm shadow-xl">
                  {error}
                </div>
              )}

              {/* CUSTOM CONTROLS */}
              <div
                className={`absolute bottom-0 inset-x-0 p-4 bg-gradient-to-t from-black via-black/90 to-transparent transition-opacity duration-300 ${
                  showControls ? "opacity-100" : "opacity-0"
                }`}
              >
                {/* Progress Bar */}
                <div className="mb-4">
                  <input
                    type="range"
                    min={0}
                    max={duration || 0}
                    value={progress}
                    onChange={(e) => seekTo(+e.target.value)}
                    className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-red-500 hover:accent-red-400"
                    style={{
                      background: `linear-gradient(to right, rgb(239, 68, 68) 0%, rgb(239, 68, 68) ${
                        (progress / duration) * 100
                      }%, rgb(75, 85, 99) ${(progress / duration) * 100}%, rgb(75, 85, 99) 100%)`,
                    }}
                  />
                </div>

                <div className="flex justify-between items-center gap-4">
                  <div className="flex items-center gap-3">
                    {/* Play/Pause */}
                    <button
                      onClick={togglePlay}
                      className="w-10 h-10 flex items-center justify-center bg-red-500 hover:bg-red-600 rounded-full transition-colors shadow-lg"
                    >
                      {isPlaying ? (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M8 5v14l11-7z" />
                        </svg>
                      )}
                    </button>

                    {/* Volume */}
                    <div className="flex items-center gap-2 group/volume">
                      <button onClick={toggleMute} className="hover:text-red-400 transition-colors">
                        {isMuted || volume === 0 ? (
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z" />
                          </svg>
                        )}
                      </button>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={isMuted ? 0 : volume}
                        onChange={(e) => changeVolume(+e.target.value)}
                        className="w-0 group-hover/volume:w-20 transition-all duration-300 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-red-500"
                      />
                    </div>

                    {/* Time */}
                    <span className="text-sm tabular-nums">
                      {formatTime(progress)} / {formatTime(duration)}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* Quality Selector */}
                    {!usingNativeHls && levels.length > 1 && (
                      <select
                        value={currentLevel}
                        onChange={(e) => changeQuality(+e.target.value)}
                        className="bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer transition-colors"
                      >
                        {levels.map((l) => (
                          <option key={l.index} value={l.index} className="bg-gray-900">
                            {l.label}
                          </option>
                        ))}
                      </select>
                    )}

                    {/* Fullscreen */}
                    <button
                      onClick={toggleFullscreen}
                      className="hover:text-red-400 transition-colors"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <aside className="bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl p-5 shadow-xl border border-white/5">
              <h3 className="mb-4 font-bold text-lg flex items-center gap-2">
                <svg className="w-5 h-5 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M4 6h16v2H4zm0 5h16v2H4zm0 5h16v2H4z" />
                </svg>
                Playlist
              </h3>
              <ul className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto pr-2 custom-scrollbar">
                {videos.map((v) => (
                  <li
                    key={v.videoId}
                    onClick={() => setSelectedVideo(v)}
                    className={`px-4 py-3 rounded-lg cursor-pointer transition-all ${
                      selectedVideo.videoId === v.videoId
                        ? "bg-gradient-to-r from-red-500 to-red-600 shadow-lg shadow-red-500/30"
                        : "bg-white/5 hover:bg-white/10 hover:scale-105"
                    }`}
                  >
                    <p className="text-sm font-medium line-clamp-2">
                      {v.title ?? v.videoId}
                    </p>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => setSelectedVideo(null)}
                className="mt-5 w-full bg-white/10 hover:bg-white/20 py-3 rounded-lg transition-colors font-medium flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Back to Videos
              </button>
            </aside>
          </div>
        )}
      </main>

      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(239, 68, 68, 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(239, 68, 68, 0.7);
        }
      `}</style>
    </div>
  );
}