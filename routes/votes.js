const express = require('express');
const router = express.Router();
const voteController = require('../controllers/voteController');
const { uploadVoteImageMulter } = require('../controllers/voteController');
const permission = require('../middleware/permission');

// 後台管理路由（需登入 + 權限）
router.get('/:eventId/admin', (req, res, next) => {
    if (!req.session || !req.session.user) return res.redirect('/login');
    next();
}, permission.requireVotesPermission, voteController.renderVoteAdmin);
router.post('/:eventId/options', uploadVoteImageMulter.single('image'), voteController.addVoteOption);
router.delete('/:eventId/options/:optionId', voteController.deleteVoteOption);
router.put('/:eventId/settings', voteController.updateVoteSettings);

// 前台投票路由
router.get('/:eventId', voteController.renderVotePage);
router.post('/:eventId/submit', voteController.submitVote);
router.get('/:eventId/results', voteController.getVoteResults);
router.get('/:eventId/check/:userId', voteController.checkUserVote);

module.exports = router; 