import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream } from 'fs';
import OpenAI from 'openai';

@Injectable()
export class OpenaiService {
  private readonly openai: OpenAI;

  constructor(private readonly configService: ConfigService) {
    const apiKey = this.configService.getOrThrow<string>('OPENAI_API_KEY');
    this.openai = new OpenAI({ apiKey });
  }

  async audioTranscription(audioFilePath: string) {
    return await this.openai.audio.transcriptions.create({
      file: createReadStream(audioFilePath),
      model: 'whisper-1',
      temperature: 0.2,
    });
  }
}
