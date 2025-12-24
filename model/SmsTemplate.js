const mongoose = require('mongoose');

const smsTemplateSchema = new mongoose.Schema({
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' }, // 事件ID
    content: { type: String, required: true, default: "" }, // SMS 內容（純文本）
    type: { type: String, default: "welcome" }, // SMS 類型（welcome, confirmation, reminder, thankYou）
    created_at: { type: Date, default: Date.now }, // 創建時間
    modified_at: { type: Date, default: Date.now } // 修改時間
});

// 在保存之前更新 modified_at 字段
smsTemplateSchema.pre('save', function(next) {
    this.modified_at = Date.now();
    next();
});

module.exports = mongoose.model('SmsTemplate', smsTemplateSchema);

