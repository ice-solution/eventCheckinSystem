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
    return {
        title: normalizeTicketTitle(t.title),
        price: t.price,
        category: getTicketCategoryKey(t),
        datetimeFrom: t.datetimeFrom || undefined,
        datetimeTo: t.datetimeTo || undefined
    };
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
    normalizePaymentTicketUi
};
