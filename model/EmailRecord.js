const mongoose = require('mongoose');

const emailRecordchema = new mongoose.Schema({
    recipient: { type: String, required: true }, // 收件人郵箱
    status: { type: String, default: "pending" }, // 發送狀態：pending, sent, failed, delivered, bounced
    emailTemplate: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailTemplate' }, // 電子郵件模板
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' }, // 事件 ID（可選）
    userId: { type: String }, // 用戶 ID（可選）
    messageId: { type: String }, // 郵件服務商返回的 Message ID
    subject: { type: String }, // 郵件主題
    created_at: { type: Date, default: Date.now }, // 創建時間
    sent_at: { type: Date }, // 發送時間
    delivered_at: { type: Date }, // 送達時間
    opened_at: { type: Date }, // 首次打開時間
    opened_count: { type: Number, default: 0 }, // 打開次數
    clicked_at: { type: Date }, // 首次點擊時間
    clicked_count: { type: Number, default: 0 }, // 點擊次數
    clicked_links: [{ 
        url: { type: String },
        clicked_at: { type: Date }
    }], // 點擊的連結記錄
    errorLog: { type: String }, // 錯誤訊息
    trackingId: { type: String, unique: true }, // 追蹤 ID（用於追蹤像素和連結）
});

// 創建索引以加快查詢
emailRecordchema.index({ emailTemplate: 1 });
emailRecordchema.index({ eventId: 1 });
emailRecordchema.index({ trackingId: 1 });
emailRecordchema.index({ recipient: 1 });

module.exports = mongoose.model('EmailRecord', emailRecordchema);