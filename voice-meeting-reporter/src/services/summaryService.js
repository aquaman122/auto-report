const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

class SummaryService {
  async summarizeText(text) {
    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `당신은 전문 회의록 작성자입니다. 주어진 회의 내용을 한국 기업 표준 회의록 형식으로 정리해주세요:

🔹 주요 논의사항
- 핵심 안건 3-5개 항목으로 정리
- 각 안건별 논의 내용 요약

🔹 결정사항  
- 구체적으로 결정된 내용
- 결정 배경과 근거

🔹 액션 아이템
- 후속 조치사항
- 담당자 및 완료 일정 (언급된 경우)

🔹 기타 특이사항
- 추가 논의 필요 사항
- 다음 회의 안건

명확하고 간결하게, 비즈니스 문서 형식으로 작성해주세요.`
          },
          {
            role: "user",
            content: `다음 회의 내용을 정리해주세요:\n\n${text}`
          }
        ],
        max_tokens: 1500,
        temperature: 0.3,
      });

      return completion.choices[0].message.content;
    } catch (error) {
      console.error('요약 API 오류:', error);
      throw new Error(`텍스트 요약 실패: ${error.message}`);
    }
  }
}

module.exports = new SummaryService();