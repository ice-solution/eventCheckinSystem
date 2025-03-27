const EmailTemplate = require('../model/EmailTemplate'); // 假設您有一個 EmailTemplate 模型
const Event = require('../model/Event'); // 引入 Event 模型

// 保存電子郵件模板
exports.saveEmailTemplate = async (req, res) => {
    const { subject, body, eventId } = req.body; // 從請求中獲取電子郵件主題、內容和事件 ID

    try {
        // 創建新的電子郵件模板實例
        const newTemplate = new EmailTemplate({
            subject,
            body,
            created_at: Date.now(),
            modified_at: Date.now()
        });

        await newTemplate.save(); // 保存電子郵件模板

        // 更新事件以關聯電子郵件模板
        await Event.findByIdAndUpdate(eventId, { emailTemplate: newTemplate._id });

        res.status(201).send('電子郵件模板保存成功！');
    } catch (error) {
        console.error('Error saving email template:', error);
        res.status(500).send('保存電子郵件模板時出現錯誤！');
    }
};