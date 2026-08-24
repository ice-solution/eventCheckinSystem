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
    scannedTreasureItems: [{ type: mongoose.Schema.Types.ObjectId }], // 已掃描的 Treasure Hunt 項目 ID 列表
    /** 專屬 Application 連結：已完成補填後不可再開改 */
    applicationCompleted: { type: Boolean, default: false },
    applicationCompletedAt: { type: Date }
}, {
    strict: false // 允許保存 formConfig 中定義的動態字段（如 funcation_unit 等）
});

const winnerSchema = new mongoose.Schema({
    _id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // 用戶 ID
    name: { type: String, required: true }, // 用戶名稱
    company: { type: String }, // 用戶公司
    table: { type: String }, // 桌號
    prizeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Prize' }, // 獎品ID
    prizeName: { type: String }, // 獎品名稱
    order: { type: Number, required: false, default: 0 }, // 抽獎號碼（從1開始）；舊資料可能無此欄位，故不設 required
    wonAt: { type: Date, default: Date.now } // 中獎時間
});

const ticketSchema = new mongoose.Schema({
    // Mixed：相容舊版字串 title 與新版 { zh, en }
    title: { type: mongoose.Schema.Types.Mixed, default: () => ({ zh: '', en: '' }) },
    price: { type: Number, required: true },
    /** 票券分類 key（與 FormConfig.paymentTicketUi.categoryButtons[].key 對應） */
    category: { type: String, default: '' },
    /** @deprecated 舊單一截止日，新資料請用 datetimeTo */
    datetime: { type: Date },
    datetimeFrom: { type: Date },
    datetimeTo: { type: Date }
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

/** 分站簽到（Station Check-in）站點定義 */
const checkInStationSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, default: '' },
    enabled: { type: Boolean, default: true },
    order: { type: Number, default: 0 },
    /** Section List：此分站允許簽到的 RSVP 用戶；空 = 不限制（全部已進場用戶可簽） */
    allowedUserIds: [{ type: mongoose.Schema.Types.ObjectId }],
    created_at: { type: Date, default: Date.now },
    modified_at: { type: Date, default: Date.now },
});

/** 分站簽到記錄：同一 user + station 只允許一次 */
const stationCheckInSchema = new mongoose.Schema({
    stationId: { type: mongoose.Schema.Types.ObjectId, required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    userName: { type: String, default: '' },
    userEmail: { type: String, default: '' },
    checkedInAt: { type: Date, default: Date.now },
    checkedInBy: { type: String, default: '' }, // 操作者（後台帳號或 ipad）
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
    /** Luckydraw List / Award / Export 要顯示的來賓欄位（FormConfig fieldName）；空則用預設 name, company, table */
    luckydrawListFieldNames: [{ type: String }],
    /** 中獎名單頁（/luckydraw/award）密碼；空則不需密碼 */
    luckydrawAwardPassword: { type: String, default: '' },
    isPaymentEvent: { type: Boolean, default: false }, // 是否為付費活動
    PaymentTickets: [ticketSchema], // 票券陣列
    /**
     * 折扣碼（Promotion Code / Coupon）
     * 用於 Payment Event checkout 折價；折後 $0 會繞過付款閘道。
     */
    promoCodes: [{
        code: { type: String, required: true }, // 代碼（會在寫入時正規化為大寫）
        enabled: { type: Boolean, default: true },
        discountType: { type: String, enum: ['fixed'], default: 'fixed' },
        discountValue: { type: Number, required: true }, // fixed：減價多少（HKD）
        maxUses: { type: Number, default: 0 }, // 0 = 無限
        usedCount: { type: Number, default: 0 },
        uses: [{
            transactionId: { type: mongoose.Schema.Types.ObjectId },
            userEmail: { type: String, default: '' },
            userName: { type: String, default: '' },
            originalTicketPrice: { type: Number, default: 0 },
            discountAmount: { type: Number, default: 0 },
            paidTicketPrice: { type: Number, default: 0 },
            usedAt: { type: Date, default: Date.now }
        }]
    }],
    gameIds: [{ type: String }], // 新增 gameIds 陣列，存儲該事件開放的遊戲ID
    scanPointUsers: [scanPointUserSchema], // 掃瞄加分用戶列表
    treasureHuntItems: [treasureHuntItemSchema], // Treasure Hunt 項目列表
    checkInStations: [checkInStationSchema], // 分站簽到站點
    stationCheckIns: [stationCheckInSchema], // 分站簽到記錄
    // 電郵發送設置
    emailSettings: {
        sendWelcomeEmail: { type: Boolean, default: false }, // 是否立即發送歡迎電郵
        sendConfirmationEmail: { type: Boolean, default: false }, // 是否立即發送確認電郵
        sendReminderEmail: { type: Boolean, default: false }, // 是否立即發送提示電郵
        sendThankYouEmail: { type: Boolean, default: false }, // 是否立即發送感謝電郵
        welcomeMessageMethod: { type: String, enum: ['email', 'sms', 'both'], default: 'email' } // 歡迎消息發送方式：email/sms/both
    },
    // 排桌：左側依 FormConfig 欄位分類、右側圓桌拖放；攜眷數 N 則佔席 (N+1)
    seatingArrangement: {
        categoryFieldName: { type: String, default: 'company' },
        companionByUserId: { type: mongoose.Schema.Types.Mixed, default: {} },
        tables: [{
            id: { type: String, required: true },
            /** 自訂桌名；空白則前端用「第 N 桌」 */
            name: { type: String, default: '' },
            /** 此桌座位代號前綴，例如 A、B、VIP；顯示為 A1、B1 */
            seatLabelPrefix: { type: String, default: '' },
            /** round=圓桌 square=方桌 row=戲院式一排 prop=擺設／看枱（無座位） */
            shape: { type: String, enum: ['round', 'square', 'row', 'prop'], default: 'round' },
            /** 整體縮放 0.5–2（各形狀皆可用） */
            scale: { type: Number, default: 1 },
            /** 方桌／排座長度；prop 為寬度（像素） */
            length: { type: Number, default: 360 },
            /** 擺設類型：stage / buffet / bar / entrance / restroom / flower / other */
            propType: { type: String, default: '' },
            /** 匯出時顯示格式：name / type / nameType / iconName / custom */
            propExportFormat: { type: String, default: 'nameType' },
            /** 匯出自訂文字（format=custom 時使用） */
            propExportText: { type: String, default: '' },
            x: { type: Number, default: 48 },
            y: { type: Number, default: 48 },
            capacity: { type: Number, default: 10 },
            userIds: [{ type: String }]
        }]
    },
    // 附件列表
    attachments: [{
        filename: { type: String, required: true }, // 原始文件名
        storedFilename: { type: String, required: true }, // 存儲的文件名
        url: { type: String, required: true }, // 文件訪問 URL
        size: { type: Number, required: true }, // 文件大小（字節）
        mimeType: { type: String, required: true }, // MIME 類型
        uploadedAt: { type: Date, default: Date.now } // 上傳時間
    }]
});

// 在保存之前更新 modified_at 字段
eventSchema.pre('save', function(next) {
    this.modified_at = Date.now(); // 每次保存時更新修改時間
    next();
});

const Event = mongoose.model('Event', eventSchema);

module.exports = Event;