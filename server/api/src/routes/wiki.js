const express = require('express');
const axios = require('axios');
const multer = require('multer');
const router = express.Router();
const logger = require('../utils/logger');

// 파일 업로드 설정
const upload = multer({ dest: 'uploads/' });

// GitHub Wiki API 클라이언트
const createGitHubClient = () => {
  return axios.create({
    baseURL: process.env.WIKI_BASE_URL,
    headers: {
      'Authorization': `token ${process.env.WIKI_API_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'voice-wiki-automation'
    }
  });
};

// GitHub Wiki 연결 테스트
router.get('/test', async (req, res) => {
  try {
    const client = createGitHubClient();
    const response = await client.get('/user');
    
    res.json({
      success: true,
      message: 'GitHub Wiki 연결 성공',
      user: response.data.login,
      repo: process.env.WIKI_SPACE_KEY
    });
  } catch (error) {
    logger.error('GitHub Wiki 연결 실패:', error.message);
    res.status(500).json({
      success: false,
      message: 'GitHub Wiki 연결 실패',
      error: error.message
    });
  }
});

// 음성 파일로 Wiki 페이지 생성
router.post('/create-from-audio', upload.single('audioFile'), async (req, res) => {
  try {
    const { language = 'ko', wikiSpace } = req.body;
    const audioFile = req.file;

    if (!audioFile) {
      return res.status(400).json({
        success: false,
        message: '음성 파일이 필요합니다'
      });
    }

    // 여기서 기존 음성 처리 API 호출
    // 간단한 테스트를 위해 더미 데이터 사용
    const wikiContent = `
# 테스트 회의록 - ${new Date().toLocaleDateString('ko-KR')}

## 회의 정보
- 날짜: ${new Date().toLocaleDateString('ko-KR')}
- 파일: ${audioFile.originalname}
- 언어: ${language}

## 내용
음성 파일 처리가 완료되었습니다.

*자동 생성된 회의록입니다.*
`;

    // GitHub Wiki 페이지 생성
    const client = createGitHubClient();
    const [owner, repo] = process.env.WIKI_SPACE_KEY.split('/');
    
    const pageTitle = `회의록_${new Date().toISOString().split('T')[0]}_${Date.now()}`;
    
    const wikiResponse = await client.post(`/repos/${owner}/${repo}/pages`, {
      title: pageTitle,
      content: wikiContent,
      format: 'markdown'
    });

    res.json({
      success: true,
      message: 'GitHub Wiki 페이지 생성 완료',
      wiki: {
        title: pageTitle,
        url: wikiResponse.data.html_url,
        pageId: wikiResponse.data.sha
      },
      statistics: {
        processingTimeSeconds: 1,
        participants: 0,
        actionItems: 0
      },
      meeting: {
        id: Date.now()
      }
    });

  } catch (error) {
    logger.error('Wiki 페이지 생성 실패:', error.message);
    res.status(500).json({
      success: false,
      message: 'Wiki 페이지 생성 실패',
      error: error.message
    });
  }
});

module.exports = router;