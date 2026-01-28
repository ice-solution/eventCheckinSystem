const BadgeConfig = require('../model/BadgeConfig');
const FormConfig = require('../model/FormConfig');
const Event = require('../model/Event');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

// 動態載入 canvas（如果可用）
let createCanvas, loadImage;
try {
    const canvas = require('canvas');
    createCanvas = canvas.createCanvas;
    loadImage = canvas.loadImage;
} catch (error) {
    console.warn('Canvas package not installed. Badge image generation will be limited.');
    console.warn('Please install canvas: npm install canvas');
}

// 渲染 badges 設計頁面
exports.renderBadgeDesignPage = async (req, res) => {
    const { eventId } = req.params;
    try {
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }
        
        // 獲取表單配置
        const formConfig = await FormConfig.findOne({ eventId });
        
        // 獲取或創建 badge 配置
        let badgeConfig = await BadgeConfig.findOne({ eventId });
        if (!badgeConfig) {
            badgeConfig = new BadgeConfig({
                eventId,
                name: 'Default Badge',
                elements: []
            });
            await badgeConfig.save();
        }
        
        res.render('admin/badge_design', {
            eventId,
            event,
            formConfig: formConfig || { sections: [] },
            badgeConfig
        });
    } catch (error) {
        console.error('Error rendering badge design page:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// 獲取 badge 配置
exports.getBadgeConfig = async (req, res) => {
    const { eventId } = req.params;
    try {
        let badgeConfig = await BadgeConfig.findOne({ eventId });
        if (!badgeConfig) {
            badgeConfig = new BadgeConfig({
                eventId,
                name: 'Default Badge',
                elements: []
            });
            await badgeConfig.save();
        }
        res.json(badgeConfig);
    } catch (error) {
        console.error('Error fetching badge config:', error);
        res.status(500).json({ message: 'Error fetching badge config' });
    }
};

// 保存 badge 配置
exports.saveBadgeConfig = async (req, res) => {
    const { eventId } = req.params;
    const { name, width, height, dpi, elements } = req.body;
    
    try {
        let badgeConfig = await BadgeConfig.findOne({ eventId });
        
        if (!badgeConfig) {
            badgeConfig = new BadgeConfig({ eventId });
        }
        
        badgeConfig.name = name || badgeConfig.name;
        badgeConfig.width = width || badgeConfig.width;
        badgeConfig.height = height || badgeConfig.height;
        badgeConfig.dpi = dpi || badgeConfig.dpi;
        badgeConfig.elements = elements || [];
        
        await badgeConfig.save();
        
        res.json({ 
            message: 'Badge config saved successfully',
            badgeConfig 
        });
    } catch (error) {
        console.error('Error saving badge config:', error);
        res.status(500).json({ message: 'Error saving badge config' });
    }
};

// 生成測試圖片
exports.generateTestImage = async (req, res) => {
    const { eventId } = req.params;
    
    try {
        const badgeConfig = await BadgeConfig.findOne({ eventId });
        if (!badgeConfig) {
            return res.status(404).json({ message: 'Badge config not found' });
        }
        
        // 嘗試從 event 中取得實際用戶資料
        const event = await Event.findById(eventId);
        let testData;
        
        if (event && event.users && event.users.length > 0) {
            // 使用 event 中第一個用戶的實際資料
            const user = event.users[0];
            const userObject = user.toObject ? user.toObject({ minimize: false }) : user;
            
            testData = {
                user: userObject,
                qrcodeUrl: `https://api.qrserver.com/v1/create-qr-code/?data=${user._id}&size=200x200`
            };
        } else {
            // 如果沒有用戶，使用預設測試數據
            testData = {
                user: {
                    name: '測試用戶',
                    email: 'test@example.com',
                    company: '測試公司',
                    phone: '12345678'
                },
                qrcodeUrl: 'https://api.qrserver.com/v1/create-qr-code/?data=test123&size=200x200'
            };
        }
        
        // 生成圖片
        const imageUrl = await generateBadgeImage(badgeConfig, testData);
        
        // 更新配置中的測試圖片 URL
        badgeConfig.testImageUrl = imageUrl;
        await badgeConfig.save();
        
        res.json({ 
            message: 'Test image generated successfully',
            imageUrl,
            usedRealUser: event && event.users && event.users.length > 0
        });
    } catch (error) {
        console.error('Error generating test image:', error);
        res.status(500).json({ message: 'Error generating test image' });
    }
};

// 生成實際 badge 圖片（用於打印）
exports.generateBadgeImage = async (req, res) => {
    const { eventId, userId } = req.params;
    
    try {
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ message: 'Event not found' });
        }
        
        const user = event.users.id(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        
        const badgeConfig = await BadgeConfig.findOne({ eventId });
        if (!badgeConfig) {
            return res.status(404).json({ message: 'Badge config not found' });
        }
        
        // 準備用戶數據
        const userData = {
            user: user.toObject ? user.toObject() : user,
            qrcodeUrl: `https://api.qrserver.com/v1/create-qr-code/?data=${user._id}&size=200x200`
        };
        
        // 生成圖片
        const imageUrl = await generateBadgeImage(badgeConfig, userData);
        
        res.json({ imageUrl });
    } catch (error) {
        console.error('Error generating badge image:', error);
        res.status(500).json({ message: 'Error generating badge image' });
    }
};

