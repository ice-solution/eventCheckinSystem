const express = require('express');
const router = express.Router();
const awardsController = require('../controllers/awardsController');

// 設置抽獎路由
router.get('/awards_admin', awardsController.renderAdminPage);
router.get('/display_awards', awardsController.renderDisplayPage);

module.exports = router;