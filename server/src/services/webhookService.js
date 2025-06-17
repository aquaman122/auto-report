const axios = require('axios');

class WebhookService {
  constructor() {
    this.webhookUrl = process.env.N8N_WEBHOOK_URL || 'https://byeong98.app.n8n.cloud/webhook-test/ca36a72e-32cf-4e47-93e5-51e07e6be8f6';
    this.retryAttempts = 3;
    this.retryDelay = 2000;
  }

  async sendMeetingReport(meetingData, reportData, analysisData = null) {
    if (!this.webhookUrl) {
      console.log('⚠️ N8N_WEBHOOK_URL이 설정되지 않았습니다. webhook 전송을 건너뜁니다.');
      return { success: false, error: 'webhook URL not configured' };
    }

    const payload = this.createPayload(meetingData, reportData, analysisData);
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await axios.post(this.webhookUrl, payload, {
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Voice-Meeting-Reporter/2.0',
            'X-Custom-Source': 'voice-meeting-reporter'
          },
          timeout: 30000
        });

        console.log('webhook 전송 성공!');
        if (response.data) {
          console.log('📄 응답 데이터:', response.data);
        }
        
        return {
          success: true,
          response: response.data,
          statusCode: response.status,
          webhookUrl: this.webhookUrl
        };

      } catch (error) {
        console.log(`webhook 전송 실패 (시도 ${attempt}/${this.retryAttempts}):`, error.message);
        
        // 에러 상세 정보 출력
        if (error.response) {
          console.log(`HTTP Status: ${error.response.status}`);
          console.log(`Response Data:`, error.response.data);
        }
        
        if (attempt < this.retryAttempts) {
          console.log(`🔄 ${this.retryDelay / 1000}초 후 재시도...`);
          await this.sleep(this.retryDelay);
        } else {
          console.log('모든 재시도 실패. 로컬 저장만 완료됨.');
          return {
            success: false,
            error: error.message,
            lastAttempt: attempt,
            errorDetails: error.response?.data
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

      // 문서 저장 위치 설정
      // parentDocumentId: "d037797d-e1d8-488e-995b-111f6ff85a0d", // front 폴더 저장
      
      // 메타데이터
      metadata: {
        generated_at: new Date().toISOString(),
        processing_time: new Date() - (meetingData.startTime || new Date()),
        system_version: "2.0.0",
        audio_duration: meetingData.audioDuration || "unknown",
        webhook_url: this.webhookUrl
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
  // testcode
  // async testWebhook() {
  //   const testPayload = {
  //     title: "🧪 Webhook 연결 테스트",
  //     date: new Date().toISOString().split('T')[0],
  //     place: "테스트 환경",
  //     content: "이것은 n8n webhook 연결 테스트입니다. 정상적으로 받으셨다면 성공!",
  //     transcription: "테스트 음성 내용입니다.",
  //     summary: "테스트 요약 내용입니다.",
  //     metadata: {
  //       test: true,
  //       timestamp: new Date().toISOString(),
  //       webhook_url: this.webhookUrl,
  //       test_type: "connection_test"
  //     }
  //   };

  //   console.log('🧪 webhook 연결 테스트 중...');
  //   console.log(`🎯 Target: ${this.webhookUrl}`);
    
  //   const result = await this.sendMeetingReport(
  //     testPayload, 
  //     { 
  //       content: testPayload.content, 
  //       filename: "webhook_test.txt",
  //       filePath: "./test/webhook_test.txt"
  //     }
  //   );

  //   if (result.success) {
  //     console.log('테스트 성공! n8n에서 데이터를 받았습니다.');
  //   } else {
  //     console.log('테스트 실패. n8n 설정을 확인해주세요.');
  //   }

  //   return result;
  // }

  async pingWebhook() {
    const pingPayload = {
      type: "ping",
      message: "Hello from Voice Meeting Reporter!",
      timestamp: new Date().toISOString()
    };

    console.log('Ping 테스트 중...');
    
    try {
      const response = await axios.post(this.webhookUrl, pingPayload, {
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'Voice-Meeting-Reporter-Ping/2.0'
        },
        timeout: 10000
      });

      console.log('Ping 성공!', response.status);
      return { success: true, status: response.status, data: response.data };
    } catch (error) {
      console.log('Ping 실패:', error.message);
      return { success: false, error: error.message };
    }
  }
}

module.exports = new WebhookService();