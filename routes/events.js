// routes/users.js
const express = require('express');
const router = express.Router();
const eventsController = require('../controllers/eventsController');
const importController = require('../controllers/importController');

const multer = require('multer');

// 設置 multer 以處理文件上傳
const storage = multer.memoryStorage();
const upload = multer({ storage: storage }).single('file');
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



router.get('/:eventId', eventsController.getEventUsersByEventID);
router.get('/:eventId/import', importController.getImportUserPage);
router.post('/:eventId/import', upload, importController.importUsers);

router.post('/:eventId/users', eventsController.addUserToEvent);
// router.put('/:eventId/users/:userEmail', eventsController.updateUserInEvent);
// router.delete('/:eventId/users/:userEmail', eventsController.removeUserFromEvent);

router.get('/:eventId/scan', eventsController.scanEventUsers);


router.get('/:eventId/login', eventsController.renderLoginPage); // 渲染登入頁面
router.post('/:eventId/login', eventsController.loginUser); // 登入請求
//update user 
router.get('/:eventId/users/:userId', eventsController.getUserById); // 根據事件 ID 和用戶 ID 獲取用戶
router.put('/:eventId/users/:userId', eventsController.updateUser); // 更新事件中的用戶

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

module.exports = router;