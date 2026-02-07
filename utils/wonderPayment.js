/**
 * Wonder Payment Gateway 整合
 * .env: PAYMENT_DEV=true → https://gateway-stg.wonder.today，否則 https://gateway.wonder.today
 * 建立訂單前需先以 Wonder-RSA-SHA256 簽名認證（Credential / Nonce / Signature）
 */

const axios = require('axios');
const path = require('path');
const WonderSignature = require(path.join(__dirname, '../nodejs/wonder_signature'));

const WONDER_ECHO_URI = '/svc/payment/api/v1/openapi/echo';
const WONDER_ORDER_API_PATH = '/svc/payment/api/v1/openapi/orders';

function getPaymentBaseUrl() {
    const dev = (process.env.PAYMENT_DEV || process.env.payment_dev || '').toString().trim().toLowerCase();
    const isDev = dev === 'true' || dev === '1';
    return isDev
        ? 'https://gateway-stg.wonder.today'
        : 'https://gateway.wonder.today';
}

/** UTC 時間 YYYYMMDDHHMMSS（Wonder credential 用） */
function formatTimeToYYYYMMDDHHMMSS(date = new Date()) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

/**
 * 取得 Wonder 設定（從 .env）
 */
function getWonderConfig() {
    const appId = (process.env.WONDER_APP_ID || '').trim();
    const customerUuid = (process.env.WONDER_CUSTOMER_UUID || '').trim();
    const apiKey = (process.env.WONDER_API_KEY || '').trim();
    const privateKeyRaw = process.env.WONDER_PRIVATE_KEY || '';
    const privateKey = privateKeyRaw.replace(/\\n/g, '\n').trim();
    return { appId, customerUuid, apiKey, privateKey };
}

/**
 * 產生 Wonder API 認證 headers（Credential, Nonce, Signature）
 * @param {string} privateKey - RSA private key (PEM)
 * @param {string} appId - WONDER_APP_ID
 * @param {string} method - HTTP method e.g. 'POST'
 * @param {string} uri - path e.g. '/svc/payment/api/v1/openapi/orders'
 * @param {string} bodyString - 請求 body 的 JSON 字串
 */
function getWonderAuthHeaders(privateKey, appId, method, uri, bodyString) {
    if (!privateKey || !appId) {
        throw new Error('WONDER_PRIVATE_KEY and WONDER_APP_ID are required for Wonder authentication');
    }
    const wonderSignature = new WonderSignature();
    const nonce = WonderSignature.generateRandomString(16);
    const now = formatTimeToYYYYMMDDHHMMSS();
    const credential = `${appId}/${now}/Wonder-RSA-SHA256`;
    const signature = wonderSignature.signature(privateKey, credential, nonce, method, uri, bodyString || null);
    return {
        Credential: credential,
        Nonce: nonce,
        Signature: signature
    };
}

/**
 * Step 1: 先呼叫 echo 做 auth，系統返回 200 即代表 auth 成功（不解析 response body）
 */
async function wonderAuthenticate() {
    const baseUrl = getPaymentBaseUrl();
    const { appId, privateKey } = getWonderConfig();
    if (!appId || !privateKey || !privateKey.includes('BEGIN')) {
        throw new Error('WONDER_APP_ID and WONDER_PRIVATE_KEY are required for Wonder auth');
    }

    const now = formatTimeToYYYYMMDDHHMMSS();
    const authBody = { message: `Hello, Current timestamp is ${now}` };
    const authBodyString = JSON.stringify(authBody);
    const method = 'POST';
    const uri = WONDER_ECHO_URI;

    const authHeaders = getWonderAuthHeaders(privateKey, appId, method, uri, authBodyString);
    const url = `${baseUrl}${WONDER_ECHO_URI}`;
    const headers = {
        'Content-Type': 'application/json',
        'Credential': authHeaders.Credential,
        'Nonce': authHeaders.Nonce,
        'Signature': authHeaders.Signature
    };

    console.log('\n[Wonder] ========== AUTH (echo) REQUEST ==========');
    console.log('[Wonder] Method:', method);
    console.log('[Wonder] URL:', url);
    console.log('[Wonder] Headers:', JSON.stringify({ ...headers }, null, 2));
    console.log('[Wonder] Body:', authBodyString);

    const response = await axios.post(url, authBodyString, {
        headers,
        timeout: 15000,
        validateStatus: () => true
    });

    console.log('\n[Wonder] ========== AUTH (echo) RESPONSE ==========');
    console.log('[Wonder] Status:', response.status, response.statusText);
    console.log('[Wonder] Response Data:', typeof response.data === 'object' ? JSON.stringify(response.data, null, 2) : response.data);
    console.log('[Wonder] ===========================================\n');

    if (response.status !== 200 && response.status !== 201) {
        throw new Error(`Wonder auth failed: ${response.status} - ${JSON.stringify(response.data)}`);
    }
    // 200 = auth 成功，不需解析 response body
}

