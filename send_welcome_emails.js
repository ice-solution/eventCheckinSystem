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

// 動態替換 email template 中的所有 user 字段
function replaceTemplateVariables(content, user, event, additionalVars = {}) {
    let result = content;
    
    // 將 user 轉換為普通對象（如果是 Mongoose document）
    const userObj = user.toObject ? user.toObject() : user;
    
    // 替換基本字段（優先處理，確保覆蓋）
    result = result.replace(/\{\{user\.name\}\}/g, userObj.name || '');
    result = result.replace(/\{\{user\.email\}\}/g, userObj.email || '');
    result = result.replace(/\{\{user\.company\}\}/g, userObj.company || '');
    result = result.replace(/\{\{user\.phone\}\}/g, userObj.phone || '');
    result = result.replace(/\{\{user\.phone_code\}\}/g, userObj.phone_code || '');
    result = result.replace(/\{\{event\.name\}\}/g, event.name || '');
    
    // 動態替換所有 user 對象中的其他字段（包括 formConfig 中定義的字段）
    Object.keys(userObj).forEach(key => {
        // 跳過 MongoDB 內部字段
        if (key.startsWith('_')) {
            return;
        }
        
        // 替換 {{user.fieldName}} 格式（轉義特殊字符）
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\{\\{user\\.${escapedKey}\\}\\}`, 'g');
        const value = userObj[key];
        // 如果值存在，轉換為字符串；否則為空字符串
        const replacement = value !== undefined && value !== null ? String(value) : '';
        result = result.replace(regex, replacement);
    });
    
    // 替換額外變量（如 qrCodeUrl, loginUrl, transaction.* 等）
    Object.keys(additionalVars).forEach(key => {
        // 轉義特殊字符以支持 transaction.ticketTitle 這樣的鍵
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'g');
        result = result.replace(regex, additionalVars[key] || '');
    });
    
    return result;
}

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
                    // 使用動態替換函數，支持所有 user 字段
                    messageBody = replaceTemplateVariables(emailTemplate.content, user, event, {
                        qrCodeUrl: qrCodeUrl
                    });
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

