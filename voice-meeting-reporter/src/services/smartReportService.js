const fs = require('fs-extra');
const path = require('path');
const moment = require('moment');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

class SmartReportService {
  async generateSmartReport(meetingData, structuredAnalysis) {
    try {
      console.log('🤖 스마트 회의록 생성 중...');

      // 1. 회의 데이터를 Supabase에 저장
      const savedMeeting = await this.saveMeetingToDatabase(meetingData, structuredAnalysis);
      
      // 2. 관련 회의 기록 조회
      const relatedMeetings = await this.findRelatedMeetings(structuredAnalysis.keywords);
      
      // 3. 참여자 이전 활동 조회
      const participantHistory = await this.getParticipantHistory(meetingData.participants);
      
      // 4. 액션아이템 진행상황 조회
      const actionItemStatus = await this.getActionItemStatus();
      
      // 5. 향상된 보고서 생성
      const reportContent = await this.generateEnhancedReport({
        meeting: meetingData,
        analysis: structuredAnalysis,
        relatedMeetings,
        participantHistory,
        actionItemStatus,
        savedMeeting
      });

      // 6. 파일 저장
      const timestamp = moment().format('YYYYMMDD_HHmmss');
      const filename = `스마트_회의록_${meetingData.title.replace(/[^\w가-힣]/g, '_')}_${timestamp}.txt`;
      const filePath = path.join('./reports', filename);
      
      await fs.writeFile(filePath, reportContent, 'utf8');
      
      console.log('✅ 스마트 회의록 생성 완료');
      return {
        filename,
        filePath: path.resolve(filePath),
        content: reportContent,
        meetingId: savedMeeting.id
      };
      
    } catch (error) {
      console.error('스마트 보고서 생성 오류:', error);
      throw error;
    }
  }

  async saveMeetingToDatabase(meetingData, analysis) {
    try {
      // 회의 저장
      const { data: meeting, error: meetingError } = await supabase
        .from('meetings')
        .insert({
          title: meetingData.title,
          meeting_date: meetingData.date,
          place: meetingData.place,
          audio_filename: meetingData.audioFilename,
          transcription: meetingData.transcription,
          summary: meetingData.summary,
          main_topics: analysis.main_topics,
          decisions: analysis.decisions,
          action_items: analysis.action_items,
          next_meeting_items: analysis.next_meeting_items,
          total_budget: meetingData.totalBudget,
          snack_budget: meetingData.snackBudget,
          meal_budget: meetingData.mealBudget,
          meeting_type: analysis.meeting_type,
          keywords: analysis.keywords,
          sentiment_score: analysis.sentiment_score,
          report_filename: null // 나중에 업데이트
        })
        .select()
        .single();

      if (meetingError) throw meetingError;

      // 참여자 연결
      if (meetingData.participants && meetingData.participants.length > 0) {
        const participantLinks = meetingData.participants.map(p => ({
          meeting_id: meeting.id,
          participant_id: p.id,
          signed: false,
          attendance_type: 'present'
        }));

        await supabase
          .from('meeting_participants')
          .insert(participantLinks);
      }

      // 액션아이템 저장
      if (analysis.action_items && analysis.action_items.length > 0) {
        const actionItems = analysis.action_items.map(item => ({
          meeting_id: meeting.id,
          assignee_id: null, // 이름으로 매칭 필요시 추후 구현
          item_description: item.task,
          due_date: item.due_date !== '다음 회의' ? item.due_date : null,
          status: 'pending'
        }));

        await supabase
          .from('action_item_tracking')
          .insert(actionItems);
      }

      return meeting;
    } catch (error) {
      console.error('데이터베이스 저장 오류:', error);
      throw error;
    }
  }

  async findRelatedMeetings(keywords) {
    try {
      const { data: meetings, error } = await supabase
        .from('meetings')
        .select('id, title, meeting_date, main_topics, keywords')
        .order('meeting_date', { ascending: false })
        .limit(5);

      if (error) throw error;

      // 키워드 매칭으로 관련도 계산
      return meetings.map(meeting => {
        const commonKeywords = meeting.keywords.filter(k => keywords.includes(k));
        return {
          ...meeting,
          relevance_score: commonKeywords.length,
          common_keywords: commonKeywords
        };
      }).filter(m => m.relevance_score > 0)
        .sort((a, b) => b.relevance_score - a.relevance_score);
        
    } catch (error) {
      console.log('관련 회의 조회 실패:', error);
      return [];
    }
  }

