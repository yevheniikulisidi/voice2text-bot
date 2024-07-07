export interface TelegramFile {
  file_id: string;
  file_unique_id: string;
  file_size: number;
  file_path: string;
}

export interface GetFileResponse {
  ok: boolean;
  result: TelegramFile;
}
