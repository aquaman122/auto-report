const fs = require('fs');
const path = require('path');
const { openai } = require('../config/openai');
const logger = require('../utils/logger');

class OpenAIService {
  constructor() {
    this.maxRetries = 3;
    this.retryDelay = 1000; // 1초
  }

  // 음성을 텍스트로 변환 (Whisper)
  async transcribeAudio(audioFilePath, options = {}) {
    try {
      logger.info(`음성 변환 시작: ${audioFilePath}`);
      
      if (!fs.existsSync(audioFilePath)) {
        throw new Error(`오디오 파일을 찾을 수 없습니다: ${audioFilePath}`);
      }

      const audioFile = fs.createReadStream(audioFilePath);
      
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: 'whisper-1',
        language: options.language || 'ko',
        response_format: 'verbose_json',
        timestamp_granularities: ['word'],
        temperature: 0.1
      });

      logger.info(`음성 변환 완료. 텍스트 길이: ${transcription.text?.length || 0}자`);

      return {
        success: true,
        text: transcription.text,
        language: transcription.language,
        duration: transcription.duration,
        words: transcription.words || [],
        segments: transcription.segments || []
      };

    } catch (error) {
      logger.error('음성 변환 실패:', error);
      throw new Error(`음성 변환 실패: ${error.message}`);
    }
  }

  // 회의 내용 구조화 분석 (GPT-4o)
  async extractMeetingStructure(transcriptionText, options = {}) {
    try {
      logger.info(`회의 내용 구조화 시작. 텍스트 길이: ${transcriptionText.length}자`);

      const systemPrompt = `당신은 한국 기업의 전문적인 회의록 작성 전문가입니다. 
다음 회의 음성 텍스트를 분석하여 구조화된 정보를 정확하게 추출해주세요.

주의사항:
1. 한국어 표현과 비즈니스 용어를 정확히 이해하세요
2. 발언자를 최대한 구분하여 분석하세요
3. 액션 아이템은 구체적인 담당자와 기한을 포함하세요
4. 결정사항과 논의사항을 명확히 구분하세요

응답은 반드시 올바른 JSON 형식으로 제공하세요.`;

      const userPrompt = `다음 회의 텍스트를 분석해주세요:

${transcriptionText}

다음 JSON 형식으로 정보를 정리해주세요:

{
  "meeting_info": {
    "title": "회의 주제/제목 (추론)",
    "estimated_date": "YYYY-MM-DD (오늘 날짜)",
    "estimated_start_time": "HH:MM (추론)",
    "estimated_end_time": "HH:MM (추론)",
    "location": "회의 장소 (언급된 경우)",
    "meeting_type": "정기회의/임시회의/프로젝트회의/기타"
  },
  "participants": [
    {
      "name": "참석자명 (언급된 경우)",
      "department": "소속부서 (추론 가능한 경우)", 
      "role": "역할/직책 (추론 가능한 경우)",
      "speaking_frequency": "high/medium/low",
      "key_contributions": ["주요 발언 내용"]
    }
  ],
  "agendas": [
    {
      "order": 1,
      "title": "안건 제목",
      "discussion": "논의 내용 요약 (2-3문장)",
      "key_points": ["핵심 포인트들"],
      "decisions": "결정된 사항 (구체적으로)",
      "action_items": [
        {
          "task": "구체적인 할 일",
          "assignee": "담당자 (언급된 경우)",
          "deadline": "YYYY-MM-DD (언급된 경우)",
          "priority": "high/medium/low"
        }
      ]
    }
  ],
  "key_outcomes": {
    "main_decisions": ["주요 결정사항들"],
    "unresolved_issues": ["미해결 이슈들"],
    "next_meeting_items": ["다음 회의 안건"],
    "overall_sentiment": "positive/neutral/negative",
    "meeting_effectiveness": "high/medium/low"
  },
  "analysis_metadata": {
    "confidence_score": 0.85,
    "processing_notes": "분석 과정에서의 특이사항",
    "potential_improvements": ["회의 진행 개선점"]
  }
}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 4000,
        response_format: { type: 'json_object' }
      });

      const result = JSON.parse(completion.choices[0].message.content);
      
      logger.info('회의 내용 구조화 완료');

      return {
        success: true,
        structured_data: result,
        usage: completion.usage,
        model: 'gpt-4o'
      };

    } catch (error) {
      logger.error('회의 내용 구조화 실패:', error);
      throw new Error(`회의 내용 구조화 실패: ${error.message}`);
    }
  }

  // 회의록 문서 생성 (GPT-4o)
  async generateMeetingMinutes(structuredData, options = {}) {
    try {
      logger.info('회의록 문서 생성 시작');

      const today = new Date().toLocaleDateString('ko-KR');
      const meetingInfo = structuredData.meeting_info;
      
      const systemPrompt = `당신은 한국 기업의 공식 회의록 작성 전문가입니다.
구조화된 회의 정보를 바탕으로 전문적이고 공식적인 회의록을 작성해주세요.

작성 원칙:
1. 공식적이고 정중한 언어 사용
2. 명확하고 간결한 표현
3. 액션 아이템은 구체적으로 명시
4. 한국 기업 문화에 맞는 형식`;

      const userPrompt = `다음 구조화된 회의 정보를 바탕으로 공식 회의록을 작성해주세요:

${JSON.stringify(structuredData, null, 2)}

다음 형식으로 작성해주세요:

==============================================
            ${meetingInfo.title || '회의록'}
==============================================

■ 회의 개요
  - 회의 주제: ${meetingInfo.title || '(제목 없음)'}
  - 일시: ${meetingInfo.estimated_date || today} ${meetingInfo.estimated_start_time || ''}${meetingInfo.estimated_end_time ? '~' + meetingInfo.estimated_end_time : ''}
  - 장소: ${meetingInfo.location || '(장소 미기재)'}
  - 회의 유형: ${meetingInfo.meeting_type || '일반회의'}

■ 참석자
${structuredData.participants.map(p => `  - ${p.name}${p.department ? ' (' + p.department + ')' : ''}${p.role ? ' ' + p.role : ''}`).join('\n')}

■ 회의 내용
${structuredData.agendas.map((agenda, index) => `
${index + 1}. ${agenda.title}
   논의내용: ${agenda.discussion}
   주요포인트: ${agenda.key_points.join(', ')}
   결정사항: ${agenda.decisions || '없음'}
   ${agenda.action_items.length > 0 ? `액션아이템:
   ${agenda.action_items.map(item => `   - ${item.task}${item.assignee ? ' (담당: ' + item.assignee + ')' : ''}${item.deadline ? ' [기한: ' + item.deadline + ']' : ''}`).join('\n')}` : ''}`).join('\n')}

■ 주요 결정사항
${structuredData.key_outcomes.main_decisions.map(decision => `  - ${decision}`).join('\n')}

■ 미해결 사항
${structuredData.key_outcomes.unresolved_issues?.length > 0 ? 
  structuredData.key_outcomes.unresolved_issues.map(issue => `  - ${issue}`).join('\n') : 
  '  - 없음'}

■ 다음 회의 안건
${structuredData.key_outcomes.next_meeting_items?.length > 0 ? 
  structuredData.key_outcomes.next_meeting_items.map(item => `  - ${item}`).join('\n') : 
  '  - 추후 결정'}

작성일: ${today}
작성자: AI 자동생성 시스템
==============================================

위 형식으로 완성된 회의록을 작성해주세요.`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 3000
      });

      const meetingMinutes = completion.choices[0].message.content;
      
      logger.info('회의록 문서 생성 완료');

      return {
        success: true,
        meeting_minutes: meetingMinutes,
        usage: completion.usage,
        model: 'gpt-4o'
      };

    } catch (error) {
      logger.error('회의록 문서 생성 실패:', error);
      throw new Error(`회의록 문서 생성 실패: ${error.message}`);
    }
  }

  // 전체 프로세스 실행
  async processAudioToMeetingMinutes(audioFilePath, options = {}) {
    try {
      const startTime = Date.now();
      logger.info(`완전 자동화 프로세스 시작: ${audioFilePath}`);
      
      // 1단계: 음성을 텍스트로 변환
      const transcriptionResult = await this.transcribeAudio(audioFilePath, {
        language: options.language || 'ko'
      });

      if (!transcriptionResult.text || transcriptionResult.text.trim().length === 0) {
        throw new Error('음성에서 텍스트를 추출할 수 없습니다');
      }

      // 2단계: 구조화된 정보 추출
      const structuredResult = await this.extractMeetingStructure(transcriptionResult.text, options);

      // 3단계: 회의록 문서 생성
      const minutesResult = await this.generateMeetingMinutes(structuredResult.structured_data, options);

      const processingTime = Date.now() - startTime;

      // 4단계: 결과 통합
      const finalResult = {
        success: true,
        transcription: transcriptionResult,
        structured_data: structuredResult.structured_data,
        meeting_minutes: minutesResult.meeting_minutes,
        metadata: {
          audio_file: path.basename(audioFilePath),
          processing_time_ms: processingTime,
          processing_time_seconds: Math.round(processingTime / 1000),
          timestamp: new Date().toISOString(),
          model_versions: {
            stt: 'whisper-1',
            analysis: 'gpt-4o'
          }
        },
        usage: {
          transcription: transcriptionResult.usage || null,
          analysis: structuredResult.usage,
          minutes: minutesResult.usage
        }
      };

      logger.info(`완전 자동화 프로세스 완료 (${Math.round(processingTime / 1000)}초)`);

      return finalResult;

    } catch (error) {
      logger.error('완전 자동화 프로세스 실패:', error);
      throw error;
    }
  }
}

module.exports = new OpenAIService();