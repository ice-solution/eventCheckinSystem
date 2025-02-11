// model/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    uid: { type: String, required: true },
    email: { type: String },
    name: { type: String, required: true },
    broker_name: { type: String, required: true },
    isCheckIn: { type: Boolean, default: false } // 新增的布林字段，默認值為 false
});

const User = mongoose.model('User', userSchema);

module.exports = User;