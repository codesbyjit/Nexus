import {
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common';

import { randomUUID } from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import Redis from 'ioredis';

@Injectable()
export class UploadService {

  private readonly BASE_DIR = path.resolve(
    process.env.STORAGE_ROOT || './data/storage'
  );

  private redis: Redis;

  constructor() {
    this.redis = new Redis(
      process.env.REDIS_URL || 'redis://127.0.0.1:6379'
    );
  }

  async handleUpload(
    file: Express.Multer.File,
    title: string,
    description: string,
    thumbnail?: Express.Multer.File,
  ) {

    const id = randomUUID();

    const base = path.join(this.BASE_DIR, id);
    const raw = path.join(base, 'raw');
    const input = path.join(raw, 'source.mp4');

    try {
      await fs.promises.mkdir(raw, {
        recursive: true,
      });

      /* ========== MOVE FILE ========== */

      await fs.promises.rename(
        file.path,
        input,
      );

      /* ========== VERIFY ========== */

      const stat = await fs.promises.stat(input);

      if (!stat.size) {
        throw new Error('Empty file');
      }

      /* ========== JOB ========== */

      const job = {
        id,
        input,
        base,
        title,
        description,
        created_at: Date.now(),
      };

      await this.redis.lpush(
        'video_jobs',
        JSON.stringify(job),
      );

      console.log('📤 Uploaded:', input);

      return {
        id,
        status: 'queued',
      };

    } catch (err) {

      console.error('Upload error:', err);

      throw new InternalServerErrorException(
        'Upload failed',
      );
    }
  }
}
