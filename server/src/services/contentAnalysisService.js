const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class ContentAnalysisService {
  async analyzeAndStructureMeeting(transcription, summary) {
    try {
      
      const completion = await openai.chat.completions.create({
        // 추후에 3.5보다 더 좋은걸로 변경 해봐도 좋을듯
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `당신은 회의 내용 분석 전문가입니다. 주어진 회의 내용을 다음 JSON 형식으로 구조화해주세요:

              {
                "main_topics": ["주요 논의사항1", "주요 논의사항2", ...],
                "decisions": [
                  {"decision": "결정내용", "rationale": "결정근거", "impact": "영향도"}
                ],
                "action_items": [
                  {"task": "할일", "assignee": "담당자", "due_date": "기한", "priority": "우선순위"}
                ],
                "next_meeting_items": ["다음회의안건1", "다음회의안건2", ...],
                "keywords": ["핵심키워드1", "핵심키워드2", ...],
                "meeting_type": "회의유형",
                "sentiment_score": 0.5,
                "participants_mentioned": ["참여자1", "참여자2", ...]
              }

              sentiment_score는 -1(부정적) ~ 1(긍정적) 사이의 값으로 회의 분위기를 평가해주세요.
              한국어로 분석하되, JSON 키는 영어로 유지해주세요.`
          },
          {
            role: "user",
            content: `회의 요약:\n${summary}\n\n전체 내용:\n${transcription}`
          }
        ],
        max_tokens: 2000,
        temperature: 0.3,
      });

      const analysisText = completion.choices[0].message.content;
      
      // JSON 파싱 시도
      try {
        const analysis = JSON.parse(analysisText);
        console.log('회의 내용 구조화 완료');
        return analysis;
      } catch (parseError) {
        console.log('JSON 파싱 실패, 기본 구조 반환');
        return this.createFallbackStructure(summary, transcription);
      }
      
    } catch (error) {
      console.error('회의 분석 오류:', error);
      return this.createFallbackStructure(summary, transcription);
    }
  }

  createFallbackStructure(summary, transcription) {
    // 간단한 키워드 추출
    const keywords = this.extractKeywords(transcription);
    
    return {
      main_topics: ["회의 내용 분석 필요"],
      decisions: [{"decision": "분석 필요", "rationale": "자동 분석 실패", "impact": "수동 검토 필요"}],
      action_items: [{"task": "회의록 검토", "assignee": "팀원", "due_date": "다음 회의", "priority": "중간"}],
      next_meeting_items: ["이전 회의 후속 논의"],
      keywords: keywords,
      meeting_type: "일반회의",
      sentiment_score: 0.0,
      participants_mentioned: []
    };
  }

  extractKeywords(text) {
    // 간단한 키워드 추출 (빈도 기반)
    const words = text.match(/[\w가-힣]{2,}/g) || [];
    const frequency = {};
    
    words.forEach(word => {
      if (word.length > 1 && !this.isStopWord(word)) {
        frequency[word] = (frequency[word] || 0) + 1;
      }
    });

    return Object.entries(frequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);
  }

  isStopWord(word) {
    const stopWords = ['그', '이', '저', '것', '네', '아', '음', '어', '잠시만', '그냥', '좀', '막'];
    return stopWords.includes(word);
  }
}

module.exports = new ContentAnalysisService();