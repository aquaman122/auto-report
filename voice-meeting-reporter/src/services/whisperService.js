const OpenAI = require('openai');
const fs = require('fs');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class WhisperService {
  async transcribeAudio(audioFilePath) {
    try {
      if (!fs.existsSync(audioFilePath)) {
        throw new Error(`파일을 찾을 수 없습니다: ${audioFilePath}`);
      }

      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(audioFilePath),
        model: "whisper-1",
        language: "ko",
        response_format: "text"
      });

      return transcription;
    } catch (error) {
      console.error('Whisper API 오류:', error);
      throw new Error(`음성 변환 실패: ${error.message}`);
    }
  }
}

module.exports = new WhisperService();