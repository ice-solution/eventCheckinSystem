const mongoose = require('mongoose');

// 標籤元素配置
const badgeElementSchema = new mongoose.Schema({
    type: {
        type: String,
        enum: ['text', 'qrcode', 'image'],
        required: true
    },
    // 位置和大小
    x: { type: Number, required: true }, // X 座標（像素）
    y: { type: Number, required: true }, // Y 座標（像素）
    width: { type: Number, default: null }, // 寬度（像素，null 表示自動）
    height: { type: Number, default: null }, // 高度（像素，null 表示自動）
    
    // 文本相關屬性
    content: { type: String, default: '' }, // 文本內容或變量（如 {{user.name}}）
    fontSize: { type: Number, default: 16 }, // 字體大小
    fontFamily: { type: String, default: 'Arial' }, // 字體
    fontWeight: { type: String, default: 'normal' }, // 字體粗細
    textAlign: { 
        type: String, 
        enum: ['left', 'center', 'right'],
        default: 'left'
    },
    color: { type: String, default: '#000000' }, // 文字顏色
    
    // QR Code 相關
    qrData: { type: String, default: '{{qrcodeUrl}}' }, // QR Code 數據或變量
    
    // 圖片相關
    imageUrl: { type: String, default: '' }, // 圖片 URL
    
    // 排序（用於圖層）
    zIndex: { type: Number, default: 0 }
});

// 標籤配置
const badgeConfigSchema = new mongoose.Schema({
    eventId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Event',
        required: true
    },
    name: {
        type: String,
        required: true,
        default: 'Default Badge'
    },
    // 標籤尺寸（毫米）- 橫向：100mm x 62mm
    width: { type: Number, default: 100 }, // 寬度（mm）
    height: { type: Number, default: 62 }, // 高度（mm）
    // DPI 設置（用於計算像素）
    dpi: { type: Number, default: 300 }, // 默認 300 DPI
    
    // 標籤元素
    elements: [badgeElementSchema],
    
    // 測試圖片 URL（生成後保存）
    testImageUrl: { type: String, default: '' },
    
    // 元數據
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// 更新時間中間件
badgeConfigSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// 計算像素尺寸的方法
badgeConfigSchema.methods.getPixelDimensions = function() {
    const mmToInch = 0.0393701;
    const widthInch = this.width * mmToInch;
    const heightInch = this.height * mmToInch;
    return {
        width: Math.round(widthInch * this.dpi),
        height: Math.round(heightInch * this.dpi)
    };
};

const BadgeConfig = mongoose.model('BadgeConfig', badgeConfigSchema);

module.exports = BadgeConfig;

