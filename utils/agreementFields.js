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

const DEFAULT_AGREEMENT = {
    enabled: false,
    title: { zh: '協議', en: 'Agreement' },
    linkLabel: { zh: '(協議)', en: '(agreement)' },
    showLinkLabel: true,
    label: {
        zh: '本人已閱讀並同意上述協議內容。',
        en: 'I have read and agree to the agreement above.'
    },
    content: { zh: '', en: '' }
};

function cloneDefaultAgreement() {
    return JSON.parse(JSON.stringify(DEFAULT_AGREEMENT));
}

function normalizeAgreementItem(src) {
    const d = cloneDefaultAgreement();
    if (!src || typeof src !== 'object' || Array.isArray(src)) return d;
    return {
        enabled: !!src.enabled,
        title: {
            zh: (src.title && src.title.zh) || d.title.zh,
            en: (src.title && src.title.en) || d.title.en
        },
        linkLabel: {
            zh: (src.linkLabel && src.linkLabel.zh) || d.linkLabel.zh,
            en: (src.linkLabel && src.linkLabel.en) || d.linkLabel.en
        },
        showLinkLabel: src.showLinkLabel !== false,
        label: {
            zh: (src.label && src.label.zh) || d.label.zh,
            en: (src.label && src.label.en) || d.label.en
        },
        content: {
            zh: (src.content && src.content.zh) || '',
            en: (src.content && src.content.en) || ''
        }
    };
}

/** 第一份沿用舊欄位 agreementAgreed；其後為 agreementAgreed_2、_3… */
function getAgreementFieldNames(index) {
    if (!index) {
        return { agreed: 'agreementAgreed', recordedAt: 'agreementRecordedAt' };
    }
    const n = Number(index) + 1;
    return { agreed: `agreementAgreed_${n}`, recordedAt: `agreementRecordedAt_${n}` };
}

function isAgreementMetaKey(key) {
    return /^(agreementAgreed|agreementRecordedAt)(_\d+)?$/.test(String(key || ''));
}

function getAgreementsList(formConfig) {
    if (!formConfig) return [cloneDefaultAgreement()];
    if (Array.isArray(formConfig.agreements) && formConfig.agreements.length) {
        return formConfig.agreements.map(normalizeAgreementItem);
    }
    return [normalizeAgreementItem(formConfig.agreement)];
}

function syncAgreementsOnConfig(migratedConfig) {
    if (!migratedConfig) return migratedConfig;
    const list = getAgreementsList(migratedConfig);
    migratedConfig.agreements = list;
    migratedConfig.agreement = list[0] || cloneDefaultAgreement();
    return migratedConfig;
}

function getEnabledAgreements(formConfig) {
    return getAgreementsList(formConfig)
        .map((item, index) => {
            const fields = getAgreementFieldNames(index);
            const titleZh = (item.title && item.title.zh) || '';
            const titleEn = (item.title && item.title.en) || '';
            return {
                ...item,
                index,
                agreedField: fields.agreed,
                recordedAtField: fields.recordedAt,
                columnLabel: titleZh || titleEn || `協議 ${index + 1}`
            };
        })
        .filter((item) => item.enabled);
}

module.exports = {
    DEFAULT_AGREEMENT,
    normalizeAgreementAgreed,
    formatAgreementAgreedLabel,
    agreementAgreedSortOrder,
    cloneDefaultAgreement,
    normalizeAgreementItem,
    getAgreementFieldNames,
    isAgreementMetaKey,
    getAgreementsList,
    syncAgreementsOnConfig,
    getEnabledAgreements
};
