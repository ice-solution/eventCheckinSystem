const EmailRecord = require('../model/EmailRecord');
const crypto = require('crypto');

function parseEnvFlag(name, defaultValue = true) {
    const raw = process.env[name];
    if (raw === undefined || raw === null || String(raw).trim() === '') {
        return defaultValue;
    }
    const v = String(raw).trim().toLowerCase();
    if (['false', '0', 'no', 'off', 'disabled'].includes(v)) return false;
    if (['true', '1', 'yes', 'on', 'enabled'].includes(v)) return true;
    return defaultValue;
}

/** 是否啟用郵件追蹤（pixel + 連結改寫）；.env: EMAIL_TRACKING_ENABLED=false 關閉全部 */
exports.isEmailTrackingEnabled = () => parseEnvFlag('EMAIL_TRACKING_ENABLED', true);

/** 是否改寫 <a href> 為 /track/email/click/...；.env: EMAIL_LINK_TRACKING_ENABLED=false 只關連結 */
exports.isEmailLinkTrackingEnabled = () => {
    if (!exports.isEmailTrackingEnabled()) return false;
    return parseEnvFlag('EMAIL_LINK_TRACKING_ENABLED', true);
};

/** 是否加入開信 pixel；.env: EMAIL_OPEN_TRACKING_ENABLED=false 只關 pixel */
exports.isEmailOpenTrackingEnabled = () => {
    if (!exports.isEmailTrackingEnabled()) return false;
    return parseEnvFlag('EMAIL_OPEN_TRACKING_ENABLED', true);
};

function getTrackingBaseUrl(domain = null) {
    const raw = domain || (process.env.DOMAIN || process.env.domain || 'http://localhost:3377').toString().trim().replace(/\/+$/, '');
    return raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
}

/** HMAC 密鑰：優先 EMAIL_TRACKING_SECRET，否則 SESSION_SECRET */
function getRedirectSigningSecret() {
    const secret = (
        process.env.EMAIL_TRACKING_SECRET
        || process.env.SESSION_SECRET
        || process.env.session_secret
        || ''
    ).toString().trim();
    return secret || 'email-tracking-fallback-secret';
}

function signRedirectTarget(targetUrl) {
    return crypto
        .createHmac('sha256', getRedirectSigningSecret())
        .update(String(targetUrl), 'utf8')
        .digest('hex');
}

function timingSafeEqualHex(a, b) {
    try {
        const bufA = Buffer.from(String(a), 'utf8');
        const bufB = Buffer.from(String(b), 'utf8');
        if (bufA.length !== bufB.length) return false;
        return crypto.timingSafeEqual(bufA, bufB);
    } catch (_) {
        return false;
    }
}

function getAllowedRedirectHosts() {
    const hosts = new Set();
    try {
        hosts.add(new URL(getTrackingBaseUrl()).hostname.toLowerCase());
    } catch (_) { /* ignore */ }
    const extra = (process.env.EMAIL_TRACKING_ALLOWED_HOSTS || '')
        .toString()
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean);
    extra.forEach((h) => hosts.add(h));
    return hosts;
}

/**
 * 驗證 click 追蹤 redirect 目標（防 CWE-601 Open Redirect）
 * - 只允許 http / https
 * - 有 sig：必須 HMAC 吻合（郵件發出時簽過的目標）
 * - 無 sig（舊信）：只允許 DOMAIN／EMAIL_TRACKING_ALLOWED_HOSTS 同源
 * @returns {string|null} 安全的目標 URL，否則 null
 */
exports.resolveSafeRedirectTarget = (rawUrl, sig) => {
    if (rawUrl == null || rawUrl === '') return null;

    let target;
    try {
        target = decodeURIComponent(String(rawUrl));
    } catch (_) {
        return null;
    }
    target = String(target).trim();
    if (!target) return null;

    let parsed;
    try {
        parsed = new URL(target);
    } catch (_) {
        return null;
    }

    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password) return null;

    const hasSig = sig != null && String(sig).trim() !== '';
    if (hasSig) {
        const expected = signRedirectTarget(target);
        if (!timingSafeEqualHex(String(sig).trim(), expected)) return null;
        return target;
    }

    // 舊郵件無簽名：僅允許白名單 host，避免任意外站 open redirect
    const host = parsed.hostname.toLowerCase();
    if (getAllowedRedirectHosts().has(host)) return target;
    return null;
};

function buildClickTrackingUrl(baseUrl, trackingId, targetUrl) {
    const sig = signRedirectTarget(targetUrl);
    return `${baseUrl}/track/email/click/${trackingId}?url=${encodeURIComponent(targetUrl)}&sig=${sig}`;
}

/**
 * 在郵件 HTML 中添加追蹤像素和追蹤連結
 * @param {string} html - 原始 HTML 內容
 * @param {string} trackingId - 追蹤 ID
 * @param {string} domain - 域名（用於生成追蹤 URL）
 * @returns {string} 添加了追蹤的 HTML
 */
exports.addTrackingToEmail = (html, trackingId, domain = null) => {
    if (!trackingId || !exports.isEmailTrackingEnabled()) {
        return html;
    }

    const baseUrl = getTrackingBaseUrl(domain);
    let result = html;

    if (exports.isEmailOpenTrackingEnabled()) {
        const trackingPixelUrl = `${baseUrl}/track/email/open/${trackingId}`;
        const trackingPixel = `<img src="${trackingPixelUrl}" width="1" height="1" style="display:none;" alt="" />`;
        if (result.includes('</body>')) {
            result = result.replace('</body>', `${trackingPixel}</body>`);
        } else {
            result += trackingPixel;
        }
    }

    if (exports.isEmailLinkTrackingEnabled()) {
        result = result.replace(/<a\s+([^>]*href=["'])([^"']+)(["'][^>]*)>/gi, (match, before, url, after) => {
            if (url.includes('/track/email/click/')) {
                return match;
            }
            if (url.startsWith('mailto:') || url.startsWith('javascript:') || url.startsWith('data:')) {
                return match;
            }
            // 相對路徑補成絕對 URL，方便簽名與驗證
            let absoluteUrl = url;
            if (url.startsWith('/') && !url.startsWith('//')) {
                absoluteUrl = `${baseUrl}${url}`;
            } else if (url.startsWith('//')) {
                absoluteUrl = `https:${url}`;
            }
            try {
                const parsed = new URL(absoluteUrl);
                if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
                    return match;
                }
            } catch (_) {
                return match;
            }
            const trackingUrl = buildClickTrackingUrl(baseUrl, trackingId, absoluteUrl);
            return `<a ${before}${trackingUrl}${after}>`;
        });
    }

    return result;
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

