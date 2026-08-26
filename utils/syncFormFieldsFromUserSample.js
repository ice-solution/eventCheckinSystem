/**
 * 由 sample user document 產生 FormConfig fields（供 RSVP / Import 欄位列表）
 */

const SYSTEM_SKIP = new Set([
    '_id', '__v', 'id',
    'create_at', 'created_at', 'createdAt',
    'modified_at', 'updated_at', 'updatedAt',
    'checkInAt', 'isCheckIn',
    'point', 'scannedTreasureItems',
    'applicationCompleted', 'applicationCompletedAt',
    'paymentStatus'
]);

function humanizeKey(key) {
    return String(key)
        .replace(/_/g, ' ')
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/\b\w/g, (c) => c.toUpperCase());
}

function guessFieldType(key, value) {
    const k = String(key).toLowerCase();
    if (k === 'email' || k.endsWith('email') || k.endsWith('_email')) return 'email';
    if (k === 'phone' || k === 'tel' || k.endsWith('phone') || k.endsWith('_phone')) return 'tel';
    if (typeof value === 'boolean') return 'checkbox';
    if (value !== null && typeof value === 'object') return 'textarea';
    return 'text';
}

/**
 * 從 sample user 抽出欄位定義
 * - 頂層 primitive → 一般欄位
 * - 頂層 object/array → textarea（RSVP 顯示 JSON 字串較實際）
 * - 若有 attendees.sponsorTier → 額外加扁平 sponsorTier 方便列表
 */
function buildFieldsFromUserSample(sampleUser) {
    if (!sampleUser || typeof sampleUser !== 'object' || Array.isArray(sampleUser)) {
        return { ok: false, message: 'Sample must be a JSON object (one user document).', fields: [] };
    }

    const fields = [];
    const seen = new Set();
    let order = 1;

    const pushField = (fieldName, value, labelOverride) => {
        if (!fieldName || seen.has(fieldName) || SYSTEM_SKIP.has(fieldName)) return;
        seen.add(fieldName);
        const type = guessFieldType(fieldName, value);
        fields.push({
            fieldName,
            label: {
                zh: labelOverride || humanizeKey(fieldName),
                en: labelOverride || humanizeKey(fieldName)
            },
            type,
            required: fieldName === 'name' || fieldName === 'email',
            display: false, // custom form 已負責前台；後台 RSVP / import 用
            visible: true,
            placeholder: { zh: '', en: '' },
            options: [],
            validation: {},
            order: order++
        });
    };

    Object.keys(sampleUser).forEach((key) => {
        pushField(key, sampleUser[key]);
    });

    // 巢狀 attendees.sponsorTier → 額外扁平欄（方便 RSVP 一欄顯示）
    const attendees = sampleUser.attendees;
    if (attendees && typeof attendees === 'object' && !Array.isArray(attendees)) {
        if (attendees.sponsorTier != null && !seen.has('sponsorTier')) {
            pushField('sponsorTier', attendees.sponsorTier, 'Sponsor Tier');
        }
    }

    // 確保有 name（Event.users 必填）
    if (!seen.has('name')) {
        pushField('name', '', 'Name');
    }

    if (!fields.length) {
        return { ok: false, message: 'No usable fields found in sample.', fields: [] };
    }

    return { ok: true, fields };
}

function buildSectionFromFields(fields) {
    return {
        sectionName: 'custom_form_fields',
        sectionTitle: {
            zh: 'Custom Form 欄位',
            en: 'Custom Form Fields'
        },
        visible: true,
        order: 1,
        fields
    };
}

/**
 * merge: 保留舊 sections，只補入未有嘅 fieldName
 * replace: 用新 section 取代全部 sections
 */
