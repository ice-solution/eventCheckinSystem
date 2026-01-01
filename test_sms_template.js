// test_sms_template.js - 測試 SMS 發送功能（使用模板）
require('dotenv').config();
const twilioSms = require('./utils/plivo');
const mongoose = require('mongoose');
const Event = require('./model/Event');
const SmsTemplate = require('./model/SmsTemplate');

// 測試配置
const TEST_PHONE = '+85256004956';
const TEST_EVENT_ID = process.argv[2]; // 從命令行參數獲取 eventId
const TEST_TEMPLATE_ID = process.argv[3]; // 從命令行參數獲取 templateId

async function testSmsWithTemplate() {
    try {
        // 連接 MongoDB
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/checkinSystem';
        await mongoose.connect(mongoUri);
        console.log('✅ MongoDB 連接成功');

        if (!TEST_EVENT_ID) {
            console.error('❌ 請提供 eventId');
            console.log('使用方法: node test_sms_template.js <eventId> [templateId]');
            process.exit(1);
        }

        // 獲取事件
        const event = await Event.findById(TEST_EVENT_ID);
        if (!event) {
            console.error(`❌ 找不到事件 ID: ${TEST_EVENT_ID}`);
            process.exit(1);
        }
        console.log(`✅ 找到事件: ${event.name}`);

        // 獲取 SMS 模板
        let smsTemplate;
        if (TEST_TEMPLATE_ID) {
            smsTemplate = await SmsTemplate.findById(TEST_TEMPLATE_ID);
            if (!smsTemplate) {
                console.error(`❌ 找不到 SMS 模板 ID: ${TEST_TEMPLATE_ID}`);
                process.exit(1);
            }
        } else {
            // 如果沒有提供 templateId，查找第一個 invitation 模板
            smsTemplate = await SmsTemplate.findOne({ 
                $or: [
                    { eventId: TEST_EVENT_ID, type: 'invitation' },
                    { eventId: null, type: 'invitation' }
                ]
            });
            if (!smsTemplate) {
                // 如果沒有 invitation，找任何類型的模板
                smsTemplate = await SmsTemplate.findOne({ 
                    $or: [
                        { eventId: TEST_EVENT_ID },
                        { eventId: null }
                    ]
                });
            }
            if (!smsTemplate) {
                console.error('❌ 找不到 SMS 模板');
                process.exit(1);
            }
        }
        console.log(`✅ 找到 SMS 模板: ${smsTemplate.type} - ${smsTemplate.content.substring(0, 50)}...`);

        // 根據 SMS 模板類型決定 loginUrl
        let loginUrl;
        if (smsTemplate.type === 'invitation') {
            // invitation 類型使用測試 guestId（使用一個假的 ID，因為我們是直接測試）
            loginUrl = `${process.env.DOMAIN || 'http://localhost:3377'}/events/${event._id}/test-guest-id/invitation`;
        } else {
            loginUrl = `${process.env.DOMAIN || 'http://localhost:3377'}/events/${event._id}/login`;
        }

        // 生成確認頁面 URL
        const confirmUrl = `${process.env.DOMAIN || 'http://localhost:3377'}/events/${event._id}/test-guest-id`;

        // 準備測試數據
        const testGuest = {
            name: '測試用戶',
            email: 'test@example.com',
            company: '測試公司',
            phone: '56004956',
            phone_code: '+852'
        };

        // 替換模板變數
        let messageBody = smsTemplate.content
            .replace(/\{\{user\.name\}\}/g, testGuest.name)
            .replace(/\{\{guest\.name\}\}/g, testGuest.name)
            .replace(/\{\{user\.email\}\}/g, testGuest.email)
            .replace(/\{\{guest\.email\}\}/g, testGuest.email)
            .replace(/\{\{user\.company\}\}/g, testGuest.company)
            .replace(/\{\{guest\.company\}\}/g, testGuest.company)
            .replace(/\{\{user\.phone\}\}/g, testGuest.phone)
            .replace(/\{\{guest\.phone\}\}/g, testGuest.phone)
            .replace(/\{\{user\.phone_code\}\}/g, testGuest.phone_code)
            .replace(/\{\{guest\.phone_code\}\}/g, testGuest.phone_code)
            .replace(/\{\{event\.name\}\}/g, event.name)
            .replace(/\{\{loginUrl\}\}/g, loginUrl)
            .replace(/\{\{confirmUrl\}\}/g, confirmUrl);

        console.log('\n📱 準備發送 SMS:');
        console.log(`   收件人: ${TEST_PHONE}`);
        console.log(`   模板類型: ${smsTemplate.type}`);
        console.log(`   消息內容:\n   ${messageBody}\n`);

        // 發送 SMS
        console.log('📤 正在發送 SMS...');
        const response = await twilioSms.sendSMS(TEST_PHONE, messageBody);
        
        console.log('✅ SMS 發送成功！');
        console.log(`   Message SID: ${response.sid}`);
        console.log(`   狀態: ${response.status}`);
        
        await mongoose.disconnect();
        process.exit(0);
    } catch (error) {
        console.error('❌ 發送 SMS 失敗:', error.message);
        if (error.stack) {
            console.error(error.stack);
        }
        await mongoose.disconnect();
        process.exit(1);
    }
}

// 執行測試
testSmsWithTemplate();

