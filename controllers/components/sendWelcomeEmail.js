const nodemailer = require('nodemailer');
const QRCode = require('qrcode');

// Nodemailer 配置
const transporter = nodemailer.createTransport({
    service: 'Gmail', // 使用 Gmail 作為郵件服務
    auth: {
        user: process.env.gmail_ac, // 替換為您的電子郵件地址
        pass: process.env.gmail_pw // 替換為您的電子郵件密碼或應用程式密碼
    }
});


// 發送歡迎電子郵件的函數
const sendWelcomeEmail = async (event, user) => {
    try {
        // 生成 QR 碼 URL
        const qrCodeUrl = `${process.env.domain}qrcode?userId=${user._id}`; // 替換為您的 QR 碼內容
        // console.log(user._id);
        
        // console.log(qrCodeDataUrl);
        // 構建郵件內容
        const messageBody = `
            <h1>歡迎您參加 ${event.name}！</h1>
            <p>這是您的 QR 碼：</p>
            <img src="${qrCodeUrl}" alt="QR Code" />
            <p>請於到場現出示此QRcode以作入場。</p>
        `;
        const mailOptions = {
            from: process.env.gmail_ac, // 替換為您的電子郵件地址
            to: user.email, // 確保用戶的電子郵件地址是有效的
            subject: '歡迎加入我們的活動',
            html: messageBody
        };

        // 發送郵件
        await transporter.sendMail(mailOptions);
        console.log(`Welcome email sent to ${user.email}`);
    } catch (error) {
        console.error('Error sending welcome email:', error);
        throw error; // 重新拋出錯誤以便在調用時處理
    }
};

module.exports = sendWelcomeEmail;