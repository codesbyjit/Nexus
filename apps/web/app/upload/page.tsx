"use client";

import { useState, useRef } from "react";

export default function UploadPage() {
    const [video, setVideo] = useState<File | null>(null);
    const [thumbnail, setThumbnail] = useState<File | null>(null);
    const [title, setTitle] = useState("");
    const [description, setDescription] = useState("");

    const [progress, setProgress] = useState(0);
    const [status, setStatus] = useState<
        "idle" | "uploading" | "success" | "error"
    >("idle");
    const [message, setMessage] = useState("");

    const videoPreviewRef = useRef<HTMLVideoElement>(null);
    const thumbnailPreviewRef = useRef<HTMLImageElement>(null);

    const upload = () => {
        if (!video || !title) {
            setMessage("Please provide a video and title");
            setStatus("error");
            return;
        }

        const form = new FormData();
        form.append("video", video);
        if (thumbnail) {
            form.append("thumbnail", thumbnail);
        }
        form.append("title", title);
        form.append("description", description);

        const xhr = new XMLHttpRequest();
        xhr.open("POST", "http://localhost:4000/upload");

        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                setProgress(Math.round((e.loaded / e.total) * 100));
            }
        };

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                setStatus("success");
                setMessage("🎉 Video uploaded successfully!");
            } else {
                setStatus("error");
                setMessage(xhr.responseText || "Upload failed");
            }
        };

        xhr.onerror = () => {
            setStatus("error");
            setMessage("Network error during upload");
        };

        setStatus("uploading");
        setProgress(0);
        setMessage("Uploading & processing video...");
        xhr.send(form);
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6 flex justify-center items-start">
            <div className="w-full max-w-2xl space-y-6">
                <h1 className="text-3xl font-bold text-center">Upload Video</h1>

                {/* TITLE */}
                <input
                    className="w-full bg-gray-800 p-3 rounded outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                />

                {/* DESCRIPTION */}
                <textarea
                    className="w-full bg-gray-800 p-3 rounded outline-none h-28 focus:ring-2 focus:ring-red-500"
                    placeholder="Description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                />

                {/* VIDEO UPLOAD */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium">Video file *</label>
                    <input
                        type="file"
                        accept="video/*"
                        onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setVideo(file);
                            if (file && videoPreviewRef.current) {
                                videoPreviewRef.current.src = URL.createObjectURL(file);
                            }
                        }}
                    />
                    {video && (
                        <video
                            ref={videoPreviewRef}
                            className="mt-2 w-full rounded"
                            controls
                        />
                    )}
                </div>

                {/* THUMBNAIL UPLOAD */}
                <div className="space-y-2">
                    <label className="block text-sm font-medium">Thumbnail</label>
                    <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            setThumbnail(file);
                            if (file && thumbnailPreviewRef.current) {
                                thumbnailPreviewRef.current.src = URL.createObjectURL(file);
                            }
                        }}
                    />
                    {thumbnail && (
                        <img
                            ref={thumbnailPreviewRef}
                            className="mt-2 w-48 h-28 object-cover rounded border border-gray-700"
                            alt="Thumbnail preview"
                        />
                    )}
                </div>

                {/* PROGRESS BAR */}
                {status === "uploading" && (
                    <div className="space-y-2">
                        <div className="w-full bg-gray-700 h-3 rounded">
                            <div
                                className="h-3 bg-red-500 rounded transition-all"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-sm text-gray-300">Processing… {progress}%</p>
                    </div>
                )}

                {/* MESSAGE */}
                {message && (
                    <p
                        className={`text-sm ${status === "error"
                                ? "text-red-400"
                                : status === "success"
                                    ? "text-green-400"
                                    : "text-gray-300"
                            }`}
                    >
                        {message}
                    </p>
                )}

                {/* UPLOAD BUTTON */}
                <button
                    onClick={upload}
                    disabled={status === "uploading"}
                    className="w-full bg-red-500 hover:bg-red-600 disabled:opacity-50 py-3 rounded font-semibold transition"
                >
                    {status === "uploading" ? "Uploading..." : "Upload"}
                </button>

                {/* SUCCESS CTA */}
                {status === "success" && (
                    <div className="mt-4 p-4 bg-green-500/10 rounded">
                        <p className="text-green-400 text-center">
                            ✅ Your video is live and processing!
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
