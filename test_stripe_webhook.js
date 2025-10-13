/**
 * Stripe Webhook 測試腳本
 * 用於測試 webhook 處理邏輯
 */

const mongoose = require('mongoose');
require('dotenv').config();

// 連接資料庫
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/checkinSystem', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const Transaction = require('./model/Transaction');
const Event = require('./model/Event');

async function testWebhookFlow() {
    console.log('🧪 開始測試 Stripe Webhook 流程...\n');
    
    try {
        // 步驟 1: 查找一個測試 transaction
        console.log('📋 步驟 1: 查找測試 transaction');
        const testTransaction = await Transaction.findOne({ status: 'pending' }).sort({ createdAt: -1 });
        
        if (!testTransaction) {
            console.log('❌ 找不到 pending 狀態的 transaction');
            console.log('💡 請先創建一個測試支付以生成 transaction\n');
            process.exit(1);
        }
        
        console.log('✅ 找到 transaction:');
        console.log(`   ID: ${testTransaction._id}`);
        console.log(`   Session ID: ${testTransaction.stripeSessionId}`);
        console.log(`   Email: ${testTransaction.userEmail}`);
        console.log(`   Status: ${testTransaction.status}\n`);
        
        // 步驟 2: 模擬 webhook 更新 transaction
        console.log('📋 步驟 2: 模擬更新 transaction 為 paid');
        const updatedTransaction = await Transaction.findOneAndUpdate(
            { stripeSessionId: testTransaction.stripeSessionId },
            { 
                status: 'paid',
                updatedAt: new Date()
            },
            { new: true }
        );
        
        console.log('✅ Transaction 已更新:');
        console.log(`   Status: ${updatedTransaction.status}\n`);
        
        // 步驟 3: 查找對應的 event
        console.log('📋 步驟 3: 查找對應的 event');
        const eventDoc = await Event.findById(updatedTransaction.eventId);
        
        if (!eventDoc) {
            console.log(`❌ 找不到 event: ${updatedTransaction.eventId}\n`);
            process.exit(1);
        }
        
        console.log('✅ 找到 event:');
        console.log(`   ID: ${eventDoc._id}`);
        console.log(`   Name: ${eventDoc.name}`);
        console.log(`   Current users count: ${eventDoc.users.length}\n`);
        
        // 步驟 4: 檢查用戶是否已存在
        console.log('📋 步驟 4: 檢查用戶是否已存在');
        const existingUser = eventDoc.users.find(u => u.email === updatedTransaction.userEmail);
        
        if (existingUser) {
            console.log('⚠️  用戶已存在，更新 payment status');
            console.log(`   Name: ${existingUser.name}`);
            console.log(`   Current payment status: ${existingUser.paymentStatus}`);
            
            existingUser.paymentStatus = 'paid';
            existingUser.modified_at = new Date();
            
            await eventDoc.save();
            console.log('✅ 用戶 payment status 已更新為 paid\n');
        } else {
            console.log('✅ 用戶不存在，添加新用戶');
            
            // 模擬 session.metadata (在實際 webhook 中來自 Stripe)
            const mockMetadata = {
                name: updatedTransaction.userName,
                company: 'Test Company',
                phone_code: '+852',
                phone: '12345678'
            };
            
            eventDoc.users.push({
                email: updatedTransaction.userEmail,
                name: updatedTransaction.userName || mockMetadata.name,
                company: mockMetadata.company || '',
                phone_code: mockMetadata.phone_code || '',
                phone: mockMetadata.phone || '',
                paymentStatus: 'paid',
                isCheckIn: false,
                role: 'guests',
                create_at: new Date(),
                modified_at: new Date()
            });
            
            await eventDoc.save();
            console.log('✅ 新用戶已添加到 event.users');
            console.log(`   Email: ${updatedTransaction.userEmail}`);
            console.log(`   Name: ${updatedTransaction.userName}`);
            console.log(`   Payment Status: paid\n`);
        }
        
        // 步驟 5: 驗證結果
        console.log('📋 步驟 5: 驗證結果');
        const verifyEvent = await Event.findById(updatedTransaction.eventId);
        const verifyUser = verifyEvent.users.find(u => u.email === updatedTransaction.userEmail);
        
        console.log('✅ 最終驗證:');
        console.log(`   Event users count: ${verifyEvent.users.length}`);
        console.log(`   User found: ${verifyUser ? 'Yes' : 'No'}`);
        if (verifyUser) {
            console.log(`   User name: ${verifyUser.name}`);
            console.log(`   User email: ${verifyUser.email}`);
            console.log(`   Payment status: ${verifyUser.paymentStatus}`);
            console.log(`   Check-in status: ${verifyUser.isCheckIn}`);
        }
        
        console.log('\n🎉 測試完成！Webhook 流程正常運作\n');
        
        // 可選: 恢復 transaction 狀態為 pending
        console.log('💡 如需再次測試，可以運行以下命令恢復 transaction 狀態:');
        console.log(`   db.transactions.updateOne({_id: ObjectId("${testTransaction._id}")}, {$set: {status: "pending"}})\n`);
        
    } catch (error) {
        console.error('❌ 測試過程中發生錯誤:', error);
    } finally {
        mongoose.connection.close();
    }
}

