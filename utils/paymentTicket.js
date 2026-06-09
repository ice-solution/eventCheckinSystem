/**
 * 票券 title 正規化（相容舊版字串與 { zh, en }）
 */
function normalizeTicketTitle(title) {
    if (title == null || title === '') return { zh: '', en: '' };
    if (typeof title === 'string') {
        const s = title.trim();
        return { zh: s, en: s };
    }
    if (typeof title === 'object') {
        const zh = (title.zh != null ? String(title.zh) : '').trim();
        const en = (title.en != null ? String(title.en) : '').trim();
        if (!zh && !en) {
            const legacy = Object.values(title).find(v => typeof v === 'string' && v.trim());
            if (legacy) {
                const s = legacy.trim();
                return { zh: s, en: s };
            }
        }
        return { zh, en: en || zh };
    }
    return { zh: '', en: '' };
}

function normalizeBilingualField(field) {
    if (field == null || field === '') return { zh: '', en: '' };
    if (typeof field === 'string') {
        const s = field.trim();
        return { zh: s, en: s };
    }
    if (typeof field === 'object') {
        return {
            zh: (field.zh != null ? String(field.zh) : '').trim(),
            en: (field.en != null ? String(field.en) : '').trim()
        };
    }
    return { zh: '', en: '' };
}

function isPaymentTicketInRange(ticket, now = new Date()) {
    if (!ticket) return false;
    const from = ticket.datetimeFrom ? new Date(ticket.datetimeFrom) : null;
    const to = ticket.datetimeTo ? new Date(ticket.datetimeTo) : (ticket.datetime ? new Date(ticket.datetime) : null);
    if (from && now < from) return false;
    if (to && now > to) return false;
    return true;
}

function getTicketCategoryKey(ticket) {
    const c = ticket && ticket.category != null ? String(ticket.category).trim() : '';
    return c || '';
}

function getTicketDisplayLabel(ticket, lang = 'zh') {
    const t = normalizeTicketTitle(ticket && ticket.title);
    const price = ticket && ticket.price != null ? ticket.price : '';
    const name = lang === 'en' ? (t.en || t.zh) : (t.zh || t.en);
    if (name) return `${name} - $${price}`;
    return lang === 'en' ? `Ticket - $${price}` : `票券 - $${price}`;
}

function normalizePaymentTicketForSave(ticket) {
    const t = { ...ticket };
    if (t.datetimeFrom) t.datetimeFrom = new Date(t.datetimeFrom);
    if (t.datetimeTo) t.datetimeTo = new Date(t.datetimeTo);
    if (t.datetime) t.datetime = new Date(t.datetime);
    if (!t.datetimeTo && t.datetime) t.datetimeTo = t.datetime;
    if (t.datetimeFrom && t.datetimeTo && t.datetimeFrom > t.datetimeTo) {
        const swap = t.datetimeFrom;
        t.datetimeFrom = t.datetimeTo;
        t.datetimeTo = swap;
    }
    const out = {
        title: normalizeTicketTitle(t.title),
        price: t.price,
        category: getTicketCategoryKey(t),
        datetimeFrom: t.datetimeFrom || undefined,
        datetimeTo: t.datetimeTo || undefined
    };
    const idStr = t._id != null ? String(t._id).trim() : '';
    if (/^[a-f0-9]{24}$/i.test(idStr)) {
        out._id = idStr;
    }
    return out;
}

/** Excel 匯出／匯入欄位（_id 用於相同 id 時更新取代） */
const PAYMENT_TICKET_XLSX_COLUMNS = ['_id', 'category', 'title_zh', 'title_en', 'price', 'datetimeFrom', 'datetimeTo'];

