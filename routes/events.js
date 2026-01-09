// routes/users.js
const express = require('express');
const router = express.Router();
const eventsController = require('../controllers/eventsController');
const importController = require('../controllers/importController');
const emailTemplateController = require("../controllers/emailTemplateController");
const smsTemplateController = require("../controllers/smsTemplateController");

const Event = require('../model/Event'); // 引入 Event 模型
const multer = require('multer');
const path = require('path');

// 設置 multer 以處理文件上傳
const storage = multer.memoryStorage();
const upload = multer({ storage: storage }).single('file');

// 設定 multer 來處理文件上傳
const uploadBackground = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/luckydraw/img/'); // 設定上傳路徑
    },
    filename: (req, file, cb) => {
        const eventId = req.params.eventId; // 獲取 eventId
        const ext = path.extname(file.originalname); // 獲取文件擴展名
        cb(null, `${eventId}${ext}`); // 使用 eventId 作為文件名
    }
});

const uploadBackgroundMulter = multer({ storage: uploadBackground }); // 使用自定義的 storage

// 設置文件上傳配置（用於 event attachments）
const fs = require('fs');
const uploadAttachmentsStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'public/events/attachments';
        // 確保目錄存在
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const eventId = req.params.eventId;
        const timestamp = Date.now();
        const ext = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, ext);
        // 使用 eventId_timestamp_原文件名 作為存儲文件名
        const storedFilename = `${eventId}_${timestamp}_${baseName}${ext}`;
        cb(null, storedFilename);
    }
});

const uploadAttachments = multer({
    storage: uploadAttachmentsStorage,
    limits: {
        fileSize: 1024 * 1024 * 10 // 10MB 限制
    },
    fileFilter: (req, file, cb) => {
        // 允許所有文件類型（可以根據需要限制）
        cb(null, true);
    }
});

// 定義路由
// router.post('/register', usersController.createUser);
// router.get('/register', usersController.getCreateUserPage);
// router.get('/register/success', usersController.createSuccessPage);
// router.get('/:id', usersController.getUserById);
// router.put('/:id', usersController.updateUser);
// router.delete('/:id', usersController.deleteUser);

// 創建事件
router.post('/create', eventsController.createEvent);
router.get('/create', eventsController.renderCreateEventPage); // 創建事件
router.get('/', eventsController.getUserEvents);
router.get('/list', eventsController.renderEventsList);



router.get('/:eventId/users/data', eventsController.fetchUsersByEvent);
router.get('/:eventId', eventsController.getEventUsersByEventID);
router.get('/:eventId/luckydraw', eventsController.renderLuckydrawPage); // 使用控制器函數
router.get('/:eventId/luckydraw/panel', eventsController.renderLuckydrawPanelPage); // iPad 抽獎控制面板
router.get('/:eventId/import', importController.getImportUserPage);
router.post('/:eventId/import', upload, importController.importUsers);
router.get('/:eventId/import/sample', importController.downloadSampleFile);

router.post('/:eventId/users', eventsController.addUserToEvent);
// router.put('/:eventId/users/:userEmail', eventsController.updateUserInEvent);

// Resend email (支持多種類型)
router.post('/:eventId/users/:userId/resend-email', eventsController.resendEmail);

// Check-in 用戶
router.put('/:eventId/users/:userId/checkin', eventsController.checkInUser);

// Batch delete users
router.delete('/:eventId/users/batch', eventsController.batchDeleteUsers);

// Batch check in users
router.put('/:eventId/users/batch-checkin', eventsController.batchCheckInUsers);

// Batch send emails
router.post('/:eventId/users/batch-send-email', eventsController.batchSendEmails);

router.get('/:eventId/scan', eventsController.scanEventUsers);


router.get('/:eventId/login', eventsController.renderLoginPage); // 渲染登入頁面
router.post('/:eventId/login', eventsController.loginUser); // 登入請求
//update user 
router.get('/:eventId/users/:userId', eventsController.getUserById); // 根據事件 ID 和用戶 ID 獲取用戶
router.put('/:eventId/users/:userId', eventsController.updateUser); // 更新事件中的用戶
router.delete('/:eventId/users/:userId', eventsController.removeUserFromEvent);

