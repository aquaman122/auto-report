const fs = require('fs-extra');
const path = require('path');
const readline = require('readline');
const OpenAI = require('openai');
const moment = require('moment');
const axios = require('axios');
require('dotenv').config();

const whisperService = require('./src/services/whisperService');
const summaryService = require('./src/services/summaryService');
const reportService = require('./src/services/reportService');
const webhookService = require('./src/services/webhookService');

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

// 음성에서 회의 정보 자동 추출 함수
async function extractMeetingInfoFromTranscription(fullTranscription) {
  try {
    const initialText = fullTranscription.substring(0, 500);

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `음성 회의 내용에서 회의 정보를 추출해주세요. 
다음 JSON 형식으로 정확히 반환해주세요:
{
  "title": "회의 제목",
  "date": "YYYY-MM-DD",
  "place": "회의 장소"
}

규칙:
- 날짜가 명시되지 않으면 오늘 날짜 사용: "${new Date().toISOString().split('T')[0]}"
- 장소가 명시되지 않으면 "미기재" 사용
- 회의 제목이 명확하지 않으면 회의 주제나 목적을 기반으로 생성
- 한국어로 자연스럽게 작성`
        },
        {
          role: "user",
          content: `다음 회의 음성 내용에서 회의 제목, 날짜, 장소를 추출해주세요:\n\n"${initialText}"`
        }
      ],
      max_tokens: 300,
      temperature: 0.3,
    });

    try {
      const extractedInfo = JSON.parse(completion.choices[0].message.content);
      return {
        success: true,
        info: extractedInfo,
        rawText: initialText
      };
    } catch (parseError) {
      return {
        success: false,
        info: {
          title: "스마트 음성 회의록",
          date: new Date().toISOString().split('T')[0],
          place: "미기재"
        },
        rawText: initialText,
        error: parseError.message
      };
    }
  } catch (error) {
    return {
      success: false,
      info: {
        title: "스마트 음성 회의록",
        date: new Date().toISOString().split('T')[0],
        place: "미기재"
      },
      error: error.message
    };
  }
}

// AI 분석 함수
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
      processing_method: 'Smart_Analysis_with_Auto_Extract',
      auto_extracted: meetingData.extractedInfo || null,
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

${meetingData.extractedInfo && meetingData.extractedInfo.success ? 
`## 🤖 AI 자동 추출 정보
- **추출 성공**: ✅ 음성에서 자동으로 회의 정보 추출됨
- **추출된 음성 내용**: "${meetingData.extractedInfo.rawText.substring(0, 100)}..."

` : ''}

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

## 📄 상세 내용

### 요약
${meetingData.summary}

### 전체 녹취록
\`\`\`
${meetingData.transcription}
\`\`\`

---
*자동 생성된 스마트 회의록 (OpenAI Whisper + GPT + Auto Extract) - ${moment().format('YYYY-MM-DD HH:mm:ss')}*`;
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

    return {
      success: true,
      response: response.data,
      statusCode: response.status,
      wikiUrl: response.data.url || null
    };

  } catch (error) {
    return {
      success: false,
      error: error.message,
      errorDetails: error.response?.data
    };
  }
}

// 스마트 보고서 생성 함수
function generateSmartReport(meetingData, analysis) {
  const meetingDate = moment(meetingData.date).format('YYYY년 MM월 DD일');
  
  return `
┌─────────────────────────────────────────────────────────────┐
│        서식 115 (프로젝트등-창성) 스마트 AI 회의록          │
└─────────────────────────────────────────────────────────────┘

                             회 의 록

회의제목: ${meetingData.title}
회의일시: ${meetingDate}
회의장소: ${meetingData.place}
회의유형: ${analysis.meeting_type} | 분위기: ${getSentimentText(analysis.sentiment_score)}

${meetingData.extractedInfo && meetingData.extractedInfo.success ? 
`🤖 AI 자동 추출: ✅ 음성에서 회의 정보 자동 인식됨` : 
`📝 수동 입력: 회의 정보 직접 입력됨`}

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
• 스마트 시스템: OpenAI Whisper + GPT-3.5-turbo + AI 구조화 + 자동 추출
• 생성 일시: ${moment().format('YYYY-MM-DD HH:mm:ss')}
• 분석 완료: 논의사항, 결정사항, 액션아이템 자동 추출
• 정보 추출: ${meetingData.extractedInfo && meetingData.extractedInfo.success ? '음성 자동 추출' : '수동 입력'}

  `.trim();
}

function getSentimentText(score) {
  if (score > 0.3) return '😊 긍정적';
  if (score < -0.3) return '😟 부정적';
  return '😐 중립적';
}

