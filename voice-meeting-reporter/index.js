const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');
require('dotenv').config();

const whisperService = require('./src/services/whisperService');
const summaryService = require('./src/services/summaryService');
const reportService = require('./src/services/reportService');

// 디렉토리 생성
async function ensureDirectories() {
  const directories = ['audio', 'reports', 'src/services', 'src/templates'];
  
  for (const dir of directories) {
    if (!await fs.pathExists(dir)) {
      await fs.ensureDir(dir);
      console.log(`📁 디렉토리 생성: ${dir}`);
    }
  }
}

// 사용자 입력 받기
function askQuestion(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

// 음성 파일 목록 표시
async function showAudioFiles() {
  const audioDir = './audio';
  const files = await fs.readdir(audioDir);
  const audioFiles = files.filter(file => 
    file.match(/\.(mp3|wav|m4a|mpeg)$/i)
  );

  if (audioFiles.length === 0) {
    console.log('\n❌ audio 폴더에 음성 파일이 없습니다.');
    console.log('📁 audio 폴더에 MP3, WAV, M4A 파일을 넣어주세요.\n');
    return null;
  }

  console.log('\n📁 사용 가능한 음성 파일:');
  audioFiles.forEach((file, index) => {
    console.log(`${index + 1}. ${file}`);
  });

  return audioFiles;
}

// 메인 처리 함수
async function processAudioFile() {
  try {
    console.log('🎤 음성 회의록 자동 생성 시스템');
    console.log('═'.repeat(50));

    // 디렉토리 확인
    await ensureDirectories();

    // 음성 파일 선택
    const audioFiles = await showAudioFiles();
    if (!audioFiles) return;

    const fileChoice = await askQuestion('\n📂 처리할 파일 번호를 선택하세요: ');
    const selectedFile = audioFiles[parseInt(fileChoice) - 1];

    if (!selectedFile) {
      console.log('❌ 잘못된 파일 번호입니다.');
      return;
    }

    // 회의 정보 입력
    console.log(`\n✅ 선택된 파일: ${selectedFile}`);
    const meetingTitle = await askQuestion('📋 회의 제목 (Enter: 자동 생성): ');
    const meetingDate = await askQuestion('📅 회의 날짜 (YYYY-MM-DD, Enter: 오늘): ');
    const meetingPlace = await askQuestion('📍 회의 장소 (Enter: 미기재): ');

    const audioFilePath = path.join('./audio', selectedFile);
    
    console.log('\n🚀 처리 시작...');
    console.log('─'.repeat(30));

    // 1. 음성을 텍스트로 변환
    console.log('🎵 Whisper API로 음성 변환 중...');
    const transcription = await whisperService.transcribeAudio(audioFilePath);
    console.log('✅ 음성 변환 완료');

    // 2. 텍스트 요약
    console.log('🤖 GPT로 회의 내용 요약 중...');
    const summary = await summaryService.summarizeText(transcription);
    console.log('✅ 요약 완료');

    // 3. 회의록 생성
    console.log('📄 회의록 보고서 생성 중...');
    const reportData = {
      title: meetingTitle || `${selectedFile.split('.')[0]} 회의록`,
      date: meetingDate || new Date().toISOString().split('T')[0],
      place: meetingPlace || '미기재',
      transcription,
      summary
    };

    const { filename, filePath } = await reportService.generateReport(reportData);
    
    console.log('✅ 회의록 생성 완료');
    console.log('─'.repeat(30));
    console.log(`📁 저장 위치: ${filePath}`);
    console.log(`📝 파일명: ${filename}`);
    console.log('\n🎉 처리가 완료되었습니다!');

  } catch (error) {
    console.error('\n❌ 오류 발생:', error.message);
  }
}

// 실행
if (require.main === module) {
  processAudioFile();
}

module.exports = {
  processAudioFile,
  whisperService,
  summaryService,
  reportService
};