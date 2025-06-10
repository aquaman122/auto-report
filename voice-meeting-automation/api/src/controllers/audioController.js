const path = require('path');
const fs = require('fs');
const openaiService = require('../services/openaiService');
const supabaseService = require('../services/supabaseService');
const documentService = require('../services/documentService');
const logger = require('../utils/logger');

class AudioController {
  // 단일 파일 업로드 및 완전 처리
  async uploadAndProcess(req, res) {
    let audioFileRecord = null;
    
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: '오디오 파일이 필요합니다'
        });
      }

      logger.info(`음성 파일 처리 시작: ${req.file.filename}`);

      // 1. 파일 정보를 DB에 저장
      audioFileRecord = await supabaseService.saveAudioFile({
        fileName: req.file.filename,
        originalName: req.file.originalname,
        filePath: req.file.path,
        fileSize: req.file.size,
        mimeType: req.file.mimetype
      });

      // 2. 처리 상태를 processing으로 업데이트
      await supabaseService.updateAudioFileStatus(audioFileRecord.id, 'processing');

      // 3. OpenAI로 완전 처리 (STT + 구조화 + 회의록 생성)
      const processingOptions = {
        language: req.body.language || 'ko'
      };

      const result = await openaiService.processAudioToMeetingMinutes(req.file.path, processingOptions);

      // 4. 회의 정보를 DB에 저장
      const meetingRecord = await supabaseService.saveMeetingData(result.structured_data, audioFileRecord.id);

      // 5. 음성 분석 결과 저장
      await supabaseService.saveVoiceAnalysis(audioFileRecord.id, result);

      // 6. 문서 생성 (HTML, DOCX, JSON)
      const documents = await documentService.generateMeetingDocument(
        result.structured_data, 
        result.meeting_minutes,
        req.body.format || 'all'
      );

      // 7. 생성된 문서 정보 DB에 저장
      for (const [format, docInfo] of Object.entries(documents)) {
        await supabaseService.saveGeneratedDocument(meetingRecord.id, {
          ...docInfo,
          type: 'meeting_minutes'
        });
      }

      // 8. 파일 상태를 완료로 업데이트
      await supabaseService.updateAudioFileStatus(audioFileRecord.id, 'completed');

      // 9. 성공 응답
      res.json({
        success: true,
        message: '음성 파일 처리가 완료되었습니다',
        data: {
          audio_file_id: audioFileRecord.id,
          meeting_id: meetingRecord.id,
          summary: result.structured_data.key_outcomes?.main_decisions?.join('; ') || '요약 없음',
          action_items: this.extractActionItems(result.structured_data.agendas),
          participants: result.structured_data.participants?.map(p => p.name).join(', ') || '참석자 없음',
          processing_time: result.metadata.processing_time_seconds
        },
        documents: documents,
        urls: {
          meeting_detail: `/api/meeting/${meetingRecord.id}`,
          audio_file: `/uploads/${req.file.filename}`
        }
      });

    } catch (error) {
      logger.error('음성 파일 처리 실패:', error);

      // 실패한 파일 정리
      if (req.file && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
          logger.error('파일 정리 실패:', cleanupError);
        }
      }

      // DB 상태 업데이트
      if (audioFileRecord) {
        await supabaseService.updateAudioFileStatus(audioFileRecord.id, 'failed', error.message);
      }

      res.status(500).json({
        success: false,
        message: '음성 파일 처리 중 오류가 발생했습니다',
        error: error.message,
        audio_file_id: audioFileRecord?.id || null
      });
    }
  }

  // STT만 수행 (테스트용)
  async transcribeOnly(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: '오디오 파일이 필요합니다'
        });
      }

      const result = await openaiService.transcribeAudio(req.file.path, {
        language: req.body.language || 'ko'
      });

      // 테스트 파일 정리
      if (fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.json({
        success: true,
        message: '음성 변환이 완료되었습니다',
        data: {
          text: result.text,
          duration: result.duration,
          language: result.language,
          word_count: result.text.split(' ').length
        }
      });

    } catch (error) {
      logger.error('STT 처리 실패:', error);

      if (req.file && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }

      res.status(500).json({
        success: false,
        message: '음성 변환 중 오류가 발생했습니다',
        error: error.message
      });
    }
  }

  // 배치 처리
  async batchProcess(req, res) {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: '최소 1개의 오디오 파일이 필요합니다'
        });
      }

      logger.info(`배치 처리 시작: ${req.files.length}개 파일`);

      const results = [];
      const processingOptions = {
        language: req.body.language || 'ko'
      };

      // 파일별 순차 처리
      for (const [index, file] of req.files.entries()) {
        try {
          logger.info(`배치 처리 진행: ${index + 1}/${req.files.length} - ${file.originalname}`);

          // 파일 정보 저장
          const audioFileRecord = await supabaseService.saveAudioFile({
            fileName: file.filename,
            originalName: file.originalname,
            filePath: file.path,
            fileSize: file.size,
            mimeType: file.mimetype
          });

          await supabaseService.updateAudioFileStatus(audioFileRecord.id, 'processing');

          // 음성 처리
          const result = await openaiService.processAudioToMeetingMinutes(file.path, processingOptions);

          // 회의 정보 저장
          const meetingRecord = await supabaseService.saveMeetingData(result.structured_data, audioFileRecord.id);

          // 문서 생성
          const documents = await documentService.generateMeetingDocument(
            result.structured_data, 
            result.meeting_minutes,
            'html' // 배치에서는 HTML만 생성
          );

          await supabaseService.updateAudioFileStatus(audioFileRecord.id, 'completed');

          results.push({
            file: file.originalname,
            success: true,
            audio_file_id: audioFileRecord.id,
            meeting_id: meetingRecord.id,
            summary: result.structured_data.key_outcomes?.main_decisions?.[0] || '요약 없음',
            processing_time: result.metadata.processing_time_seconds,
            document_url: documents.html?.url
          });

        } catch (error) {
          logger.error(`배치 처리 오류 (${file.filename}):`, error);
          
          // 실패한 파일 정리
          if (fs.existsSync(file.path)) {
            fs.unlinkSync(file.path);
          }

          results.push({
            file: file.originalname,
            success: false,
            error: error.message
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failCount = results.filter(r => !r.success).length;

      res.json({
        success: true,
        message: `배치 처리 완료: 성공 ${successCount}개, 실패 ${failCount}개`,
        results,
        summary: {
          total: req.files.length,
          successful: successCount,
          failed: failCount,
          success_rate: Math.round((successCount / req.files.length) * 100)
        }
      });

    } catch (error) {
      logger.error('배치 처리 실패:', error);
      res.status(500).json({
        success: false,
        message: '배치 처리 중 오류가 발생했습니다',
        error: error.message
      });
    }
  }

  // 파일 목록 조회
  async getFileList(req, res) {
    try {
      const limit = parseInt(req.query.limit) || 20;
      const offset = parseInt(req.query.offset) || 0;

      const files = await supabaseService.getMeetingList(limit, offset);

      res.json({
        success: true,
        data: files,
        pagination: {
          limit,
          offset,
          count: files.length
        }
      });

    } catch (error) {
      logger.error('파일 목록 조회 실패:', error);
      res.status(500).json({
        success: false,
        message: '파일 목록 조회에 실패했습니다',
        error: error.message
      });
    }
  }

  // 특정 파일 정보 조회
  async getFileById(req, res) {
    try {
      const fileId = parseInt(req.params.id);
      
      const file = await supabaseService.getMeetingById(fileId);
      
      if (!file) {
        return res.status(404).json({
          success: false,
          message: '파일을 찾을 수 없습니다'
        });
      }

      res.json({
        success: true,
        data: file
      });

    } catch (error) {
      logger.error('파일 정보 조회 실패:', error);
      res.status(500).json({
        success: false,
        message: '파일 정보 조회에 실패했습니다',
        error: error.message
      });
    }
  }

  // 처리 상태 조회
  async getProcessingStatus(req, res) {
    try {
      const fileId = parseInt(req.params.id);
      
      const file = await supabaseService.getMeetingById(fileId);
      
      if (!file) {
        return res.status(404).json({
          success: false,
          message: '파일을 찾을 수 없습니다'
        });
      }

      res.json({
        success: true,
        data: {
          id: file.id,
          status: file.audio_files?.status || 'unknown',
          uploaded_at: file.audio_files?.uploaded_at,
          processed_at: file.audio_files?.processed_at,
          error_message: file.audio_files?.error_message,
          progress: this.calculateProgress(file.audio_files?.status)
        }
      });

    } catch (error) {
      logger.error('처리 상태 조회 실패:', error);
      res.status(500).json({
        success: false,
        message: '처리 상태 조회에 실패했습니다',
        error: error.message
      });
    }
  }

  // 통계 조회
  async getStats(req, res) {
    try {
      const stats = await supabaseService.getStatistics();

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('통계 조회 실패:', error);
      res.status(500).json({
        success: false,
        message: '통계 조회에 실패했습니다',
        error: error.message
      });
    }
  }

  // 헬퍼 함수들
  extractActionItems(agendas) {
    if (!agendas || agendas.length === 0) return [];
    
    const actionItems = [];
    agendas.forEach(agenda => {
      if (agenda.action_items && agenda.action_items.length > 0) {
        actionItems.push(...agenda.action_items);
      }
    });
    
    return actionItems;
  }

  calculateProgress(status) {
    const progressMap = {
      'uploaded': 25,
      'processing': 75,
      'completed': 100,
      'failed': 0
    };
    return progressMap[status] || 0;
  }
}

module.exports = new AudioController();