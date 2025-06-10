const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const logger = require('../utils/logger');

// 업로드 디렉토리 확인/생성
const ensureUploadDir = () => {
  const uploadDir = 'uploads';
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
    logger.info('업로드 디렉토리 생성:', uploadDir);
  }
};

// 파일 저장 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    ensureUploadDir();
    cb(null, 'uploads');
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}_${Date.now()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

// 파일 필터 (오디오 파일만 허용)
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    'audio/mpeg',        // .mp3
    'audio/mp3',         // .mp3
    'audio/wav',         // .wav
    'audio/wave',        // .wav
    'audio/x-wav',       // .wav
    'audio/m4a',         // .m4a
    'audio/mp4',         // .m4a
    'audio/aac',         // .aac
    'audio/ogg',         // .ogg
    'audio/webm',        // .webm
    'audio/flac',        // .flac
    'video/mp4',         // .mp4 (비디오에서 오디오 추출 가능)
    'video/quicktime'    // .mov
  ];
  
  const allowedExts = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.webm', '.flac', '.mp4', '.mov'];
  const fileExt = path.extname(file.originalname).toLowerCase();
  
  if (allowedMimes.includes(file.mimetype) || allowedExts.includes(fileExt)) {
    cb(null, true);
  } else {
    const error = new Error(`지원하지 않는 파일 형식입니다. 지원 형식: ${allowedExts.join(', ')}`);
    error.code = 'INVALID_FILE_TYPE';
    cb(error, false);
  }
};

// Multer 설정
const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.UPLOAD_MAX_SIZE) || 100 * 1024 * 1024, // 100MB
    files: parseInt(process.env.MAX_FILES_PER_REQUEST) || 5
  },
  fileFilter: fileFilter
});

// 에러 핸들링 미들웨어
const handleUploadError = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({
          success: false,
          error: '파일 크기가 너무 큽니다',
          message: `최대 ${Math.round((parseInt(process.env.UPLOAD_MAX_SIZE) || 100 * 1024 * 1024) / 1024 / 1024)}MB까지 업로드 가능합니다`
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          success: false,
          error: '파일 개수가 너무 많습니다',
          message: `최대 ${process.env.MAX_FILES_PER_REQUEST || 5}개까지 업로드 가능합니다`
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({
          success: false,
          error: '예상하지 못한 파일 필드입니다',
          message: 'audioFile 또는 audioFiles 필드를 사용해주세요'
        });
      default:
        return res.status(400).json({
          success: false,
          error: '파일 업로드 오류',
          message: error.message
        });
    }
  } else if (error && error.code === 'INVALID_FILE_TYPE') {
    return res.status(400).json({
      success: false,
      error: '지원하지 않는 파일 형식',
      message: error.message
    });
  }
  
  next(error);
};

// 업로드 미들웨어에 에러 핸들링 추가
const wrapUpload = (uploadFunction) => {
  return (req, res, next) => {
    uploadFunction(req, res, (error) => {
      if (error) {
        return handleUploadError(error, req, res, next);
      }
      next();
    });
  };
};

module.exports = {
  single: (fieldName) => wrapUpload(upload.single(fieldName)),
  array: (fieldName, maxCount) => wrapUpload(upload.array(fieldName, maxCount)),
  handleUploadError
};