// controllers/usersController.js
const User = require('../model/User');
const { param } = require('../routes/users');
const twilio = require('twilio');
const QRCode = require('qrcode');
const nodemailer = require('nodemailer');

// Twilio 配置
// const accountSid = 'ACde8882055e49e02c2e3d57f7591d644f'; // 替換為您的 Twilio Account SID
// const authToken = '8db06efb9a3faea7531ada9386ff9347'; // 替換為您的 Twilio Auth Token
// testing 
const accountSid = 'ACcd2283e35535710c9f18a321e960f56c'; // 替換為您的 Twilio Account SID
const authToken = '17e57d1fb95e974587588a1b1c30e611'; // 替換為您的 Twilio Auth Token
const client = twilio(accountSid, authToken);

// Nodemailer 配置
const transporter = nodemailer.createTransport({
    service: 'Gmail', // 使用 Gmail 作為郵件服務
    auth: {
        user: 'icesolution0321@gmail.com', // 替換為您的電子郵件地址
        pass: 'sjxornmikstzjzxa' // 替換為您的電子郵件密碼或應用程式密碼
    }
});

// 創建用戶
exports.createUser = async (req, res) => {
    try {
        const user = new User(req.body);
        await user.save();

        // 生成 QR 碼
        //https://api.qrserver.com/v1/create-qr-code/?data=67ae345f10b42c96a3ce3c17&size=250x250
        const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${user._id}&size=250x250`; // 替換為您的 QR 碼內容
        // const qrCodeUrl = await QRCode.toDataURL(qrCodeData);

        // 發送歡迎訊息和 QR 碼到電子郵件
        const messageBody = `
            <h1>歡迎您成為我們的會員！</h1>
            <p>這是您的 QR 碼：</p>
            <img src="${qrCodeUrl}" alt="QR Code" />
        `;

        const mailOptions = {
            from: 'icesolution0321@gmail.com', // 替換為您的電子郵件地址
            to: user.email, // 確保用戶的電子郵件地址是有效的
            subject: '歡迎加入我們的活動',
            html: messageBody
        };

        await transporter.sendMail(mailOptions);

        res.status(201).send(user);
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).send({ message: '該電子郵件已被使用。' });
        }
        res.status(400).send(error);
    }
};
exports.getCreateUserPage = async (req, res) => {
    try {
        res.render('create_user');
    } catch (error) {
        res.status(400).send(error);
    }
};
exports.createSuccessPage = async (req, res) => {
    try {
        res.render('success');
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
        
        const user = await User.findOne({'_id': req.params.id}); // 根據 UID 查找用戶
        if (!user) {
            return res.status(404).send(); // 找不到用戶
        }
        else{
            const user = await User.findOneAndUpdate({'_id':req.params.id}, {'isCheckIn':true}, { new: false, runValidators: true });
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
        const user = await User.findOneAndUpdate({'_id':req.params.id}, req.body, { new: false, runValidators: true });
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