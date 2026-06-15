function pickTruthyString(...vals) {
    for (const v of vals) {
        const s = v != null ? String(v).trim() : '';
        if (s) return s;
    }
    return '';
}

/** 從表單資料組出顯示用姓名（相容 name、first/last、lastname/surname） */
function resolveUserDisplayName(data = {}) {
    if (!data || typeof data !== 'object') return '';

    const direct = pickTruthyString(
        data.name,
        data.fullName,
        data.full_name,
        data.displayName
    );
    if (direct) return direct;

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

    return pickTruthyString(lastname, surname, first, last, data.email, data.company);
}

/** 若無 name 欄，依其他姓名欄位補上（供 Transaction / event.users 使用） */
function ensureUserNameField(data = {}) {
    const out = { ...data };
    if (!pickTruthyString(out.name)) {
        const resolved = resolveUserDisplayName(out);
        if (resolved) out.name = resolved;
    }
    return out;
}

module.exports = {
    resolveUserDisplayName,
    ensureUserNameField,
};
