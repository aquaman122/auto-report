const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs-extra');
const moment = require('moment');
require('dotenv').config();

const whisperService = require('./src/services/whisperService');
const summaryService = require('./src/services/summaryService');
const smartReportService = require('./src/services/smartReportService');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const audioDir = path.join(__dirname, 'audio');
    fs.ensureDirSync(audioDir);
    cb(null, audioDir);
  },
  filename: function (req, file, cb) {
    const timestamp = moment().format('YYYYMMDD_HHmmss');
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}_${timestamp}${ext}`);
  }
});

const upload = multer({
  storage: storage,
  fileFilter: function (req, file, cb) {
    const allowedExtensions = /\.(m4a|mp3|wav|flac|aac|ogg)$/i;
    const extname = allowedExtensions.test(path.extname(file.originalname));
    
    const allowedMimeTypes = [
      'audio/m4a',
      'audio/mp4',
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/flac',
      'audio/aac',
      'audio/ogg',
      'audio/x-m4a',
      'application/octet-stream'
    ];
    
    const mimetype = allowedMimeTypes.includes(file.mimetype);
    
    if (extname || mimetype) {
      return cb(null, true);
    } else {
      console.log(`파일 거부됨: ${file.originalname} (MIME: ${file.mimetype})`);
      cb(new Error('오디오 파일만 업로드 가능합니다.'));
    }
  },
  limits: {
    fileSize: 100 * 1024 * 1024
  }
});

app.post('/api/upload-audio', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '파일이 업로드되지 않았습니다.' });
    }

    const fileInfo = {
      originalName: req.file.originalname,
      filename: req.file.filename,
      path: req.file.path,
      size: req.file.size
    };

    res.json({
      success: true,
      message: '파일이 성공적으로 업로드되었습니다.',
      file: fileInfo
    });

  } catch (error) {
    console.error('파일 업로드 오류:', error);
    res.status(500).json({ error: '파일 업로드 중 오류가 발생했습니다.' });
  }
});

app.post('/api/process-audio', async (req, res) => {
  try {
    const { filename } = req.body;
    
    if (!filename) {
      return res.status(400).json({ error: '파일명이 필요합니다.' });
    }

    const audioPath = path.join(__dirname, 'audio', filename);
    
    if (!fs.existsSync(audioPath)) {
      return res.status(404).json({ error: '파일을 찾을 수 없습니다.' });
    }

    res.json({
      success: true,
      message: '음성 처리가 시작되었습니다.',
      filename: filename
    });

    processAudioFile(audioPath, filename);

  } catch (error) {
    console.error('음성 처리 오류:', error);
    res.status(500).json({ error: '음성 처리 중 오류가 발생했습니다.' });
  }
});

app.get('/api/status/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const reportsDir = path.join(__dirname, 'reports');
    
    const jsonFile = path.join(reportsDir, `${filename}.json`);
    const txtFile = path.join(reportsDir, `${filename}.txt`);
    
    if (fs.existsSync(jsonFile) && fs.existsSync(txtFile)) {
      const jsonData = await fs.readJson(jsonFile);
      const txtData = await fs.readFile(txtFile, 'utf8');
      
      res.json({
        success: true,
        status: 'completed',
        data: {
          json: jsonData,
          text: txtData
        }
      });
    } else {
      res.json({
        success: true,
        status: 'processing'
      });
    }

  } catch (error) {
    console.error('상태 확인 오류:', error);
    res.status(500).json({ error: '상태 확인 중 오류가 발생했습니다.' });
  }
});

app.get('/api/audio-files', async (req, res) => {
  try {
    const audioDir = path.join(__dirname, 'audio');
    const files = await fs.readdir(audioDir);
    
    const audioFiles = files
      .filter(file => /\.(m4a|mp3|wav|flac|aac|ogg)$/i.test(file))
      .map(file => {
        const stats = fs.statSync(path.join(audioDir, file));
        return {
          filename: file,
          size: stats.size,
          uploadDate: stats.mtime,
          path: path.join(audioDir, file)
        };
      })
      .sort((a, b) => b.uploadDate - a.uploadDate);

    res.json({
      success: true,
      files: audioFiles
    });

  } catch (error) {
    console.error('파일 목록 조회 오류:', error);
    res.status(500).json({ error: '파일 목록 조회 중 오류가 발생했습니다.' });
  }
});

async function processAudioFile(audioPath, filename) {
  try {
    const transcription = await whisperService.transcribeAudio(audioPath);
    const summary = await summaryService.summarizeText(transcription);
    
    const smartReport = await smartReportService.generateSmartReport({
      transcription,
      summary,
      audioFilename: filename
    });
    
    
  } catch (error) {
    console.error(`음성 파일 처리 오류 (${filename}):`, error);
  }
}

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버가 포트 ${PORT}에서 실행 중입니다.`);
  console.log(`API 엔드포인트:`);
  console.log(`- POST /api/upload-audio: 음성 파일 업로드`);
  console.log(`- POST /api/process-audio: 음성 파일 처리`);
  console.log(`- GET /api/status/:filename: 처리 상태 확인`);
  console.log(`- GET /api/audio-files: 업로드된 파일 목록`);
}); 