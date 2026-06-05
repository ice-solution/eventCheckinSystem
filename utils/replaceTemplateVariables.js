/**
 * 郵件 / SMS 模板變數替換（{{user.name}}、{{event.name}}、{{qrCodeUrl}} 等）
 */

function getPublicBaseUrlFromEnv() {
    const raw = (process.env.DOMAIN || process.env.domain || 'http://localhost:3377').toString().trim().replace(/\/+$/, '');
    return raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
}

/** 將物件壓平為 {{prefix.key}} 變數表 */
function flattenForTemplate(obj, prefix) {
    if (!obj || typeof obj !== 'object') return {};
    const out = {};
    const toStr = (v) => (v === undefined || v === null ? '' : String(v));
    Object.keys(obj).forEach((key) => {
        if (key.startsWith('_') && key !== '_id') return;
        const val = obj[key];
        // _id 為 Mongoose ObjectId（typeof object），需明確輸出供 {{transaction._id}} 等變數
        if (key === '_id') {
            out[`${prefix}._id`] = toStr(val);
            return;
        }
        if (val !== null && typeof val === 'object' && !(val instanceof Date) && !Array.isArray(val)) return;
        out[`${prefix}.${key}`] = Array.isArray(val) ? JSON.stringify(val) : toStr(val);
    });
    return out;
}

/** 從活動用戶列表以 email 補全 _id（發票信等僅有 email 時） */
function resolveEventUser(event, user) {
    const userObj = user && (user.toObject ? user.toObject() : user);
    if (!userObj) return null;
    if (userObj._id) return userObj;
    const eventObj = event && (event.toObject ? event.toObject() : event);
    if (!eventObj || !Array.isArray(eventObj.users) || !userObj.email) return userObj;
    const found = eventObj.users.find((u) => u.email && u.email === userObj.email);
    if (!found) return userObj;
    return found.toObject ? found.toObject() : found;
}

/**
 * 發信／預覽共用的額外變數（含網頁版郵件連結）
 * 模板內請用 {{emailPreviewUrl}} 或 {{contentUrl}}，勿寫死 URL
 */
function buildEmailTemplateAdditionalVars({ baseUrl, user, event, emailTemplateId, transaction = null } = {}) {
    const userObj = resolveEventUser(event, user);
    const eventObj = event && (event.toObject ? event.toObject() : event);
    const base = (baseUrl || getPublicBaseUrlFromEnv()).replace(/\/+$/, '');
    const uid = userObj && userObj._id ? String(userObj._id) : '';
    const eventId = eventObj && eventObj._id ? String(eventObj._id) : '';

    const qrCodeUrl = uid
        ? `https://api.qrserver.com/v1/create-qr-code/?data=${uid}&size=250x250`
        : '';

    const vars = {
        qrCodeUrl,
        qrcodeUrl: qrCodeUrl,
        loginUrl: eventId ? `${base}/events/${eventId}/login` : '',
        checkinLink: eventId ? `${base}/events/${eventId}/login` : '',
    };

    if (emailTemplateId && uid) {
        const tplId = String(emailTemplateId);
        let previewUrl = `${base}/emailTemplate/preview/${tplId}?userId=${uid}`;
        if (transaction && transaction._id) {
            previewUrl += `&transactionId=${transaction._id}`;
        }
        vars.emailPreviewUrl = previewUrl;
        vars.webVersionUrl = previewUrl;
        vars.contentUrl = previewUrl;
    }

    if (transaction) {
        const t = transaction.toObject ? transaction.toObject() : transaction;
        Object.assign(vars, flattenForTemplate(t, 'transaction'));
        vars['transaction.amount'] = t.ticketPrice != null ? String(t.ticketPrice) : '';
        const invoiceData = t.transactionData && Object.keys(t.transactionData).length > 0
            ? t.transactionData
            : {
                currency: 'HKD',
                number: String(t.stripeSessionId || t._id || ''),
                state: t.status || '',
                paid_total: t.ticketPrice != null ? String(t.ticketPrice) : '',
            };
        Object.assign(vars, flattenForTemplate(invoiceData, 'invoice'));
    }

    return vars;
}

function replaceTemplateVariables(content, user, event, additionalVars = {}) {
    if (!content) return '';
    let result = String(content);

    const userObj = user && (user.toObject ? user.toObject() : user);
    const eventObj = event && (event.toObject ? event.toObject() : event);

    if (!userObj || !eventObj) {
        return result;
    }

    result = result.replace(/\{\{user\.name\}\}/g, userObj.name || '');
    result = result.replace(/\{\{user\.email\}\}/g, userObj.email || '');
    result = result.replace(/\{\{user\.company\}\}/g, userObj.company || '');
    result = result.replace(/\{\{user\.phone\}\}/g, userObj.phone || '');
    result = result.replace(/\{\{user\.phone_code\}\}/g, userObj.phone_code || '');
    result = result.replace(/\{\{event\.name\}\}/g, eventObj.name || '');

    Object.keys(userObj).forEach((key) => {
        if (key.startsWith('_')) return;
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\{\\{user\\.${escapedKey}\\}\\}`, 'g');
        const value = userObj[key];
        const replacement = value !== undefined && value !== null ? String(value) : '';
        result = result.replace(regex, replacement);
    });

    Object.keys(additionalVars).forEach((key) => {
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'g');
        result = result.replace(regex, additionalVars[key] || '');
    });

    return result;
}

module.exports = {
    replaceTemplateVariables,
    buildEmailTemplateAdditionalVars,
    resolveEventUser,
    flattenForTemplate,
    getPublicBaseUrlFromEnv,
};
