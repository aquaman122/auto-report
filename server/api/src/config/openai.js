const OpenAI = require('openai/index.mjs');
const logger = require('../utils/logger');

if (!process.env.OPENAI_API_KEY) {
  throw new Error('OPENAI_API_KEY 환경변수가 설정되지 않았습니다');
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 120000, // 2분 타임아웃
  maxRetries: 3
});

// OpenAI 연결 상태 확인
const checkOpenAIConnection = async () => {
  try {
    const response = await openai.models.list();
    if (response.data && response.data.length > 0) {
      logger.info('✅ OpenAI API 연결 성공');
      return true;
    }
    return false;
  } catch (error) {
    logger.error('❌ OpenAI API 연결 실패:', error.message);
    return false;
  }
};

module.exports = {
  openai,
  checkOpenAIConnection
};