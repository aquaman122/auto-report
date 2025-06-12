const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');
require('dotenv').config();

const whisperService = require('./src/services/whisperService');
const summaryService = require('./src/services/summaryService');
const reportService = require('./src/services/reportService');
const webhookService = require('./src/services/webhookService');

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

async function processAudioFileWithWebhook() {
  const startTime = new Date();
  
  try {
    // 디렉토리 확인
    await fs.ensureDir('audio');
    await fs.ensureDir('reports');

    // 음성 파일 선택
    const audioFiles = await fs.readdir('./audio');
    const validFiles = audioFiles.filter(f => f.match(/\.(mp3|wav|m4a|mpeg)$/i));

    if (validFiles.length === 0) {
      console.log('audio 폴더에 음성 파일이 없습니다.');
      return;
    }

    validFiles.forEach((file, index) => {
      console.log(`${index + 1}. ${file}`);
    });

    const fileChoice = await askQuestion('\n파일 번호 선택: ');
    const selectedFile = validFiles[parseInt(fileChoice) - 1];

    if (!selectedFile) {
      console.log('잘못된 선택입니다.');
      return;
    }

    // 회의 정보 입력
    const meetingTitle = await askQuestion('\n📋 회의 제목: ');
    const meetingDate = await askQuestion('📅 회의 날짜 (YYYY-MM-DD, Enter: 오늘): ') || new Date().toISOString().split('T')[0];
    const meetingPlace = await askQuestion('📍 회의 장소: ') || '미기재';

    // 음성 처리
    const audioFilePath = path.join('./audio', selectedFile);
    const transcription = await whisperService.transcribeAudio(audioFilePath);

    const summary = await summaryService.summarizeText(transcription);

    // 회의록 생성
    const meetingData = {
      title: meetingTitle,
      date: meetingDate,
      place: meetingPlace,
      transcription,
      summary,
      participants: [],
      totalBudget: 30000,
      snackBudget: 10000,
      mealBudget: 15000,
      audioFilename: selectedFile,
      startTime
    };

    const reportData = await reportService.generateReport(meetingData);

    console.log('✅ 로컬 회의록 생성 완료!');

    // 🔥 n8n Webhook으로 JSON 데이터만 전송
    const webhookResult = await webhookService.sendMeetingReport(meetingData, reportData);

    if (webhookResult.success) {
      console.log('n8n webhook 전송 성공!');
      console.log('이제 n8n에서 JSON 데이터를 받아 Wiki 등록 워크플로우가 실행됩니다.');
      if (webhookResult.response) {
        console.log('n8n 응답:', JSON.stringify(webhookResult.response, null, 2));
      }
    } else {
      console.log('webhook 전송은 실패했지만 로컬 파일은 정상 생성되었습니다.');
      console.log('오류:', webhookResult.error);
      if (webhookResult.errorDetails) {
        console.log('상세:', webhookResult.errorDetails);
      }
    }

    // 처리 완료 정보
    const processingTime = new Date() - startTime;
    console.log(`\n 총 처리 시간: ${Math.round(processingTime / 1000)}초`);
    console.log('결과: 로컬 파일 생성 + JSON 데이터 n8n 전송 완료');

  } catch (error) {
    console.error('오류:', error.message);
    console.error('상세:', error.stack);
  }
}

if (require.main === module) {
  processAudioFileWithWebhook();
}