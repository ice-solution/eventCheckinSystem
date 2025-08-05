const express = require('express');
const router = express.Router();
const voteController = require('../controllers/voteController');
const { uploadVoteImageMulter } = require('../controllers/voteController');

// 後台管理路由
router.get('/:eventId/admin', voteController.renderVoteAdmin);
router.post('/:eventId/options', uploadVoteImageMulter.single('image'), voteController.addVoteOption);
router.delete('/:eventId/options/:optionId', voteController.deleteVoteOption);
router.put('/:eventId/settings', voteController.updateVoteSettings);

// 前台投票路由
router.get('/:eventId', voteController.renderVotePage);
router.post('/:eventId/submit', voteController.submitVote);
router.get('/:eventId/results', voteController.getVoteResults);
router.get('/:eventId/check/:userId', voteController.checkUserVote);

module.exports = router; 