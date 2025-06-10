const supabaseService = require('../services/supabaseService');
const logger = require('../utils/logger');

class MeetingController {
  // 회의 목록 조회
  async getMeetingList(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const offset = parseInt(req.query.offset) || 0;
      const status = req.query.status; // draft, approved, archived

      let meetings = await supabaseService.getMeetingList(limit, offset);

      // 상태별 필터링
      if (status) {
        meetings = meetings.filter(meeting => meeting.status === status);
      }

      res.json({
        success: true,
        data: meetings,
        pagination: {
          limit,
          offset,
          count: meetings.length
        },
        filters: {
          status: status || 'all'
        }
      });

    } catch (error) {
      logger.error('회의 목록 조회 실패:', error);
      res.status(500).json({
        success: false,
        message: '회의 목록 조회에 실패했습니다',
        error: error.message
      });
    }
  }

  // 특정 회의 상세 조회
  async getMeetingById(req, res) {
    try {
      const meetingId = parseInt(req.params.id);
      
      const meeting = await supabaseService.getMeetingById(meetingId);
      
      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: '회의를 찾을 수 없습니다'
        });
      }

      res.json({
        success: true,
        data: meeting
      });

    } catch (error) {
      logger.error('회의 상세 조회 실패:', error);
      res.status(500).json({
        success: false,
        message: '회의 상세 조회에 실패했습니다',
        error: error.message
      });
    }
  }

  // 회의 생성 (수동)
  async createMeeting(req, res) {
    try {
      const { meeting_data } = req.body;
      
      if (!meeting_data) {
        return res.status(400).json({
          success: false,
          message: '회의 데이터가 필요합니다'
        });
      }

      const meeting = await supabaseService.saveMeetingData(meeting_data, null);

      res.status(201).json({
        success: true,
        message: '회의가 생성되었습니다',
        data: meeting
      });

    } catch (error) {
      logger.error('회의 생성 실패:', error);
      res.status(500).json({
        success: false,
        message: '회의 생성에 실패했습니다',
        error: error.message
      });
    }
  }

  // 회의 정보 수정
  async updateMeeting(req, res) {
    try {
      const meetingId = parseInt(req.params.id);
      const updateData = req.body;

      // 기존 회의 확인
      const existingMeeting = await supabaseService.getMeetingById(meetingId);
      if (!existingMeeting) {
        return res.status(404).json({
          success: false,
          message: '회의를 찾을 수 없습니다'
        });
      }

      // TODO: 회의 정보 업데이트 로직 구현
      // supabaseService에 updateMeeting 메서드 추가 필요

      res.json({
        success: true,
        message: '회의 정보가 업데이트되었습니다',
        data: { id: meetingId, ...updateData }
      });

    } catch (error) {
      logger.error('회의 수정 실패:', error);
      res.status(500).json({
        success: false,
        message: '회의 수정에 실패했습니다',
        error: error.message
      });
    }
  }

  // 회의 삭제
  async deleteMeeting(req, res) {
    try {
      const meetingId = parseInt(req.params.id);

      // TODO: 회의 삭제 로직 구현
      // supabaseService에 deleteMeeting 메서드 추가 필요

      res.json({
        success: true,
        message: '회의가 삭제되었습니다'
      });

    } catch (error) {
      logger.error('회의 삭제 실패:', error);
      res.status(500).json({
        success: false,
        message: '회의 삭제에 실패했습니다',
        error: error.message
      });
    }
  }

  // 회의 승인 상태 업데이트
  async updateApprovalStatus(req, res) {
    try {
      const meetingId = parseInt(req.params.id);
      const { status, approved_by } = req.body; // approved, rejected

      if (!['approved', 'rejected'].includes(status)) {
        return res.status(400).json({
          success: false,
          message: '유효하지 않은 승인 상태입니다'
        });
      }

      // TODO: 승인 상태 업데이트 로직 구현

      res.json({
        success: true,
        message: `회의가 ${status === 'approved' ? '승인' : '거부'}되었습니다`,
        data: { id: meetingId, status, approved_by }
      });

    } catch (error) {
      logger.error('승인 상태 업데이트 실패:', error);
      res.status(500).json({
        success: false,
        message: '승인 상태 업데이트에 실패했습니다',
        error: error.message
      });
    }
  }

  // 액션 아이템 조회
  async getActionItems(req, res) {
    try {
      const meetingId = parseInt(req.params.id);
      
      const meeting = await supabaseService.getMeetingById(meetingId);
      
      if (!meeting) {
        return res.status(404).json({
          success: false,
          message: '회의를 찾을 수 없습니다'
        });
      }

      // 모든 안건의 액션 아이템 수집
      const actionItems = [];
      if (meeting.meeting_agendas) {
        meeting.meeting_agendas.forEach(agenda => {
          if (agenda.action_items) {
            actionItems.push(...agenda.action_items);
          }
        });
      }

      res.json({
        success: true,
        data: {
          meeting_id: meetingId,
          action_items: actionItems,
          total_count: actionItems.length,
          open_count: actionItems.filter(item => item.status === 'open').length,
          completed_count: actionItems.filter(item => item.status === 'completed').length
        }
      });

    } catch (error) {
      logger.error('액션 아이템 조회 실패:', error);
      res.status(500).json({
        success: false,
        message: '액션 아이템 조회에 실패했습니다',
        error: error.message
      });
    }
  }

  // 액션 아이템 업데이트
  async updateActionItem(req, res) {
    try {
      const actionId = parseInt(req.params.actionId);
      const { status, notes, completion_date } = req.body;

      // TODO: 액션 아이템 업데이트 로직 구현

      res.json({
        success: true,
        message: '액션 아이템이 업데이트되었습니다',
        data: { id: actionId, status, notes, completion_date }
      });

    } catch (error) {
      logger.error('액션 아이템 업데이트 실패:', error);
      res.status(500).json({
        success: false,
        message: '액션 아이템 업데이트에 실패했습니다',
        error: error.message
      });
    }
  }

  // 회의 통계
  async getMeetingStats(req, res) {
    try {
      const stats = await supabaseService.getStatistics();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('회의 통계 조회 실패:', error);
      res.status(500).json({
        success: false,
        message: '회의 통계 조회에 실패했습니다',
        error: error.message
      });
    }
  }
}

module.exports = new MeetingController();