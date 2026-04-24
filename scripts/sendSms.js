// sendSms.js
require('dotenv').config();
const axios = require('axios');

const twilioSid = process.env.twiliosid;
const twilioAuthToken = process.env.twilioauthtoken;
const twilioPhoneNumber = '+18453828305'; // Twilio 發送號碼
const messageBody = 'Hello, testing with link. https://eventdemo.brandactivation.hk/events/67db51c759d994b65f11dff6/login';

// 用戶電話號碼列表
const userPhoneNumbers = [
    '+12345678901', // 替換為實際的電話號碼
    '+10987654321', // 替換為實際的電話號碼
    // 添加更多電話號碼
];

async function sendSms(to) {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Messages.json`;

    try {
        const response = await axios.post(url, new URLSearchParams({
            To: to,
            From: twilioPhoneNumber,
            Body: messageBody
        }), {
            auth: {
                username: twilioSid,
                password: twilioAuthToken
            }
        });

        console.log(`Message sent to ${to}: ${response.data.sid}`);
    } catch (error) {
        console.error(`Failed to send message to ${to}:`, error.response ? error.response.data : error.message);
    }
}

async function sendBulkSms() {
    for (const phoneNumber of userPhoneNumbers) {
        await sendSms(phoneNumber);
    }
}

// 執行發送 SMS
sendBulkSms();