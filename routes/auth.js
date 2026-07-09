const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const permission = require('../middleware/permission');

// 用戶登入管理（僅 admin）
router.get('/users', permission.requireAdmin, authController.listUsersPage);
router.get('/users/add', permission.requireAdmin, authController.addUserPage);
router.post('/users/add', permission.requireAdmin, authController.addUser);
router.get('/users/:id/edit', permission.requireAdmin, authController.editUserPage);
router.post('/users/:id/permissions', permission.requireAdmin, authController.updateUserPermissions);

// 舊路由相容
router.get('/add', permission.requireAdmin, authController.addUserPageLegacy);
router.post('/add', permission.requireAdmin, authController.addUser);
router.post('/create', permission.requireAdmin, authController.createUser);

module.exports = router;