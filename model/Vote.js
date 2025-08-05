const mongoose = require('mongoose');

const voteOptionSchema = new mongoose.Schema({
    name: { type: String, required: true }, // 候選項目名稱
    image: { type: String }, // 候選項目圖片
    description: { type: String }, // 描述
    votes: { type: Number, default: 0 }, // 得票數
    created_at: { type: Date, default: Date.now }
});

const voteRecordSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true }, // 投票用戶ID
    userName: { type: String, required: true }, // 投票用戶姓名
    optionId: { type: mongoose.Schema.Types.ObjectId, required: true }, // 選擇的選項ID
    votedAt: { type: Date, default: Date.now } // 投票時間
});

const voteSchema = new mongoose.Schema({
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true }, // 事件ID
    title: { type: String, required: true }, // 投票標題
    description: { type: String }, // 投票描述
    options: [voteOptionSchema], // 候選項目
    records: [voteRecordSchema], // 投票記錄
    isActive: { type: Boolean, default: true }, // 是否啟用
    created_at: { type: Date, default: Date.now },
    modified_at: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Vote', voteSchema); 