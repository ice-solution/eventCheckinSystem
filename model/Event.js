const mongoose = require('mongoose');
const emailTemplateSchema = require('./EmailTemplate'); // 引入 EmailTemplate 模型

const pointSchema = new mongoose.Schema({
    point: {
        type: Number,
        required: true
    },
    created_at: {
        type: Date,
        default: Date.now
    },
});
const userSchema = new mongoose.Schema({
    point: {type:Number, default:0},
    email: { type: String },
    name: { type: String, required: true },
    phone_code: { type: String }, // 電話區號
    phone: { type: String }, // 電話
    company: { type: String },
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
    }],
    role: { type: String, default: 'guests' }, // 角色，默認為 'guests'
    saluation: { type: String }, // 稱謂
    industry: { type: String }, // 行業
    transport: { type: String }, // 交通方式
    meal: { type: String }, // 餐飲選擇
    remarks: { type: String } // 備註
});

const attendeeSchema = new mongoose.Schema({
    name: { type: String, required: true },
    location: { type: String, required: true },
    phone: { type: String, required: true },
    email: { type: String, required: true },
    promo_codes: [{ code_name: String, point: Number }]
});

const winnerSchema = new mongoose.Schema({
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // 用戶 ID
    name: { type: String, required: true }, // 用戶名稱
    company: { type: String, required: true } // 用戶公司
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
    points: [pointSchema],
    winners: [winnerSchema] // 新增 winners 字段
});

// 在保存之前更新 modified_at 字段
eventSchema.pre('save', function(next) {
    this.modified_at = Date.now(); // 每次保存時更新修改時間
    next();
});

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;