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

/** 向 payment gateway 實際收款：票價 × 1.058（2 位小數） */
const PAYMENT_CHARGE_MULTIPLIER = 1.058;

function computeGatewayChargeAmount(paidTicketPrice) {
    return Math.round(Number(paidTicketPrice) * PAYMENT_CHARGE_MULTIPLIER * 100) / 100;
}

/** Stripe unit_amount 用（最小貨幣單位，例如 USD 分） */
function computeGatewayChargeAmountCents(paidTicketPrice) {
    return Math.round(computeGatewayChargeAmount(paidTicketPrice) * 100);
}

module.exports = {
    getCurrencyRaw,
    getCurrencyLower,
    getCurrencyUpper,
    getCurrencySymbol,
    PAYMENT_CHARGE_MULTIPLIER,
    computeGatewayChargeAmount,
    computeGatewayChargeAmountCents,
};
