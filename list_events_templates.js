// list_events_templates.js - 列出所有事件和 SMS 模板
require('dotenv').config();
const mongoose = require('mongoose');
const Event = require('./model/Event');
const SmsTemplate = require('./model/SmsTemplate');

async function listEventsAndTemplates() {
    try {
        const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/checkinSystem';
        await mongoose.connect(mongoUri);
        console.log('✅ MongoDB 連接成功\n');

        const events = await Event.find({}).limit(10).select('_id name').sort({ created_at: -1 });
        console.log('📅 可用的事件:');
        if (events.length === 0) {
            console.log('   沒有找到事件');
        } else {
            events.forEach((e, i) => {
                console.log(`   ${i + 1}. ${e._id} - ${e.name}`);
            });
        }

        console.log('\n📱 可用的 SMS 模板:');
        const templates = await SmsTemplate.find({}).limit(20).select('_id type eventId content').sort({ created_at: -1 });
        if (templates.length === 0) {
            console.log('   沒有找到模板');
        } else {
            templates.forEach((t, i) => {
                const scope = t.eventId ? `事件: ${t.eventId}` : '全局';
                const preview = (t.content || '').substring(0, 50).replace(/\n/g, ' ');
                console.log(`   ${i + 1}. ${t._id}`);
                console.log(`      類型: ${t.type} | ${scope}`);
                console.log(`      內容: ${preview}...`);
            });
        }

        await mongoose.disconnect();
    } catch (error) {
        console.error('❌ 錯誤:', error.message);
        await mongoose.disconnect();
        process.exit(1);
    }
}

listEventsAndTemplates();

