import { Queue } from 'bullmq';
import { redis } from './redis.config';

export const videoQueue = new Queue(
  'video-processing',
  {
    connection: redis,
  },
);