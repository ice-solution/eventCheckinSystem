const express = require('express');
const router = express.Router();
const emailTemplateController = require('../controllers/emailTemplateController');

// 獲取電子郵件模板頁面
router.get('/', (req, res) => {
    res.render('admin/email_template'); // 渲染 email_template.ejs 頁面
});

// 保存電子郵件模板路由
router.post('/', emailTemplateController.saveEmailTemplate); // 只有經過身份驗證的用戶可以保存模板

module.exports = router;