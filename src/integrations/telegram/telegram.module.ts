import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OpenaiModule } from '../openai/openai.module';
import { TelegramService } from './telegram.service';

@Module({
  imports: [
    HttpModule.register({ baseURL: 'https://api.telegram.org' }),
    ConfigModule,
    OpenaiModule,
  ],
  providers: [TelegramService],
})
export class TelegramModule {}
