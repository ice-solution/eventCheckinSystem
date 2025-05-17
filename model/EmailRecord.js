const mongoose = require('mongoose');

const emailRecordchema = new mongoose.Schema({
    recipient: { type: String, required: true }, // 電子郵件主題
    status: { type: String,  default: "", },  
    emailTemplate:  { type: mongoose.Schema.Types.ObjectId, ref: 'EmailTemplate' }, // 電子郵件內容
    created_at: { type: Date, default: Date.now }, // 創建時間
    errorMessage: { type: String }, // 錯誤訊息
});

module.exports = mongoose.model('EmailRecord', emailRecordchema);