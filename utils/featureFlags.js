/** 環境變數 truthy 判斷（true / 1，不分大小寫） */
function isTruthyEnv(val) {
    return (val || '').toString().trim().toLowerCase() === 'true' || val === '1';
}

/**
 * 發票（invoice）郵件功能開關，預設關閉。
 * 設 INVOICE_EMAIL_ENABLED=true 可重新啟用結帳發票、後台選項與手動重發。
 */
function isInvoiceEmailEnabled() {
    return isTruthyEnv(process.env.INVOICE_EMAIL_ENABLED);
}

module.exports = {
    isInvoiceEmailEnabled,
};
