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

//update user 
router.get('/:eventId/users/:userId', eventsController.getUserById); // 根據事件 ID 和用戶 ID 獲取用戶
router.put('/:eventId/users/:userId', eventsController.updateUser); // 更新事件中的用戶

module.exports = router;