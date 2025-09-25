const express = require('express');
const router = express.Router();
const gameController = require('../controllers/gameController');

// 遊戲開始API
// POST: abc.com/api/game/:gameId/gamestart
router.post('/:gameId/gamestart', gameController.startGame);

// 遊戲結束API  
// POST: abc.com/api/game/:gameId/endgame
router.post('/:gameId/endgame', gameController.endGame);

// 獲取用戶遊戲歷史
// GET: abc.com/api/game/:gameId/user/:eventUserId/history
router.get('/:gameId/user/:eventUserId/history', gameController.getGameHistory);

// 獲取遊戲統計信息
// GET: abc.com/api/game/:gameId/stats
router.get('/:gameId/stats', gameController.getGameStats);

// 事件遊戲ID管理API
// POST: abc.com/api/game/event/:eventId/gameId (添加遊戲ID到事件)
router.post('/event/:eventId/gameId', gameController.addGameIdToEvent);

// DELETE: abc.com/api/game/event/:eventId/gameId/:gameId (從事件移除遊戲ID)
router.delete('/event/:eventId/gameId/:gameId', gameController.removeGameIdFromEvent);

// GET: abc.com/api/game/event/:eventId/gameIds (獲取事件的所有遊戲ID)
router.get('/event/:eventId/gameIds', gameController.getEventGameIds);

module.exports = router;