  async getParticipantHistory(participants) {
    if (!participants || participants.length === 0) return [];
    
    try {
      const participantIds = participants.map(p => p.id);
      
      const { data: history, error } = await supabase
        .from('meeting_participants')
        .select(`
          participant_id,
          meetings!inner(title, meeting_date, main_topics)
        `)
        .in('participant_id', participantIds)
        .order('meetings.meeting_date', { ascending: false })
        .limit(10);

      if (error) throw error;
      return history;
    } catch (error) {
      console.log('참여자 기록 조회 실패:', error);
      return [];
    }
  }

  async getActionItemStatus() {
    try {
      const { data: actionItems, error } = await supabase
        .from('action_item_tracking')
        .select(`
          *,
          meetings!inner(title, meeting_date),
          participants(name, department)
        `)
        .neq('status', 'completed')
        .order('due_date', { ascending: true });

      if (error) throw error;
      return actionItems;
    } catch (error) {
      console.log('액션아이템 조회 실패:', error);
      return [];
    }
  }

  generateEnhancedReport(data) {
    const { meeting, analysis, relatedMeetings, participantHistory, actionItemStatus } = data;
    const currentDate = moment().format('YYYY년 MM월 DD일');
    const meetingDate = moment(meeting.date).format('YYYY년 MM월 DD일');

    // 참여자 테이블 생성
    const participantRows = this.generateParticipantTable(meeting.participants || []);
    
    // 관련 회의 섹션
    const relatedMeetingsSection = relatedMeetings.length > 0 ? 
      this.generateRelatedMeetingsSection(relatedMeetings) : '';
    
    // 미완료 액션아이템 섹션
    const pendingActionsSection = actionItemStatus.length > 0 ?
      this.generatePendingActionsSection(actionItemStatus) : '';

    return `
┌─────────────────────────────────────────────────────────────┐
│              서식 115 (프로젝트등-창성) 스마트 회의록        │
└─────────────────────────────────────────────────────────────┘

                             회 의 록

회의제목: ${meeting.title}                          ((meeting-title))
회의일시: ${meetingDate}                         ((meeting-date))
회의장소: ${meeting.place}                          ((meeting-place))
회의유형: ${analysis.meeting_type} | 분위기: ${this.getSentimentText(analysis.sentiment_score)}

${participantRows}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎯 주요 논의사항                              ((meeting-context))
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${analysis.main_topics.map((topic, index) => `${index + 1}. ${topic}`).join('\n')}

🔹 핵심 결정사항
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${analysis.decisions.map((decision, index) => 
  `${index + 1}. ${decision.decision}\n   ├ 근거: ${decision.rationale}\n   └ 영향: ${decision.impact}`
).join('\n\n')}

🔹 액션 아이템 및 후속 조치
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${analysis.action_items.map((item, index) => 
  `${index + 1}. ${item.task}\n   ├ 담당자: ${item.assignee}\n   ├ 기한: ${item.due_date}\n   └ 우선순위: ${item.priority}`
).join('\n\n')}

🔹 다음 회의 안건
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${analysis.next_meeting_items.map((item, index) => `${index + 1}. ${item}`).join('\n')}

${relatedMeetingsSection}

${pendingActionsSection}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

┌─────────────────────────────────────────────────────────────┐
│                        정부규격                             │
├───────────┬─────────────┬─────────────────────────────────┤
│    입계   │    다과      │           회의(식사)            │
├───────────┼─────────────┼─────────────────────────────────┤
│           │             │                                 │
│ ${String(meeting.totalBudget || 30000).padStart(9)}원 │ ${String(meeting.snackBudget || 10000).padStart(9)}원 │ ${String(meeting.mealBudget || 15000).padStart(27)}원 │
│           │             │                                 │
└───────────┴─────────────┴─────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🔍 AI 분석 정보
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📊 핵심 키워드: ${analysis.keywords.slice(0, 8).join(', ')}
📈 회의 분위기: ${this.getSentimentText(analysis.sentiment_score)} (${analysis.sentiment_score})
🏷️  회의 분류: ${analysis.meeting_type}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📄 상세 회의 내용 (AI 음성 인식 결과)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${meeting.transcription}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 생성 정보
• 스마트 시스템: OpenAI Whisper + GPT-3.5-turbo + Supabase
• 생성 일시: ${moment().format('YYYY-MM-DD HH:mm:ss')}
• 총 참여자: ${meeting.participants ? meeting.participants.length : 0}명
• 데이터베이스 ID: ${data.savedMeeting.id}
• 예산 총액: ${meeting.totalBudget || 30000}원

    `.trim();
  }

