const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    point: {type:Number, default:0},
    email: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    phone_code: { type: String }, // 電話區號
    phone: { type: String }, // 電話
    company: { type: String, required: true },
    isCheckIn: { type: Boolean, default: false }, // 是否簽到
    create_at: { type: Date, default: Date.now }, // 創建時間
    modified_at: { type: Date, default: Date.now } // 修改時間
});

const eventSchema = new mongoose.Schema({
    name: { type: String, required: true }, // 事件名稱
    from: { type: Date, required: true },   // 事件開始時間
    to: { type: Date, required: true },     // 事件結束時間
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Auth', required: true },
    created_at: { type: Date, default: Date.now }, // 創建時間
    modified_at: { type: Date, default: Date.now }, // 修改時間
    users:[userSchema]
});

// 在保存之前更新 modified_at 字段
eventSchema.pre('save', function(next) {
    this.modified_at = Date.now(); // 每次保存時更新修改時間
    next();
});

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;