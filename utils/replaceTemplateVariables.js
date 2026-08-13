/**
 * 郵件 / SMS 模板變數替換（{{user.name}}、{{event.name}}、{{qrCodeUrl}} 等）
 *
 * Select／radio／checkbox 欄位另支援：
 *   {{user.fieldName}}              → 儲存的 option value（向後相容）
 *   {{user.fieldName.label.zh}}     → FormConfig option 中文 label（無則 fallback value）
 *   {{user.fieldName.label.en}}     → FormConfig option 英文 label（無則 fallback value）
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

function getOptionLabelText(option, lang) {
    if (!option) return '';
    const fallback = option.value != null ? String(option.value) : '';
    const label = option.label;
    if (label == null || label === '') return fallback;
    if (typeof label === 'string') return label || fallback;
    if (typeof label !== 'object') return fallback;
    if (lang === 'en') {
        const t = (label.en || label.zh || '').toString().trim();
        return t || fallback;
    }
    const t = (label.zh || label.en || '').toString().trim();
    return t || fallback;
}

function findFieldWithOptions(formConfig, fieldName) {
    if (!formConfig || !fieldName) return null;
    const sections = formConfig.sections || [];
    for (let i = 0; i < sections.length; i++) {
        const fields = (sections[i] && sections[i].fields) || [];
        for (let j = 0; j < fields.length; j++) {
            const field = fields[j];
            if (field && field.fieldName === fieldName && Array.isArray(field.options) && field.options.length) {
                return field;
            }
        }
    }
    return null;
}

function getUserRawFieldValue(userObj, fieldName) {
    if (!userObj || !fieldName) return undefined;
    let v = userObj[fieldName];
    if (v === undefined || v === null || v === '') {
        if (userObj.formData && typeof userObj.formData === 'object') {
            v = userObj.formData[fieldName];
        }
    }
    return v;
}

function resolveOptionValueToLabel(options, rawValue, lang) {
    if (rawValue === undefined || rawValue === null || rawValue === '') return '';
    if (Array.isArray(rawValue)) {
        return rawValue
            .map((v) => resolveOptionValueToLabel(options, v, lang))
            .filter((s) => s !== '')
            .join(', ');
    }
    const valueStr = String(rawValue);
    const opt = (options || []).find((o) => o && String(o.value) === valueStr);
    if (!opt) return valueStr; // 無對應 option → 用已存 value
    return getOptionLabelText(opt, lang) || valueStr;
}

/**
 * 依 FormConfig options 產生 {{user.field.label.zh|en}} 變數
 * 無 label 時 fallback 為 option value／已存值
 */
function buildUserOptionLabelVars(user, formConfig) {
    const vars = {};
    if (!user || !formConfig || !Array.isArray(formConfig.sections)) return vars;
    const userObj = user.toObject ? user.toObject({ minimize: false }) : user;

    formConfig.sections.forEach((section) => {
        (section.fields || []).forEach((field) => {
            if (!field || !field.fieldName || !Array.isArray(field.options) || !field.options.length) return;
            if (field.type === 'display') return;
            const name = field.fieldName;
            const raw = getUserRawFieldValue(userObj, name);
            vars[`user.${name}.label.zh`] = resolveOptionValueToLabel(field.options, raw, 'zh');
            vars[`user.${name}.label.en`] = resolveOptionValueToLabel(field.options, raw, 'en');
        });
    });
    return vars;
}

async function loadFormConfigForEvent(eventId) {
    if (!eventId) return null;
    try {
        const FormConfig = require('../model/FormConfig');
        const formConfigController = require('../controllers/formConfigController');
        let formConfig = await FormConfig.findOne({ eventId });
        if (!formConfig) return null;
        return formConfigController.getFormConfigForRender(formConfig);
    } catch (e) {
        console.warn('loadFormConfigForEvent failed:', e && e.message ? e.message : e);
        return null;
    }
}

/**
 * 發信／預覽共用的額外變數（含網頁版郵件連結、select label）
 * 模板內請用 {{emailPreviewUrl}} 或 {{contentUrl}}，勿寫死 URL
 */
async function buildEmailTemplateAdditionalVars({
    baseUrl,
    user,
    event,
    emailTemplateId,
    transaction = null,
    formConfig = null
} = {}) {
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

    // 專屬 Application 補填連結（invitation 等；每人獨立 token，約 180 日）
    if (eventId && uid) {
        try {
            const { buildApplicationLink } = require('./applicationToken');
            const appLink = buildApplicationLink(base, eventId, uid);
            vars.applicationLink = appLink;
            vars.applicationUrl = appLink;
        } catch (e) {
            vars.applicationLink = '';
            vars.applicationUrl = '';
        }
    }

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

    // select／radio／checkbox：{{user.field.label.zh|en}}
    let fc = formConfig;
    if (!fc && eventId) {
        fc = await loadFormConfigForEvent(eventId);
    }
    if (fc && userObj) {
        Object.assign(vars, buildUserOptionLabelVars(userObj, fc));
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
        // 跳過物件／陣列頂層，避免把 [object Object] 寫進 {{user.xxx}}；
        // 陣列／label 由 additionalVars（user.xxx.label.*）處理
        const value = userObj[key];
        if (value !== null && typeof value === 'object' && !(value instanceof Date)) return;
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\{\\{user\\.${escapedKey}\\}\\}`, 'g');
        const replacement = value !== undefined && value !== null ? String(value) : '';
        result = result.replace(regex, replacement);
    });

    Object.keys(additionalVars || {}).forEach((key) => {
        if (key.startsWith('__')) return;
        const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\{\\{${escapedKey}\\}\\}`, 'g');
        const val = additionalVars[key];
        result = result.replace(regex, val != null ? String(val) : '');
    });

    return result;
}

module.exports = {
    replaceTemplateVariables,
    buildEmailTemplateAdditionalVars,
    buildUserOptionLabelVars,
    resolveEventUser,
    flattenForTemplate,
    getPublicBaseUrlFromEnv,
    loadFormConfigForEvent,
};
