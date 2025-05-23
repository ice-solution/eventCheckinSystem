// routes/website.js
const express = require('express');
const router = express.Router();
const path = require('path');

// 路由到 demo_website/index.ejs
router.get('/:event_id', (req, res) => {
    const { event_id } = req.params; // 獲取 event_id
    res.render('exvent/index', { event_id }); // 渲染 index.ejs，並傳遞 event_id
});

// 路由到 event_website/register.ejs
router.get('/:event_id/register', (req, res) => {
    const { event_id } = req.params; // 獲取 event_id
    res.render('exvent/register', { event_id }); // 渲染 register.ejs，並傳遞 event_id
});
// 路由到註冊成功頁面
router.get('/:event_id/register/success', (req, res) => {
    const { event_id } = req.params; // 獲取 event_id
    res.render('exvent/success', { event_id }); // 渲染註冊成功頁面
});
module.exports = router;