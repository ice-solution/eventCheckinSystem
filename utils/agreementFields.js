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

function cloneDefaultAgreementSection() {
    return {
        title: { zh: '協議', en: 'Agreement' },
        agreements: [cloneDefaultAgreement()]
    };
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

function normalizeAgreementSection(src) {
    const d = cloneDefaultAgreementSection();
    if (!src || typeof src !== 'object' || Array.isArray(src)) return d;
    const title = {
        zh: (src.title && src.title.zh) || d.title.zh,
        en: (src.title && src.title.en) || d.title.en
    };
    const rawItems = Array.isArray(src.agreements) && src.agreements.length
        ? src.agreements
        : (Array.isArray(src.items) && src.items.length ? src.items : [cloneDefaultAgreement()]);
    const agreements = rawItems.map((item) => {
        const normalized = normalizeAgreementItem(item);
        // section title 覆蓋 item.title（flat list / report 欄位標籤用）
        normalized.title = { zh: title.zh, en: title.en };
        return normalized;
    });
    return { title, agreements };
}

/** 第一份沿用舊欄位 agreementAgreed；其後為 agreementAgreed_2、_3…（跨所有 sections 全局編號） */
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

function flattenAgreementSections(sections) {
    const out = [];
    (Array.isArray(sections) ? sections : []).forEach((sec) => {
        const normalized = normalizeAgreementSection(sec);
        normalized.agreements.forEach((item) => out.push(item));
    });
    return out;
}

/** 取得 title sections（優先 agreementSections；否則由舊 flat agreements 遷成單一 section） */
function getAgreementSections(formConfig) {
    if (!formConfig) return [cloneDefaultAgreementSection()];

    if (Array.isArray(formConfig.agreementSections) && formConfig.agreementSections.length) {
        return formConfig.agreementSections.map(normalizeAgreementSection);
    }

    // 舊資料：flat agreements（共用第一份 title）
    if (Array.isArray(formConfig.agreements) && formConfig.agreements.length) {
        const list = formConfig.agreements.map(normalizeAgreementItem);
        const title = {
            zh: (list[0].title && list[0].title.zh) || '協議',
            en: (list[0].title && list[0].title.en) || 'Agreement'
        };
        return [{
            title,
            agreements: list.map((item) => ({
                ...item,
                title: { zh: title.zh, en: title.en }
            }))
        }];
    }

    if (formConfig.agreement) {
        const one = normalizeAgreementItem(formConfig.agreement);
        return [{
            title: { zh: one.title.zh, en: one.title.en },
            agreements: [one]
        }];
    }

    return [cloneDefaultAgreementSection()];
}

function getAgreementsList(formConfig) {
    const sections = getAgreementSections(formConfig);
    const flat = flattenAgreementSections(sections);
    return flat.length ? flat : [cloneDefaultAgreement()];
}

function syncAgreementsOnConfig(migratedConfig) {
    if (!migratedConfig) return migratedConfig;
    const sections = getAgreementSections(migratedConfig);
    const list = flattenAgreementSections(sections);
    migratedConfig.agreementSections = sections;
    migratedConfig.agreements = list.length ? list : [cloneDefaultAgreement()];
    migratedConfig.agreement = migratedConfig.agreements[0] || cloneDefaultAgreement();
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

/** Register 頁用：每個 title section + 其 enabled agreements（帶全局 index） */
function getEnabledAgreementSections(formConfig) {
    const sections = getAgreementSections(formConfig);
    let globalIndex = 0;
    const out = [];
    sections.forEach((sec) => {
        const enabledItems = [];
        (sec.agreements || []).forEach((item) => {
            const index = globalIndex;
            globalIndex += 1;
            if (!item.enabled) return;
            const fields = getAgreementFieldNames(index);
            enabledItems.push({
                ...item,
                index,
                agreedField: fields.agreed,
                recordedAtField: fields.recordedAt
            });
        });
        if (enabledItems.length) {
            out.push({
                title: sec.title || { zh: '協議', en: 'Agreement' },
                agreements: enabledItems
            });
        }
    });
    return out;
}

module.exports = {
    DEFAULT_AGREEMENT,
    normalizeAgreementAgreed,
    formatAgreementAgreedLabel,
    agreementAgreedSortOrder,
    cloneDefaultAgreement,
    cloneDefaultAgreementSection,
    normalizeAgreementItem,
    normalizeAgreementSection,
    getAgreementFieldNames,
    isAgreementMetaKey,
    flattenAgreementSections,
    getAgreementSections,
    getAgreementsList,
    syncAgreementsOnConfig,
    getEnabledAgreements,
    getEnabledAgreementSections
};
