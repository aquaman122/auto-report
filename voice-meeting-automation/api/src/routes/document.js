const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');

// 문서 생성
router.post('/generate', documentController.generateDocument);

// 문서 목록 조회
router.get('/', documentController.getDocumentList);

// 특정 문서 다운로드
router.get('/download/:fileName', documentController.downloadDocument);

// 문서 삭제
router.delete('/:fileName', documentController.deleteDocument);

// 문서 미리보기
router.get('/preview/:fileName', documentController.previewDocument);

// 템플릿 목록
router.get('/templates', documentController.getTemplates);

module.exports = router;