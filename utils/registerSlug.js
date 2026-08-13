/** 報名頁公開 slug：小寫英數與連字號，2–64 字元 */
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SLUG_MIN = 2;
const SLUG_MAX = 64;

/** 不可作為報名 slug 的路徑（與 app 既有路由衝突） */
const RESERVED_SLUGS = new Set([
    'about', 'api', 'auth', 'awards', 'demo_website', 'emailtemplate',
    'event-details', 'events', 'formconfig', 'games', 'homepage', 'login',
    'logout', 'points', 'prizes', 'purpose', 'qrcode', 'rules', 'set-lang',
    'tc', 'track', 'users', 'votes', 'web'
]);

function normalizeRegisterSlug(raw) {
    if (raw == null) return '';
    return String(raw).trim().toLowerCase().replace(/\s+/g, '-');
}

function validateRegisterSlug(slug) {
    if (!slug) {
        return { valid: true, slug: '' };
    }
    if (isReservedRegisterSlug(slug)) {
        return { valid: false, message: '此 slug 為系統保留字，請改用其他名稱' };
    }
    if (slug.length < SLUG_MIN || slug.length > SLUG_MAX) {
        return { valid: false, message: `slug 長度需為 ${SLUG_MIN}–${SLUG_MAX} 字元` };
    }
    if (!SLUG_PATTERN.test(slug)) {
        return { valid: false, message: 'slug 只能包含小寫英文、數字與連字號（不可連續連字號或首尾連字號）' };
    }
    if (/^[0-9a-f]{24}$/.test(slug)) {
        return { valid: false, message: 'slug 不可與 MongoDB ObjectId 格式相同' };
    }
    return { valid: true, slug };
}

function isReservedRegisterSlug(slug) {
    return RESERVED_SLUGS.has(String(slug || '').toLowerCase());
}

function isRegisterSlugRouteCandidate(slug) {
    if (!slug || slug.includes('/')) return false;
    const normalized = normalizeRegisterSlug(slug);
    const validation = validateRegisterSlug(normalized);
    return validation.valid && !!normalized;
}

module.exports = {
    SLUG_PATTERN,
    SLUG_MIN,
    SLUG_MAX,
    RESERVED_SLUGS,
    normalizeRegisterSlug,
    validateRegisterSlug,
    isReservedRegisterSlug,
    isRegisterSlugRouteCandidate
};