  generateRelatedMeetingsSection(relatedMeetings) {
    if (relatedMeetings.length === 0) return '';
    
    return `
🔗 관련 회의 기록
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${relatedMeetings.slice(0, 3).map((meeting, index) => 
  `${index + 1}. ${meeting.title} (${moment(meeting.meeting_date).format('MM/DD')})\n   연관도: ${meeting.relevance_score}점 | 공통키워드: ${meeting.common_keywords.join(', ')}`
).join('\n\n')}

`;
  }

  generatePendingActionsSection(actionItems) {
    if (actionItems.length === 0) return '';
    
    return `
⏰ 미완료 액션아이템 현황
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${actionItems.slice(0, 5).map((item, index) => 
  `${index + 1}. ${item.item_description}\n   ├ 담당: ${item.participants?.name || '미정'}\n   ├ 기한: ${item.due_date ? moment(item.due_date).format('MM/DD') : '미정'}\n   └ 상태: ${this.getStatusText(item.status)}`
).join('\n\n')}

`;
  }

  generateParticipantTable(participants) {
    const rows = [];
    const maxRows = Math.max(3, Math.ceil(participants.length / 2));

    for (let i = 0; i < maxRows; i++) {
      const leftParticipant = participants[i * 2];
      const rightParticipant = participants[i * 2 + 1];
      
      const leftName = leftParticipant ? leftParticipant.name : '';
      const leftDept = leftParticipant ? leftParticipant.department : '';
      const leftPos = leftParticipant ? leftParticipant.position : '';
      
      const rightName = rightParticipant ? rightParticipant.name : '';
      const rightDept = rightParticipant ? rightParticipant.department : '';
      const rightPos = rightParticipant ? rightParticipant.position : '';

      if (i === 0) {
        rows.push('┌─────────┬─────┬─────┬─────┬─────────┬─────┬─────┬─────┐');
        rows.push('│ 참여자  │소속 │직책 │서명 │ 참여자  │소속 │직책 │서명 │');
        rows.push('├─────────┼─────┼─────┼─────┼─────────┼─────┼─────┼─────┤');
      }
      
      rows.push(
        `│${leftName.padEnd(9, ' ')}│${leftDept.padEnd(5, ' ')}│${leftPos.padEnd(5, ' ')}│     │${rightName.padEnd(9, ' ')}│${rightDept.padEnd(5, ' ')}│${rightPos.padEnd(5, ' ')}│     │`
      );
      
      if (i < maxRows - 1) {
        rows.push('├─────────┼─────┼─────┼─────┼─────────┼─────┼─────┼─────┤');
      }
    }
    
    rows.push('└─────────┴─────┴─────┴─────┴─────────┴─────┴─────┴─────┘');
    return rows.join('\n');
  }

  getSentimentText(score) {
    if (score > 0.3) return '😊 긍정적';
    if (score < -0.3) return '😟 부정적';
    return '😐 중립적';
  }

  getStatusText(status) {
    const statusMap = {
      'pending': '⏳ 대기중',
      'in_progress': '🔄 진행중',
      'completed': '✅ 완료'
    };
    return statusMap[status] || status;
  }
}

module.exports = new SmartReportService();