const twilio = require('twilio');
const QRCode = require('qrcode');

// Twilio 配置
const accountSid = 'ACde8882055e49e02c2e3d57f7591d644f'; // 替換為您的 Twilio Account SID
const authToken = '8db06efb9a3faea7531ada9386ff9347'; // 替換為您的 Twilio Auth Token
const twilioClient = twilio(accountSid, authToken);

// 發送 WhatsApp 消息的函數
const sendWhatsAppMessage = async (to, userId) => {
    try {
        // 生成 QR 碼
        const qrCodeDataUrl = await QRCode.toDataURL(userId);

        // 構建消息內容
        const messageBody = `您的 QR 碼：\n${qrCodeDataUrl}`;

        // 發送 WhatsApp 消息
        await twilioClient.messages.create({
            from: 'whatsapp:+YOUR_TWILIO_WHATSAPP_NUMBER', // 替換為您的 Twilio WhatsApp 號碼
            to: `whatsapp:${to}`, // 收件人 WhatsApp 號碼
            body: messageBody
        });

        console.log(`WhatsApp message sent to ${to}`);
    } catch (error) {
        console.error('Error sending WhatsApp message:', error);
        throw error; // 重新拋出錯誤以便在調用時處理
    }
};


module.exports = sendWhatsAppMessage;
