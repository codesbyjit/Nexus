import { Worker } from 'bullmq';
import { redis } from './redis.config';
import { spawn } from 'child_process';
import { StorageService } from '../storage/storage.service';
import { rm } from 'fs/promises';

const storage = new StorageService();

new Worker(
  'video-processing',
  async (job) => {
    console.log("▶ Processing:", job.data.videoId);
    const {
      videoId,
      inputPath,
      outputDir,
      thumbPath,
      metaPath,
    } = job.data;

    // Run HLS Worker
    await runHLS(inputPath, outputDir);

    // Upload HLS
    await storage.uploadFolder(
      outputDir,
      `videos/${videoId}`,
    );

    // Upload video
    await storage.uploadFile(
      inputPath,
      `videos/${videoId}/${videoId}.mp4`,
    );

    // Upload thumb
    await storage.uploadFile(
      thumbPath,
      `videos/${videoId}/${videoId}_thumb.jpg`,
    );

    // Upload meta
    await storage.uploadFile(
      metaPath,
      `videos/${videoId}/${videoId}_meta.json`,
    );

    // Cleanup
    await rm(outputDir, { recursive: true, force: true });
    await rm(inputPath, { force: true });
    await rm(thumbPath, { force: true });
    await rm(metaPath, { force: true });
  },
  {
    connection: redis,
  },
);

function runHLS(
  input: string,
  output: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('src/worker_bin/worker', [
      input,
      output,
    ]);

    proc.on('exit', (c) =>
      c === 0 ? resolve() : reject(),
    );
  });
}