const mongoose = require('mongoose');

const gameHistorySchema = new mongoose.Schema({
    gameId: { 
        type: String, 
        required: true 
    },
    userId: { 
        type: String, 
        required: true 
    },
    point: { 
        type: Number, 
        required: true 
    },
    created_at: { 
        type: Date, 
        default: Date.now 
    },
    // 可選：添加更多遊戲相關字段
    gameData: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
});

// 添加索引以提高查詢性能
gameHistorySchema.index({ gameId: 1, userId: 1 });
gameHistorySchema.index({ created_at: -1 });

const GameHistory = mongoose.model('GameHistory', gameHistorySchema);

module.exports = GameHistory;
