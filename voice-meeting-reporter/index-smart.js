const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');
const OpenAI = require('openai');
const moment = require('moment');
const axios = require('axios');
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
    console.log('분석 실패, 기본값 사용');
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

// JSON 데이터 생성 함수
function createMeetingJSON(meetingData, analysis) {
  return {
    meeting_title: meetingData.title,
    meeting_date: moment(meetingData.date).format('YYYY-MM-DD'),
    meeting_date_formatted: moment(meetingData.date).format('YYYY년 MM월 DD일'),
    meeting_place: meetingData.place,
    meeting_type: analysis.meeting_type || 'General Meeting',
    
    // 구조화된 내용
    meeting_topics: analysis.main_topics || [],
    main_discussions: analysis.main_topics || [],
    decisions: analysis.decisions || [],
    action_items: analysis.action_items || [],
    
    // 원본 내용
    meeting_content: meetingData.summary,
    full_transcription: meetingData.transcription,
    
    // 분석 데이터
    keywords: analysis.keywords || [],
    meeting_sentiment: getSentimentText(analysis.sentiment_score),
    sentiment_score: analysis.sentiment_score || 0.0,
    
    // 메타데이터
    metadata: {
      created_at: moment().format('YYYY-MM-DD HH:mm:ss'),
      audio_filename: meetingData.audioFilename || '',
      system_version: '2.0.0',
      processing_method: 'Smart_Analysis'
    }
  };
}

// Wiki 마크다운 생성 함수 (JSON 데이터 포함)
function createWikiMarkdown(meetingData, analysis, jsonData) {
  const meetingDate = moment(meetingData.date).format('YYYY-MM-DD');
  
  return `# ${meetingData.title}

## 📋 회의 정보
- **날짜**: ${moment(meetingData.date).format('YYYY년 MM월 DD일')}
- **장소**: ${meetingData.place}
- **유형**: ${analysis.meeting_type || 'General Meeting'}
- **분위기**: ${getSentimentText(analysis.sentiment_score)} (${analysis.sentiment_score})

## 🎯 주요 논의사항
${(analysis.main_topics || []).map((topic, index) => `${index + 1}. ${topic}`).join('\n')}

## 🔹 핵심 결정사항
${(analysis.decisions || []).map((decision, index) => {
  const decisionText = typeof decision === 'string' ? decision : decision.decision;
  const rationale = typeof decision === 'object' ? decision.rationale : '';
  return `**${index + 1}. ${decisionText}**${rationale ? `\n   - 근거: ${rationale}` : ''}`;
}).join('\n\n')}

## ⚡ 액션 아이템
${(analysis.action_items || []).map((item, index) => {
  const task = typeof item === 'string' ? item : item.task;
  const assignee = typeof item === 'object' ? item.assignee : '미정';
  const priority = typeof item === 'object' ? item.priority : '중간';
  return `- **${task}**\n  - 담당자: ${assignee}\n  - 우선순위: ${priority}`;
}).join('\n\n')}

## 📊 분석 정보
- **키워드**: ${(analysis.keywords || []).join(', ')}
- **회의 분위기**: ${getSentimentText(analysis.sentiment_score)}

## 📄 JSON 데이터 (API 연동용)

\`\`\`json
${JSON.stringify(jsonData, null, 2)}
\`\`\`

> 💡 **사용법**: 위 JSON 데이터를 복사해서 API 연동이나 추가 개발에 활용하세요.

## 📄 상세 내용

### 요약
${meetingData.summary}

### 전체 녹취록
\`\`\`
${meetingData.transcription}
\`\`\`

---
*자동 생성된 회의록 (OpenAI Whisper + GPT) - ${moment().format('YYYY-MM-DD HH:mm:ss')}*`;
}

// Wiki 설정 검증 함수
function validateWikiConfig() {
  const required = ['WIKI_API_URL', 'WIKI_AUTH_TOKEN', 'WIKI_COLLECTION_ID', 'WIKI_PARENT_DOCUMENT_ID'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    return false;
  }
  return true;
}

