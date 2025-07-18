const mongoose = require('mongoose');

const transactionSchema = new mongoose.Schema({
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    userEmail: { type: String, required: true },
    userName: { type: String, required: true },
    ticketId: { type: mongoose.Schema.Types.ObjectId, required: true },
    ticketTitle: { type: String, required: true },
    ticketPrice: { type: Number, required: true },
    stripeSessionId: { type: String, required: true },
    status: { type: String, enum: ['pending', 'paid', 'failed'], default: 'pending' },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

transactionSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const Transaction = mongoose.model('Transaction', transactionSchema);
module.exports = Transaction; 