/** 正規化 agreementAgreed（支援 boolean、字串 "true"/"false"、數字 1/0） */
function normalizeAgreementAgreed(val) {
    if (val === true || val === 'true' || val === 1 || val === '1') return true;
    if (val === false || val === 'false' || val === 0 || val === '0') return false;
    return null;
}

function formatAgreementAgreedLabel(val) {
    const agreed = normalizeAgreementAgreed(val);
    if (agreed === true) return '同意';
    if (agreed === false) return '未同意';
    return '-';
}

function agreementAgreedSortOrder(val) {
    const agreed = normalizeAgreementAgreed(val);
    if (agreed === true) return 1;
    if (agreed === false) return 0;
    return -1;
}

module.exports = {
    normalizeAgreementAgreed,
    formatAgreementAgreedLabel,
    agreementAgreedSortOrder,
};
