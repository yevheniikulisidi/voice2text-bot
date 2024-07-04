import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OpenaiModule } from '../openai/openai.module';
import { TelegramService } from './telegram.service';

@Module({
  imports: [ConfigModule, OpenaiModule],
  providers: [TelegramService],
})
export class TelegramModule {}
