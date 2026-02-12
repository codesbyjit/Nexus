import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { writeFile, rm, mkdir } from 'fs/promises';
import { join } from 'path';
import type { Express } from 'express';
import { StorageService } from '../storage/storage.service';
import { videoQueue } from '../queue/video.queue';

@Injectable()
export class UploadService {
  private readonly BASE_DIR = 'apps/localstorage';

  constructor(private readonly storage: StorageService) { }

  async handleUpload(
    file: Express.Multer.File,
    title: string,
    description: string,
    thumbnailFile?: Express.Multer.File,
  ) {
    const videoId = randomUUID();

    const inputPath = join(this.BASE_DIR, `${videoId}.mp4`);
    const outputDir = join(this.BASE_DIR, 'hls', videoId);

    const thumbPath = join(
      this.BASE_DIR,
      `${videoId}_thumb.jpg`,
    );

    const metaPath = join(
      this.BASE_DIR,
      `${videoId}_meta.json`,
    );

    try {
      // Create folders
      await mkdir(this.BASE_DIR, { recursive: true });
      await mkdir(outputDir, { recursive: true });

      // Save video
      await writeFile(inputPath, file.buffer);

      // Save thumbnail
      if (thumbnailFile) {
        await writeFile(thumbPath, thumbnailFile.buffer);
      } else {
        await this.generateThumbnail(
          inputPath,
          thumbPath,
        );
      }

      // Save meta
      const meta = { title, description };
      await writeFile(metaPath, JSON.stringify(meta));

      // 👉 Push to Redis Queue (NO DIRECT PROCESSING)
      await videoQueue.add('process-video', {
        videoId,
        inputPath,
        outputDir,
        thumbPath,
        metaPath,
      });

      return {
        videoId,
        status: 'queued',
        message: 'Video added to processing queue',
      };
    } catch (err) {
      console.error(err);

      throw new InternalServerErrorException(
        'Upload failed',
      );
    }
  }

  private generateThumbnail(
    input: string,
    output: string,
  ): Promise<void> {
    const { spawn } = require('child_process');

    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', [
        '-y',
        '-i',
        input,
        '-ss',
        '00:00:01',
        '-vframes',
        '1',
        output,
      ]);

      ffmpeg.on('exit', (c) =>
        c === 0 ? resolve() : reject(),
      );
    });
  }
}









// import {
//   Injectable,
//   InternalServerErrorException,
// } from '@nestjs/common';
// import { randomUUID } from 'crypto';
// import { writeFile, rm, mkdir } from 'fs/promises';
// import path, { join } from 'path';
// import { StorageService } from './storage.service';
// import { spawn } from 'child_process';
// import type { Express } from 'express';
// import * as fs from 'fs';

// @Injectable()
// export class UploadService {
//   private readonly BASE_DIR =
//     'apps/localstorage';

//   constructor(private readonly storage: StorageService) {}

//   async handleUpload(
//     file: Express.Multer.File,
//     title: string,
//     description: string,
//     thumbnailFile?: Express.Multer.File,
//   ) {
//     const videoId = randomUUID();

//     const inputPath = join(this.BASE_DIR, `${videoId}.mp4`);
//     const outputDir = join(this.BASE_DIR, 'hls', videoId);
//     const thumbPath = join(this.BASE_DIR, `${videoId}_thumb.jpg`);
//     const metaPath = join(this.BASE_DIR, `${videoId}_meta.json`);

//     try {
//       // ✅ Ensure directories exist
//       await mkdir(this.BASE_DIR, { recursive: true });
//       await mkdir(outputDir, { recursive: true });

//       // ✅ Save uploaded video
//       await writeFile(inputPath, file.buffer);

//       // ✅ Handle thumbnail
//       if (thumbnailFile) {
//         await writeFile(thumbPath, thumbnailFile.buffer);
//       } else {
//         await this.generateThumbnail(inputPath, thumbPath);
//       }

//       // ✅ Save meta.json
//       const meta = { title, description };
//       await writeFile(metaPath, JSON.stringify(meta));

//       // ✅ Run worker to generate HLS
//       await this.runWorker(inputPath, outputDir);

//       // ✅ Upload HLS
//       await this.storage.uploadFolder(outputDir, videoId);

//       // ✅ Upload thumbnail
//       await this.storage.uploadFolder(join(this.BASE_DIR), videoId);

//       // ✅ Upload meta.json
//       await this.storage.uploadFolder(join(this.BASE_DIR), videoId);

//       return {
//         videoId,
//         hlsUrl: this.storage.getPublicUrl(`${videoId}/master.m3u8`),
//         thumbnailUrl: this.storage.getPublicUrl(`${videoId}/${videoId}_thumb.jpg`),
//         metaUrl: this.storage.getPublicUrl(`${videoId}/${videoId}_meta.json`),
//       };
//     } catch (err) {
//       console.error('UploadService error:', err);
//       throw new InternalServerErrorException(
//         'Failed to process video upload',
//       );
//     } finally {
//       // 🧹 Clean up
//       await rm(inputPath, { force: true }).catch(() => {});
//       await rm(outputDir, { recursive: true, force: true }).catch(() => {});
//       await rm(thumbPath, { force: true }).catch(() => {});
//       await rm(metaPath, { force: true }).catch(() => {});
//     }
//   }

//   private runWorker(input: string, output: string): Promise<void> {
//     return new Promise((resolve, reject) => {
//       // const workerPath = process.env.WORKER_BINARY;
//       const workerPath = "src/worker_bin/worker";
//       console.log(workerPath)
//       if (!workerPath) {
//         return reject(new Error('WORKER_BINARY env not set'));
//       }

//       const proc = spawn(workerPath, [input, output], {
//         stdio: 'inherit',
//       });

//       proc.on('error', reject);
//       proc.on('exit', (code) => {
//         code === 0
//           ? resolve()
//           : reject(new Error(`Worker exited with code ${code}`));
//       });
//     });
//   }

//   private generateThumbnail(input: string, output: string): Promise<void> {
//     return new Promise((resolve, reject) => {
//       const ffmpeg = spawn('ffmpeg', [
//         '-y',
//         '-i',
//         input,
//         '-ss',
//         '00:00:01',
//         '-vframes',
//         '1',
//         '-q:v',
//         '2',
//         output,
//       ]);

//       ffmpeg.on('error', reject);
//       ffmpeg.on('exit', (code) => {
//         code === 0 ? resolve() : reject(new Error(`Thumbnail generation failed`));
//       });
//     });
//   }
// }