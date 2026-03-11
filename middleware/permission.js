/**
 * 後台用戶權限：admin 唯一且擁有全部權限；其他用戶依 allowedEvents + eventPermissions 限制。
 */

// Event 功能鍵（與路由對應）
const EVENT_FUNCTIONS = [
    { key: 'rsvp', label: 'RSVP / User List', pathMatch: /^\/events\/[^/]+\/?$/ },
    { key: 'rsvp', label: 'Edit Event Name', pathMatch: /^\/events\/[^/]+\/edit-name/ },
    { key: 'guestList', label: 'Guest List', pathMatch: /^\/events\/[^/]+\/guest-list/ },
    { key: 'emailTemplate', label: 'Email Template', pathMatch: /^\/events\/[^/]+\/emailTemplate/ },
    { key: 'smsTemplate', label: 'SMS Template', pathMatch: /^\/events\/[^/]+\/smsTemplate/ },
    { key: 'badges', label: 'Badge Design', pathMatch: /^\/events\/[^/]+\/badges/ },
    { key: 'qrcodeLogin', label: 'QR Code Login', pathMatch: /^\/events\/[^/]+\/qrcodeLogin/ },
    { key: 'scanPointUsers', label: 'Scan Point Management', pathMatch: /^\/events\/[^/]+\/scan-point-users/ },
    { key: 'treasureHunt', label: 'Treasure Hunt', pathMatch: /^\/events\/[^/]+\/treasure-hunt/ },
    { key: 'luckydrawList', label: 'Luckydraw List', pathMatch: /^\/events\/[^/]+\/luckydraw\/list/ },
    { key: 'luckydrawList', label: 'Luckydraw List Columns', pathMatch: /^\/events\/[^/]+\/luckydraw\/list-columns/ },
    { key: 'luckydrawPanel', label: 'LuckyDraw Panel', pathMatch: /^\/events\/[^/]+\/luckydraw\/panel/ },
    { key: 'luckydrawAward', label: 'LuckyDraw Award', pathMatch: /^\/events\/[^/]+\/luckydraw\/award/ },
    { key: 'luckydrawOpen', label: 'LuckyDraw Open', pathMatch: /^\/events\/[^/]+\/luckydraw$/ },
    { key: 'luckydrawSetting', label: 'LuckyDraw Setting', pathMatch: /^\/events\/[^/]+\/(luckydraw_setting|luckydraw-config)/ },
    { key: 'prizes', label: 'Prize Management', pathMatch: /^\/prizes\/[^/]+\/prizes/ },
    { key: 'votes', label: 'Vote Management', pathMatch: /^\/votes\/[^/]+\/admin/ },
    { key: 'website', label: 'Website / Register / FormConfig', pathMatch: /^\/web\/[^/]+/ },
    { key: 'formConfig', label: 'Registration Page Config', pathMatch: /^\/formConfig\/[^/]+/ },
    { key: 'transactions', label: 'Transaction Records', pathMatch: /^\/events\/[^/]+\/transactions/ },
    { key: 'attachments', label: 'Attachments', pathMatch: /^\/events\/[^/]+\/attachments/ },
    { key: 'scan', label: 'Scan QR Code', pathMatch: /^\/events\/[^/]+\/scan/ },
    { key: 'import', label: 'Import Data', pathMatch: /^\/events\/[^/]+\/import/ },
    { key: 'banner', label: 'Banner Management', pathMatch: /^\/events\/[^/]+\/banner/ },
    { key: 'report', label: 'Download Report', pathMatch: /^\/events\/[^/]+\/report/ },
    { key: 'emailRecords', label: 'Email Records', pathMatch: /^\/events\/[^/]+\/email-records/ },
];

// 供前端 / 權限頁使用的完整列表（label + key）
function getEventFunctionList() {
    return EVENT_FUNCTIONS.map(f => ({ key: f.key, label: f.label }));
}

function getFunctionKeyByPath(path) {
    const normalized = path.replace(/\?.*$/, '');
    for (const f of EVENT_FUNCTIONS) {
        if (f.pathMatch.test(normalized)) return f.key;
    }
    if (/^\/events\/[^/]+/.test(normalized)) return 'rsvp'; // 預設 event 主頁
    return null;
}

/** 僅允許 role === 'admin' 的用戶 */
function requireAdmin(req, res, next) {
    if (req.session && req.session.user && req.session.user.role === 'admin') {
        return next();
    }
    res.status(403).send('無權限執行此操作');
}

/**
 * 非 admin 用戶：從 DB 重新載入 allowedEvents、eventPermissions，讓 admin 新增/修改權限後不需重新登入即生效
 */