function parsePaymentTicketDateCell(val) {
    if (val === undefined || val === null || val === '') return undefined;
    if (val instanceof Date && !Number.isNaN(val.getTime())) return val;
    if (typeof val === 'number' && Number.isFinite(val)) {
        // Excel 序列日（xlsx 常見）
        const epoch = new Date(Date.UTC(1899, 11, 30));
        const d = new Date(epoch.getTime() + val * 86400000);
        return Number.isNaN(d.getTime()) ? undefined : d;
    }
    const s = String(val).trim();
    if (!s) return undefined;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? undefined : d;
}

function ticketToXlsxRow(ticket) {
    const t = ticket && typeof ticket.toObject === 'function' ? ticket.toObject() : (ticket || {});
    const title = normalizeTicketTitle(t.title);
    const fmt = (d) => {
        if (!d) return '';
        const dt = d instanceof Date ? d : new Date(d);
        return Number.isNaN(dt.getTime()) ? '' : dt.toISOString();
    };
    return {
        _id: t._id ? String(t._id) : '',
        category: getTicketCategoryKey(t),
        title_zh: title.zh || '',
        title_en: title.en || '',
        price: t.price != null ? Number(t.price) : '',
        datetimeFrom: fmt(t.datetimeFrom),
        datetimeTo: fmt(t.datetimeTo || t.datetime),
    };
}

function xlsxRowToPaymentTicket(row) {
    if (!row || typeof row !== 'object') return null;
    const titleZh = row.title_zh != null ? String(row.title_zh).trim() : '';
    const titleEn = row.title_en != null ? String(row.title_en).trim() : '';
    if (!titleZh && !titleEn) return null;

    const idRaw = row._id != null ? String(row._id).trim() : '';
    const ticket = {
        title: { zh: titleZh, en: titleEn },
        category: row.category != null ? String(row.category).trim() : '',
        price: Number(row.price),
        datetimeFrom: parsePaymentTicketDateCell(row.datetimeFrom),
        datetimeTo: parsePaymentTicketDateCell(row.datetimeTo),
    };
    if (/^[a-f0-9]{24}$/i.test(idRaw)) {
        ticket._id = idRaw;
    }
    if (Number.isNaN(ticket.price)) ticket.price = 0;
    return normalizePaymentTicketForSave(ticket);
}

/**
 * 依 _id 合併：檔內相同 _id 更新現有票券；無 _id 或新 _id 則新增；未出現在檔內的既有票券保留
 */
function mergePaymentTicketsFromImportRows(existingTickets, rows) {
    const merged = (existingTickets || []).map((t) => {
        const raw = t && typeof t.toObject === 'function' ? t.toObject() : { ...t };
        return normalizePaymentTicketForSave(raw);
    });
    const byId = new Map();
    merged.forEach((t) => {
        if (t._id) byId.set(String(t._id), t);
    });

    let updated = 0;
    let created = 0;
    const errors = [];

    (rows || []).forEach((row, index) => {
        const parsed = xlsxRowToPaymentTicket(row);
        if (!parsed) {
            if (row && Object.values(row).some((v) => v !== '' && v != null)) {
                errors.push(`第 ${index + 2} 列：缺少 title_zh / title_en`);
            }
            return;
        }
        const id = parsed._id ? String(parsed._id) : '';
        if (id && byId.has(id)) {
            Object.assign(byId.get(id), parsed);
            updated++;
        } else {
            merged.push(parsed);
            if (parsed._id) byId.set(String(parsed._id), parsed);
            created++;
        }
    });

    return { tickets: merged, updated, created, errors };
}

function normalizeTicketsForView(tickets) {
    if (!Array.isArray(tickets)) return [];
    return tickets.map(ticket => {
        const raw = ticket && typeof ticket.toObject === 'function' ? ticket.toObject() : { ...ticket };
        return {
            ...raw,
            title: normalizeTicketTitle(raw.title),
            category: getTicketCategoryKey(raw)
        };
    });
}

