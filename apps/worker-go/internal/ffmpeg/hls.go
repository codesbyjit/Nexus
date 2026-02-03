package ffmpeg

import (
	"bytes"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path/filepath"
)

// GenerateHLS generates HLS + thumbnails
func GenerateHLS(input, outputDir, customThumb string) error {
	// Ensure outputDir exists
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return fmt.Errorf("failed to create output directory: %w", err)
	}

	// ---- 1. Generate HLS ----
	cmd := exec.Command(
		"ffmpeg",
		"-y",
		"-i", input,

		// 1080p
		"-map", "0:v:0", "-map", "0:a:0",
		"-c:v:0", "libx264", "-b:v:0", "5000k", "-s:v:0", "1920x1080",

		// 720p
		"-map", "0:v:0", "-map", "0:a:0",
		"-c:v:1", "libx264", "-b:v:1", "2800k", "-s:v:1", "1280x720",

		// 480p
		"-map", "0:v:0", "-map", "0:a:0",
		"-c:v:2", "libx264", "-b:v:2", "1400k", "-s:v:2", "854x480",

		// 144p
		"-map", "0:v:0", "-map", "0:a:0",
		"-c:v:3", "libx264", "-b:v:3", "100k", "-s:v:3", "256x144",

		// Common encoding
		"-preset", "veryfast",
		"-profile:v", "main",
		"-g", "48",
		"-keyint_min", "48",
		"-sc_threshold", "0",
		"-c:a", "aac",
		"-b:a", "128k",

		// HLS options
		"-hls_time", "2",
		"-hls_playlist_type", "vod",
		"-hls_flags", "independent_segments",

		// Variant streams
		"-var_stream_map",
		"v:0,a:0,name:1080p v:1,a:1,name:720p v:2,a:2,name:480p v:3,a:3,name:144p",

		"-master_pl_name", "master.m3u8",
		"-f", "hls",
		filepath.Join(outputDir, "%v/index.m3u8"),
	)

	var stderr bytes.Buffer
	cmd.Stderr = &stderr

	log.Println("Running FFmpeg HLS generation...")
	if err := cmd.Run(); err != nil {
		log.Println("FFmpeg failed:\n", stderr.String())
		return fmt.Errorf("ffmpeg error: %w", err)
	}

	// ---- 2. Generate Thumbnails ----
	thumbDir := filepath.Join(outputDir, "thumbs")
	if err := os.MkdirAll(thumbDir, 0755); err != nil {
		return err
	}

	if customThumb != "" {
		// Convert custom thumbnail to webp multi-res
		for _, size := range []int{1280, 640, 320} {
			out := filepath.Join(thumbDir, fmt.Sprintf("%d.webp", size))
			cmd := exec.Command("ffmpeg", "-y", "-i", customThumb, "-vf", fmt.Sprintf("scale=%d:-1", size), out)
			if err := cmd.Run(); err != nil {
				return fmt.Errorf("failed to convert custom thumbnail: %w", err)
			}
		}
	} else {
		// Extract from video
		for _, size := range []int{1280, 640, 320} {
			out := filepath.Join(thumbDir, fmt.Sprintf("%d.webp", size))
			cmd := exec.Command("ffmpeg", "-y", "-i", input, "-vf", fmt.Sprintf("thumbnail,scale=%d:-1", size), "-frames:v", "1", out)
			if err := cmd.Run(); err != nil {
				return fmt.Errorf("failed to generate thumbnail: %w", err)
			}
		}
	}

	log.Println("Thumbnails generated successfully")
	return nil
}