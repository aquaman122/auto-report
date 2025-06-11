require('dotenv').config();
const webhookService = require('./src/services/webhookService');

async function testWebhookConnection() {
  console.log('🧪 n8n Webhook 연결 테스트');
  console.log('═'.repeat(40));
  
  if (!process.env.N8N_WEBHOOK_URL) {
    console.log('❌ .env 파일에 N8N_WEBHOOK_URL을 설정해주세요.');
    return;
  }

  console.log(`Target URL: ${process.env.N8N_WEBHOOK_URL}`);
  
  const result = await webhookService.testWebhook();
  
  if (result.success) {
    console.log('webhook 연결 성공!');
    console.log('응답 데이터:', JSON.stringify(result.response, null, 2));
  } else {
    console.log('webhook 연결 실패');
    console.log('오류:', result.error);
  }
}

// 직접 실행시 테스트 수행
if (require.main === module) {
  testWebhookConnection();
}