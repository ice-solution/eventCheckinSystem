// routes/users.js
const express = require('express');
const router = express.Router();
const eventsController = require('../controllers/eventsController');
const importController = require('../controllers/importController');
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
router.get('/:eventId/import', importController.getImportUserPage);
router.post('/:eventId/import', upload, importController.importUsers);

router.post('/:eventId/users', eventsController.addUserToEvent);
// router.put('/:eventId/users/:userEmail', eventsController.updateUserInEvent);


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

// 渲染參展商列表頁面
router.get('/:eventId/attendees', eventsController.renderAttendeesListPage); // 新增的路由

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

// 獲取單個 point
// 生成 QRCode 的路由
router.get('/:eventId/points/:pointId', (req, res) => {
    const { eventId, pointId } = req.params; // 獲取 eventId 和 pointId
    res.render('admin/points/qrcode', { eventId, pointId }); // 渲染 QRCode 頁面
});

// 更新 point
router.put('/:eventId/points/:pointId', eventsController.updatePoint);



// 渲染編輯點數的頁面
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

// 刪除中獎者
router.delete('/:eventId/luckydraw', eventsController.removeLuckydrawUser); // 使用控制器函數

// 新增中獎者
router.post('/:eventId/luckydraw', eventsController.addLuckydrawUser); // 使用控制器函數

// 添加路由以顯示中獎者列表
router.get('/:eventId/luckydraw/list', eventsController.renderAdminLuckydrawPage); // 使用控制器函數

// 添加路由以顯示 QR 碼登錄頁面
router.get('/:eventId/qrcodeLogin', eventsController.renderQRCodeLoginPage); // 使用控制器函數

// 上傳背景圖片的路由
router.post('/:eventId/luckydraw_setting/upload-background', uploadBackgroundMulter.single('backgroundImage'), eventsController.uploadBackground);

// 渲染 luckydraw_setting.ejs 的 GET 路由
router.get('/:eventId/luckydraw_setting', eventsController.renderLuckydrawSetting);

// 新增的路由
router.get('/:eventId/email/:userId', eventsController.renderEmailHtml);

router.patch('/:eventId/paymentEvent', eventsController.updatePaymentEvent);

router.get('/:eventId/report', eventsController.outputReport);

module.exports = router;