// 內部函數：生成 badge 圖片
async function generateBadgeImage(badgeConfig, data) {
    if (!createCanvas || !loadImage) {
        throw new Error('Canvas package is not installed. Please install it: npm install canvas');
    }
    
    const dimensions = badgeConfig.getPixelDimensions();
    const canvas = createCanvas(dimensions.width, dimensions.height);
    const ctx = canvas.getContext('2d');
    
    // 設置白色背景
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);
    
    // 繪製每個元素
    for (const element of badgeConfig.elements) {
        await drawElement(ctx, element, data, dimensions);
    }
    
    // 保存圖片
    const filename = `badge_${badgeConfig.eventId}_${Date.now()}.png`;
    const filepath = path.join(__dirname, '../public/badges', filename);
    
    // 確保目錄存在
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    
    // 保存文件
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(filepath, buffer);
    
    // 返回 URL
    return `/badges/${filename}`;
}

// 繪製單個元素
async function drawElement(ctx, element, data, dimensions) {
    switch (element.type) {
        case 'text':
            await drawText(ctx, element, data, dimensions);
            break;
        case 'qrcode':
            await drawQRCode(ctx, element, data);
            break;
        case 'image':
            await drawImage(ctx, element, data);
            break;
    }
}

// 文字換行函數
function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = words[0] || '';

    for (let i = 1; i < words.length; i++) {
        const word = words[i];
        const width = ctx.measureText(currentLine + ' ' + word).width;
        if (width < maxWidth) {
            currentLine += ' ' + word;
        } else {
            lines.push(currentLine);
            currentLine = word;
        }
    }
    lines.push(currentLine);
    return lines;
}

// 繪製文本
async function drawText(ctx, element, data, dimensions) {
    let content = element.content || '';
    
    // 替換動態變量
    content = replaceVariables(content, data);
    
    // 計算實際 font-size（根據 size 百分比）
    const baseFontSize = element.fontSize || 16;
    const sizePercent = element.size || 100;
    const actualFontSize = Math.round(baseFontSize * (sizePercent / 100));
    
    // 設置字體樣式
    ctx.font = `${element.fontWeight || 'normal'} ${actualFontSize}px ${element.fontFamily || 'Arial'}`;
    ctx.fillStyle = element.color || '#000000';
    
    // 處理 fullWidth：如果 fullWidth，則元素寬度為整個 canvas 寬度，x 為 0
    let elementX = element.x;
    let elementWidth = element.width || 300;
    
    if (element.fullWidth) {
        elementX = 0;
        elementWidth = dimensions.width;
    }
    
    // 設定文字對齊方式
    // fullWidth 時強制置中，否則使用設定的 textAlign（預設 center）
    const textAlign = element.fullWidth ? 'center' : (element.textAlign || 'center');
    ctx.textAlign = textAlign;
    ctx.textBaseline = 'top';
    
    // 計算文字繪製的 x 座標
    let x = elementX;
    if (textAlign === 'center') {
        x = elementX + elementWidth / 2;
    } else if (textAlign === 'right') {
        x = elementX + elementWidth;
    } else {
        x = elementX;
    }
    
    // 處理文字換行
    const maxWidth = elementWidth - 10; // 留一點邊距
    const lines = wrapText(ctx, content, maxWidth);
    
    // 繪製多行文字
    const lineHeight = actualFontSize * 1.2; // 行高
    lines.forEach((line, index) => {
        ctx.fillText(line, x, element.y + index * lineHeight);
    });
}

// 繪製 QR Code
async function drawQRCode(ctx, element, data) {
    try {
        let qrData = element.qrData || '{{qrcodeUrl}}';
        qrData = replaceVariables(qrData, data);
        
        // 如果 qrData 是 URL，直接使用；否則生成 QR Code
        let image;
        if (qrData.startsWith('http')) {
            image = await loadImage(qrData);
        } else {
            // 生成 QR Code data URL
            const qrDataUrl = await QRCode.toDataURL(qrData, {
                width: element.width || 200,
                margin: 1
            });
            image = await loadImage(qrDataUrl);
        }
        
        // 繪製圖片
        ctx.drawImage(
            image,
            element.x,
            element.y,
            element.width || image.width,
            element.height || image.height
        );
    } catch (error) {
        console.error('Error drawing QR code:', error);
    }
}

// 繪製圖片
async function drawImage(ctx, element, data) {
    try {
        let imageUrl = element.imageUrl || '';
        imageUrl = replaceVariables(imageUrl, data);
        
        if (imageUrl) {
            const image = await loadImage(imageUrl);
            ctx.drawImage(
                image,
                element.x,
                element.y,
                element.width || image.width,
                element.height || image.height
            );
        }
    } catch (error) {
        console.error('Error drawing image:', error);
    }
}

// 替換變量
function replaceVariables(text, data) {
    if (!text) return '';
    
    // 替換 {{user.fieldName}}
    text = text.replace(/\{\{user\.(\w+)\}\}/g, (match, field) => {
        return data.user && data.user[field] ? String(data.user[field]) : '';
    });
    
    // 替換 {{qrcodeUrl}}
    text = text.replace(/\{\{qrcodeUrl\}\}/g, data.qrcodeUrl || '');
    
    // 替換其他變量
    Object.keys(data).forEach(key => {
        if (key !== 'user') {
            const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            text = text.replace(regex, data[key] || '');
        }
    });
    
    return text;
}