// 顯示使用說明
async function showUsage() {
    console.log('\n=== Stripe Webhook 測試工具 ===\n');
    console.log('使用方式:');
    console.log('  node test_stripe_webhook.js test    - 執行完整測試流程');
    console.log('  node test_stripe_webhook.js list    - 列出所有 transactions');
    console.log('  node test_stripe_webhook.js check   - 檢查系統配置');
    console.log('');
}

async function listTransactions() {
    console.log('\n📋 所有 Transactions:\n');
    
    const transactions = await Transaction.find().sort({ createdAt: -1 }).limit(10);
    
    if (transactions.length === 0) {
        console.log('❌ 沒有找到任何 transaction\n');
        process.exit(0);
    }
    
    transactions.forEach((t, index) => {
        console.log(`${index + 1}. Transaction ID: ${t._id}`);
        console.log(`   Session ID: ${t.stripeSessionId}`);
        console.log(`   Email: ${t.userEmail}`);
        console.log(`   Name: ${t.userName}`);
        console.log(`   Ticket: ${t.ticketTitle} - HKD ${t.ticketPrice}`);
        console.log(`   Status: ${t.status}`);
        console.log(`   Created: ${t.createdAt}`);
        console.log('');
    });
    
    mongoose.connection.close();
}

async function checkConfiguration() {
    console.log('\n🔍 檢查系統配置:\n');
    
    // 檢查環境變數
    console.log('📋 環境變數:');
    console.log(`   STRIPE_SECRET_KEY: ${process.env.STRIPE_SECRET_KEY ? '✅ 已設定' : '❌ 未設定'}`);
    console.log(`   STRIPE_WEBHOOK_SECRET: ${process.env.STRIPE_WEBHOOK_SECRET ? '✅ 已設定' : '❌ 未設定'}`);
    console.log(`   MONGODB_URI: ${process.env.MONGODB_URI ? '✅ 已設定' : '⚠️  使用預設值'}`);
    console.log('');
    
    // 檢查資料庫連接
    console.log('📋 資料庫連接:');
    const dbStatus = mongoose.connection.readyState;
    const statusText = {
        0: '❌ 斷線',
        1: '✅ 已連接',
        2: '⏳ 連接中',
        3: '⏳ 斷線中'
    };
    console.log(`   Status: ${statusText[dbStatus]}`);
    console.log('');
    
    // 檢查模型
    console.log('📋 資料統計:');
    const transactionCount = await Transaction.countDocuments();
    const eventCount = await Event.countDocuments();
    console.log(`   Transactions: ${transactionCount}`);
    console.log(`   Events: ${eventCount}`);
    console.log('');
    
    // 檢查 pending transactions
    const pendingCount = await Transaction.countDocuments({ status: 'pending' });
    const paidCount = await Transaction.countDocuments({ status: 'paid' });
    const failedCount = await Transaction.countDocuments({ status: 'failed' });
    console.log('📋 Transaction 狀態分布:');
    console.log(`   Pending: ${pendingCount}`);
    console.log(`   Paid: ${paidCount}`);
    console.log(`   Failed: ${failedCount}`);
    console.log('');
    
    mongoose.connection.close();
}

// 主程序
const command = process.argv[2];

switch (command) {
    case 'test':
        testWebhookFlow();
        break;
    case 'list':
        listTransactions();
        break;
    case 'check':
        checkConfiguration();
        break;
    default:
        showUsage();
        mongoose.connection.close();
        break;
}

