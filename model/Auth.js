// model/Auth.js
const mongoose = require('mongoose');

const authSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
    modified_at: { type: Date, default: Date.now },
    role: {
        type: String,
        enum: ['admin', 'staff', 'reception', 'user'], // 限制角色的值
        default: 'user' // 設置默認角色為 user
    }
});

// 在保存之前加密密碼
authSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        const bcrypt = require('bcrypt');
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
    }
    next();
});

const Auth = mongoose.model('Auth', authSchema);

module.exports = Auth;