// 獲取事件的用戶列表

// 用戶登入

// 獲取用戶資料頁面
router.get('/:eventId/profile', eventsController.renderProfilePage); // 渲染用戶資料頁面
// 渲染添加參展商頁面
router.get('/:eventId/attendees/create', eventsController.renderCreateAttendeePage); // 新增的路由

// 渲染參展商列表頁面（舊的 attendees 功能，保留用於向後兼容）
// router.get('/:eventId/attendees', eventsController.renderAttendeesListPage); // 已改為 guest list

// 渲染 Guest List 頁面（預先準備的來賓列表，尚未註冊為 RSVP）
router.get('/:eventId/guest-list/export', eventsController.exportGuestList); // 導出 Guest List 為 Excel（必須在 guest-list 路由之前）
router.get('/:eventId/guest-list', eventsController.renderGuestListPage); // Guest List 路由

// Guest List 管理路由
router.post('/:eventId/guest-list', eventsController.addGuestToList); // 添加來賓到 Guest List
router.put('/:eventId/guest-list/:guestId', eventsController.updateGuestInList); // 更新 Guest List 中的來賓
router.delete('/:eventId/guest-list/:guestId', eventsController.deleteGuestFromList); // 從 Guest List 刪除來賓
router.post('/:eventId/guest-list/:guestId/add-to-rsvp', eventsController.addGuestToRSVP); // 將 Guest List 中的來賓添加到 RSVP
router.post('/:eventId/guest-list/send-sms', eventsController.sendSmsToGuestList); // 發送 SMS 給 Guest List

// Guest List Excel 導入路由
const guestListStorage = multer.memoryStorage();
const guestListUpload = multer({ storage: guestListStorage }).single('file');
router.post('/:eventId/guest-list/import', guestListUpload, eventsController.importGuestListFromExcel); // 導入 Excel 到 Guest List

// 渲染參展商列表頁面（舊的 attendees 功能，保留用於向後兼容）
router.get('/:eventId/attendees', eventsController.renderAttendeesListPage);

// 添加參展商
router.post('/:eventId/attendees', eventsController.addAttendee);

// 參展商登入頁面
router.get('/:eventId/attendees/login', eventsController.attendeeLoginPage);

// 參展商登入路由
router.post('/:eventId/attendees/login', eventsController.attendeeLogin);

// 參展商個人資料頁面
router.get('/:eventId/attendees/:attendeeId/profile', eventsController.attendeeProfilePage);

// 添加分數路由
router.post('/:eventId/attendees/:attendeeId/addPoints', eventsController.addPoints);

// 獲取參展商
router.get('/:eventId/attendees/:attendeeId', eventsController.getAttendee);

// 提升參展商的點數
router.post('/:eventId/attendees/:attendeeId/promote', eventsController.promoteAttendee);

// 渲染添加促銷代碼頁面
router.get('/:eventId/attendees/:attendeeId/promote', eventsController.renderAddPointPage); // 新增的路由

// 渲染特定參展商的點數列表頁面
router.get('/:eventId/attendees/:attendeeId/points', eventsController.renderAttendeePointListPage); // 新增的路由

// 增加用戶點數的路由
router.post('/:eventId/gain', eventsController.gainPoint); // 新增的路由

// 獲取排行榜
router.get('/:eventId/leaderboard', eventsController.getLeaderboard);

// Points 路由

// 渲染創建點數的頁面
router.get('/:eventId/points/create', (req, res) => {
    const { eventId } = req.params; // 獲取 eventId
    res.render('admin/points/create_points', { eventId }); // 傳遞 eventId
});
// 渲染點數列表的頁面
router.get('/:eventId/points/list', async (req, res) => {
    const { eventId } = req.params; // 獲取 eventId
    try {
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).send('Event not found.');
        }
        res.render('admin/points/list_points', { eventId, points: event.points }); // 傳遞 eventId 和 points
    } catch (error) {
        console.error('Error fetching points list:', error);
        res.status(500).send('Error fetching points.');
    }
});

