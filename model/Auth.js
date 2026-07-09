// model/Auth.js
const mongoose = require('mongoose');

const eventPermissionSchema = new mongoose.Schema({
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    functions: [{ type: String }] // 該 event 下可使用的功能鍵，如 rsvp, guestList, emailTemplate...
}, { _id: false });

const authSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    created_at: { type: Date, default: Date.now },
    modified_at: { type: Date, default: Date.now },
    role: {
        type: String,
        enum: ['admin', 'staff', 'reception', 'user'],
        default: 'user'
    },
    // 非 admin 用戶：可存取哪些 event（ObjectId 列表）
    allowedEvents: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Event' }],
    // 非 admin 用戶：每個 event 下可使用哪些功能
    eventPermissions: [eventPermissionSchema]
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