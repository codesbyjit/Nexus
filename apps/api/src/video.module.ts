import { Module } from '@nestjs/common';
import { VideoController } from './video.controller';
import { VideoService } from './video.service';
import { StorageService } from './storage.service';

@Module({
  controllers: [VideoController],
  providers: [VideoService, StorageService],
  exports: [VideoService],
})
export class VideoModule {}