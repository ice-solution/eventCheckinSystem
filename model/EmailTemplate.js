const mongoose = require('mongoose');

const emailTemplateSchema = new mongoose.Schema({
    subject: { type: String, required: true }, // 電子郵件主題
    content: { type: String,  default: "", },    // 電子郵件內容
    created_at: { type: Date, default: Date.now }, // 創建時間
    modified_at: { type: Date, default: Date.now }  // 修改時間
});

module.exports = mongoose.model('EmailTemplate', emailTemplateSchema);