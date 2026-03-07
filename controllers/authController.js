const Auth = require('../model/Auth');
const Event = require('../model/Event');
const bcrypt = require('bcrypt');
const { getEventFunctionList } = require('../middleware/permission');

/** 僅 admin 可操作 */
function requireAdmin(req, res, next) {
    if (!req.session.user || req.session.user.role !== 'admin') {
        return res.status(403).send('無權限執行此操作');
    }
    next();
}

/** 用戶列表（僅 admin）*/
exports.listUsersPage = async (req, res) => {
    try {
        const users = await Auth.find({ username: { $ne: 'admin' } })
            .select('-password')
            .lean();
        res.render('admin/auth_users_list', { users });
    } catch (error) {
        console.error('Error listing users:', error);
        res.status(500).send('列出用戶時發生錯誤');
    }
};

/** 添加用戶頁面（僅 admin）*/
exports.addUserPage = async (req, res) => {
    const events = await Event.find({}).select('name _id').lean();
    res.render('admin/auth_user_add', { events, eventFunctions: getEventFunctionList() });
};

/** 添加用戶（僅 admin，不允許建立 admin）*/
exports.addUser = async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).send('請填寫帳號與密碼');
    }
    if (username.trim().toLowerCase() === 'admin') {
        return res.status(400).send('不可建立 admin 帳號');
    }
    try {
        const exists = await Auth.findOne({ username: username.trim() });
        if (exists) return res.status(400).send('該帳號已存在');
        const newUser = new Auth({
            username: username.trim(),
            password: password,
            role: 'user',
            allowedEvents: [],
            eventPermissions: []
        });
        await newUser.save();
        return res.redirect('/auth/users');
    } catch (error) {
        console.error('Error adding user:', error);
        res.status(500).send('添加用戶時出現錯誤');
    }
};

/** 編輯用戶權限頁面（僅 admin）*/
exports.editUserPage = async (req, res) => {
    const { id } = req.params;
    try {
        const user = await Auth.findById(id).select('-password').lean();
        if (!user) return res.status(404).send('用戶不存在');
        if (user.username === 'admin') return res.status(403).send('不可編輯 admin');
        const events = await Event.find({}).select('name _id').lean();
        const eventFunctions = getEventFunctionList();
        res.render('admin/auth_user_edit', {
            user,
            events,
            eventFunctions
        });
    } catch (error) {
        console.error('Error loading user for edit:', error);
        res.status(500).send('載入用戶時發生錯誤');
    }
};

/** 更新用戶權限（僅 admin）*/
exports.updateUserPermissions = async (req, res) => {
    const { id } = req.params;
    let allowedEvents = req.body.allowedEvents;
    const eventPermissionsRaw = req.body.eventPermissions;
    if (!Array.isArray(allowedEvents)) allowedEvents = allowedEvents ? [allowedEvents] : [];
    try {
        const user = await Auth.findById(id);
        if (!user) return res.status(404).send('用戶不存在');
        if (user.username === 'admin') return res.status(403).send('不可編輯 admin');
        user.allowedEvents = allowedEvents.filter(Boolean);
        if (typeof eventPermissionsRaw === 'string' && eventPermissionsRaw) {
            try {
                user.eventPermissions = JSON.parse(eventPermissionsRaw);
            } catch (e) {
                user.eventPermissions = [];
            }
        } else if (Array.isArray(eventPermissionsRaw)) {
            user.eventPermissions = eventPermissionsRaw;
        }
        await user.save();
        return res.redirect('/auth/users');
    } catch (error) {
        console.error('Error updating user permissions:', error);
        res.status(500).send('更新權限時發生錯誤');
    }
};

// 保留舊的 addUserPage 給 create_auth（可導向新頁）
exports.addUserPageLegacy = (req, res) => {
    res.redirect('/auth/users/add');
};

exports.createUser = async (req, res) => {
    const { username, password, role } = req.body;
    if (username && username.trim().toLowerCase() === 'admin') {
        return res.status(400).send('不可建立 admin 帳號');
    }
    try {
        const newUser = new Auth({
            username: username && username.trim(),
            password,
            role: role === 'admin' ? 'user' : (role || 'user'),
            allowedEvents: [],
            eventPermissions: []
        });
        await newUser.save();
        res.status(201).send('User created successfully!');
    } catch (error) {
        console.error('Error creating user:', error);
        res.status(500).send('Error creating user.');
    }
};
