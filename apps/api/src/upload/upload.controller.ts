import { Controller, Post, UploadedFiles, UseInterceptors, Body, BadRequestException } from '@nestjs/common';
import { AnyFilesInterceptor } from '@nestjs/platform-express';
import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(AnyFilesInterceptor()) // accept any files
  async upload(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('title') title: string,
    @Body('description') description: string,
  ) {
    // find video file
    const video = files.find(f => f.fieldname === 'video');
    if (!video) throw new BadRequestException('Video file is required');

    // find optional thumbnail
    const thumbnail = files.find(f => f.fieldname === 'thumbnail');

    return this.uploadService.handleUpload(video, title, description, thumbnail);
  }
}