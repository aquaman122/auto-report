const express = require('express');
const router = express.Router();
const meetingController = require('../controllers/meetingController');

// 회의 목록 조회
router.get('/', meetingController.getMeetingList);

// 특정 회의 상세 조회
router.get('/:id', meetingController.getMeetingById);

// 회의 데이터 수동 저장
router.post('/', meetingController.createMeeting);

// 회의 정보 수정
router.put('/:id', meetingController.updateMeeting);

// 회의 삭제
router.delete('/:id', meetingController.deleteMeeting);

// 회의 승인/거부
router.patch('/:id/approval', meetingController.updateApprovalStatus);

// 액션 아이템 조회
router.get('/:id/actions', meetingController.getActionItems);

// 액션 아이템 업데이트
router.patch('/actions/:actionId', meetingController.updateActionItem);

// 회의 통계
router.get('/stats/overview', meetingController.getMeetingStats);

module.exports = router;