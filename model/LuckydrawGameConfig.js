const mongoose = require('mongoose');

const luckydrawGameConfigSchema = new mongoose.Schema({
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true, unique: true },
    config: { type: mongoose.Schema.Types.Mixed, required: true },
    updatedAt: { type: Date, default: Date.now }
});

luckydrawGameConfigSchema.index({ eventId: 1 });

const LuckydrawGameConfig = mongoose.model('LuckydrawGameConfig', luckydrawGameConfigSchema);

module.exports = LuckydrawGameConfig;
