// controllers/usersController.js
const User = require('../model/User');
const { param } = require('../routes/users');

// 創建用戶
exports.createUser = async (req, res) => {
    try {
        const user = new User(req.body);
        await user.save();
        res.status(201).send(user);
    } catch (error) {
        res.status(400).send(error);
    }
};

// 獲取所有用戶
exports.getAllUsers = async (req, res) => {
    try {
        const users = await User.find();
        res.render('users', { users }); // 傳遞用戶資料到 EJS 頁面
    } catch (error) {
        console.log(error)
        res.status(500).send(error);
    }
};

// 獲取特定用戶
exports.getUserById = async (req, res) => {
    try {
        
        const user = await User.findOne({'uid': req.params.id}); // 根據 UID 查找用戶
        if (!user) {
            return res.status(404).send(); // 找不到用戶
        }
        else{
            const user = await User.findOneAndUpdate({'uid':req.params.id}, {'isCheckIn':true}, { new: false, runValidators: true });
            // user.isCheckIn = true;
            // user.save();
            res.status(200).send(user);
        }
    } catch (error) {
        res.status(500).send(error);
    }
};

// 更新用戶
exports.updateUser = async (req, res) => {
    try {
        const user = await User.findOneAndUpdate({'uid':req.params.id}, req.body, { new: false, runValidators: true });
        if (!user) {
            return res.status(404).send();
        }
        res.status(200).send(user);
    } catch (error) {
        res.status(400).send(error);
    }
};

// 刪除用戶
exports.deleteUser = async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).send();
        }
        res.status(200).send(user);
    } catch (error) {
        res.status(500).send(error);
    }
};