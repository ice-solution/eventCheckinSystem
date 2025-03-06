const mongoose = require('mongoose');

const awardUserSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
});

const AwardUser = mongoose.model('AwardUser', awardUserSchema);

module.exports = AwardUser;