// 創建新的 points
router.post('/:eventId/points', eventsController.createPoint);

// 獲取所有 points
router.get('/:eventId/points', eventsController.getPoints);

// 積分掃描器路由已移除，請使用掃瞄加分管理功能
router.get('/:eventId/points/edit/:pointId', async (req, res) => {
    const { eventId, pointId } = req.params; // 獲取 eventId 和 pointId
    try {
        const event = await Event.findById(eventId);
        const point = event.points.id(pointId);
        if (!point) {
            return res.status(404).send('Point not found.');
        }
        res.render('admin/points/edit_points', { eventId, point }); // 傳遞 eventId 和 point
    } catch (error) {
        console.error('Error fetching point for edit:', error);
        res.status(500).send('Error fetching point.');
    }
});

// 獲取單個 point
// 生成 QRCode 的路由
router.get('/:eventId/points/:pointId', (req, res) => {
    const { eventId, pointId } = req.params; // 獲取 eventId 和 pointId
    res.render('admin/points/qrcode', { eventId, pointId }); // 渲染 QRCode 頁面
});

// 更新 point
router.put('/:eventId/points/:pointId', eventsController.updatePoint);

// 刪除中獎者
router.delete('/:eventId/luckydraw', eventsController.removeLuckydrawUser); // 使用控制器函數

// 刪除所有中獎記錄
router.delete('/:eventId/luckydraw/all', eventsController.removeAllLuckydrawUsers); // 使用控制器函數

// 新增中獎者
router.post('/:eventId/luckydraw', eventsController.addLuckydrawUser); // 使用控制器函數

// 批量抽獎 API
router.post('/:eventId/luckydraw/batch', eventsController.batchDrawWinners);

// 添加路由以顯示中獎者列表
router.get('/:eventId/luckydraw/list', eventsController.renderAdminLuckydrawPage); // 使用控制器函數
// 匯出中獎者列表為 Excel
router.get('/:eventId/luckydraw/list/export', eventsController.exportLuckydrawList);

// 添加路由以顯示 QR 碼登錄頁面
router.get('/:eventId/qrcodeLogin', eventsController.renderQRCodeLoginPage); // 使用控制器函數

// 上傳背景圖片的路由
router.post('/:eventId/luckydraw_setting/upload-background', uploadBackgroundMulter.single('backgroundImage'), eventsController.uploadBackground);

// 渲染 luckydraw_setting.ejs 的 GET 路由
router.get('/:eventId/luckydraw_setting', eventsController.renderLuckydrawSetting);

// 新增的路由
router.get('/:eventId/email/:userId', eventsController.renderEmailHtml);

router.patch('/:eventId/paymentEvent', eventsController.updatePaymentEvent);
router.patch('/:eventId/emailSettings', eventsController.updateEmailSettings);

// 文件上傳相關路由
router.get('/:eventId/attachments', eventsController.renderAttachmentsPage); // 渲染附件管理頁面
router.get('/:eventId/attachments/api', eventsController.getAttachments); // API: 獲取附件列表
router.post('/:eventId/attachments', uploadAttachments.single('file'), eventsController.uploadAttachment); // 上傳文件
router.delete('/:eventId/attachments/:attachmentId', eventsController.deleteAttachment); // 刪除附件

router.get('/:eventId/report', eventsController.outputReport);
// Transaction Records
router.get('/:eventId/transactions', eventsController.renderTransactionRecords);
// Email Records
router.get('/:eventId/email-records', eventsController.renderEmailRecords);
router.get('/:eventId/email-records/:trackingId', eventsController.getEmailRecordDetails);
// Email Template
router.get('/:eventId/emailTemplate', emailTemplateController.renderEmailTemplateList); // 渲染電子郵件模板列表頁面
router.get('/:eventId/emailTemplate/create', emailTemplateController.renderCreateEmailTemplatePage); // 渲染創建電子郵件模板頁面
router.get('/:eventId/emailTemplate/:id', emailTemplateController.renderEmailTemplateDetail); // 渲染創建電子郵件模板頁面

