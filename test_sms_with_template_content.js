// test_sms_with_template_content.js - 使用實際模板內容測試 SMS
require('dotenv').config();
const twilioSms = require('./utils/plivo');

// 測試配置
const TEST_PHONE = '+85256004956';

// 如果您有實際的模板內容，可以在這裡指定
// 或者從命令行參數獲取
const TEMPLATE_CONTENT = process.argv[2] || 
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

async function testSmsWithTemplate() {
    try {
        console.log('📱 準備發送測試 SMS（使用模板內容）...\n');
        
        // 替換模板變數
        let messageBody = TEMPLATE_CONTENT
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
        console.log(`   發送號碼: ${process.env.TWILIO_PHONE_NUMBER || '未設置'}`);
        console.log(`   消息內容:\n   ${messageBody}\n`);

        // 檢查 Twilio 配置
        const accountSid = process.env.TWILIO_ACCOUNT_SID || process.env.twiliosid;
        const authToken = process.env.TWILIO_AUTH_TOKEN || process.env.twilioauthtoken;
        const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

        if (!accountSid || !authToken || !twilioPhoneNumber) {
            console.error('❌ Twilio 配置不完整！');
            process.exit(1);
        }

        console.log('✅ Twilio 配置檢查通過\n');

        // 發送 SMS
        console.log('📤 正在發送 SMS...');
        const response = await twilioSms.sendSMS(TEST_PHONE, messageBody);
        
        console.log('\n✅ SMS 發送成功！');
        console.log(`   Message SID: ${response.sid}`);
        console.log(`   狀態: ${response.status}`);
        console.log(`   發送到: ${TEST_PHONE}`);
        console.log(`   發送號碼: ${twilioPhoneNumber}`);
        console.log(`   消息長度: ${messageBody.length} 字符`);
        
    } catch (error) {
        console.error('\n❌ 發送 SMS 失敗:', error.message);
        
        if (error.code === 21612) {
            console.error('\n⚠️  錯誤 21612: 國家/地區不匹配');
            console.error('   發送號碼:', twilioPhoneNumber);
            console.error('   接收號碼:', TEST_PHONE);
            console.error('\n解決方案:');
            console.error('   1. 購買與接收號碼相同國家/地區的 Twilio 號碼');
            console.error('   2. 或在 Twilio Console 驗證接收號碼（測試帳號）');
            console.error('   3. 或啟用國際 SMS 功能（正式帳號）');
        }
        
        if (error.moreInfo) {
            console.error(`\n   詳細信息: ${error.moreInfo}`);
        }
        
        process.exit(1);
    }
}

// 執行測試
testSmsWithTemplate();

