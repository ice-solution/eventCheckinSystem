// routes/website.js
const express = require('express');
const router = express.Router();
const path = require('path');

// 路由到 demo_website/index.ejs
router.get('/:event_id', (req, res) => {
    const { event_id } = req.params; // 獲取 event_id
    res.render('event_website/index', { event_id }); // 渲染 index.ejs，並傳遞 event_id
});

module.exports = router;