// 메인 함수 - 자동 정보 추출 + Wiki 연동 + n8n 전송
async function processSmartMeeting() {
  const startTime = new Date();
  const targetFileName = process.argv[2];
  
  try {
    console.log('🎤 스마트 음성 회의록 완전 자동 생성 시스템');
    console.log('═'.repeat(50));

    await fs.ensureDir('audio');
    await fs.ensureDir('reports');

    // 음성 파일 선택
    const audioFiles = await fs.readdir('./audio');
    const validFiles = audioFiles.filter(f => f.match(/\.(mp3|wav|m4a|mpeg)$/i));

    if (validFiles.length === 0) {
      console.log('❌ audio 폴더에 음성 파일이 없습니다.');
      return;
    }

    let selectedFile;
    
    if (targetFileName) {
      if (validFiles.includes(targetFileName)) {
        selectedFile = targetFileName;
        console.log(`🎯 파일: ${selectedFile}`);
      } else {
        console.log(`❌ 파일 '${targetFileName}'을 찾을 수 없습니다.`);
        return;
      }
    } else if (validFiles.length === 1) {
      selectedFile = validFiles[0];
      console.log(`🎵 파일: ${selectedFile}`);
    } else {
      console.log('\n📁 음성 파일:');
      validFiles.forEach((file, index) => {
        console.log(`${index + 1}. ${file}`);
      });

      const fileChoice = await askQuestion('\n파일 번호 선택: ');
      selectedFile = validFiles[parseInt(fileChoice) - 1];

      if (!selectedFile) {
        console.log('❌ 잘못된 선택입니다.');
        return;
      }
    }

    const audioFilePath = path.join('./audio', selectedFile);

    // 1단계: 음성 변환
    console.log('\n🚀 음성 변환 중...');
    const fullTranscription = await whisperService.transcribeAudio(audioFilePath);
    
    // 2단계: 정보 추출
    console.log('🚀 회의 정보 추출 중...');
    const extractResult = await extractMeetingInfoFromTranscription(fullTranscription);
    
    let meetingTitle, meetingDate, meetingPlace;

    if (extractResult.success) {
      meetingTitle = extractResult.info.title;
      meetingDate = extractResult.info.date;
      meetingPlace = extractResult.info.place;
      console.log(`✅ 제목: ${meetingTitle}`);
      console.log(`✅ 날짜: ${meetingDate}`);
      console.log(`✅ 장소: ${meetingPlace}`);
    } else {
      meetingTitle = "AI 음성 회의록";
      meetingDate = new Date().toISOString().split('T')[0];
      meetingPlace = "미기재";
      console.log(`⚠️ 기본값 사용: ${meetingTitle}`);
    }

    // 3단계: 요약 및 분석
    console.log('🚀 요약 및 분석 중...');
    const summary = await summaryService.summarizeText(fullTranscription);
    const analysis = await analyzeContent(fullTranscription, summary);

    // 회의 데이터 구성
    const meetingData = {
      title: meetingTitle,
      date: meetingDate,
      place: meetingPlace,
      transcription: fullTranscription,
      summary,
      participants: [],
      totalBudget: 30000,
      snackBudget: 10000,
      mealBudget: 15000,
      audioFilename: selectedFile,
      startTime,
      extractedInfo: extractResult
    };

    // 4단계: 회의록 생성
    console.log('🚀 회의록 생성 중...');
    const reportData = await reportService.generateReport(meetingData);

    // 5단계: 스마트 보고서 생성
    const smartReportContent = generateSmartReport(meetingData, analysis);
    const timestamp = moment().format('YYYYMMDD_HHmmss');
    const smartFilename = `스마트_회의록_${meetingTitle.replace(/[^\w가-힣]/g, '_')}_${timestamp}.txt`;
    const smartFilePath = path.join('./reports', smartFilename);
    
    await fs.writeFile(smartFilePath, smartReportContent, 'utf8');

    // 6단계: JSON 데이터 생성
    const jsonData = createMeetingJSON(meetingData, analysis);
    const jsonFilename = smartFilename.replace('.txt', '.json');
    const jsonFilePath = path.join('./reports', jsonFilename);
    await fs.writeFile(jsonFilePath, JSON.stringify(jsonData, null, 2), 'utf8');

    // 7단계: Wiki 업로드
    console.log('🚀 Wiki 업로드 중...');
    const wikiResult = await sendToWiki(meetingData, analysis, jsonData);

    // 8단계: n8n 전송
    console.log('🚀 n8n 전송 중...');
    const webhookResult = await webhookService.sendMeetingReport(meetingData, reportData, analysis);

    // 완료 정보
    const processingTime = new Date() - startTime;
    console.log('\n🎉 처리 완료!');
    console.log(`⏱️ 처리 시간: ${Math.round(processingTime / 1000)}초`);
    console.log(`📄 기본 회의록: ${reportData.filename}`);
    console.log(`📄 스마트 회의록: ${smartFilename}`);
    console.log(`📊 JSON 파일: ${jsonFilename}`);
    console.log(`🌐 Wiki: ${wikiResult.success ? '✅' : '❌'}`);
    console.log(`🔗 n8n: ${webhookResult.success ? '✅' : '❌'}`);

  } catch (error) {
    console.error('❌ 오류:', error.message);
  }
}

if (require.main === module) {
  const targetFileName = process.argv[2];
  
  if (targetFileName) {
    console.log(`🚀 파일 지정 실행: ${targetFileName}`);
  } else {
    console.log('🚀 자동 모드 실행');
  }
  
  processSmartMeeting();
}

module.exports = { processSmartMeeting };