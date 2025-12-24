const EmailRecord = require('../model/EmailRecord');
const crypto = require('crypto');

/**
 * 記錄郵件打開事件
 * @param {string} trackingId - 追蹤 ID
 */
exports.trackEmailOpen = async (req, res) => {
    try {
        const { trackingId } = req.params;

        if (!trackingId) {
            return res.status(400).send('Missing tracking ID');
        }

        const emailRecord = await EmailRecord.findOne({ trackingId });

        if (!emailRecord) {
            // 返回 1x1 透明像素
            const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
            res.set('Content-Type', 'image/gif');
            res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
            res.set('Pragma', 'no-cache');
            res.set('Expires', '0');
            return res.send(pixel);
        }

        // 更新打開記錄
        if (!emailRecord.opened_at) {
            emailRecord.opened_at = new Date();
        }
        emailRecord.opened_count = (emailRecord.opened_count || 0) + 1;
        await emailRecord.save();

        // 返回 1x1 透明像素
        const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
        res.set('Content-Type', 'image/gif');
        res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        res.send(pixel);
    } catch (error) {
        console.error('Error tracking email open:', error);
        // 即使出錯也返回像素，避免影響郵件顯示
        const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
        res.set('Content-Type', 'image/gif');
        res.send(pixel);
    }
};

/**
 * 記錄郵件連結點擊事件
 * @param {string} trackingId - 追蹤 ID
 * @param {string} url - 被點擊的連結 URL
 */
exports.trackEmailClick = async (req, res) => {
    try {
        const { trackingId } = req.params;
        const { url } = req.query;

        if (!trackingId || !url) {
            return res.status(400).send('Missing tracking ID or URL');
        }

        const emailRecord = await EmailRecord.findOne({ trackingId });

        if (!emailRecord) {
            // 重定向到原始 URL
            return res.redirect(decodeURIComponent(url));
        }

        // 更新點擊記錄
        if (!emailRecord.clicked_at) {
            emailRecord.clicked_at = new Date();
        }
        emailRecord.clicked_count = (emailRecord.clicked_count || 0) + 1;

        // 記錄點擊的連結
        if (!emailRecord.clicked_links) {
            emailRecord.clicked_links = [];
        }
        emailRecord.clicked_links.push({
            url: decodeURIComponent(url),
            clicked_at: new Date()
        });

        await emailRecord.save();

        // 重定向到原始 URL
        res.redirect(decodeURIComponent(url));
    } catch (error) {
        console.error('Error tracking email click:', error);
        // 即使出錯也重定向，避免影響用戶體驗
        if (req.query.url) {
            res.redirect(decodeURIComponent(req.query.url));
        } else {
            res.status(500).send('Error tracking click');
        }
    }
};

/**
 * 獲取郵件追蹤統計
 * @param {string} emailTemplateId - 郵件模板 ID
 * @param {string} eventId - 事件 ID（可選）
 */
exports.getEmailTrackingStats = async (req, res) => {
    try {
        const { emailTemplateId, eventId } = req.query;

        const query = {};
        if (emailTemplateId) {
            query.emailTemplate = emailTemplateId;
        }
        if (eventId) {
            query.eventId = eventId;
        }

        const records = await EmailRecord.find(query);

        const stats = {
            total: records.length,
            sent: records.filter(r => r.status === 'sent' || r.status === 'delivered').length,
            failed: records.filter(r => r.status === 'failed').length,
            opened: records.filter(r => r.opened_at).length,
            clicked: records.filter(r => r.clicked_at).length,
            openRate: 0,
            clickRate: 0,
            clickToOpenRate: 0
        };

        const sentCount = stats.sent;
        if (sentCount > 0) {
            stats.openRate = ((stats.opened / sentCount) * 100).toFixed(2);
            stats.clickRate = ((stats.clicked / sentCount) * 100).toFixed(2);
        }

        if (stats.opened > 0) {
            stats.clickToOpenRate = ((stats.clicked / stats.opened) * 100).toFixed(2);
        }

        res.json(stats);
    } catch (error) {
        console.error('Error getting email tracking stats:', error);
        res.status(500).json({ error: 'Error getting tracking stats' });
    }
};

/**
 * 生成追蹤 ID
 */
exports.generateTrackingId = () => {
    return crypto.randomBytes(16).toString('hex');
};

