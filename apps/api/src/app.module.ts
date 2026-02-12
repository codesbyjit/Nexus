import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploadModule } from './upload/upload.module';
import { StorageModule } from './storage/storage.module';
import { VideoModule } from './video/video.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    //   envFilePath: 'Nexus/.env',
      envFilePath: 'apps/api/.env', // if needed in this folder
    }),
    UploadModule,
    StorageModule,
    VideoModule,
  ],
})
export class AppModule {}
