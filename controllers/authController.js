const Auth = require('../model/Auth'); // 引入 Auth 模型
const bcrypt = require('bcrypt');

// 添加用戶
exports.addUser = async (req, res) => {
    const { username, password, role } = req.body; // 從請求中獲取用戶信息

    // 檢查當前用戶是否為 admin
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).send('無權限執行此操作'); // 如果不是 admin，返回 403 錯誤
    }

    try {
        const newUser = new Auth({
            username,
            password, // 密碼應在保存之前進行加密
            role: role || 'user' // 默認角色為 user
        });

        await newUser.save(); // 保存新用戶
        res.status(201).send('用戶添加成功！');
    } catch (error) {
        console.error('Error adding user:', error);
        res.status(500).send('添加用戶時出現錯誤！');
    }
};

// 添加用戶頁面
exports.addUserPage = (req, res) => {
    res.render('admin/create_auth'); // 渲染創建用戶頁面
};

exports.createUser = async (req, res) => {
    const { username, password, role } = req.body;

    try {
        // 哈希密碼
        const hashedPassword = await bcrypt.hash(password, 10);
        
        // 創建新用戶
        const newUser = new Auth({
            username,
            password: hashedPassword,
            role
        });

        await newUser.save(); // 保存用戶到數據庫
        res.status(201).send('User created successfully!'); // 返回成功消息
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).send('Error creating user.');
    }
};