const mongoose = require('mongoose');
const emailTemplateSchema = require('./EmailTemplate'); // 引入 EmailTemplate 模型

const userSchema = new mongoose.Schema({
    point: {type:Number, default:0},
    email: { type: String, required: true },
    name: { type: String, required: true },
    phone_code: { type: String }, // 電話區號
    phone: { type: String }, // 電話
    company: { type: String, required: true },
    isCheckIn: { type: Boolean, default: false }, // 是否簽到
    create_at: { type: Date, default: Date.now }, // 創建時間
    modified_at: { type: Date, default: Date.now }, // 修改時間
    promos: [{ // 添加 promos 字段
        event_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Event' },
        attendee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Attendee' },
        promo_code_id: { type: mongoose.Schema.Types.ObjectId, ref: 'PromoCode' }
    }],
    points: [{ // 新增 points 字段
        attendee_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Attendee' }, // 參展商 ID
        point: { type: Number, default: 0 } // 點數
    }]
});

const attendeeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    location: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    promo_codes: [{ code_name: String, point: Number }]
});

const eventSchema = new mongoose.Schema({
    name: { type: String, required: true }, // 事件名稱
    from: { type: Date, required: true },   // 事件開始時間
    to: { type: Date, required: true },     // 事件結束時間
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Auth', required: true },
    created_at: { type: Date, default: Date.now }, // 創建時間
    modified_at: { type: Date, default: Date.now }, // 修改時間
    emailTemplate: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailTemplate' }, // 引用 EmailTemplate
    users:[userSchema],
    attendees: [attendeeSchema], // 添加參展商參數

});

// 在保存之前更新 modified_at 字段
eventSchema.pre('save', function(next) {
    this.modified_at = Date.now(); // 每次保存時更新修改時間
    next();
});

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;