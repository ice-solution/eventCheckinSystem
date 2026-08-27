/**
 * 付款幣別：讀 .env CURRENCY
 * Stripe 用小寫（usd），Wonder／顯示訊息用大寫（USD），票券標籤用符號（US$）
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

/** 報名頁票券標籤用：usd → US$，hkd → HK$ */
function getCurrencySymbol() {
    const code = getCurrencyLower();
    const map = {
        usd: 'US$',
        hkd: 'HK$',
        cny: 'CN¥',
        cnh: 'CN¥',
        eur: '€',
        gbp: '£',
        sgd: 'S$',
        jpy: '¥',
        twd: 'NT$',
        aud: 'A$',
        cad: 'C$',
        nzd: 'NZ$',
        myr: 'RM',
        thb: '฿',
        php: '₱',
        krw: '₩',
    };
    if (map[code]) return map[code];
    return getCurrencyUpper() + ' ';
}

module.exports = {
    getCurrencyRaw,
    getCurrencyLower,
    getCurrencyUpper,
    getCurrencySymbol,
};
