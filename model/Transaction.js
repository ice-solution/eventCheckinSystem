const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    userEmail: { type: String, required: true },
    userName: { type: String, required: true },
    ticketId: { type: mongoose.Schema.Types.ObjectId, required: true },
    ticketTitle: { type: String, required: true },
    ticketPrice: { type: Number, required: true },
    stripeSessionId: { type: String, required: true },
    /** 付款閘道：'stripe' | 'wonder'，依 PAYMENT_GATEWAY 建立時寫入 */
    paymentGateway: { type: String, enum: ['stripe', 'wonder'], default: 'wonder' },
    status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    // 付款前註冊表單的完整資料（FormConfig 欄位），webhook 完成付款後用來寫入 event.users
    userFormData: { type: mongoose.Schema.Types.Mixed },
    /** Wonder 回調的完整 body（Invoice 等），用於對帳與排查 */
    transactionData: { type: mongoose.Schema.Types.Mixed }
});

transactionSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction; 