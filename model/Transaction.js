const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    userEmail: { type: String, required: true },
    userName: { type: String, required: true },
    ticketId: { type: mongoose.Schema.Types.ObjectId, required: true },
    ticketTitle: { type: String, required: true },
    ticketPrice: { type: Number, required: true },
    stripeSessionId: { type: String, required: true },
    /** 付款閘道：'stripe' | 'wonder' | 'none'（$0 免費票券無付款） */
    paymentGateway: { type: String, enum: ['stripe', 'wonder', 'none'], default: 'wonder' },
    status: { type: String, enum: ['pending', 'paid', 'failed', 'free'], default: 'pending' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    // 付款前註冊表單的完整資料（FormConfig 欄位），webhook 完成付款後用來寫入 event.users
    userFormData: { type: mongoose.Schema.Types.Mixed },
    /** 付款成功寫入 event.users 後的 RSVP user._id（避免重覆 email 時用錯人） */
    userId: { type: mongoose.Schema.Types.ObjectId, default: null },
    /** 若使用 promocode 折扣：折後/原價與代碼資訊（用於管理端查詢） */
    promoCode: { type: String, default: '' },
    promoDiscountAmount: { type: Number, default: 0 }, // fixed：減價多少（HKD）
    promoOriginalTicketPrice: { type: Number, default: 0 }, // 折扣前票價（HKD）
    /** Wonder 回調的完整 body（Invoice 等），用於對帳與排查 */
    transactionData: { type: mongoose.Schema.Types.Mixed }
});

transactionSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction; 