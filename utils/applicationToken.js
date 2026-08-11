/**
 * 專屬 Application 連結 token（HMAC，預設有效 180 日）
 * URL: /web/:eventId/application/:userId?token=...
 */

const crypto = require('crypto');
const { getPublicBaseUrlFromEnv } = require('./replaceTemplateVariables');

const DEFAULT_TTL_MS = 180 * 24 * 60 * 60 * 1000; // 半年

function getSecret() {
    const s = (
        process.env.APPLICATION_TOKEN_SECRET ||
        process.env.SESSION_SECRET ||
        process.env.JWT_SECRET ||
        'events-application-token'
    ).toString();
    return s;
}

function getTtlMs() {
    const days = parseInt(process.env.APPLICATION_TOKEN_TTL_DAYS || '180', 10);
    if (!Number.isFinite(days) || days <= 0) return DEFAULT_TTL_MS;
    return days * 24 * 60 * 60 * 1000;
}

function b64urlEncode(buf) {
    return Buffer.from(buf)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/g, '');
}

function b64urlDecodeToString(str) {
    const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
    const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + pad;
    return Buffer.from(b64, 'base64').toString('utf8');
}

function signPayload(payloadB64) {
    return b64urlEncode(
        crypto.createHmac('sha256', getSecret()).update(payloadB64).digest()
    );
}

/**
 * @returns {{ token: string, exp: number }}
 */
function createApplicationToken(eventId, userId, ttlMs = getTtlMs()) {
    const exp = Date.now() + ttlMs;
    const payload = JSON.stringify({
        e: String(eventId),
        u: String(userId),
        exp
    });
    const payloadB64 = b64urlEncode(payload);
    const sig = signPayload(payloadB64);
    return { token: `${payloadB64}.${sig}`, exp };
}

/**
 * @returns {{ ok: boolean, reason?: string, eventId?: string, userId?: string, exp?: number }}
 */
function verifyApplicationToken(token, eventId, userId) {
    if (!token || typeof token !== 'string' || !token.includes('.')) {
        return { ok: false, reason: 'invalid_token' };
    }
    const [payloadB64, sig] = token.split('.');
    if (!payloadB64 || !sig) return { ok: false, reason: 'invalid_token' };

    const expected = signPayload(payloadB64);
    const sigBuf = Buffer.from(sig);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        return { ok: false, reason: 'invalid_signature' };
    }

    let data;
    try {
        data = JSON.parse(b64urlDecodeToString(payloadB64));
    } catch (_) {
        return { ok: false, reason: 'invalid_payload' };
    }

    if (!data || String(data.e) !== String(eventId) || String(data.u) !== String(userId)) {
        return { ok: false, reason: 'mismatch' };
    }
    if (!data.exp || Date.now() > Number(data.exp)) {
        return { ok: false, reason: 'expired' };
    }
    return { ok: true, eventId: String(data.e), userId: String(data.u), exp: Number(data.exp) };
}

function buildApplicationLink(baseUrl, eventId, userId) {
    const base = (baseUrl || getPublicBaseUrlFromEnv()).toString().replace(/\/+$/, '');
    const { token } = createApplicationToken(eventId, userId);
    return `${base}/web/${eventId}/application/${userId}?token=${encodeURIComponent(token)}`;
}

/** 判斷用戶某欄位是否已有資料（唯讀鎖定） */
function isUserFieldFilled(userObj, fieldName) {
    if (!userObj || !fieldName) return false;
    let v = userObj[fieldName];
    if (v === undefined || v === null || v === '') {
        if (userObj.formData && typeof userObj.formData === 'object') {
            v = userObj.formData[fieldName];
        }
    }
    if (v === undefined || v === null) return false;
    if (Array.isArray(v)) return v.length > 0;
    if (typeof v === 'boolean') return true;
    return String(v).trim() !== '';
}

function getUserFieldValue(userObj, fieldName) {
    if (!userObj || !fieldName) return '';
    let v = userObj[fieldName];
    if (v === undefined || v === null || v === '') {
        if (userObj.formData && typeof userObj.formData === 'object' && userObj.formData[fieldName] != null) {
            v = userObj.formData[fieldName];
        }
    }
    if (v === undefined || v === null) return '';
    return v;
}

module.exports = {
    createApplicationToken,
    verifyApplicationToken,
    buildApplicationLink,
    isUserFieldFilled,
    getUserFieldValue,
    getTtlMs,
    DEFAULT_TTL_MS
};
