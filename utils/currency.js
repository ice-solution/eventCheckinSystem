/**
 * 付款幣別：讀 .env CURRENCY
 * Stripe 用小寫（usd），Wonder／顯示訊息用大寫（USD）
 */

function getCurrencyRaw() {
    const raw = (process.env.CURRENCY || 'hkd').toString().trim();
    return raw || 'hkd';
}

function getCurrencyLower() {
    return getCurrencyRaw().toLowerCase();
}

function getCurrencyUpper() {
    return getCurrencyRaw().toUpperCase();
}

module.exports = {
    getCurrencyRaw,
    getCurrencyLower,
    getCurrencyUpper,
};
