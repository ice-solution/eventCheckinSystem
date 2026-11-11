function pickTruthyString(...vals) {
    for (const v of vals) {
        const s = v != null ? String(v).trim() : '';
        if (s) return s;
    }
    return '';
}

/** name 欄有時被寫成 email（匯入／舊邏輯）；呢啲唔應當顯示姓名 */
function looksLikeEmail(s) {
    const t = String(s == null ? '' : s).trim();
    if (!t || !t.includes('@')) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t);
}

/** 匯入／舊流程寫入嘅佔位字，唔好當真正姓名 */
const PLACEHOLDER_DISPLAY_NAMES = new Set([
    'name not provided',
    '未提供姓名',
    'n/a',
    'na',
    'null',
    'undefined',
    '-',
    '--',
]);

function isUsableDisplayName(value, email, company) {
    const s = value != null ? String(value).trim() : '';
    if (!s) return false;
    if (looksLikeEmail(s)) return false;
    if (PLACEHOLDER_DISPLAY_NAMES.has(s.toLowerCase())) return false;
    if (email && s.toLowerCase() === String(email).trim().toLowerCase()) return false;
    // 匯入有時把 company 寫入 name；有 first/last 時唔好當姓名
    if (company && s.toLowerCase() === String(company).trim().toLowerCase()) return false;
    return true;
}

/** 從表單資料組出顯示用姓名：優先 first + last，再 fallback name */
function resolveUserDisplayName(data = {}) {
    if (!data || typeof data !== 'object') return '';

    const email = pickTruthyString(data.email);
    const company = pickTruthyString(data.company);

    const first = pickTruthyString(
        data.firstName,
        data.firstname,
        data.first_name,
        data.givenName,
        data.given_name
    );
    const last = pickTruthyString(
        data.lastName,
        data.lastname,
        data.last_name,
        data.surname,
        data.familyName,
        data.family_name
    );

    if (first && last) return `${first} ${last}`.trim();

    const lastname = pickTruthyString(data.lastname, data.lastName, data.last_name);
    const surname = pickTruthyString(data.surname, data.familyName, data.family_name);
    if (lastname && surname) return `${lastname} ${surname}`.trim();

    const fromParts = pickTruthyString(lastname, surname, first, last);
    if (fromParts) return fromParts;

    const direct = pickTruthyString(
        data.name,
        data.fullName,
        data.full_name,
        data.displayName
    );
    if (isUsableDisplayName(direct, email, company)) return direct;

    return '';
}

/** 若無 name 欄，依其他姓名欄位補上（供 Transaction / event.users 使用） */
function ensureUserNameField(data = {}, options = {}) {
    const out = { ...data };
    const refreshFromParts = options.refreshFromParts === true;
    if (refreshFromParts) {
        const fromParts = resolveUserDisplayName({ ...out, name: '' });
        if (fromParts) {
            out.name = fromParts;
            return out;
        }
    }
    if (!isUsableDisplayName(out.name, out.email, out.company)) {
        out.name = resolveUserDisplayName(out) || pickTruthyString(out.email, out.company) || '未提供姓名';
    }
    return out;
}

module.exports = {
    resolveUserDisplayName,
    ensureUserNameField,
    looksLikeEmail,
    isUsableDisplayName,
};
