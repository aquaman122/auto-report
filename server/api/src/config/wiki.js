const axios = require('axios');
const logger = require('../utils/logger');

// Wiki 설정
const wikiConfig = {
  baseURL: process.env.WIKI_BASE_URL,
  apiToken: process.env.WIKI_API_TOKEN,
  spaceKey: process.env.WIKI_SPACE_KEY || 'MEETING_MINUTES',
  username: process.env.WIKI_USERNAME || 'automation-bot',
  timeout: 30000
};

// Wiki 연결 확인
const checkWikiConnection = async () => {
  try {
    if (!wikiConfig.baseURL || !wikiConfig.apiToken) {
      logger.warn('Wiki 설정이 불완전합니다');
      return false;
    }

    const response = await axios.get(`${wikiConfig.baseURL}/api/spaces`, {
      headers: {
        'Authorization': `Bearer ${wikiConfig.apiToken}`,
        'Content-Type': 'application/json'
      },
      timeout: wikiConfig.timeout
    });

    logger.info('✅ Wiki 연결 성공');
    return true;
  } catch (error) {
    logger.error('❌ Wiki 연결 실패:', error.message);
    return false;
  }
};

// Wiki API 클라이언트 생성
const createWikiClient = () => {
  return axios.create({
    baseURL: wikiConfig.baseURL,
    headers: {
      'Authorization': `Bearer ${wikiConfig.apiToken}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    timeout: wikiConfig.timeout
  });
};

module.exports = {
  wikiConfig,
  checkWikiConnection,
  createWikiClient
};