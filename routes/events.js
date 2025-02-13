// routes/users.js
const express = require('express');
const router = express.Router();
const usersController = require('../controllers/usersController');

// 定義路由
router.post('/register', usersController.createUser);
router.get('/register', usersController.getCreateUserPage);
router.get('/register/success', usersController.createSuccessPage);
router.get('/:id', usersController.getUserById);
router.put('/:id', usersController.updateUser);
router.delete('/:id', usersController.deleteUser);

module.exports = router;