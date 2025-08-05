const mongoose = require('mongoose');

const prizeSchema = new mongoose.Schema({
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true }, // 事件ID
    name: { type: String, required: true }, // 獎品名稱
    picture: { type: String }, // 獎品圖片URL
    unit: { type: Number, default: 1 }, // 獎品數量
    created_at: { type: Date, default: Date.now }, // 創建時間
    modified_at: { type: Date, default: Date.now }  // 修改時間
});

module.exports = mongoose.model('Prize', prizeSchema); 