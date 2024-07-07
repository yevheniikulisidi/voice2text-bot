import { hydrateFiles } from '@grammyjs/files';
import { HttpService } from '@nestjs/axios';
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { unlink, writeFile } from 'fs/promises';
import { Bot, ApiClientOptions } from 'grammy';
import { tmpdir } from 'os';
import { join, basename, extname } from 'path';
import { firstValueFrom, map } from 'rxjs';
import ffmpeg from 'fluent-ffmpeg';
import { OpenaiService } from '../openai/openai.service';
import {
  TelegramFile,
  GetFileResponse,
} from './interfaces/get-file-response.interface';
import { MyContext } from './types/my-context.type';
import { MAX_VOICE_FILE_SIZE } from './telegram.constants';

@Injectable()
export class TelegramService implements OnModuleInit {
  private readonly logger = new Logger(TelegramService.name);
  private readonly bot: Bot<MyContext>;
  private readonly environment: 'prod' | 'test';

  constructor(
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
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
    this.onVoiceToTextCommand();

    this.bot.start({
      allowed_updates: ['message'],
      drop_pending_updates: true,
    });
  }

  private onStartCommand() {
    this.bot.chatType('private').command('start', async (ctx) => {
      await ctx.reply(
        'Hello! 👋' +
          '\n\nWelcome to the Voice-to-Text Bot. I can help you transcribe your voice messages quickly and accurately.' +
          " Here's how you can make the most of my features:" +
          "\n\n<b>Direct Transcription:</b> Send me a voice message directly, and I'll transcribe it to text for you." +
          '\n<b>Add Me to Your Group (Optional):</b> Invite me to your group, and I can assist everyone with voice message transcriptions.' +
          " Simply reply to any voice message with the command /v2t, and I'll convert it to text." +
          '\n\nEnjoy using the Voice-to-Text Bot!',
        { parse_mode: 'HTML' },
      );
    });
  }

  private onVoiceToText() {
    this.bot.chatType('private').on('message:voice', async (ctx) => {
      const voiceFileSize = ctx.message.voice?.file_size ?? 0;

      if (voiceFileSize > MAX_VOICE_FILE_SIZE) {
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

      try {
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
          ctx.chat.id,
          processingMessage.message_id,
          audioTranscription.text,
        );
      } catch (error) {
        this.logger.error(
          `Error processing voice message in private chat: ${error}`,
        );
        await ctx.api.editMessageText(
          ctx.chat.id,
          processingMessage.message_id,
          '⚠️ An error occurred while processing the voice message.',
        );
      }
    });
  }

  private onVoiceToTextCommand() {
    this.bot.chatType(['group', 'supergroup']).command('v2t', async (ctx) => {
      if (ctx.message?.reply_to_message?.voice) {
        const voiceFileSize =
          ctx.message.reply_to_message.voice?.file_size ?? 0;

        if (voiceFileSize > MAX_VOICE_FILE_SIZE) {
          await ctx.reply('⚠️ Voice message is too large (over 25 MB).', {
            reply_to_message_id: ctx.message.reply_to_message.message_id,
          });
          return;
        }

        const processingMessage = await ctx.reply(
          'Processing your voice message...',
          {
            reply_to_message_id: ctx.message.reply_to_message.message_id,
          },
        );

        try {
          const voiceFile = await firstValueFrom<TelegramFile>(
            this.httpService
              .get<GetFileResponse>(
                `/bot${this.bot.token}${this.environment === 'test' ? '/test' : ''}/getFile`,
                {
                  params: {
                    file_id: ctx.message.reply_to_message.voice.file_id,
                  },
                },
              )
              .pipe(map((response) => response.data.result)),
          );

          const voiceFileResponse = await firstValueFrom(
            this.httpService.get(
              `/file/bot${this.bot.token}${this.environment === 'test' ? '/test' : ''}/${voiceFile.file_path}`,
              { responseType: 'arraybuffer' },
            ),
          );

          const voiceFilePath = join(tmpdir(), `${voiceFile.file_unique_id}`);
          const voiceFileBuffer = Buffer.from(voiceFileResponse.data);

          await writeFile(voiceFilePath, voiceFileBuffer);

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

          const audioTranscription =
            await this.openaiService.audioTranscription(convertedVoiceFilePath);

          await Promise.all([
            unlink(voiceFilePath),
            unlink(convertedVoiceFilePath),
          ]);

          await ctx.api.editMessageText(
            ctx.chat.id,
            processingMessage.message_id,
            audioTranscription.text,
          );
        } catch (error) {
          this.logger.error(
            `Error processing voice message in group chat: ${error}`,
          );
          await ctx.api.editMessageText(
            ctx.chat.id,
            processingMessage.message_id,
            '⚠️ An error occurred while processing the voice message.',
          );
        }
      } else {
        await ctx.reply(
          'ℹ️ Please reply to a voice message with the /v2t command to transcribe it.',
          {
            reply_to_message_id: ctx.message.message_id,
          },
        );
      }
    });
  }
}
