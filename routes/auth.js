const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// 添加用戶路由

router.post('/add', authController.addUser); // 只有經過身份驗證的用戶可以添加用戶
router.post('/create', authController.createUser); // 添加用戶創建的路由

router.get('/add', authController.addUserPage);

module.exports = router;