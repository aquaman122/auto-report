const express = require('express');
const router = express.Router();
const audioController = require('../controllers/audioController');
const uploadMiddleware = require('../middleware/upload');

// 단일 파일 업로드 및 처리
router.post('/upload', uploadMiddleware.single('audioFile'), audioController.uploadAndProcess);

// 배치 파일 업로드 및 처리
router.post('/batch', uploadMiddleware.array('audioFiles', 5), audioController.batchProcess);

// 파일 목록 조회
router.get('/files', audioController.getFileList);

// 특정 파일 정보 조회
router.get('/files/:id', audioController.getFileById);

// 처리 상태 조회
router.get('/status/:id', audioController.getProcessingStatus);

// 통계 조회
router.get('/stats', audioController.getStats);

// STT만 수행 (테스트용)
router.post('/transcribe', uploadMiddleware.single('audioFile'), audioController.transcribeOnly);

module.exports = router;