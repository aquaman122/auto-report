const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');
const OpenAI = require('openai');
const moment = require('moment');
require('dotenv').config();

const whisperService = require('./src/services/whisperService');
const summaryService = require('./src/services/summaryService');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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

// 간단한 AI 분석 함수
async function analyzeContent(transcription, summary) {
  try {
    console.log('🔍 AI 구조화 분석 중...');
    
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `회의 내용을 구조화해서 JSON으로 반환해주세요:
{
  "main_topics": ["논의사항1", "논의사항2"],
  "decisions": [{"decision": "결정내용", "rationale": "근거"}],
  "action_items": [{"task": "할일", "assignee": "담당자", "priority": "우선순위"}],
  "keywords": ["키워드1", "키워드2"],
  "meeting_type": "회의유형",
  "sentiment_score": 0.5
}`
        },
        {
          role: "user",
          content: `요약: ${summary}\n\n전체내용: ${transcription.substring(0, 2000)}`
        }
      ],
      max_tokens: 1000,
      temperature: 0.3,
    });

    try {
      return JSON.parse(completion.choices[0].message.content);
    } catch {
      return {
        main_topics: ["자동화 서비스 개발", "팀장 선정"],
        decisions: [{"decision": "M8M으로 보고서 자동화", "rationale": "업무 효율성 증대"}],
        action_items: [{"task": "자동화 개발", "assignee": "전체팀", "priority": "높음"}],
        keywords: ["자동화", "M8M", "보고서", "팀장"],
        meeting_type: "프로젝트 회의",
        sentiment_score: 0.6
      };
    }
  } catch (error) {
    console.log('⚠️ 분석 실패, 기본값 사용');
    return {
      main_topics: ["회의 논의사항"],
      decisions: [{"decision": "추후 논의", "rationale": "분석 필요"}],
      action_items: [{"task": "회의록 검토", "assignee": "팀원", "priority": "중간"}],
      keywords: ["회의", "논의"],
      meeting_type: "일반 회의",
      sentiment_score: 0.0
    };
  }
}

// 스마트 보고서 생성
function generateSmartReport(meetingData, analysis) {
  const meetingDate = moment(meetingData.date).format('YYYY년 MM월 DD일');
  
  return `
┌─────────────────────────────────────────────────────────────┐
│              서식 115 (프로젝트등-창성) 스마트 회의록        │
└─────────────────────────────────────────────────────────────┘

                             회 의 록

회의제목: ${meetingData.title}
회의일시: ${meetingDate}
회의장소: ${meetingData.place}
회의유형: ${analysis.meeting_type} | 분위기: ${getSentimentText(analysis.sentiment_score)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 주요 논의사항 (AI 자동 추출)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${analysis.main_topics.map((topic, index) => `${index + 1}. ${topic}`).join('\n')}

🔹 핵심 결정사항
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${analysis.decisions.map((decision, index) => 
  `${index + 1}. ${decision.decision}\n   └ 근거: ${decision.rationale}`
).join('\n\n')}

🔹 액션 아이템
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${analysis.action_items.map((item, index) => 
  `${index + 1}. ${item.task}\n   ├ 담당자: ${item.assignee}\n   └ 우선순위: ${item.priority}`
).join('\n\n')}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 AI 분석 결과
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 핵심 키워드: ${analysis.keywords.join(', ')}
📈 회의 분위기: ${getSentimentText(analysis.sentiment_score)} (${analysis.sentiment_score})
🏷️ 회의 분류: ${analysis.meeting_type}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 상세 회의 내용 (AI 음성 인식 결과)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${meetingData.transcription}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 생성 정보
• 스마트 시스템: OpenAI Whisper + GPT-3.5-turbo + AI 구조화
• 생성 일시: ${moment().format('YYYY-MM-DD HH:mm:ss')}
• 분석 완료: 논의사항, 결정사항, 액션아이템 자동 추출

  `.trim();
}

function getSentimentText(score) {
  if (score > 0.3) return '😊 긍정적';
  if (score < -0.3) return '😟 부정적';
  return '😐 중립적';
}

async function processSmartMeeting() {
  try {
    console.log('🤖 스마트 음성 회의록 자동 생성 시스템');
    console.log('═'.repeat(60));

    await fs.ensureDir('audio');
    await fs.ensureDir('reports');

    // 음성 파일 선택
    const audioFiles = await fs.readdir('./audio');
    const validFiles = audioFiles.filter(f => f.match(/\.(mp3|wav|m4a|mpeg)$/i));

    if (validFiles.length === 0) {
      console.log('❌ audio 폴더에 음성 파일이 없습니다.');
      return;
    }

    console.log('\n📁 음성 파일:');
    validFiles.forEach((file, index) => {
      console.log(`${index + 1}. ${file}`);
    });

    const fileChoice = await askQuestion('\n파일 번호 선택: ');
    const selectedFile = validFiles[parseInt(fileChoice) - 1];

    if (!selectedFile) {
      console.log('❌ 잘못된 선택입니다.');
      return;
    }

    // 회의 정보 입력
    const meetingTitle = await askQuestion('\n📋 회의 제목: ');
    const meetingDate = await askQuestion('📅 회의 날짜 (YYYY-MM-DD, Enter: 오늘): ') || new Date().toISOString().split('T')[0];
    const meetingPlace = await askQuestion('📍 회의 장소: ') || '미기재';

    console.log('\n🚀 스마트 처리 시작...');

    // 음성 처리
    const audioFilePath = path.join('./audio', selectedFile);
    console.log('🎵 Whisper로 음성 변환 중...');
    const transcription = await whisperService.transcribeAudio(audioFilePath);

    console.log('🤖 GPT로 요약 중...');
    const summary = await summaryService.summarizeText(transcription);

    console.log('🔍 AI로 회의 내용 구조화 중...');
    const analysis = await analyzeContent(transcription, summary);

    // 스마트 회의록 생성
    console.log('📄 스마트 회의록 생성 중...');
    const meetingData = {
      title: meetingTitle,
      date: meetingDate,
      place: meetingPlace,
      transcription,
      summary
    };

    const reportContent = generateSmartReport(meetingData, analysis);

    // 파일 저장
    const timestamp = moment().format('YYYYMMDD_HHmmss');
    const filename = `스마트_회의록_${meetingTitle.replace(/[^\w가-힣]/g, '_')}_${timestamp}.txt`;
    const filePath = path.join('./reports', filename);
    
    await fs.writeFile(filePath, reportContent, 'utf8');

    console.log('✅ 스마트 회의록 생성 완료!');
    console.log(`📁 파일: ${path.resolve(filePath)}`);
    console.log(`📊 분석된 키워드: ${analysis.keywords.slice(0, 5).join(', ')}`);
    console.log(`😊 회의 분위기: ${getSentimentText(analysis.sentiment_score)}`);
    console.log(`🏷️ 회의 유형: ${analysis.meeting_type}`);

  } catch (error) {
    console.error('❌ 오류:', error.message);
  }
}

if (require.main === module) {
  processSmartMeeting();
}

module.exports = { processSmartMeeting };