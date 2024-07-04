import { Module } from '@nestjs/common';
import { OpenaiModule } from './openai/openai.module';
import { TelegramModule } from './telegram/telegram.module';

@Module({
  imports: [OpenaiModule, TelegramModule],
})
export class IntegrationsModule {}
