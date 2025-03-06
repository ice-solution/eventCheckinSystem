const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// 添加用戶路由
router.get('/', (req, res) => {
    res.render('admin/auth'); // 渲染 auth.ejs 頁面
});
router.post('/add', authController.addUser); // 只有經過身份驗證的用戶可以添加用戶

module.exports = router;