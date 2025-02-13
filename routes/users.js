// routes/users.js
const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');
const importController = require('../controllers/importController');

const multer = require('multer');

// 設置 multer 以處理文件上傳
const storage = multer.memoryStorage();
const upload = multer({ storage: storage }).single('file');

// 定義路由
router.get('/import', importController.getImportUserPage);
router.post('/import', upload, importController.importUsers);
router.post('/', usersController.createUser);
router.get('/', usersController.getAllUsers);
router.get('/:id', usersController.getUserById);
router.put('/:id', usersController.updateUser);
router.delete('/:id', usersController.deleteUser);


module.exports = router;