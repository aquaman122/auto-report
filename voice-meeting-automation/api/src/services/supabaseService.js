const { supabaseAdmin } = require('../config/supabase');
const logger = require('../utils/logger');

class SupabaseService {
  // 직원 정보 조회
  async findEmployeeByName(name) {
    try {
      const { data, error } = await supabaseAdmin
        .from('employees')
        .select('*')
        .ilike('name', `%${name}%`)
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return data;
    } catch (error) {
      logger.warn(`직원 정보 조회 실패 (${name}):`, error.message);
      return null;
    }
  }

  // 오디오 파일 정보 저장
  async saveAudioFile(fileData) {
    try {
      const { data, error } = await supabaseAdmin
        .from('audio_files')
        .insert([{
          file_name: fileData.fileName,
          original_name: fileData.originalName,
          file_path: fileData.filePath,
          file_size: fileData.fileSize,
          mime_type: fileData.mimeType,
          duration_seconds: fileData.duration || null,
          status: 'uploaded',
          uploaded_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        logger.error('오디오 파일 저장 실패:', error);
        throw error;
      }

      logger.info(`오디오 파일 DB 저장 완료: ${data.id}`);
      return data;

    } catch (error) {
      logger.error('오디오 파일 저장 오류:', error);
      throw new Error(`오디오 파일 저장 실패: ${error.message}`);
    }
  }

  // 회의 정보 저장
  async saveMeetingData(meetingData, audioFileId) {
    try {
      // 트랜잭션 시작
      const { data: meeting, error: meetingError } = await supabaseAdmin
        .from('meetings')
        .insert([{
          audio_file_id: audioFileId,
          meeting_title: meetingData.meeting_info?.title || '제목 없음',
          meeting_date: meetingData.meeting_info?.estimated_date || new Date().toISOString().split('T')[0],
          start_time: meetingData.meeting_info?.estimated_start_time || null,
          end_time: meetingData.meeting_info?.estimated_end_time || null,
          location: meetingData.meeting_info?.location || null,
          meeting_type: meetingData.meeting_info?.meeting_type || '일반회의',
          agenda_items: meetingData.agendas?.map(a => a.title) || [],
          status: 'draft',
          created_by: 'AI_SYSTEM'
        }])
        .select()
        .single();

      if (meetingError) {
        throw meetingError;
      }

      // 참석자 정보 저장
      if (meetingData.participants && meetingData.participants.length > 0) {
        const participantsData = meetingData.participants.map(p => ({
          meeting_id: meeting.id,
          name: p.name,
          department: p.department || null,
          role_in_meeting: p.role || '참석자',
          speaking_time_percent: this.calculateSpeakingFrequency(p.speaking_frequency)
        }));

        const { error: participantsError } = await supabaseAdmin
          .from('meeting_participants')
          .insert(participantsData);

        if (participantsError) {
          logger.error('참석자 정보 저장 실패:', participantsError);
        }
      }

      // 안건 정보 저장
      if (meetingData.agendas && meetingData.agendas.length > 0) {
        for (const [index, agenda] of meetingData.agendas.entries()) {
          const { data: agendaRecord, error: agendaError } = await supabaseAdmin
            .from('meeting_agendas')
            .insert([{
              meeting_id: meeting.id,
              agenda_order: agenda.order || index + 1,
              agenda_title: agenda.title,
              discussion_content: agenda.discussion,
              key_points: agenda.key_points || [],
              decisions: agenda.decisions ? { decision: agenda.decisions } : null,
              next_steps: [],
              responsible_person: null,
              deadline: null,
              priority: 'medium',
              status: 'pending'
            }])
            .select()
            .single();

          if (agendaError) {
            logger.error('안건 저장 실패:', agendaError);
            continue;
          }

          // 액션 아이템 저장
          if (agenda.action_items && agenda.action_items.length > 0) {
            const actionItemsData = agenda.action_items.map(item => ({
              meeting_id: meeting.id,
              agenda_id: agendaRecord.id,
              task_description: item.task,
              assignee: item.assignee || '미정',
              deadline: item.deadline || null,
              priority: item.priority || 'medium',
              status: 'open'
            }));

            const { error: actionError } = await supabaseAdmin
              .from('action_items')
              .insert(actionItemsData);

            if (actionError) {
              logger.error('액션 아이템 저장 실패:', actionError);
            }
          }
        }
      }

      logger.info(`회의 데이터 저장 완료: meeting_id=${meeting.id}`);
      return meeting;

    } catch (error) {
      logger.error('회의 데이터 저장 실패:', error);
      throw new Error(`회의 데이터 저장 실패: ${error.message}`);
    }
  }

  // 음성 분석 결과 저장
  async saveVoiceAnalysis(audioFileId, analysisData) {
    try {
      const { data, error } = await supabaseAdmin
        .from('voice_analysis')
        .insert([{
          audio_file_id: audioFileId,
          original_text: analysisData.transcription.text,
          summary_text: analysisData.structured_data.key_outcomes?.main_decisions?.join('; ') || '',
          key_topics: this.extractKeyTopics(analysisData.structured_data),
          sentiment_analysis: {
            overall: analysisData.structured_data.key_outcomes?.overall_sentiment || 'neutral',
            effectiveness: analysisData.structured_data.key_outcomes?.meeting_effectiveness || 'medium'
          },
          speaker_analysis: this.analyzeSpeakers(analysisData.structured_data.participants),
          confidence_score: analysisData.structured_data.analysis_metadata?.confidence_score || 0.8,
          processing_metadata: analysisData.metadata,
          ai_model_version: 'gpt-4o',
          processing_time_seconds: analysisData.metadata.processing_time_seconds
        }])
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info(`음성 분석 결과 저장 완료: ${data.id}`);
      return data;

    } catch (error) {
      logger.error('음성 분석 결과 저장 실패:', error);
      throw new Error(`음성 분석 결과 저장 실패: ${error.message}`);
    }
  }

  // 생성된 문서 정보 저장
  async saveGeneratedDocument(meetingId, documentData) {
    try {
      const { data, error } = await supabaseAdmin
        .from('generated_documents')
        .insert([{
          meeting_id: meetingId,
          document_type: documentData.type || 'meeting_minutes',
          file_name: documentData.fileName,
          file_path: documentData.filePath,
          file_format: documentData.format,
          template_used: documentData.template || 'default',
          generated_at: new Date().toISOString(),
          is_final: false,
          approval_status: 'pending'
        }])
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info(`문서 정보 저장 완료: ${data.id}`);
      return data;

    } catch (error) {
      logger.error('문서 정보 저장 실패:', error);
      throw new Error(`문서 정보 저장 실패: ${error.message}`);
    }
  }

  // 오디오 파일 상태 업데이트
  async updateAudioFileStatus(audioFileId, status, errorMessage = null) {
    try {
      const updateData = {
        status,
        updated_at: new Date().toISOString()
      };

      if (status === 'completed') {
        updateData.processed_at = new Date().toISOString();
      }

      if (errorMessage) {
        updateData.error_message = errorMessage;
      }

      const { error } = await supabaseAdmin
        .from('audio_files')
        .update(updateData)
        .eq('id', audioFileId);

      if (error) throw error;

      logger.info(`오디오 파일 상태 업데이트: ${audioFileId} -> ${status}`);

    } catch (error) {
      logger.error('오디오 파일 상태 업데이트 실패:', error);
    }
  }

  // 회의 목록 조회
  async getMeetingList(limit = 20, offset = 0) {
    try {
      const { data, error } = await supabaseAdmin
        .from('meetings')
        .select(`
          *,
          audio_files (
            file_name,
            original_name,
            file_size,
            duration_seconds,
            uploaded_at
          ),
          meeting_participants (
            name,
            department,
            role_in_meeting
          ),
          meeting_agendas (
            agenda_title,
            status
          ),
          generated_documents (
            document_type,
            file_name,
            file_format,
            approval_status
          )
        `)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return data;

    } catch (error) {
      logger.error('회의 목록 조회 실패:', error);
      throw new Error(`회의 목록 조회 실패: ${error.message}`);
    }
  }

  // 특정 회의 상세 조회
  async getMeetingById(meetingId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('meetings')
        .select(`
          *,
          audio_files (*),
          meeting_participants (*),
          meeting_agendas (
            *,
            action_items (*)
          ),
          voice_analysis (*),
          generated_documents (*)
        `)
        .eq('id', meetingId)
        .single();

      if (error) throw error;

      return data;

    } catch (error) {
      logger.error('회의 상세 조회 실패:', error);
      throw new Error(`회의 상세 조회 실패: ${error.message}`);
    }
  }

  // 통계 조회
  async getStatistics() {
    try {
      const [
        { count: totalMeetings },
        { count: totalAudioFiles },
        { count: completedFiles },
        { count: recentMeetings }
      ] = await Promise.all([
        supabaseAdmin.from('meetings').select('count').single(),
        supabaseAdmin.from('audio_files').select('count').single(),
        supabaseAdmin.from('audio_files').select('count').eq('status', 'completed').single(),
        supabaseAdmin.from('meetings').select('count')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .single()
      ]);

      return {
        total_meetings: totalMeetings || 0,
        total_audio_files: totalAudioFiles || 0,
        completed_files: completedFiles || 0,
        recent_meetings: recentMeetings || 0,
        success_rate: totalAudioFiles ? ((completedFiles || 0) / totalAudioFiles * 100) : 0
      };

    } catch (error) {
      logger.error('통계 조회 실패:', error);
      throw new Error(`통계 조회 실패: ${error.message}`);
    }
  }

  // 헬퍼 함수들
  calculateSpeakingFrequency(frequency) {
    const frequencyMap = {
      'high': 0.4,
      'medium': 0.3,
      'low': 0.2
    };
    return frequencyMap[frequency] || 0.25;
  }

  extractKeyTopics(structuredData) {
    const topics = [];
    
    if (structuredData.agendas) {
      structuredData.agendas.forEach(agenda => {
        if (agenda.key_points) {
          topics.push(...agenda.key_points);
        }
      });
    }

    return topics.slice(0, 10); // 상위 10개만
  }

  analyzeSpeakers(participants) {
    if (!participants || participants.length === 0) {
      return { total_speakers: 0, main_speaker: null };
    }

    const mainSpeaker = participants.find(p => p.speaking_frequency === 'high') || participants[0];

    return {
      total_speakers: participants.length,
      main_speaker: mainSpeaker.name,
      speaker_distribution: participants.map(p => ({
        name: p.name,
        frequency: p.speaking_frequency
      }))
    };
  }
}

module.exports = new SupabaseService();