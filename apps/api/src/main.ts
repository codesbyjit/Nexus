// import {} from ''
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import {config} from 'dotenv'

config()

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();

  const port = process.env.PORT || '5000';
  console.log('PORT:', port);
  // console.log('WORKER_BINARY:', process.env.WORKER_BINARY);
  await app.listen(port);
}
bootstrap();
