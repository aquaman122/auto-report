const axios = require('axios');

class WebhookService {
  constructor() {
    this.webhookUrl = process.env.N8N_WEBHOOK_URL;
    this.retryAttempts = 3;
    this.retryDelay = 2000; // 2초
  }

  async sendMeetingReport(meetingData, reportData, analysisData = null) {
    if (!this.webhookUrl) {
      console.log('⚠️ N8N_WEBHOOK_URL이 설정되지 않았습니다. webhook 전송을 건너뜁니다.');
      return { success: false, error: 'webhook URL not configured' };
    }

    const payload = this.createPayload(meetingData, reportData, analysisData);
    
    console.log('n8n webhook으로 데이터 전송 중...');
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await axios.post(this.webhookUrl, payload, {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Voice-Meeting-Reporter/2.0'
          },
          timeout: 30000 // 30초 타임아웃
        });

        console.log('webhook 전송 성공!');
        console.log(`응답 상태: ${response.status}`);
        
        return {
          success: true,
          response: response.data,
          statusCode: response.status
        };

      } catch (error) {
        console.log(`webhook 전송 실패 (시도 ${attempt}/${this.retryAttempts}):`, error.message);
        
        if (attempt < this.retryAttempts) {
          console.log(`🔄 ${this.retryDelay / 1000}초 후 재시도...`);
          await this.sleep(this.retryDelay);
        } else {
          console.log('모든 재시도 실패. 로컬 저장만 완료됨.');
          return {
            success: false,
            error: error.message,
            lastAttempt: attempt
          };
        }
      }
    }
  }

  createPayload(meetingData, reportData, analysisData) {
    const basePayload = {
      // 기본 회의 정보
      title: meetingData.title,
      date: meetingData.date,
      place: meetingData.place,
      participants: meetingData.participants || [],
      
      // 파일 정보
      report_filename: reportData.filename,
      report_filepath: reportData.filePath,
      audio_filename: meetingData.audioFilename,
      
      // 회의록 내용
      content: reportData.content,
      transcription: meetingData.transcription,
      summary: meetingData.summary,
      
      // 메타데이터
      metadata: {
        generated_at: new Date().toISOString(),
        processing_time: new Date() - (meetingData.startTime || new Date()),
        system_version: "2.0.0",
        audio_duration: meetingData.audioDuration || "unknown"
      }
    };

    // AI 분석 데이터가 있으면 추가
    if (analysisData) {
      basePayload.structured_data = {
        main_topics: analysisData.main_topics || [],
        decisions: analysisData.decisions || [],
        action_items: analysisData.action_items || [],
        next_meeting_items: analysisData.next_meeting_items || [],
        keywords: analysisData.keywords || [],
        meeting_type: analysisData.meeting_type || "일반회의",
        sentiment_score: analysisData.sentiment_score || 0.0,
        participants_mentioned: analysisData.participants_mentioned || []
      };
    }

    return basePayload;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // 테스트용 메서드
  async testWebhook() {
    const testPayload = {
      title: "테스트 회의록",
      date: new Date().toISOString().split('T')[0],
      place: "테스트 장소",
      content: "이것은 webhook 연결 테스트입니다.",
      metadata: {
        test: true,
        timestamp: new Date().toISOString()
      }
    };

    console.log('webhook 연결 테스트 중...');
    return await this.sendMeetingReport(testPayload, { content: testPayload.content, filename: "test.txt" });
  }
}

module.exports = new WebhookService();
