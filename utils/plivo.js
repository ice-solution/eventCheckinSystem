const twilio = require('twilio');

// Twilio 配置
const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.twiliosid; // 支持兩種環境變數名稱
const authToken = process.env.TWILIO_AUTH_TOKEN || process.env.twilioauthtoken; // 支持兩種環境變數名稱
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER; // 發送 SMS 的號碼
const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID; // Messaging Service SID（可選，優先使用）

// 創建 Twilio 客戶端
let client = null;
if (accountSid && authToken) {
    client = twilio(accountSid, authToken);
}

/**
 * 發送 SMS
 * @param {string} to - 接收者電話號碼（格式：+85212345678）
 * @param {string} message - 短信內容
 * @returns {Promise} Twilio API 響應
 */
exports.sendSMS = async (to, message) => {
    try {
        if (!accountSid || !authToken || !twilioPhoneNumber) {
            throw new Error('Twilio 配置不完整，請檢查 .env 文件中的 TWILIO_ACCOUNT_SID (或 twiliosid), TWILIO_AUTH_TOKEN (或 twilioauthtoken) 和 TWILIO_PHONE_NUMBER');
        }

        if (!client) {
            client = twilio(accountSid, authToken);
        }

        // 確保電話號碼格式正確（需要包含國家代碼）
        const formattedTo = to.startsWith('+') ? to : `+${to}`;

        // 構建消息參數
        const messageParams = {
            body: message,
            to: formattedTo
        };

        // 優先使用 Messaging Service（如果配置了），否則使用直接號碼
        if (messagingServiceSid) {
            messageParams.messagingServiceSid = messagingServiceSid;
            console.log('使用 Messaging Service 發送 SMS');
        } else {
            if (!twilioPhoneNumber) {
                throw new Error('TWILIO_PHONE_NUMBER 或 TWILIO_MESSAGING_SERVICE_SID 必須設置其中一個');
            }
            messageParams.from = twilioPhoneNumber;
        }

        const response = await client.messages.create(messageParams);

        console.log('SMS sent successfully:', response.sid);
        return response;
    } catch (error) {
        console.error('Error sending SMS:', error);
        throw error;
    }
};

/**
 * 批量發送 SMS
 * @param {Array<string>} phoneNumbers - 電話號碼數組
 * @param {string} message - 短信內容
 * @returns {Promise<Array>} 發送結果數組
 */
exports.sendBulkSMS = async (phoneNumbers, message) => {
    const results = [];
    for (const phoneNumber of phoneNumbers) {
        try {
            const response = await exports.sendSMS(phoneNumber, message);
            results.push({ phoneNumber, success: true, messageSid: response.sid });
        } catch (error) {
            results.push({ phoneNumber, success: false, error: error.message });
        }
    }
    return results;
};

