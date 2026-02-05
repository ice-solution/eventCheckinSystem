const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const Auth = require('../model/Auth');
const Event = require('../model/Event');
const BadgeConfig = require('../model/BadgeConfig');
const { authenticateJwt, getJwtSecret } = require('../utils/jwtAuth');
const formConfigController = require('../controllers/formConfigController');
const eventsController = require('../controllers/eventsController');

const router = express.Router();

// 1) iPad API 登入：回傳 JWT（供後續 API 使用）
router.post('/login', async (req, res) => {
  const { username, password } = req.body || {};

  if (!username || !password) {
    return res.status(400).json({ message: 'username/password required' });
  }

  try {
    const user = await Auth.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const payload = {
      authId: String(user._id),
      username: user.username,
      role: user.role,
    };

    const token = jwt.sign(payload, getJwtSecret(), { expiresIn: '7d' });

    return res.json({
      token,
      token_type: 'Bearer',
      expires_in: 60 * 60 * 24 * 7,
      user: payload,
    });
  } catch (err) {
    console.error('iPad API login error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// 2) 取得所有 event 的 name/_id（預設：只回傳該 token 使用者(owner)的 events；admin 可回全部）
router.get('/events', authenticateJwt, async (req, res) => {
  try {
    const { role, authId } = req.jwt || {};

    const filter = role === 'admin' ? {} : { owner: authId };
    const events = await Event.find(filter).select({ _id: 1, name: 1 }).sort({ created_at: -1 });

    return res.json(events);
  } catch (err) {
    console.error('iPad API get events error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// 3) 透過 event _id 拿到 users（回傳該 Event.users）
router.get('/events/:eventId/users', authenticateJwt, async (req, res) => {
  const { eventId } = req.params;
  try {
    const event = await Event.findById(eventId).select({ users: 1, owner: 1 });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const { role, authId } = req.jwt || {};
    const isAdmin = role === 'admin';
    const isOwner = String(event.owner) === String(authId);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    return res.json(event.users || []);
  } catch (err) {
    console.error('iPad API get users by event error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// 3b) 取得 registration page 用的表單配置（FormConfig）
router.get('/events/:eventId/registration-config', authenticateJwt, async (req, res) => {
  const { eventId } = req.params;

  try {
    // 檢查權限：確認 event 存在且用戶有權限
    const event = await Event.findById(eventId).select({ owner: 1 });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const { role, authId } = req.jwt || {};
    const isAdmin = role === 'admin';
    const isOwner = String(event.owner) === String(authId);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // 直接重用 formConfigController 的邏輯（會自動建立 default config & 做資料遷移）
    return formConfigController.getFormConfig(req, res);
  } catch (err) {
    console.error('iPad API get registration config error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// 3c) 取得單個用戶詳細資料
router.get('/events/:eventId/users/:userId', authenticateJwt, async (req, res) => {
  const { eventId, userId } = req.params;

  try {
    // 檢查權限：確認 event 存在且用戶有權限
    const event = await Event.findById(eventId).select({ users: 1, owner: 1 });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const { role, authId } = req.jwt || {};
    const isAdmin = role === 'admin';
    const isOwner = String(event.owner) === String(authId);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // 查找用戶
    const user = event.users.id(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 返回用戶完整資料（包括所有動態字段）
    const userObject = user.toObject ? user.toObject({ minimize: false }) : user;
    return res.json(userObject);
  } catch (err) {
    console.error('iPad API get user by id error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// 4) 更新用戶 checkin 狀態（和 users.ejs 中的功能一樣）
router.put('/events/:eventId/users/:userId', authenticateJwt, async (req, res) => {
  const { eventId, userId } = req.params;
  const updateData = req.body || {};

  try {
    // 檢查權限：確認 event 存在且用戶有權限
    const event = await Event.findById(eventId).select({ users: 1, owner: 1 });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const { role, authId } = req.jwt || {};
    const isAdmin = role === 'admin';
    const isOwner = String(event.owner) === String(authId);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // 查找用戶
    const user = event.users.id(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 處理 isCheckIn 特殊邏輯（和 eventsController.updateUser 一樣）
    let checkInUpdated = false;
    if (typeof updateData.isCheckIn !== 'undefined') {
      if (!user.isCheckIn && updateData.isCheckIn === true) {
        user.isCheckIn = true;
        user.checkInAt = new Date();
        checkInUpdated = true;
      } else if (updateData.isCheckIn === false) {
        user.isCheckIn = false;
        user.checkInAt = undefined;
        checkInUpdated = true;
      }
    }

    // 更新其他字段（排除內部字段）
    const excludedFields = ['_id', '__v', 'isCheckIn', 'checkInAt', 'create_at', 'modified_at'];
    Object.keys(updateData).forEach(key => {
      if (!excludedFields.includes(key) && updateData[key] !== undefined) {
        user[key] = updateData[key];
      }
    });

    user.modified_at = new Date();

    // 標記為已修改
    if (checkInUpdated) {
      user.markModified('isCheckIn');
      if (user.checkInAt) {
        user.markModified('checkInAt');
      }
    }
    event.markModified('users');

    await event.save();

    // 返回更新後的完整用戶資料（供簽到與修改個人資料共用）
    const userObject = user.toObject ? user.toObject({ minimize: false }) : user;
    return res.json(userObject);
  } catch (err) {
    console.error('iPad API update user checkin error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// 4b) 根據 registration config 建立 event 用戶
// Body: 根據 FormConfig 的字段提交資料（例如 email, name, phone_code, phone, company 等）
router.post('/events/:eventId/users', authenticateJwt, async (req, res) => {
  const { eventId } = req.params;

  try {
    // 檢查權限：確認 event 存在且用戶有權限
    const event = await Event.findById(eventId).select({ owner: 1 });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const { role, authId } = req.jwt || {};
    const isAdmin = role === 'admin';
    const isOwner = String(event.owner) === String(authId);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // 直接重用 eventsController.addUserToEvent 的邏輯
    return eventsController.addUserToEvent(req, res);
  } catch (err) {
    console.error('iPad API create user via registration config error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// 4c) 刪除用戶
router.delete('/events/:eventId/users/:userId', authenticateJwt, async (req, res) => {
  const { eventId, userId } = req.params;

  try {
    // 檢查權限：確認 event 存在且用戶有權限
    const event = await Event.findById(eventId).select({ users: 1, owner: 1 });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const { role, authId } = req.jwt || {};
    const isAdmin = role === 'admin';
    const isOwner = String(event.owner) === String(authId);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // 查找用戶的索引
    const userIndex = event.users.findIndex(user => user._id.toString() === userId);
    if (userIndex === -1) {
      return res.status(404).json({ message: 'User not found in this event' });
    }

    // 從用戶數組中移除用戶
    event.users.splice(userIndex, 1);
    await event.save();

    return res.json({ message: 'User deleted successfully' });
  } catch (err) {
    console.error('iPad API delete user error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// 5a) 取得 Badge 設定（包含所有已添加的 elements）
router.get('/events/:eventId/badge-config', authenticateJwt, async (req, res) => {
  const { eventId } = req.params;

  try {
    // 檢查權限：確認 event 存在且用戶有權限
    const event = await Event.findById(eventId).select({ owner: 1 });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const { role, authId } = req.jwt || {};
    const isAdmin = role === 'admin';
    const isOwner = String(event.owner) === String(authId);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // 取得或建立 badge 配置
    let badgeConfig = await BadgeConfig.findOne({ eventId });
    if (!badgeConfig) {
      badgeConfig = new BadgeConfig({
        eventId,
        name: 'Default Badge',
        elements: []
      });
      await badgeConfig.save();
    }

    return res.json(badgeConfig);
  } catch (err) {
    console.error('iPad API get badge config error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// 5b) 刪除 Badge 中的特定元素
router.delete('/events/:eventId/badge-config/elements/:elementId', authenticateJwt, async (req, res) => {
  const { eventId, elementId } = req.params;

  try {
    // 檢查權限：確認 event 存在且用戶有權限
    const event = await Event.findById(eventId).select({ owner: 1 });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const { role, authId } = req.jwt || {};
    const isAdmin = role === 'admin';
    const isOwner = String(event.owner) === String(authId);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // 取得 badge 配置
    const badgeConfig = await BadgeConfig.findOne({ eventId });
    if (!badgeConfig) {
      return res.status(404).json({ message: 'Badge config not found' });
    }

    // 查找並刪除元素
    const elementIndex = badgeConfig.elements.findIndex(
      el => el._id && el._id.toString() === elementId
    );

    if (elementIndex === -1) {
      return res.status(404).json({ message: 'Element not found' });
    }

    // 從陣列中移除元素
    badgeConfig.elements.splice(elementIndex, 1);
    await badgeConfig.save();

    return res.json({
      message: 'Element deleted successfully',
      badgeConfig
    });
  } catch (err) {
    console.error('iPad API delete badge element error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// 5c) 更新 Badge 設定（可以更新整個 elements 陣列或添加新元素）
router.put('/events/:eventId/badge-config', authenticateJwt, async (req, res) => {
  const { eventId } = req.params;
  const { name, width, height, dpi, elements } = req.body;

  try {
    // 檢查權限：確認 event 存在且用戶有權限
    const event = await Event.findById(eventId).select({ owner: 1 });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const { role, authId } = req.jwt || {};
    const isAdmin = role === 'admin';
    const isOwner = String(event.owner) === String(authId);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // 取得或建立 badge 配置
    let badgeConfig = await BadgeConfig.findOne({ eventId });
    if (!badgeConfig) {
      badgeConfig = new BadgeConfig({ eventId });
    }

    // 更新欄位（只更新有提供的欄位）
    if (name !== undefined) badgeConfig.name = name;
    if (width !== undefined) badgeConfig.width = width;
    if (height !== undefined) badgeConfig.height = height;
    if (dpi !== undefined) badgeConfig.dpi = dpi;
    if (elements !== undefined) badgeConfig.elements = elements;

    await badgeConfig.save();

    return res.json({
      message: 'Badge config updated successfully',
      badgeConfig
    });
  } catch (err) {
    console.error('iPad API update badge config error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// 5d) 生成用戶的 Badge 圖片（根據 badge 配置排版）
router.get('/events/:eventId/users/:userId/badge', authenticateJwt, async (req, res) => {
  const { eventId, userId } = req.params;

  try {
    // 檢查權限：確認 event 存在且用戶有權限
    const event = await Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    const { role, authId } = req.jwt || {};
    const isAdmin = role === 'admin';
    const isOwner = String(event.owner) === String(authId);

    if (!isAdmin && !isOwner) {
      return res.status(403).json({ message: 'Forbidden' });
    }

    // 查找用戶
    const user = event.users.id(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // 檢查 badge 配置是否存在
    const badgeConfig = await BadgeConfig.findOne({ eventId });
    if (!badgeConfig) {
      return res.status(404).json({ message: 'Badge config not found. Please configure badge design first.' });
    }

    // 準備用戶數據（和 badgeController 一樣的格式）
    const userData = {
      user: user.toObject ? user.toObject() : user,
      qrcodeUrl: `https://api.qrserver.com/v1/create-qr-code/?data=${user._id}&size=200x200`
    };

    // 直接調用 badgeController 的內部生成函數
    // 需要訪問內部函數，所以我們直接實現相同的邏輯
    const QRCode = require('qrcode');
    let createCanvas, loadImage;
    try {
      const canvasLib = require('canvas');
      createCanvas = canvasLib.createCanvas;
      loadImage = canvasLib.loadImage;
    } catch (error) {
      return res.status(500).json({ message: 'Canvas package not installed. Please install canvas: npm install canvas' });
    }

    // 生成 badge 圖片（使用 badgeController 的邏輯）
    const dimensions = badgeConfig.getPixelDimensions();
    const badgeCanvas = createCanvas(dimensions.width, dimensions.height);
    const ctx = badgeCanvas.getContext('2d');

    // 設置白色背景
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, dimensions.width, dimensions.height);

    // 繪製每個元素
    for (const element of badgeConfig.elements) {
      await drawBadgeElement(ctx, element, userData, dimensions);
    }

    // 保存圖片
    const path = require('path');
    const fs = require('fs');
    const filename = `badge_${eventId}_${userId}_${Date.now()}.png`;
    const filepath = path.join(__dirname, '../public/badges', filename);

    // 確保目錄存在
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // 保存文件
    const buffer = badgeCanvas.toBuffer('image/png');
    fs.writeFileSync(filepath, buffer);

    // 返回 URL
    const imageUrl = `/badges/${filename}`;
    return res.json({ imageUrl });
  } catch (err) {
    console.error('iPad API generate badge image error:', err);
    return res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// 輔助函數：繪製 badge 元素（從 badgeController 複製邏輯）
async function drawBadgeElement(ctx, element, data, dimensions) {
  switch (element.type) {
    case 'text':
      await drawBadgeText(ctx, element, data, dimensions);
      break;
    case 'qrcode':
      await drawBadgeQRCode(ctx, element, data);
      break;
    case 'image':
      await drawBadgeImage(ctx, element, data);
      break;
  }
}

// 文字換行函數
function wrapBadgeText(ctx, text, maxWidth) {
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
async function drawBadgeText(ctx, element, data, dimensions) {
  let content = element.content || '';
  content = replaceBadgeVariables(content, data);

  // 計算實際 font-size（根據 size 百分比）
  const baseFontSize = element.fontSize || 16;
  const sizePercent = element.size || 100;
  const actualFontSize = Math.round(baseFontSize * (sizePercent / 100));

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
  const lines = wrapBadgeText(ctx, content, maxWidth);
  
  // 繪製多行文字
  const lineHeight = actualFontSize * 1.2; // 行高
  lines.forEach((line, index) => {
    ctx.fillText(line, x, element.y + index * lineHeight);
  });
}

// 繪製 QR Code
async function drawBadgeQRCode(ctx, element, data) {
  try {
    const QRCode = require('qrcode');
    let loadImage;
    try {
      const canvasLib = require('canvas');
      loadImage = canvasLib.loadImage;
    } catch (error) {
      throw new Error('Canvas package not installed');
    }

    let qrData = element.qrData || '{{qrcodeUrl}}';
    qrData = replaceBadgeVariables(qrData, data);

    let image;
    if (qrData.startsWith('http')) {
      image = await loadImage(qrData);
    } else {
      const qrDataUrl = await QRCode.toDataURL(qrData, {
        width: element.width || 200,
        margin: 1
      });
      image = await loadImage(qrDataUrl);
    }

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
async function drawBadgeImage(ctx, element, data) {
  try {
    let loadImage;
    try {
      const canvasLib = require('canvas');
      loadImage = canvasLib.loadImage;
    } catch (error) {
      throw new Error('Canvas package not installed');
    }

    let imageUrl = element.imageUrl || '';
    imageUrl = replaceBadgeVariables(imageUrl, data);

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
function replaceBadgeVariables(text, data) {
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

module.exports = router;