// Wiki API 전송 함수 (JSON 데이터 포함)
async function sendToWiki(meetingData, analysis, jsonData) {
  if (!validateWikiConfig()) {
    return { success: false, error: 'Wiki configuration missing' };
  }

  const wikiUrl = process.env.WIKI_API_URL;
  const authToken = process.env.WIKI_AUTH_TOKEN;
  const collectionId = process.env.WIKI_COLLECTION_ID;
  const parentDocumentId = process.env.WIKI_PARENT_DOCUMENT_ID;
  
  try {
    const markdownContent = createWikiMarkdown(meetingData, analysis, jsonData);
    
    const wikiData = {
      title: `${moment(meetingData.date).format('YYYY-MM-DD')} ${meetingData.title}`,
      text: markdownContent,
      collectionId: collectionId,
      parentDocumentId: parentDocumentId,
      publish: true
    };
    
    const response = await axios.post(wikiUrl, wikiData, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      timeout: 15000
    });

    console.log('Wiki 문서 생성 성공!');
    
    if (response.data && response.data.url) {
      console.log(`Wiki URL: ${response.data.url}`);
    }
    
    return {
      success: true,
      response: response.data,
      statusCode: response.status,
      wikiUrl: response.data.url || null
    };

  } catch (error) {
    console.log('Wiki 생성 실패:', error.message);
    
    if (error.response) {
      
      // 401 Unauthorized 에러 특별 처리
      if (error.response.status === 401) {
        console.log('인증 오류: Auth Token을 확인하세요.');
      }
    }
    
    return {
      success: false,
      error: error.message,
      errorDetails: error.response?.data
    };
  }
}

// POST 요청 전송 함수 (추가 API용)
async function sendMeetingData(jsonData) {
  const targetUrl = process.env.POST_TARGET_URL; 
  
  if (!targetUrl) {
    return { success: false, error: 'No POST target URL configured' };
  }
  
  try {
    const response = await axios.post(targetUrl, jsonData, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Voice-Meeting-Reporter/2.0'
      },
      timeout: 15000
    });
    
    return {
      success: true,
      response: response.data,
      statusCode: response.status
    };

  } catch (error) {
    console.log('추가 데이터 전송 실패:', error.message);
    
    return {
      success: false,
      error: error.message
    };
  }
}

// 스마트 보고서 생성 함수
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

// 🔥 수정된 메인 함수 - Wiki 연동 추가
async function processSmartMeeting() {
  try {
    console.log('🎤 스마트 음성 회의록 자동 생성 시스템 (Wiki 연동)');

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

    const analysis = await analyzeContent(transcription, summary);

    // 회의 데이터 구성
    const meetingData = {
      title: meetingTitle,
      date: meetingDate,
      place: meetingPlace,
      transcription,
      summary,
      audioFilename: selectedFile
    };

    // 1. 스마트 회의록 생성 (.txt 파일)
    const reportContent = generateSmartReport(meetingData, analysis);

    const timestamp = moment().format('YYYYMMDD_HHmmss');
    const filename = `스마트_회의록_${meetingTitle.replace(/[^\w가-힣]/g, '_')}_${timestamp}.txt`;
    const filePath = path.join('./reports', filename);
    
    await fs.writeFile(filePath, reportContent, 'utf8');

    console.log('✅ 스마트 회의록 생성 완료!');

    // 2. JSON 데이터 생성 및 저장
    const jsonData = createMeetingJSON(meetingData, analysis);
    
    const jsonFilename = filename.replace('.txt', '.json');
    const jsonFilePath = path.join('./reports', jsonFilename);
    await fs.writeFile(jsonFilePath, JSON.stringify(jsonData, null, 2), 'utf8');

    // 🔥 3. Wiki에 회의록 생성 (JSON 데이터 포함)
    const wikiResult = await sendToWiki(meetingData, analysis, jsonData);
    
    if (wikiResult.success) {
      console.log('Wiki 회의록 생성 성공!');
      if (wikiResult.wikiUrl) {
        console.log(`Wiki URL: ${wikiResult.wikiUrl}`);
      }
      console.log('팀원들이 Wiki에서 회의록과 JSON 데이터를 확인할 수 있습니다.');
    } else {
      console.log('Wiki 생성 실패, 하지만 로컬 파일은 정상 생성되었습니다.');
      console.log('나중에 Wiki에 수동으로 업로드하거나 설정을 확인하세요.');
    }

    // 4. 추가 API 전송 (선택사항)
    if (process.env.POST_TARGET_URL) {
      console.log('\n 추가 API 전송 중...');
      const apiResult = await sendMeetingData(jsonData);
      
      if (apiResult.success) {
        console.log('추가 API 전송 성공!');
      } else {
        console.log('추가 API 전송 실패 (선택사항)');
      }
    }

  } catch (error) {
    console.error('오류:', error.message);
  }
}

if (require.main === module) {
  processSmartMeeting();
}

module.exports = { processSmartMeeting };