// SMS Template
router.get('/:eventId/smsTemplate', smsTemplateController.renderSmsTemplateList); // 渲染 SMS 模板列表頁面
router.get('/:eventId/smsTemplate/create', smsTemplateController.renderCreateSmsTemplatePage); // 渲染創建 SMS 模板頁面
router.get('/:eventId/smsTemplate/:id', smsTemplateController.renderSmsTemplateDetail); // 渲染 SMS 模板詳情頁面
router.post('/:eventId/smsTemplate', smsTemplateController.createSmsTemplate); // 創建 SMS 模板
router.put('/:eventId/smsTemplate/:id', smsTemplateController.updateSmsTemplate); // 更新 SMS 模板
router.delete('/:eventId/smsTemplate/:id', smsTemplateController.deleteSmsTemplate); // 刪除 SMS 模板
router.get('/api/:eventId/smsTemplates', smsTemplateController.getSmsTemplates); // 獲取 SMS 模板列表 (API)

// Banner 管理路由
router.get('/:eventId/banner', eventsController.showBannerManagement);
router.post('/:eventId/banner/upload', eventsController.uploadBanner);
router.post('/:eventId/banner/delete', eventsController.deleteBanner);

// 掃瞄加分功能路由
router.get('/:eventId/scan-point-users', eventsController.renderScanPointUsersPage); // 管理頁面
router.post('/:eventId/scan-point-users', eventsController.createScanPointUser); // 創建用戶
router.delete('/:eventId/scan-point-users/:userId', eventsController.deleteScanPointUser); // 刪除用戶
router.post('/:eventId/scan-point-users/:userId/regenerate-pin', eventsController.regeneratePIN); // 重新生成 PIN

// 掃瞄加分登入和掃瞄頁面
router.get('/:eventId/attendee', eventsController.renderScanPointLoginPage); // 登入頁面 (主要路由)
router.get('/:eventId/attendee/login', eventsController.renderScanPointLoginPage); // 登入頁面 (備用路由)
router.post('/:eventId/attendee/login', eventsController.scanPointLogin); // PIN 登入驗證
router.get('/:eventId/attendee/scan', eventsController.renderScanPointScanPage); // 掃瞄頁面
router.post('/:eventId/attendee/scan/add-points', eventsController.addPointsByScan); // 添加分數
router.post('/:eventId/attendee/logout', (req, res) => { // 登出
    req.session.scanPointUser = null;
    res.json({ success: true });
});

// Treasure Hunt 功能路由
router.get('/:eventId/treasure-hunt', eventsController.renderTreasureHuntPage); // 管理頁面
router.post('/:eventId/treasure-hunt', eventsController.createTreasureHuntItem); // 創建項目
router.put('/:eventId/treasure-hunt/:itemId', eventsController.updateTreasureHuntItem); // 更新項目
router.delete('/:eventId/treasure-hunt/:itemId', eventsController.deleteTreasureHuntItem); // 刪除項目
router.get('/:eventId/treasure-hunt/scan', eventsController.renderTreasureHuntScanPage); // 用戶掃描頁面
router.post('/:eventId/treasure-hunt/scan', eventsController.scanTreasureHuntQRCode); // 掃描 QR Code 並添加積分

// 渲染 Guest 確認頁面（公開頁面，讓用戶確認資料並轉移到 RSVP）
// 注意：這個路由必須放在所有其他 /:eventId/xxx 路由之後，避免攔截其他路由（如 smsTemplate）
router.get('/:eventId/:guestId/invitation', eventsController.renderGuestConfirmPage); // Guest 邀請頁面路由（用於 invitation SMS）
router.get('/:eventId/:guestId', eventsController.renderGuestConfirmPage); // Guest 確認頁面路由

module.exports = router;