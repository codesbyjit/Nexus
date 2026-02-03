import {
  Controller,
  Post,
  UploadedFiles,
  UseInterceptors,
  Body,
  BadRequestException,
} from '@nestjs/common';

import {
  AnyFilesInterceptor,
} from '@nestjs/platform-express';

import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';

import { UploadService } from './upload.service';

@Controller('upload')
export class UploadController {

  constructor(
    private readonly uploadService: UploadService,
  ) {}

  @Post()
  @UseInterceptors(
    AnyFilesInterceptor({
      storage: diskStorage({

        destination: (req, file, cb) => {
          const tmp = '/tmp/uploads';

          fs.mkdirSync(tmp, {
            recursive: true,
          });

          cb(null, tmp);
        },

        filename: (req, file, cb) => {
          const ext = path.extname(file.originalname);

          cb(
            null,
            Date.now() + '-' + Math.random() + ext
          );
        },
      }),

      limits: {
        fileSize: 5 * 1024 * 1024 * 1024, // 5GB
      },
    }),
  )
  async upload(
    @UploadedFiles() files: Express.Multer.File[],
    @Body('title') title: string,
    @Body('description') description: string,
  ) {

    if (!files?.length) {
      throw new BadRequestException('No files');
    }

    const video = files.find(
      f => f.fieldname === 'video'
    );

    if (!video) {
      throw new BadRequestException('Video required');
    }

    const thumbnail = files.find(
      f => f.fieldname === 'thumbnail'
    );

    return this.uploadService.handleUpload(
      video,
      title,
      description,
      thumbnail,
    );
  }
}
