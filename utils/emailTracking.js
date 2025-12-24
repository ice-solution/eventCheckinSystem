const EmailRecord = require('../model/EmailRecord');
const crypto = require('crypto');

/**
 * 在郵件 HTML 中添加追蹤像素和追蹤連結
 * @param {string} html - 原始 HTML 內容
 * @param {string} trackingId - 追蹤 ID
 * @param {string} domain - 域名（用於生成追蹤 URL）
 * @returns {string} 添加了追蹤的 HTML
 */
exports.addTrackingToEmail = (html, trackingId, domain = null) => {
    if (!trackingId) {
        return html;
    }

    const baseUrl = domain || process.env.DOMAIN || 'http://localhost:3377';
    const trackingPixelUrl = `${baseUrl}/track/email/open/${trackingId}`;

    // 添加追蹤像素（在郵件末尾）
    const trackingPixel = `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />`;
    
    // 如果 HTML 有 </body> 標籤，在之前插入；否則在末尾添加
    if (html.includes('</body>')) {
        html = html.replace('</body>', `${trackingPixel}</body>`);
    } else {
        html += trackingPixel;
    }

    // 替換所有連結為追蹤連結
    html = html.replace(/<a\s+([^>]*href=["'])([^"']+)(["'][^>]*)>/gi, (match, before, url, after) => {
        // 跳過已經是追蹤連結的 URL
        if (url.includes('/track/email/click/')) {
            return match;
        }
        // 跳過 mailto: 和 javascript: 連結
        if (url.startsWith('mailto:') || url.startsWith('javascript:')) {
            return match;
        }
        // 創建追蹤連結
        const encodedUrl = encodeURIComponent(url);
        const trackingUrl = `${baseUrl}/track/email/click/${trackingId}?url=${encodedUrl}`;
        return `<a ${before}${trackingUrl}${after}>`;
    });

    return html;
};

/**
 * 創建郵件記錄並返回追蹤 ID
 * @param {Object} emailData - 郵件數據
 * @param {string} emailData.recipient - 收件人
 * @param {string} emailData.subject - 主題
 * @param {string} emailData.emailTemplateId - 郵件模板 ID
 * @param {string} emailData.eventId - 事件 ID（可選）
 * @param {string} emailData.userId - 用戶 ID（可選）
 * @returns {Promise<string>} 追蹤 ID
 */
/**
 * 生成追蹤 ID
 */
const generateTrackingId = () => {
    return crypto.randomBytes(16).toString('hex');
};

exports.createEmailRecord = async (emailData) => {
    try {
        const trackingId = generateTrackingId();
        
        const emailRecord = new EmailRecord({
            recipient: emailData.recipient,
            subject: emailData.subject,
            emailTemplate: emailData.emailTemplateId,
            eventId: emailData.eventId,
            userId: emailData.userId,
            status: 'pending',
            trackingId: trackingId,
            created_at: new Date()
        });

        await emailRecord.save();
        return trackingId;
    } catch (error) {
        console.error('Error creating email record:', error);
        return null;
    }
};

/**
 * 更新郵件記錄狀態
 * @param {string} trackingId - 追蹤 ID
 * @param {string} status - 狀態：sent, failed, delivered, bounced
 * @param {string} messageId - 郵件服務商返回的 Message ID
 */
exports.updateEmailRecordStatus = async (trackingId, status, messageId = null) => {
    try {
        const emailRecord = await EmailRecord.findOne({ trackingId });
        if (emailRecord) {
            emailRecord.status = status;
            if (messageId) {
                emailRecord.messageId = messageId;
            }
            if (status === 'sent') {
                emailRecord.sent_at = new Date();
            }
            if (status === 'delivered') {
                emailRecord.delivered_at = new Date();
            }
            await emailRecord.save();
        }
    } catch (error) {
        console.error('Error updating email record status:', error);
    }
};

