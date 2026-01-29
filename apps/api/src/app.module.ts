import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { UploadModule } from './upload.module';
import { StorageModule } from './storage.module';
import { VideoModule } from './video.module';

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
