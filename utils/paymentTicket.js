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
        // 舊資料偶爾整段名稱存在非 zh/en 的 key
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
            title: normalizeTicketTitle(raw.title)
        };
    });
}

module.exports = {
    normalizeTicketTitle,
    getTicketDisplayLabel,
    normalizePaymentTicketForSave,
    normalizeTicketsForView
};
