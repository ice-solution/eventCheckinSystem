const express = require('express');
const router = express.Router();
const voteController = require('../controllers/voteController');
const { uploadVoteImageMulter } = require('../controllers/voteController');
const permission = require('../middleware/permission');

function requireAdminSession(req, res, next) {
    if (!req.session || !req.session.user) return res.redirect('/login');
    next();
}

// 後台
router.get('/:eventId/admin', requireAdminSession, permission.requireVotesPermission, voteController.renderVoteAdmin);
router.put('/:eventId/settings', requireAdminSession, permission.requireVotesPermission, voteController.updateVoteSettings);
router.put('/:eventId/questions/reorder', requireAdminSession, permission.requireVotesPermission, voteController.reorderQuestions);
router.put('/:eventId/questions/:questionId', requireAdminSession, permission.requireVotesPermission, voteController.updateQuestion);
router.post(
    '/:eventId/questions/:questionId/kv',
    requireAdminSession,
    permission.requireVotesPermission,
    uploadVoteImageMulter.single('kv'),
    voteController.uploadQuestionKv
);
router.get('/:eventId/results', requireAdminSession, permission.requireVotesPermission, voteController.getVoteResults);

// 前台
router.get('/:eventId', voteController.renderVotePage);
router.post('/:eventId/auth', voteController.authVoteEmail);
router.post('/:eventId/logout', voteController.logoutVote);
router.post('/:eventId/submit', voteController.submitVote);

module.exports = router;
