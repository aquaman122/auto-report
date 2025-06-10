const path = require('path');
const fs = require('fs');
const documentService = require('../services/documentService');
const supabaseService = require('../services/supabaseService');
const logger = require('../utils/logger');

class DocumentController {
  // 문서 생성
  async generateDocument(req, res) {
    try {
      const { meeting_id, format = 'all' } = req.body;

      if (!meeting_id) {
        return res.status(400).json({
          success: false,
          message: '회의 ID가 필요합니다'
        });
      }

      // 회의 정보 조회
      const meeting = await supabaseService.getMeetingById(meeting_id);
      
      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: '회의를 찾을 수 없습니다'
        });
      }

      // 구조화된 데이터 재구성
      const structuredData = this.reconstructStructuredData(meeting);
      
      // 회의록 텍스트 생성 (간단 버전)
      const meetingMinutes = this.generateSimpleMeetingMinutes(structuredData);

      // 문서 생성
      const documents = await documentService.generateMeetingDocument(
        structuredData, 
        meetingMinutes, 
        format
      );

      // 생성된 문서 정보 DB에 저장
      for (const [formatType, docInfo] of Object.entries(documents)) {
        await supabaseService.saveGeneratedDocument(meeting_id, {
          ...docInfo,
          type: 'meeting_minutes'
        });
      }

      res.json({
        success: true,
        message: '문서가 생성되었습니다',
        data: {
          meeting_id,
          documents,
          generated_at: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('문서 생성 실패:', error);
      res.status(500).json({
        success: false,
        message: '문서 생성에 실패했습니다',
        error: error.message
      });
    }
  }

  // 문서 목록 조회
  async getDocumentList(req, res) {
    try {
      const documents = documentService.getDocumentList();

      res.json({
        success: true,
        data: documents,
        count: documents.length
      });

    } catch (error) {
      logger.error('문서 목록 조회 실패:', error);
      res.status(500).json({
        success: false,
        message: '문서 목록 조회에 실패했습니다',
        error: error.message
      });
    }
  }

  // 문서 다운로드
  async downloadDocument(req, res) {
    try {
      const fileName = req.params.fileName;
      const filePath = path.join('summaries', fileName);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: '파일을 찾을 수 없습니다'
        });
      }

      const fileExt = path.extname(fileName).toLowerCase();
      let contentType = 'application/octet-stream';

      switch (fileExt) {
        case '.html':
          contentType = 'text/html; charset=utf-8';
          break;
        case '.docx':
          contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
          break;
        case '.json':
          contentType = 'application/json; charset=utf-8';
          break;
      }

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
      
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);

    } catch (error) {
      logger.error('문서 다운로드 실패:', error);
      res.status(500).json({
        success: false,
        message: '문서 다운로드에 실패했습니다',
        error: error.message
      });
    }
  }

  // 문서 미리보기
  async previewDocument(req, res) {
    try {
      const fileName = req.params.fileName;
      const filePath = path.join('summaries', fileName);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({
          success: false,
          message: '파일을 찾을 수 없습니다'
        });
      }

      const fileExt = path.extname(fileName).toLowerCase();

      if (fileExt === '.html') {
        // HTML 파일은 직접 렌더링
        const htmlContent = fs.readFileSync(filePath, 'utf8');
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.send(htmlContent);
      } else if (fileExt === '.json') {
        // JSON 파일은 포맷팅해서 표시
        const jsonContent = fs.readFileSync(filePath, 'utf8');
        res.json(JSON.parse(jsonContent));
      } else {
        // 다른 형식은 다운로드로 리다이렉트
        this.downloadDocument(req, res);
      }

    } catch (error) {
      logger.error('문서 미리보기 실패:', error);
      res.status(500).json({
        success: false,
        message: '문서 미리보기에 실패했습니다',
        error: error.message
      });
    }
  }

  // 문서 삭제
  async deleteDocument(req, res) {
    try {
      const fileName = req.params.fileName;
      const filePath = path.join('summaries', fileName);

      const deleted = await documentService.deleteDocument(filePath);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          message: '파일을 찾을 수 없습니다'
        });
      }

      res.json({
        success: true,
        message: '문서가 삭제되었습니다'
      });

    } catch (error) {
      logger.error('문서 삭제 실패:', error);
      res.status(500).json({
        success: false,
        message: '문서 삭제에 실패했습니다',
        error: error.message
      });
    }
  }

  // 템플릿 목록
  async getTemplates(req, res) {
    try {
      const templates = [
        {
          id: 'default',
          name: '기본 회의록',
          description: '표준 한국식 회의록 형식',
          formats: ['html', 'docx', 'json']
        },
        {
          id: 'executive',
          name: '임원 회의록',
          description: '임원진 회의용 간결한 형식',
          formats: ['html', 'docx']
        },
        {
          id: 'technical',
          name: '기술 회의록',
          description: '개발팀용 상세 기술 회의록',
          formats: ['html', 'json']
        }
      ];

      res.json({
        success: true,
        data: templates
      });

    } catch (error) {
      logger.error('템플릿 조회 실패:', error);
      res.status(500).json({
        success: false,
        message: '템플릿 조회에 실패했습니다',
        error: error.message
      });
    }
  }

  // 헬퍼 함수들
  reconstructStructuredData(meeting) {
    return {
      meeting_info: {
        title: meeting.meeting_title,
        estimated_date: meeting.meeting_date,
        estimated_start_time: meeting.start_time,
        estimated_end_time: meeting.end_time,
        location: meeting.location,
        meeting_type: meeting.meeting_type
      },
      participants: meeting.meeting_participants?.map(p => ({
        name: p.name,
        department: p.department,
        role: p.role_in_meeting,
        speaking_frequency: this.convertSpeakingTime(p.speaking_time_percent)
      })) || [],
      agendas: meeting.meeting_agendas?.map(agenda => ({
        order: agenda.agenda_order,
        title: agenda.agenda_title,
        discussion: agenda.discussion_content,
        key_points: agenda.key_points || [],
        decisions: agenda.decisions?.decision || null,
        action_items: agenda.action_items?.map(item => ({
          task: item.task_description,
          assignee: item.assignee,
          deadline: item.deadline,
          priority: item.priority
        })) || []
      })) || [],
      key_outcomes: {
        main_decisions: this.extractMainDecisions(meeting.meeting_agendas),
        unresolved_issues: [],
        next_meeting_items: [],
        overall_sentiment: 'neutral',
        meeting_effectiveness: 'medium'
      }
    };
  }

  generateSimpleMeetingMinutes(structuredData) {
    const info = structuredData.meeting_info;
    const participants = structuredData.participants;
    const agendas = structuredData.agendas;

    return `
==============================================
            ${info.title} 회의록
==============================================

■ 회의 개요
  - 회의 주제: ${info.title}
  - 일시: ${info.estimated_date} ${info.estimated_start_time || ''}${info.estimated_end_time ? '~' + info.estimated_end_time : ''}
  - 장소: ${info.location || '(장소 미기재)'}

■ 참석자
${participants.map(p => `  - ${p.name}${p.department ? ' (' + p.department + ')' : ''}`).join('\n')}

■ 회의 내용
${agendas.map((agenda, index) => `
${index + 1}. ${agenda.title}
   논의내용: ${agenda.discussion}
   결정사항: ${agenda.decisions || '없음'}
   ${agenda.action_items.length > 0 ? `액션아이템:\n   ${agenda.action_items.map(item => `- ${item.task} (담당: ${item.assignee})`).join('\n   ')}` : ''}
`).join('')}

작성일: ${new Date().toLocaleDateString('ko-KR')}
작성자: AI 자동생성 시스템
==============================================
    `;
  }

  convertSpeakingTime(percent) {
    if (!percent) return 'low';
    if (percent > 0.35) return 'high';
    if (percent > 0.25) return 'medium';
    return 'low';
  }

  extractMainDecisions(agendas) {
    if (!agendas) return [];
    
    const decisions = [];
    agendas.forEach(agenda => {
      if (agenda.decisions?.decision) {
        decisions.push(agenda.decisions.decision);
      }
    });
    
    return decisions;
  }
}

module.exports = new DocumentController();