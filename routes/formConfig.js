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

module.exports = router;

