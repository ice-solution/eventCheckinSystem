const fs = require('fs');
const path = require('path');

const EXVENT_DIR = path.join(__dirname, '..', 'public', 'exvent');

function getFileCacheVersion(filePath) {
    try {
        if (filePath && fs.existsSync(filePath)) {
            return fs.statSync(filePath).mtimeMs;
        }
    } catch (_) {
        /* ignore */
    }
    return Date.now();
}

function withCacheBuster(url, version) {
    if (!url) return url;
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}t=${version}`;
}

/**
 * 依檔案修改時間產生帶 ?t= 的 banner URL，避免 Cloudflare／瀏覽器快取舊圖
 */
function getBannerRenderData(eventId) {
    const eventPath = path.join(EXVENT_DIR, `${eventId}.jpg`);
    const defaultPath = path.join(EXVENT_DIR, 'banner.jpg');

    const eventVersion = getFileCacheVersion(eventPath);
    const defaultVersion = getFileCacheVersion(defaultPath);

    return {
        eventBannerSrc: withCacheBuster(`/exvent/${eventId}.jpg`, eventVersion),
        fallbackBannerSrc: withCacheBuster('/exvent/banner.jpg', defaultVersion)
    };
}

/** 管理頁預覽：回傳目前實際使用的 banner URL（含 cache buster） */
function getCurrentBannerPreviewUrl(eventId) {
    const eventPath = path.join(EXVENT_DIR, `${eventId}.jpg`);
    const defaultPath = path.join(EXVENT_DIR, 'banner.jpg');

    if (fs.existsSync(eventPath)) {
        return withCacheBuster(`/exvent/${eventId}.jpg`, getFileCacheVersion(eventPath));
    }
    if (fs.existsSync(defaultPath)) {
        return withCacheBuster('/exvent/banner.jpg', getFileCacheVersion(defaultPath));
    }
    return null;
}

module.exports = {
    getBannerRenderData,
    getCurrentBannerPreviewUrl,
    withCacheBuster,
    getFileCacheVersion
};