/** 取得可售票券中出現的分類 key（去重、保序；空 category 以 '' 代表「其他」） */
function getDistinctCategoryKeys(tickets, now = new Date()) {
    const keys = [];
    const seen = new Set();
    let hasEmptyCategory = false;
    (tickets || []).forEach((ticket) => {
        if (!isPaymentTicketInRange(ticket, now)) return;
        const key = getTicketCategoryKey(ticket);
        if (!key) {
            hasEmptyCategory = true;
            return;
        }
        if (seen.has(key)) return;
        seen.add(key);
        keys.push(key);
    });
    if (hasEmptyCategory) keys.push('');
    return keys;
}

/** 任一可售票券設有 category 時，Register 顯示分類按鈕 */
function ticketsUseCategories(tickets, now = new Date()) {
    return (tickets || []).some((t) => isPaymentTicketInRange(t, now) && getTicketCategoryKey(t) !== '');
}

/** 依 FormConfig 取得分類按鈕顯示文字 */
function getCategoryButtonLabel(categoryKey, paymentTicketUi, lang = 'zh') {
    const ui = paymentTicketUi || {};
    if (categoryKey === '') {
        const def = normalizeBilingualField(ui.defaultCategoryLabel);
        return lang === 'en' ? (def.en || def.zh || 'Other') : (def.zh || def.en || '其他');
    }
    const buttons = Array.isArray(ui.categoryButtons) ? ui.categoryButtons : [];
    const found = buttons.find(b => b && String(b.key).trim() === categoryKey);
    if (found && found.label) {
        const label = normalizeBilingualField(found.label);
        return lang === 'en' ? (label.en || label.zh || categoryKey) : (label.zh || label.en || categoryKey);
    }
    return categoryKey;
}

function normalizePaymentTicketUi(ui) {
    const src = ui && typeof ui === 'object' ? ui : {};
    const def = {
        sectionTitle: { zh: '票券選擇', en: 'Ticket Selection' },
        categoryLabel: { zh: '選擇類別', en: 'Select Category' },
        ticketLabel: { zh: '選擇票券', en: 'Select Ticket' },
        defaultCategoryLabel: { zh: '其他', en: 'Other' },
        buttons: {
            back: { zh: '返回', en: 'Back' },
            next: { zh: '下一步', en: 'Next' }
        },
        highlightText: { zh: '', en: '' },
        categoryButtons: []
    };
    const out = {
        sectionTitle: normalizeBilingualField(src.sectionTitle || def.sectionTitle),
        categoryLabel: normalizeBilingualField(src.categoryLabel || def.categoryLabel),
        ticketLabel: normalizeBilingualField(src.ticketLabel || def.ticketLabel),
        defaultCategoryLabel: normalizeBilingualField(src.defaultCategoryLabel || def.defaultCategoryLabel),
        buttons: {
            back: normalizeBilingualField((src.buttons && src.buttons.back) || def.buttons.back),
            next: normalizeBilingualField((src.buttons && src.buttons.next) || def.buttons.next)
        },
        highlightText: normalizeBilingualField(src.highlightText || def.highlightText || { zh: '', en: '' }),
        categoryButtons: Array.isArray(src.categoryButtons)
            ? src.categoryButtons.map(b => ({
                key: (b && b.key != null ? String(b.key) : '').trim(),
                label: normalizeBilingualField(b && b.label)
            })).filter(b => b.key)
            : []
    };
    return out;
}

module.exports = {
    normalizeTicketTitle,
    normalizeBilingualField,
    getTicketDisplayLabel,
    normalizePaymentTicketForSave,
    normalizeTicketsForView,
    isPaymentTicketInRange,
    getTicketCategoryKey,
    getDistinctCategoryKeys,
    ticketsUseCategories,
    getCategoryButtonLabel,
    normalizePaymentTicketUi,
    PAYMENT_TICKET_XLSX_COLUMNS,
    ticketToXlsxRow,
    xlsxRowToPaymentTicket,
    mergePaymentTicketsFromImportRows,
};
