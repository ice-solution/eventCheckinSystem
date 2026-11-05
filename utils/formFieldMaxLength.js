function getFieldMaxLength(field) {
    if (!field || !field.validation || field.validation.maxLength == null || field.validation.maxLength === '') {
        return 0;
    }
    const n = Number(field.validation.maxLength);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.floor(n);
}

function payloadValueLength(val) {
    if (val == null) return 0;
    if (Array.isArray(val)) {
        return val.reduce((sum, item) => sum + String(item == null ? '' : item).length, 0);
    }
    return String(val).length;
}

function assertPayloadMaxLength(formConfig, data) {
    if (!formConfig || !data || typeof data !== 'object') return { ok: true };
    const sections = Array.isArray(formConfig.sections) ? formConfig.sections : [];
    for (const section of sections) {
        for (const field of section.fields || []) {
            if (!field || !field.fieldName) continue;
            if (field.type === 'display' || field.type === 'checkbox' || field.type === 'radio' || field.type === 'select') {
                continue;
            }
            const maxLength = getFieldMaxLength(field);
            if (maxLength <= 0) continue;
            if (data[field.fieldName] === undefined) continue;
            if (payloadValueLength(data[field.fieldName]) > maxLength) {
                return {
                    ok: false,
                    fieldName: field.fieldName,
                    maxLength,
                    message: `「${field.fieldName}」不可超過 ${maxLength} 個字元 / "${field.fieldName}" cannot exceed ${maxLength} characters`
                };
            }
        }
    }
    return { ok: true };
}

module.exports = { getFieldMaxLength, assertPayloadMaxLength };