/**
 * 建立 Wonder 訂單（Step 2: auth 成功後，用我們自己的簽名呼叫 create order）
 * 回傳 { paymentUrl, orderId } 或拋錯
 * @param {Object} params
 * @param {string} params.referenceNumber - 我方參考編號（建議用 Transaction._id）
 * @param {string} params.currency - 例如 'HKD'
 * @param {string} params.ticketTitle - 票券名稱
 * @param {number} params.amount - 金額（整數或小數）
 * @param {string} params.callbackUrl - 付款完成後 Wonder 回調的 URL
 * @param {string} params.redirectUrl - 付款完成後導向使用者的 URL
 * @param {string} [params.dueDate] - 到期日 YYYY-MM-DD
 * @param {string} [params.note] - 備註
 */
async function createOrder(params) {
    const baseUrl = getPaymentBaseUrl();
    const { appId, customerUuid, apiKey, privateKey } = getWonderConfig();
    if (!appId) {
        throw new Error('WONDER_APP_ID is required in .env');
    }

    // Step 1: 先 auth（echo），200 即成功
    await wonderAuthenticate();

    const amountStr = typeof params.amount === 'number'
        ? params.amount.toFixed(2)
        : String(params.amount || '0.00');

    // order 依官方設定：reference_number, charge_fee, note, callback_url, redirect_url
    const body = {
        app_id: appId,
        customer_uuid: customerUuid || '00000000-0000-0000-0000-000000000000',
        order: {
            reference_number: String(params.referenceNumber || ''),
            charge_fee: amountStr,
            currency: (params.currency || 'HKD').toUpperCase(),
            note: String(params.note || ''),
            callback_url: params.callbackUrl,
            redirect_url: params.redirectUrl
        }
    };

    const plainText = JSON.stringify(body);
    const query = 'with_payment_link=true';
    const uriWithQuery = `${WONDER_ORDER_API_PATH}?${query}`;
    const url = `${baseUrl}${uriWithQuery}`;
    const method = 'POST';

    if (!privateKey || !privateKey.includes('BEGIN')) {
        throw new Error('WONDER_PRIVATE_KEY is required for create order signature');
    }
    // Step 2: auth 成功後，用我們自己的簽名（uri 含 query，對 order body 簽名）呼叫 create order
    const orderAuthHeaders = getWonderAuthHeaders(privateKey, appId, method, uriWithQuery, plainText);
    const headers = {
        'Content-Type': 'application/json',
        'Credential': orderAuthHeaders.Credential,
        'Nonce': orderAuthHeaders.Nonce,
        'Signature': orderAuthHeaders.Signature
    };
    if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`;
        headers['X-API-Key'] = apiKey;
    }

    console.log('\n[Wonder] ========== CREATE ORDER REQUEST ==========');
    console.log('[Wonder] Credential:', orderAuthHeaders.Credential);
    console.log('[Wonder] Nonce:', orderAuthHeaders.Nonce);
    console.log('[Wonder] Signature:', orderAuthHeaders.Signature);
    console.log('[Wonder] Method:', method);
    console.log('[Wonder] URL:', url);
    console.log('[Wonder] Headers:', JSON.stringify({
        'Content-Type': headers['Content-Type'],
        'Credential': headers['Credential'],
        'Nonce': headers['Nonce'],
        'Signature': headers['Signature'],
        ...(headers['Authorization'] ? { 'Authorization': '(present)' } : {}),
        ...(headers['X-API-Key'] ? { 'X-API-Key': '(present)' } : {})
    }, null, 2));
    console.log('[Wonder] Body:', plainText);

    const response = await axios.post(url, plainText, {
        headers,
        timeout: 15000,
        validateStatus: () => true
    });

    console.log('\n[Wonder] ========== CREATE ORDER RESPONSE ==========');
    console.log('[Wonder] Status:', response.status, response.statusText);
    console.log('[Wonder] Response Headers:', JSON.stringify(response.headers, null, 2));
    console.log('[Wonder] Response Data:', typeof response.data === 'object' ? JSON.stringify(response.data, null, 2) : response.data);
    console.log('[Wonder] ===========================================\n');

    if (response.status !== 200 && response.status !== 201) {
        const msg = response.data?.message || response.data?.error || response.statusText || JSON.stringify(response.data);
        throw new Error(`Wonder create order failed: ${response.status} - ${JSON.stringify(msg)}`);
    }

    const data = response.data || {};
    const paymentUrl =
        data.payment_url ||
        data.url ||
        data.data?.payment_url ||
        data.data?.url ||
        data.data?.payment_link;
    const orderId =
        data.order_id ||
        data.id ||
        data.data?.order_id ||
        data.data?.id ||
        data.reference_number;

    if (!paymentUrl) {
        throw new Error('Wonder API did not return payment_url. Response: ' + JSON.stringify(data));
    }

    return {
        paymentUrl,
        orderId: orderId || params.referenceNumber
    };
}

module.exports = {
    getPaymentBaseUrl,
    getWonderConfig,
    getWonderAuthHeaders,
    formatTimeToYYYYMMDDHHMMSS,
    wonderAuthenticate,
    createOrder
};
