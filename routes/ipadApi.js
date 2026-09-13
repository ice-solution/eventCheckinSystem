const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const Auth = require('../model/Auth');
const Event = require('../model/Event');
const BadgeConfig = require('../model/BadgeConfig');
const { authenticateJwt, getJwtSecret } = require('../utils/jwtAuth');
const permission = require('../middleware/permission');
const formConfigController = require('../controllers/formConfigController');
const eventsController = require('../controllers/eventsController');
const stationCheckinController = require('../controllers/stationCheckinController');
const badgeController = require('../controllers/badgeController');

const router = express.Router();

/** iPad 不應拿到後台預覽用的 testImageUrl，避免誤印同一張 test image */
function serializeBadgeConfigForIpad(badgeConfig) {
  const obj = badgeConfig && badgeConfig.toObject
    ? badgeConfig.toObject({ minimize: false })
    : { ...(badgeConfig || {}) };
  delete obj.testImageUrl;
  return obj;
}

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

// 2) 取得 event 清單（admin：全部；其他：依 Auth.allowedEvents，與後台 /events/list 一致）
router.get('/events', authenticateJwt, async (req, res) => {
  try {
    const { role, authId } = req.jwt || {};

    let filter = {};
    if (role !== 'admin') {
      const allowedIds = await permission.loadAuthAllowedEventIds(authId);
      filter = allowedIds.length ? { _id: { $in: allowedIds } } : { owner: authId };
    }
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

    if (!(await permission.assertJwtEventAccess(req, res, event))) {
      return;
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

    if (!(await permission.assertJwtEventAccess(req, res, event))) {
      return;
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

    if (!(await permission.assertJwtEventAccess(req, res, event))) {
      return;
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

    if (!(await permission.assertJwtEventAccess(req, res, event))) {
      return;
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

    if (!(await permission.assertJwtEventAccess(req, res, event))) {
      return;
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

    if (!(await permission.assertJwtEventAccess(req, res, event))) {
      return;
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

    if (!(await permission.assertJwtEventAccess(req, res, event))) {
      return;
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

    return res.json(serializeBadgeConfigForIpad(badgeConfig));
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

    if (!(await permission.assertJwtEventAccess(req, res, event))) {
      return;
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
      badgeConfig: serializeBadgeConfigForIpad(badgeConfig)
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

    if (!(await permission.assertJwtEventAccess(req, res, event))) {
      return;
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
      badgeConfig: serializeBadgeConfigForIpad(badgeConfig)
    });
  } catch (err) {
    console.error('iPad API update badge config error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// 5d) 生成用戶的 Badge 圖片（根據 badge 配置 + 該用戶真實資料；唔用 testImageUrl）
router.get('/events/:eventId/users/:userId/badge', authenticateJwt, async (req, res) => {
  const { eventId, userId } = req.params;

  try {
    const event = await Event.findById(eventId).select({ owner: 1 });
    if (!event) {
      return res.status(404).json({ message: 'Event not found' });
    }

    if (!(await permission.assertJwtEventAccess(req, res, event))) {
      return;
    }

    const { imageUrl } = await badgeController.generateUserBadgeImage(eventId, userId);
    return res.json({ imageUrl });
  } catch (err) {
    console.error('iPad API generate badge image error:', err);
    const status = err.status || 500;
    return res.status(status).json({
      message: status === 500 ? 'Server error' : err.message,
      error: status === 500 ? err.message : undefined
    });
  }
});

// ── Station Check-in（分站簽到）────────────────────────────────
// 6a) 取得活動下所有分站
router.get('/events/:eventId/stations', authenticateJwt, async (req, res) => {
  const { eventId } = req.params;
  try {
    const event = await Event.findById(eventId).select({ owner: 1, checkInStations: 1, stationCheckIns: 1 });
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!(await permission.assertJwtEventAccess(req, res, event))) return;
    return stationCheckinController.listStations(req, res);
  } catch (err) {
    console.error('iPad API list stations error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// 6b) 取得某分站簽到記錄
router.get('/events/:eventId/stations/:stationId/checkins', authenticateJwt, async (req, res) => {
  const { eventId } = req.params;
  try {
    const event = await Event.findById(eventId).select({ owner: 1 });
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!(await permission.assertJwtEventAccess(req, res, event))) return;
    return stationCheckinController.listStationCheckIns(req, res);
  } catch (err) {
    console.error('iPad API list station checkins error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// 6c) 分站簽到（需已完成進場 isCheckIn；同一站同一人只能一次）
router.post('/events/:eventId/stations/:stationId/checkin', authenticateJwt, async (req, res) => {
  const { eventId } = req.params;
  try {
    const event = await Event.findById(eventId).select({ owner: 1 });
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!(await permission.assertJwtEventAccess(req, res, event))) return;
    return stationCheckinController.checkInToStation(req, res);
  } catch (err) {
    console.error('iPad API station checkin error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// 6c2) 取消分站簽到
router.delete('/events/:eventId/stations/:stationId/checkin/:userId', authenticateJwt, async (req, res) => {
  const { eventId } = req.params;
  try {
    const event = await Event.findById(eventId).select({ owner: 1 });
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!(await permission.assertJwtEventAccess(req, res, event))) return;
    return stationCheckinController.uncheckStationCheckIn(req, res);
  } catch (err) {
    console.error('iPad API station uncheck error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

router.post('/events/:eventId/stations/:stationId/uncheck', authenticateJwt, async (req, res) => {
  const { eventId } = req.params;
  try {
    const event = await Event.findById(eventId).select({ owner: 1 });
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!(await permission.assertJwtEventAccess(req, res, event))) return;
    return stationCheckinController.uncheckStationCheckIn(req, res);
  } catch (err) {
    console.error('iPad API station uncheck error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

// 6d) 取得某用戶在各分站的簽到狀態
router.get('/events/:eventId/users/:userId/station-checkins', authenticateJwt, async (req, res) => {
  const { eventId } = req.params;
  try {
    const event = await Event.findById(eventId).select({ owner: 1 });
    if (!event) return res.status(404).json({ message: 'Event not found' });
    if (!(await permission.assertJwtEventAccess(req, res, event))) return;
    return stationCheckinController.getUserStationCheckIns(req, res);
  } catch (err) {
    console.error('iPad API user station checkins error:', err);
    return res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

