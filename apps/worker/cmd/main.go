package main

import (
	"log"
	"nexus/worker/internal/ffmpeg"
)

func main() {
	log.Println("Worker started")

	err := ffmpeg.GenerateHLS(
		"data/input.mp4",
		"data/output",
	)

	if err != nil {
		log.Fatal(err)
	}

	log.Println("Job completed")
}
