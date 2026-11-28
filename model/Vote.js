const mongoose = require('mongoose');

/** KV 上可點選的 slot（人選已喺 KV 圖入面） */
const voteSlotSchema = new mongoose.Schema({
    label: { type: String, required: true }, // 顯示名／編號，例如 Slot 1
    votes: { type: Number, default: 0 },
    created_at: { type: Date, default: Date.now }
});

/** 一條題目 = 一張 KV + N 個 slots */
const voteQuestionSchema = new mongoose.Schema({
    title: { type: String, default: '' },
    kvImage: { type: String, default: '' },
    slots: [voteSlotSchema],
    order: { type: Number, default: 0 },
    created_at: { type: Date, default: Date.now }
});

/** 一份完整選票（三題一次提交） */
const voteBallotSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, required: true },
    userEmail: { type: String, required: true },
    userName: { type: String, default: '' },
    answers: [{
        questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
        slotId: { type: mongoose.Schema.Types.ObjectId, required: true }
    }],
    votedAt: { type: Date, default: Date.now }
});

const voteSchema = new mongoose.Schema({
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: 'Event', required: true },
    title: { type: String, required: true }, // 左上 Vote Title
    description: { type: String, default: '' }, // gate short description（可空）
    /** 前台文案（可空 = 唔顯示／唔用預設字） */
    headerRight: { type: String, default: '' }, // 右上
    gateTitle: { type: String, default: '' }, // email 登入標題
    pickHint: { type: String, default: '' }, // Tap one option…
    submitLabel: { type: String, default: '' }, // Submit 按鈕
    doneTitle: { type: String, default: '' }, // 提交成功標題
    questions: [voteQuestionSchema],
    records: [voteBallotSchema],
    isActive: { type: Boolean, default: true },
    created_at: { type: Date, default: Date.now },
    modified_at: { type: Date, default: Date.now },

    // 舊版欄位（遷移／相容；新流程唔再用）
    options: { type: Array, default: undefined }
});

module.exports = mongoose.model('Vote', voteSchema);
