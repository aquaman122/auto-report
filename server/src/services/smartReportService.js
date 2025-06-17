const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');

class SmartReportService {
  async generateSmartReport(meetingData) {
    try {
      console.log('🤖 스마트 회의록 생성 중...');

      // 1. 기본 보고서 생성
      const reportContent = this.generateBasicReport(meetingData);

      // 2. 파일 저장
      const timestamp = moment().format('YYYYMMDD_HHmmss');
      const filename = `스마트_회의록_${meetingData.title?.replace(/[^\w가-힣]/g, '_') || '회의'}_${timestamp}.txt`;
      const filePath = path.join('./reports', filename);
      
      // reports 폴더가 없으면 생성
      await fs.ensureDir('./reports');
      await fs.writeFile(filePath, reportContent, 'utf8');
      
      // JSON 형태로도 저장
      const jsonData = {
        meeting_title: meetingData.title || '스마트 회의록',
        meeting_date: moment().format('YYYY-MM-DD'),
        meeting_date_formatted: moment().format('YYYY년 MM월 DD일'),
        meeting_place: meetingData.place || '미기재',
        meeting_type: 'General Meeting',
        meeting_content: meetingData.summary || '',
        full_transcription: meetingData.transcription || '',
        main_topics: [],
        decisions: [],
        action_items: [],
        keywords: [],
        meeting_sentiment: '중립',
        sentiment_score: 0.5,
        metadata: {
          created_at: moment().format('YYYY-MM-DD HH:mm:ss'),
          audio_filename: meetingData.audioFilename || '',
          system_version: '2.0.0',
          processing_method: 'Smart_Analysis'
        }
      };
      
      const jsonPath = path.join('./reports', `${filename}.json`);
      await fs.writeJson(jsonPath, jsonData, { spaces: 2 });
      
      console.log('✅ 스마트 회의록 생성 완료');
      return {
        filename,
        filePath: path.resolve(filePath),
        jsonPath: path.resolve(jsonPath),
        content: reportContent,
        jsonData
      };
      
    } catch (error) {
      console.error('스마트 보고서 생성 오류:', error);
      throw error;
    }
  }

  generateBasicReport(meetingData) {
    const currentDate = moment().format('YYYY년 MM월 DD일');
    const meetingDate = moment().format('YYYY년 MM월 DD일');

    return `# 스마트 회의록

## 📋 회의 정보
- **날짜**: ${meetingDate}
- **장소**: ${meetingData.place || '미기재'}
- **유형**: 일반 회의
- **분위기**: 중립

## 🎯 회의 요약
${meetingData.summary || '회의 내용이 요약되지 않았습니다.'}

## 📝 전체 회의 내용
${meetingData.transcription || '회의 내용이 기록되지 않았습니다.'}

## 📊 분석 결과
- **주요 키워드**: ${meetingData.keywords?.join(', ') || '분석 중'}
- **회의 분위기**: 중립
- **처리 방법**: AI 자동 분석

---
*생성일시: ${currentDate}*
*시스템: 스마트 음성 회의록 자동화 v2.0*`;
  }
}

module.exports = new SmartReportService();