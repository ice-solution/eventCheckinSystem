/**
 * 批量發送歡迎電郵工具
 * 
 * 使用方法：
 * node send_welcome_emails.js <eventId> <userId1> <userId2> <userId3> ...
 * 
 * 例如：
 * node send_welcome_emails.js 68faefd3a325b3b73ed12a7e 67a1234567890abcdef12345 67a9876543210fedcba09876
 */

const mongoose = require('mongoose');
const Event = require('./model/Event');
const EmailTemplate = require('./model/EmailTemplate');
const ses = require('./utils/ses');
const { getWelcomeEmailTemplate } = require('./template/welcomeEmail');

// 連接到 MongoDB
mongoose.connect(process.env.mongodb || 'mongodb://localhost:27017/checkinSystem', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(async () => {
    console.log('MongoDB 連接成功');
    
    // 獲取命令行參數
    const args = process.argv.slice(2);
    
    if (args.length < 2) {
        console.log('使用方法：');
        console.log('node send_welcome_emails.js <eventId> <userId1> [userId2] [userId3] ...');
        console.log('');
        console.log('範例：');
        console.log('node send_welcome_emails.js 68faefd3a325b3b73ed12a7e 67a1234567890abcdef12345 67a9876543210fedcba09876');
        process.exit(1);
    }
    
    const [eventId, ...userIds] = args;
    
    try {
        // 查找事件
        const event = await Event.findById(eventId);
        if (!event) {
            console.error(`❌ 找不到事件：${eventId}`);
            process.exit(1);
        }
        
        console.log(`✅ 找到事件：${event.name}`);
        console.log(`📧 準備發送 ${userIds.length} 封歡迎電郵...\n`);
        
        let successCount = 0;
        let failCount = 0;
        
        // 查找歡迎郵件模板
        let emailTemplate = await EmailTemplate.findOne({ 
            eventId: event._id, 
            type: 'welcome' 
        });
        
        if (!emailTemplate) {
            emailTemplate = await EmailTemplate.findOne({ 
                eventId: null, 
                type: 'welcome' 
            });
        }
        
        // 逐一處理每個用戶
        for (const userId of userIds) {
            try {
                // 查找用戶
                const user = event.users.id(userId);
                
                if (!user) {
                    console.error(`❌ 找不到用戶：${userId}`);
                    failCount++;
                    continue;
                }
                
                console.log(`發送電郵給 ${user.name} (${user.email})...`);
                
                // 生成 QR 碼
                const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${user._id}&size=250x250`;
                
                // 準備郵件內容
                let subject = '歡迎加入我們的活動';
                let messageBody;
                
                if (emailTemplate) {
                    subject = emailTemplate.subject;
                    messageBody = emailTemplate.content
                        .replace(/\{\{user\.name\}\}/g, user.name)
                        .replace(/\{\{user\.email\}\}/g, user.email)
                        .replace(/\{\{user\.company\}\}/g, user.company || '')
                        .replace(/\{\{event\.name\}\}/g, event.name)
                        .replace(/\{\{qrCodeUrl\}\}/g, qrCodeUrl);
                } else {
                    messageBody = getWelcomeEmailTemplate(user, event, qrCodeUrl);
                }
                
                // 發送郵件
                await ses.sendEmail(user.email, subject, messageBody);
                console.log(`  ✅ 成功發送給 ${user.email}`);
                successCount++;
                
            } catch (error) {
                console.error(`  ❌ 發送失敗：${error.message}`);
                failCount++;
            }
        }
        
        console.log('\n' + '='.repeat(50));
        console.log('📊 發送結果：');
        console.log(`✅ 成功：${successCount} 封`);
        console.log(`❌ 失敗：${failCount} 封`);
        console.log('='.repeat(50));
        
        process.exit(0);
        
    } catch (error) {
        console.error('發送過程出錯：', error);
        process.exit(1);
    }
    
}).catch(err => {
    console.error('MongoDB 連接失敗：', err);
    process.exit(1);
});

