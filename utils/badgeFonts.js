const path = require('path');
const fs = require('fs');

const BADGE_FONT_DIR = path.join(__dirname, '../public/admin/assets/fonts/badge');

/** Badge 可用字型；自訂字型請將 .ttf / .otf 放入 public/admin/assets/fonts/badge/ */
const BADGE_FONT_CATALOG = [
    { value: 'Arial', label: 'Arial', files: [] },
    {
        value: 'ITC Avant Garde Gothic Demi',
        label: 'ITC Avant Garde Gothic Demi',
        files: [
            'avantgarde_demi.ttf',
            'ITCAvantGardeGothic-Demi.ttf',
            'ITCAvantGardeGothicDemi.ttf',
            'ITCAvantGardeStd-Demi.otf',
            'ITC Avant Garde Gothic Demi.ttf',
        ],
    },
];

const DEFAULT_BADGE_FONT_FAMILY = 'ITC Avant Garde Gothic Demi';

let fontsRegistered = false;

function findBadgeFontFile(files) {
    if (!Array.isArray(files)) return null;
    for (const name of files) {
        const filePath = path.join(BADGE_FONT_DIR, name);
        if (fs.existsSync(filePath)) return filePath;
    }
    return null;
}

function registerBadgeFonts(canvasModule) {
    if (fontsRegistered || !canvasModule || typeof canvasModule.registerFont !== 'function') return;

    const { registerFont } = canvasModule;
    BADGE_FONT_CATALOG.forEach((font) => {
        if (!font.files || !font.files.length) return;
        const filePath = findBadgeFontFile(font.files);
        if (!filePath) return;
        try {
            registerFont(filePath, {
                family: font.value,
                weight: 'normal',
                style: 'normal',
            });
            console.log('[Badge] Registered font:', font.value);
        } catch (err) {
            console.warn('[Badge] Failed to register font:', font.value, err.message);
        }
    });

    fontsRegistered = true;
}

function formatCanvasFont(element, actualFontSize) {
    const family = element.fontFamily || DEFAULT_BADGE_FONT_FAMILY;
    const weight = element.fontWeight || 'normal';
    const quotedFamily = family.includes(' ') ? `"${family}"` : family;
    return `${weight} ${actualFontSize}px ${quotedFamily}, Arial, sans-serif`;
}

function getBadgeFontCatalog() {
    return BADGE_FONT_CATALOG.map((font) => ({
        value: font.value,
        label: font.label,
        available: !font.files.length || !!findBadgeFontFile(font.files),
        cssUrl: font.files.length ? getBadgeFontCssUrl(font.value) : null,
    }));
}

function getDefaultBadgeFontFamily() {
    return DEFAULT_BADGE_FONT_FAMILY;
}

function getBadgeFontCssUrl(fontValue) {
    const font = BADGE_FONT_CATALOG.find((f) => f.value === fontValue);
    if (!font || !font.files.length) return null;
    const filePath = findBadgeFontFile(font.files);
    if (!filePath) return null;
    return `/admin/assets/fonts/badge/${path.basename(filePath)}`;
}

module.exports = {
    BADGE_FONT_DIR,
    BADGE_FONT_CATALOG,
    DEFAULT_BADGE_FONT_FAMILY,
    registerBadgeFonts,
    formatCanvasFont,
    getBadgeFontCatalog,
    getDefaultBadgeFontFamily,
    getBadgeFontCssUrl,
    findBadgeFontFile,
};
