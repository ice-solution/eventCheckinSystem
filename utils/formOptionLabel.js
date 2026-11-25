/**
 * FormConfig select/radio/checkbox：儲存嘅係 option.value，顯示／匯出要用 label。
 */

function pickLangLabel(labelObj, lang) {
    if (labelObj == null) return '';
    if (typeof labelObj === 'string') return labelObj.trim();
    if (typeof labelObj !== 'object') return '';
    const preferred = lang === 'en'
        ? (labelObj.en || labelObj.zh)
        : (labelObj.zh || labelObj.en);
    return preferred != null ? String(preferred).trim() : '';
}

function optionDisplayLabel(opt, lang = 'zh') {
    if (!opt) return '';
    if (typeof opt === 'string') return opt;
    const fromLabel = pickLangLabel(opt.label, lang);
    if (fromLabel) return fromLabel;
    if (opt.zh || opt.en) {
        return pickLangLabel({ zh: opt.zh, en: opt.en }, lang);
    }
    return opt.value != null ? String(opt.value) : '';
}

/**
 * fieldName -> { type, optionsByValue }
 * @param {object} formConfig
 * @param {string} [langOverride] 後台 RSVP 用頁面 CN/EN（res.locals.lang）；唔傳則用 formConfig.defaultLanguage
 */
function buildFieldOptionIndex(formConfig, langOverride) {
    const index = new Map();
    if (!formConfig || !Array.isArray(formConfig.sections)) return index;
    const lang = langOverride || formConfig.defaultLanguage || 'zh';
    formConfig.sections.forEach((section) => {
        if (!section || !Array.isArray(section.fields)) return;
        section.fields.forEach((field) => {
            if (!field || !field.fieldName || index.has(field.fieldName)) return;
            const type = field.type || 'text';
            if (!['select', 'radio', 'checkbox'].includes(type)) {
                index.set(field.fieldName, { type, lang, optionsByValue: null });
                return;
            }
            const optionsByValue = new Map();
            (field.options || []).forEach((opt) => {
                if (!opt || opt.value == null) return;
                const key = String(opt.value);
                if (!optionsByValue.has(key)) {
                    optionsByValue.set(key, optionDisplayLabel(opt, lang) || key);
                }
            });
            index.set(field.fieldName, { type, lang, optionsByValue });
        });
    });
    return index;
}

function mapOneStoredValue(raw, optionsByValue) {
    if (raw == null || raw === '') return '';
    const key = String(raw);
    if (!optionsByValue) return key;
    return optionsByValue.has(key) ? optionsByValue.get(key) : key;
}

/**
 * 將 user 欄位儲存值轉成可讀文字（select/radio/checkbox → label；其他原樣）。
 * 找不到對應 option（例如 Other 自填）→ 保留原文。
 */
function resolveFieldDisplayValue(rawValue, fieldName, fieldIndex) {
    if (rawValue == null || rawValue === '') return '';
    const meta = fieldIndex && fieldIndex.get(fieldName);
    const optionsByValue = meta && meta.optionsByValue;

    if (Array.isArray(rawValue)) {
        const parts = rawValue
            .map((v) => mapOneStoredValue(v, optionsByValue))
            .filter((s) => s !== '');
        return parts.length ? parts.join(', ') : '';
    }
    if (typeof rawValue === 'object') return '';
    return mapOneStoredValue(rawValue, optionsByValue);
}

module.exports = {
    pickLangLabel,
    optionDisplayLabel,
    buildFieldOptionIndex,
    resolveFieldDisplayValue,
};
