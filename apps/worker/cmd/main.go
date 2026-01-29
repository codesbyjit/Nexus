package main

import (
	"log"
	"os"
	// "path/filepath"

	"nexus/worker/internal/ffmpeg"
)

func main() {
	if len(os.Args) < 3 {
		log.Fatal("usage: worker <inputFilePath> <outputDir>")
	}

	inputPath := os.Args[1]
	outputDir := os.Args[2]

	// check for optional custom thumbnail
	var customThumb string
	if len(os.Args) >= 4 {
		customThumb = os.Args[3]
	}

	log.Println("Starting HLS generation...")
	if err := ffmpeg.GenerateHLS(inputPath, outputDir, customThumb); err != nil {
		log.Fatal(err)
	}

	log.Println("HLS generation completed successfully")
}
