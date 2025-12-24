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
    table: { type: String }, // 新增的 table 字段
    phone_code: { type: String }, // 電話區號
    phone: { type: String }, // 電話
    company: { type: String },
    isCheckIn: { type: Boolean, default: false }, // 是否簽到
    create_at: { type: Date, default: Date.now }, // 創建時間
    modified_at: { type: Date, default: Date.now }, // 修改時間
    checkInAt: { type: Date }, // 簽到時間
    role: { type: String, default: 'guests' }, // 角色，默認為 'guests'
    saluation: { type: String }, // 稱謂
    industry: { type: String }, // 行業
    transport: { type: String }, // 交通方式
    meal: { type: String }, // 餐飲選擇
    remarks: { type: String }, // 備註
    paymentStatus: { type: String, enum: ['unpaid', 'pending', 'paid', 'failed'], default: 'unpaid' }, // 付款狀態
    scannedTreasureItems: [{ type: mongoose.Schema.Types.ObjectId }] // 已掃描的 Treasure Hunt 項目 ID 列表
});

const winnerSchema = new mongoose.Schema({
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // 用戶 ID
    name: { type: String, required: true }, // 用戶名稱
    company: { type: String }, // 用戶公司
    table: { type: String }, // 桌號
    prizeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prize' }, // 獎品ID
    prizeName: { type: String }, // 獎品名稱
    order: { type: Number, required: true }, // 抽獎號碼（從1開始，不重用已刪除的號碼）
    wonAt: { type: Date, default: Date.now } // 中獎時間
});

const ticketSchema = new mongoose.Schema({
    title: { type: String, required: true },
    price: { type: Number, required: true },
    datetime: { type: Date, required: true }
});

// 掃瞄加分用戶 schema
const scanPointUserSchema = new mongoose.Schema({
    name: { type: String, required: true }, // 用戶名稱
    pin: { type: String, required: true }, // 6位數字 PIN 碼
    created_at: { type: Date, default: Date.now }, // 創建時間
    modified_at: { type: Date, default: Date.now } // 修改時間
});

// Treasure Hunt 項目 schema
const treasureHuntItemSchema = new mongoose.Schema({
    name: { type: String, required: true }, // 項目名稱
    points: { type: Number, required: true, min: 1 }, // 積分數值
    qrCodeData: { type: String, required: true }, // QR Code 數據（用於掃描識別）
    qrCodeImage: { type: String }, // QR Code 圖片 URL（可選）
    description: { type: String }, // 描述
    created_at: { type: Date, default: Date.now }, // 創建時間
    modified_at: { type: Date, default: Date.now } // 修改時間
});

const eventSchema = new mongoose.Schema({
    name: { type: String, required: true }, // 事件名稱
    from: { type: Date, required: true },   // 事件開始時間
    to: { type: Date, required: true },     // 事件結束時間
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Auth', required: true },
    created_at: { type: Date, default: Date.now }, // 創建時間
    modified_at: { type: Date, default: Date.now }, // 修改時間
    emailTemplate: { type: mongoose.Schema.Types.ObjectId, ref: 'EmailTemplate' }, // 引用 EmailTemplate
    users:[userSchema], // RSVP 註冊用戶
    guestList: [userSchema], // Guest List（預先準備的來賓列表，尚未註冊為 RSVP）
    points: [pointSchema],
    winners: [winnerSchema], // 新增 winners 字段
    maxLuckydrawOrder: { type: Number, default: 0 }, // 追蹤最大的中獎編號（即使刪除也不會減少，確保唯一性）
    isPaymentEvent: { type: Boolean, default: false }, // 是否為付費活動
    PaymentTickets: [ticketSchema], // 票券陣列
    gameIds: [{ type: String }], // 新增 gameIds 陣列，存儲該事件開放的遊戲ID
    scanPointUsers: [scanPointUserSchema], // 掃瞄加分用戶列表
    treasureHuntItems: [treasureHuntItemSchema], // Treasure Hunt 項目列表
    // 電郵發送設置
    emailSettings: {
        sendWelcomeEmail: { type: Boolean, default: false }, // 是否立即發送歡迎電郵
        sendConfirmationEmail: { type: Boolean, default: false }, // 是否立即發送確認電郵
        sendReminderEmail: { type: Boolean, default: false }, // 是否立即發送提示電郵
        sendThankYouEmail: { type: Boolean, default: false }, // 是否立即發送感謝電郵
        welcomeMessageMethod: { type: String, enum: ['email', 'sms', 'both'], default: 'email' } // 歡迎消息發送方式：email/sms/both
    }
});

// 在保存之前更新 modified_at 字段
eventSchema.pre('save', function(next) {
    this.modified_at = Date.now(); // 每次保存時更新修改時間
    next();
});

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;