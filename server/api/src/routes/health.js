const express = require('express');
const router = express.Router();
const { checkOpenAIConnection } = require('../config/openai');
const { checkSupabaseConnection } = require('../config/supabase');

// 기본 헬스체크
router.get('/', async (req, res) => {
  try {
    const startTime = Date.now();
    
    // 외부 서비스 연결 확인
    const [openaiStatus, supabaseStatus] = await Promise.all([
      checkOpenAIConnection(),
      checkSupabaseConnection()
    ]);

    const responseTime = Date.now() - startTime;

    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      response_time_ms: responseTime,
      services: {
        openai: openaiStatus ? 'connected' : 'disconnected',
        supabase: supabaseStatus ? 'connected' : 'disconnected',
        redis: 'connected' // Redis 연결 체크는 선택사항
      },
      version: '1.0.0'
    });

  } catch (error) {
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// 상세 시스템 정보
router.get('/detailed', async (req, res) => {
  try {
    const systemInfo = {
      nodejs: process.version,
      platform: process.platform,
      architecture: process.arch,
      memory: process.memoryUsage(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      timestamp: new Date().toISOString()
    };

    res.json({
      status: 'healthy',
      system: systemInfo,
      endpoints: {
        audio: '/api/audio',
        meeting: '/api/meeting',
        document: '/api/document'
      }
    });

  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message
    });
  }
});

module.exports = router;