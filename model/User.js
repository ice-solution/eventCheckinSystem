// model/User.js
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    email: { type: String,required: true, unique: true },
    name: { type: String, required: true },
    phone_code: { type: String }, // 新增的 phone_code 字段
    phone: { type: String }, // 新增的 phone 字段
    company: { type: String, required: true },
    isCheckIn: { type: Boolean, default: false }, // 新增的布林字段，默認值為 false
    create_at: { type: Date, default: Date.now }, // 新增的 create_at 字段
    modified_at: { type: Date, default: Date.now } // 新增的 modified_at 字段
});

const User = mongoose.model('User', userSchema);

module.exports = User;