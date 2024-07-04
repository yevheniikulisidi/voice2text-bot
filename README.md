# Voice-to-Text Bot 🎤

This Telegram bot allows you to transcribe voice messages quickly and accurately using OpenAI's speech-to-text technology.

## Main Features:

- **Direct Transcription**: Send a voice message directly to the bot, and it will transcribe it to text.

This bot simplifies the process of converting voice messages to text, making communication more efficient and accessible.

## Usage

### Prerequisites

To run this bot, you need to have Docker installed. You can download Docker from the [official website](https://www.docker.com/get-started).

**Run the Docker container**:

- Pull and run the Docker image:
  ```bash
  docker run --name voice2text-bot -e TELEGRAM_BOT_TOKEN=your-telegram-bot-token -e OPENAI_API_KEY=your-openai-api-key -d ykulisidi/voice2textbot
  ```

## Development

### Prerequisites

You need to have `ffmpeg` installed for audio processing. Download it from the [official website](https://ffmpeg.org/download.html) or use your OS's package manager.

1. **Clone the repository**:

   ```bash
   git clone https://github.com/yevheniikulisidi/voice2text-bot.git
   cd voice2text-bot
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Configure the environment**:

   - Copy the `.env.example` file to `.env`:

   ```bash
   cp .env.example .env
   ```

   - Fill in the environment variables in the `.env` file.

4. **Run the application**:

   ```bash
   npm run start:dev
   ```
