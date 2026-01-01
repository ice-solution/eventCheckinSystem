// test_sms_direct.js - 直接測試 SMS 發送（使用模板內容）
require('dotenv').config();
const twilioSms = require('./utils/plivo');

// 測試配置
const TEST_PHONE = '+85256004956';

// 測試模板內容（可以從 SMS 模板中複製）
const TEST_TEMPLATE_CONTENT = process.argv[2] || 
    '歡迎{{user.name}} 參加 {{event.name}}!您的登入連結:{{loginUrl}}';

// 測試數據
const testData = {
    name: '測試用戶',
    email: 'test@example.com',
    company: '測試公司',
    phone: '56004956',
    phone_code: '+852',
    eventName: '測試活動',
    loginUrl: `${process.env.DOMAIN || 'http://localhost:3377'}/events/test-event-id/invitation`,
    confirmUrl: `${process.env.DOMAIN || 'http://localhost:3377'}/events/test-event-id/test-guest-id`
};

async function testSmsDirect() {
    try {
        console.log('📱 準備發送測試 SMS...\n');
        
        // 替換模板變數
        let messageBody = TEST_TEMPLATE_CONTENT
            .replace(/\{\{user\.name\}\}/g, testData.name)
            .replace(/\{\{guest\.name\}\}/g, testData.name)
            .replace(/\{\{user\.email\}\}/g, testData.email)
            .replace(/\{\{guest\.email\}\}/g, testData.email)
            .replace(/\{\{user\.company\}\}/g, testData.company)
            .replace(/\{\{guest\.company\}\}/g, testData.company)
            .replace(/\{\{user\.phone\}\}/g, testData.phone)
            .replace(/\{\{guest\.phone\}\}/g, testData.phone)
            .replace(/\{\{user\.phone_code\}\}/g, testData.phone_code)
            .replace(/\{\{guest\.phone_code\}\}/g, testData.phone_code)
            .replace(/\{\{event\.name\}\}/g, testData.eventName)
            .replace(/\{\{loginUrl\}\}/g, testData.loginUrl)
            .replace(/\{\{confirmUrl\}\}/g, testData.confirmUrl);

        console.log('📤 發送信息:');
        console.log(`   收件人: ${TEST_PHONE}`);
        console.log(`   消息內容:\n   ${messageBody}\n`);

        // 檢查 Twilio 配置
        const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.twiliosid;
        const authToken = process.env.TWILIO_AUTH_TOKEN || process.env.twilioauthtoken;
        const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

        console.log('🔍 檢查 Twilio 配置:');
        console.log(`   Account SID: ${accountSid ? '✅ 已設置' : '❌ 未設置'}`);
        console.log(`   Auth Token: ${authToken ? '✅ 已設置' : '❌ 未設置'}`);
        console.log(`   Phone Number: ${twilioPhoneNumber ? '✅ ' + twilioPhoneNumber : '❌ 未設置'}\n`);

        if (!accountSid || !authToken || !twilioPhoneNumber) {
            console.error('❌ Twilio 配置不完整！');
            console.log('\n請確保 .env 文件中有以下配置:');
            if (!accountSid) console.log('  ❌ TWILIO_ACCOUNT_SID 或 twiliosid');
            if (!authToken) console.log('  ❌ TWILIO_AUTH_TOKEN 或 twilioauthtoken');
            if (!twilioPhoneNumber) console.log('  ❌ TWILIO_PHONE_NUMBER (必需！)');
            console.log('\n範例:');
            console.log('  TWILIO_PHONE_NUMBER=+1234567890');
            process.exit(1);
        }

        console.log('✅ Twilio 配置檢查通過');
        console.log(`   發送號碼: ${twilioPhoneNumber}\n`);

        // 發送 SMS
        console.log('📤 正在發送 SMS...');
        const response = await twilioSms.sendSMS(TEST_PHONE, messageBody);
        
        console.log('\n✅ SMS 發送成功！');
        console.log(`   Message SID: ${response.sid}`);
        console.log(`   狀態: ${response.status}`);
        console.log(`   發送到: ${TEST_PHONE}`);
        
    } catch (error) {
        console.error('\n❌ 發送 SMS 失敗:', error.message);
        if (error.stack) {
            console.error('\n詳細錯誤:');
            console.error(error.stack);
        }
        process.exit(1);
    }
}

// 執行測試
testSmsDirect();