function applyFieldsToSections(existingSections, newFields, mode) {
    if (mode === 'replace') {
        return [buildSectionFromFields(newFields)];
    }

    const sections = Array.isArray(existingSections)
        ? JSON.parse(JSON.stringify(existingSections))
        : [];
    const existingNames = new Set();
    sections.forEach((sec) => {
        (sec.fields || []).forEach((f) => {
            if (f && f.fieldName) existingNames.add(f.fieldName);
        });
    });

    const toAdd = newFields.filter((f) => f && f.fieldName && !existingNames.has(f.fieldName));
    if (!toAdd.length) {
        return sections;
    }

    let target = sections.find((s) => s.sectionName === 'custom_form_fields');
    if (!target) {
        target = buildSectionFromFields([]);
        sections.push(target);
    }
    if (!Array.isArray(target.fields)) target.fields = [];
    let orderBase = target.fields.reduce((m, f) => Math.max(m, f.order || 0), 0);
    toAdd.forEach((f) => {
        orderBase += 1;
        target.fields.push({ ...f, order: orderBase });
    });
    return sections;
}

function normalizeFieldDef(field, order) {
    if (!field || !field.fieldName) return null;
    const label = field.label && typeof field.label === 'object'
        ? {
            zh: field.label.zh || humanizeKey(field.fieldName),
            en: field.label.en || humanizeKey(field.fieldName)
        }
        : {
            zh: (typeof field.label === 'string' && field.label) || humanizeKey(field.fieldName),
            en: (typeof field.label === 'string' && field.label) || humanizeKey(field.fieldName)
        };
    return {
        fieldName: String(field.fieldName).trim(),
        label,
        type: field.type || 'text',
        required: !!field.required,
        display: field.display === true,
        visible: field.visible !== false,
        placeholder: field.placeholder && typeof field.placeholder === 'object'
            ? field.placeholder
            : { zh: '', en: '' },
        options: Array.isArray(field.options) ? field.options : [],
        validation: field.validation && typeof field.validation === 'object' ? field.validation : {},
        order: field.order != null ? field.order : order
    };
}

/**
 * 接受多種貼上格式：
 * 1) sponsorship-custom-form.json 成份（有 fields 或 sampleUser）
 * 2) 只有 sampleUser object
 * 3) 直接一個 user document
 * Body 亦可係 { sampleUser, fields, mode }
 */
function resolveFieldsFromSyncPayload(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return {
            ok: false,
            message: '請貼上 JSON object。可用：① sponsorship-custom-form.json 成份；② 其中的 sampleUser；③ 一個 RSVP user document。'
        };
    }

    // 模板 JSON：優先用 fields[]
    if (Array.isArray(raw.fields) && raw.fields.length && raw.fields[0] && raw.fields[0].fieldName) {
        const fields = [];
        raw.fields.forEach((f, i) => {
            const def = normalizeFieldDef(f, i + 1);
            if (def) fields.push(def);
        });
        if (!fields.some((f) => f.fieldName === 'name')) {
            fields.push(normalizeFieldDef({ fieldName: 'name', type: 'text', required: true }, fields.length + 1));
        }
        return { ok: true, fields, source: 'fields' };
    }

    // 模板 JSON 或 API body：sampleUser
    if (raw.sampleUser && typeof raw.sampleUser === 'object' && !Array.isArray(raw.sampleUser)) {
        const built = buildFieldsFromUserSample(raw.sampleUser);
        if (!built.ok) return built;
        return { ...built, source: 'sampleUser' };
    }

    // 直接係 user document（有典型欄位、又唔係模板 wrapper）
    const looksLikeUser =
        raw.firstName != null ||
        raw.lastName != null ||
        raw.email != null ||
        raw.name != null ||
        raw.company != null ||
        raw.attendees != null;
    const looksLikeTemplateWrapper =
        raw.htmlFile != null ||
        raw.publicPath != null ||
        raw.tierRules != null ||
        raw.submit != null;

    if (looksLikeUser && !looksLikeTemplateWrapper) {
        const built = buildFieldsFromUserSample(raw);
        if (!built.ok) return built;
        return { ...built, source: 'userDocument' };
    }

    return {
        ok: false,
        message: '認唔到格式。請貼 sponsorship-custom-form.json 成份，或只貼裡面的 sampleUser { firstName, email, attendees, ... }。'
    };
}

module.exports = {
    SYSTEM_SKIP,
    buildFieldsFromUserSample,
    buildSectionFromFields,
    applyFieldsToSections,
    resolveFieldsFromSyncPayload,
    normalizeFieldDef
};
