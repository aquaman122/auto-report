const logger = require('../utils/logger');

const errorHandler = (error, req, res, next) => {
  let statusCode = 500;
  let message = '내부 서버 오류가 발생했습니다';
  
  // 에러 타입별 처리
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = '입력 데이터 검증 실패';
  } else if (error.name === 'UnauthorizedError') {
    statusCode = 401;
    message = '인증이 필요합니다';
  } else if (error.name === 'ForbiddenError') {
    statusCode = 403;
    message = '접근 권한이 없습니다';
  } else if (error.name === 'NotFoundError') {
    statusCode = 404;
    message = '요청한 리소스를 찾을 수 없습니다';
  } else if (error.message) {
    message = error.message;
  }

  // 에러 로깅
  logger.error('API Error:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent')
  });

  // 에러 응답
  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { 
        stack: error.stack,
        details: error 
      })
    },
    timestamp: new Date().toISOString(),
    path: req.path
  });
};

module.exports = errorHandler;