const express = require('express');
const router = express.Router();
const formConfigController = require('../controllers/formConfigController');

// 渲染表單配置管理頁面
router.get('/:eventId', formConfigController.renderFormConfigPage);

// 獲取事件的表單配置
router.get('/:eventId/config', formConfigController.getFormConfig);

// 更新事件的表單配置
router.put('/:eventId/config', formConfigController.updateFormConfig);

// 重置為預設配置
router.post('/:eventId/reset', formConfigController.resetToDefault);

// 用 sample user document 同步 FormConfig fields（RSVP 欄位列表）
router.post('/:eventId/sync-fields-from-sample', formConfigController.syncFieldsFromUserSample);

// Custom form sample HTML
router.get('/:eventId/custom-form/sample', (req, res) => {
    const registerPageController = require('../controllers/registerPageController');
    const html = registerPageController.getCustomFormSampleHtml();
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=sponsorship-custom-form.html');
    res.send(html);
});

// Custom form fields / sampleUser JSON（方便 sync RSVP fields）
router.get('/:eventId/custom-form/fields-json', (req, res) => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, '..', 'template', 'sponsorship-custom-form.json');
    if (!fs.existsSync(filePath)) {
        return res.status(404).json({ success: false, message: 'sponsorship-custom-form.json not found' });
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=sponsorship-custom-form.json');
    res.send(fs.readFileSync(filePath, 'utf8'));
});

module.exports = router;

