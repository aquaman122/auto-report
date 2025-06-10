const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
require('dotenv').config();

const logger = require('./utils/logger');
const errorHandler = require('./middleware/errorHandler');

// 서비스 초기화
const { checkOpenAIConnection } = require('./config/openai');
const { checkSupabaseConnection } = require('./config/supabase');
const { checkWikiConnection } = require('./config/wiki');

// 라우트 임포트
const healthRoutes = require('./routes/health');
const wikiRoutes = require('./routes/wiki');

const app = express();
const PORT = process.env.PORT || 3000;

// 보안 미들웨어
app.use(helmet({
  crossOriginEmbedderPolicy: false
}));

// CORS 설정
app.use(cors({
  origin: [
    'http://localhost:5678', 
    'http://n8n.localhost',
    'http://localhost:3000',
    process.env.WIKI_BASE_URL
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 로깅 미들웨어
app.use(morgan('combined', {
  stream: { write: message => logger.info(message.trim()) }
}));

// 바디 파서
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 정적 파일 서빙
app.use('/uploads', express.static('uploads'));
app.use('/summaries', express.static('summaries'));

// API 라우트
app.use('/health', healthRoutes);
app.use('/api/wiki', wikiRoutes);

// 루트 라우트
app.get('/', (req, res) => {
  res.json({
    message: '🎙️ 음성-Wiki 자동화 API',
    version: '1.0.0',
    status: 'running',
    features: ['STT', 'AI Analysis', 'Wiki Integration'],
    endpoints: {
      health: '/health',
      audio: '/api/audio',
      meeting: '/api/meeting',
      wiki: '/api/wiki'
    }
  });
});

// 404 핸들러
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: '요청한 엔드포인트를 찾을 수 없습니다',
    path: req.originalUrl
  });
});

// 에러 핸들러
app.use(errorHandler);

// 서버 시작
const startServer = async () => {
  try {
    // 외부 서비스 연결 확인
    logger.info('🔍 외부 서비스 연결 확인 중...');
    
    const [openaiConnected, supabaseConnected, wikiConnected] = await Promise.all([
      checkOpenAIConnection(),
      checkSupabaseConnection(),
      checkWikiConnection()
    ]);
    
    if (!openaiConnected) {
      logger.warn('⚠️ OpenAI API 연결 실패');
    }
    if (!supabaseConnected) {
      logger.warn('⚠️ Supabase 연결 실패');
    }
    if (!wikiConnected) {
      logger.warn('⚠️ Wiki 연결 실패 - API 토큰을 확인해주세요');
    }
    
    // 서버 시작
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`🚀 Wiki 자동화 API 서버 시작`);
      logger.info(`📊 환경: ${process.env.NODE_ENV}`);
      logger.info(`🌐 포트: ${PORT}`);
      logger.info(`🔗 헬스체크: http://localhost:${PORT}/health`);
      logger.info(`📚 Wiki: ${process.env.WIKI_BASE_URL}`);
    });

    // Graceful shutdown
    process.on('SIGTERM', () => {
      logger.info('SIGTERM 수신, 서버를 안전하게 종료합니다...');
      server.close(() => {
        logger.info('서버가 종료되었습니다');
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('서버 시작 실패:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;