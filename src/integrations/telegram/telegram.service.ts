import { hydrateFiles } from '@grammyjs/files';
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { unlink } from 'fs/promises';
import { Bot, ApiClientOptions } from 'grammy';
import { tmpdir } from 'os';
import { join, basename, extname } from 'path';
import ffmpeg from 'fluent-ffmpeg';
import { OpenaiService } from '../openai/openai.service';
import { MyContext } from './types/my-context.type';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private readonly bot: Bot<MyContext>;
  private readonly environment: 'prod' | 'test';

  constructor(
    private readonly configService: ConfigService,
    private readonly openaiService: OpenaiService,
  ) {
    const token = this.configService.getOrThrow<string>('TELEGRAM_BOT_TOKEN');
    this.environment =
      this.configService.get<string>('NODE_ENV') === 'production'
        ? 'prod'
        : 'test';

    const clientOptions: ApiClientOptions = { environment: this.environment };
    this.bot = new Bot<MyContext>(token, { client: clientOptions });
  }

  onModuleInit() {
    this.bot.api.config.use(
      hydrateFiles(this.bot.token, { environment: this.environment }),
    );

    this.onStartCommand();
    this.onVoiceToText();

    this.bot.start({
      allowed_updates: ['message'],
      drop_pending_updates: true,
    });
  }

  private onStartCommand() {
    this.bot.chatType('private').command('start', async (ctx) => {
      await ctx.reply(
        'Hello! 👋' +
          "\n\nWelcome to the Voice-to-Text Bot. I can help you transcribe your voice messages quickly and accurately. Here's how you can make the most of my features:" +
          "\n\n<b>Direct Transcription:</b> Send me a voice message directly, and I'll transcribe it to text for you." +
          '\n\nEnjoy using the Voice-to-Text Bot!',
        { parse_mode: 'HTML' },
      );
    });
  }

  private onVoiceToText() {
    this.bot.chatType('private').on('message:voice', async (ctx) => {
      try {
        const maxVoiceFileSize = 25 * 1024 * 1024; // 25 MB in bytes
        const voiceFileSize = ctx.message.voice?.file_size ?? 0;

        if (voiceFileSize > maxVoiceFileSize) {
          await ctx.reply('⚠️ Voice message is too large (over 25 MB).', {
            reply_to_message_id: ctx.message.message_id,
          });
          return;
        }

        const processingMessage = await ctx.reply(
          'Processing your voice message...',
          {
            reply_to_message_id: ctx.message.message_id,
          },
        );

        const voiceFile = await ctx.getFile();
        const voiceFilePath = await voiceFile.download(
          join(tmpdir(), `${voiceFile.file_unique_id}`),
        );

        const convertedVoiceFilePath = join(
          tmpdir(),
          `${basename(voiceFilePath, extname(voiceFilePath))}.ogg`,
        );

        await new Promise((resolve, reject) => {
          ffmpeg(voiceFilePath)
            .toFormat('ogg')
            .on('end', resolve)
            .on('error', reject)
            .save(convertedVoiceFilePath);
        });

        const audioTranscription = await this.openaiService.audioTranscription(
          convertedVoiceFilePath,
        );

        await Promise.all([
          unlink(voiceFilePath),
          unlink(convertedVoiceFilePath),
        ]);

        await ctx.api.editMessageText(
          ctx.from.id,
          processingMessage.message_id,
          audioTranscription.text,
        );
      } catch (error) {
        this.logger.error('Error processing voice message:', error);
        await ctx.reply(
          '⚠️ An error occurred while processing the voice message.',
          {
            reply_to_message_id: ctx.message.message_id,
          },
        );
      }
    });
  }
}