async function refreshUserPermissions(req, res, next) {
    if (!req.session || !req.session.user || req.session.user.role === 'admin') {
        return next();
    }
    try {
        const Auth = require('../model/Auth');
        const auth = await Auth.findById(req.session.user._id).select('allowedEvents eventPermissions').lean();
        if (auth) {
            req.session.user.allowedEvents = (auth.allowedEvents || []).map(id => id && id.toString());
            req.session.user.eventPermissions = (auth.eventPermissions || []).map(p => ({
                eventId: p.eventId && p.eventId.toString(),
                functions: p.functions || []
            }));
        }
    } catch (err) {
        console.error('refreshUserPermissions error:', err);
    }
    next();
}

/** 檢查當前用戶是否有權存取該 event 的該功能（用於 /events/:eventId/* 等） */
function requireEventPermission(req, res, next) {
    const user = req.session && req.session.user;
    if (!user) {
        return res.redirect('/login');
    }
    if (user.role === 'admin') {
        return next();
    }
    const eventId = req._eventIdFromPath || (req.params && req.params.eventId);
    if (!eventId) return next(); // 例如 /events/list 沒有 eventId，不在此檢查

    const pathForCheck = '/events' + (req.path || '');
    const functionKey = getFunctionKeyByPath(pathForCheck);
    if (!functionKey) return next();

    const allowed = (user.allowedEvents || []).map(id => id && id.toString());
    if (!allowed.includes(eventId)) {
        return res.status(403).send('您沒有權限存取此活動');
    }
    const perms = (user.eventPermissions || []).find(p => p.eventId && p.eventId.toString() === eventId);
    const allowedFuncs = perms ? (perms.functions || []) : [];
    if (!allowedFuncs.includes(functionKey)) {
        return res.status(403).send('您沒有權限使用此功能');
    }
    next();
}

/** 用於 /formConfig/:eventId：從 params 或 path 取得 eventId 並檢查權限 */
function requireFormConfigPermission(req, res, next) {
    const user = req.session && req.session.user;
    if (!user) return res.redirect('/login');
    if (user.role === 'admin') return next();
    const eventId = req.params.eventId || (req.path && req.path.replace(/^\//, '').split('/')[0]);
    if (!eventId) return next();
    const allowed = (user.allowedEvents || []).map(id => id && id.toString());
    if (!allowed.includes(eventId)) return res.status(403).send('您沒有權限存取此活動');
    const perms = (user.eventPermissions || []).find(p => p.eventId && p.eventId.toString() === eventId);
    const allowedFuncs = perms ? (perms.functions || []) : [];
    if (!allowedFuncs.includes('formConfig')) return res.status(403).send('您沒有權限使用此功能');
    next();
}

/** 用於 /prizes/:eventId/*：從 params 或 path 取得 eventId 並檢查權限 */
function requirePrizesPermission(req, res, next) {
    const user = req.session && req.session.user;
    if (!user) return res.redirect('/login');
    if (user.role === 'admin') return next();
    const eventId = req.params.eventId || (req.path && req.path.replace(/^\//, '').split('/')[0]);
    if (!eventId) return next();
    const allowed = (user.allowedEvents || []).map(id => id && id.toString());
    if (!allowed.includes(eventId)) return res.status(403).send('您沒有權限存取此活動');
    const perms = (user.eventPermissions || []).find(p => p.eventId && p.eventId.toString() === eventId);
    const allowedFuncs = perms ? (perms.functions || []) : [];
    if (!allowedFuncs.includes('prizes')) return res.status(403).send('您沒有權限使用此功能');
    next();
}

/** 用於 /votes/:eventId/admin */
function requireVotesPermission(req, res, next) {
    const user = req.session && req.session.user;
    if (!user) return res.redirect('/login');
    if (user.role === 'admin') return next();
    const eventId = req.params.eventId;
    if (!eventId) return next();
    const allowed = (user.allowedEvents || []).map(id => id && id.toString());
    if (!allowed.includes(eventId)) return res.status(403).send('您沒有權限存取此活動');
    const perms = (user.eventPermissions || []).find(p => p.eventId && p.eventId.toString() === eventId);
    const allowedFuncs = perms ? (perms.functions || []) : [];
    if (!allowedFuncs.includes('votes')) return res.status(403).send('您沒有權限使用此功能');
    next();
}

module.exports = {
    requireAdmin,
    requireEventPermission,
    requireFormConfigPermission,
    requirePrizesPermission,
    requireVotesPermission,
    refreshUserPermissions,
    getEventFunctionList,
    getFunctionKeyByPath,
};
