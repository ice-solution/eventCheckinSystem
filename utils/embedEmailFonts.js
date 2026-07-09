const fs = require('fs');
const path = require('path');

/**
 * 將字型檔案轉換為 base64 字串
 * @param {string} fontPath - 字型檔案路徑
 * @returns {string} base64 編碼的字型字串
 */
function fontToBase64(fontPath) {
    try {
        const fontBuffer = fs.readFileSync(fontPath);
        return fontBuffer.toString('base64');
    } catch (error) {
        console.error(`Error reading font file ${fontPath}:`, error);
        return null;
    }
}

/**
 * 檢查 HTML 內容是否包含標楷體相關字型
 * @param {string} html - HTML 內容
 * @returns {boolean}
 */
function hasKaitiFont(html) {
    const kaitiFontNames = [
        'DFKai-SB',
        'BiauKai',
        '標楷體',
        'AR PL UKai TW',
        'STKaiti',
        'ST Kaiti',
        'Kaiti SC',
        'Kaiti TC'
    ];
    
    const htmlLower = html.toLowerCase();
    return kaitiFontNames.some(fontName => 
        htmlLower.includes(fontName.toLowerCase())
    );
}

/**
 * 在 HTML 的 <head> 中添加字型樣式（使用系統內建字型，不嵌入字型檔案）
 * 這樣可以避免郵件大小超過 AWS SES 的 10MB 限制
 * @param {string} html - HTML 內容
 * @returns {string} 添加了字型樣式的 HTML
 */
function injectFontStyle(html) {
    // 使用系統內建字型，不嵌入字型檔案
    // 這樣可以確保郵件大小不會超過限制，同時讓有標楷體的系統能正確顯示
    const fontStyle = `
    <style type="text/css">
        /* 標楷體字型樣式 - 使用系統內建字型 */
        /* 注意：由於字型檔案太大（9MB），我們不嵌入字型檔案 */
        /* 而是依賴收件人系統上已有的標楷體字型 */
        /* 如果系統沒有標楷體，會使用 serif 作為後備 */
        @font-face {
            font-family: 'DFKai-SB';
            src: local('DFKai-SB'), 
                 local('BiauKai'), 
                 local('AR PL UKai TW'), 
                 local('STKaiti'), 
                 local('ST Kaiti'), 
                 local('標楷體'),
                 local('Kaiti SC'), 
                 local('Kaiti TC'),
                 serif;
            font-weight: normal;
            font-style: normal;
        }
        @font-face {
            font-family: 'BiauKai';
            src: local('BiauKai'), 
                 local('DFKai-SB'), 
                 local('AR PL UKai TW'), 
                 local('STKaiti'), 
                 local('ST Kaiti'), 
                 local('標楷體'),
                 local('Kaiti SC'), 
                 local('Kaiti TC'),
                 serif;
            font-weight: normal;
            font-style: normal;
        }
        @font-face {
            font-family: '標楷體';
            src: local('標楷體'),
                 local('DFKai-SB'), 
                 local('BiauKai'), 
                 local('AR PL UKai TW'), 
                 local('STKaiti'), 
                 local('ST Kaiti'), 
                 local('Kaiti SC'), 
                 local('Kaiti TC'),
                 serif;
            font-weight: normal;
            font-style: normal;
        }
    </style>
    `;

    // 嘗試在 </head> 之前插入
    if (html.includes('</head>')) {
        return html.replace('</head>', fontStyle + '</head>');
    }
    
    // 如果沒有 </head>，嘗試在 <head> 之後插入
    if (html.includes('<head>')) {
        return html.replace('<head>', '<head>' + fontStyle);
    }
    
    // 如果都沒有，在開頭添加
    if (html.includes('<!DOCTYPE')) {
        const doctypeEnd = html.indexOf('>') + 1;
        return html.slice(0, doctypeEnd) + fontStyle + html.slice(doctypeEnd);
    }
    
    // 最後的備選方案：在開頭添加
    return fontStyle + html;
}

/**
 * 為電子郵件 HTML 添加標楷體字型樣式
 * 注意：由於字型檔案太大（9MB），我們不嵌入字型檔案，而是使用系統內建字型
 * 這樣可以避免郵件大小超過 AWS SES 的 10MB 限制
 * @param {string} html - 電子郵件 HTML 內容
 * @returns {string} 添加了字型樣式的 HTML
 */
function embedKaitiFontInEmail(html) {
    // 檢查是否需要添加字型樣式
    if (!hasKaitiFont(html)) {
        return html;
    }

    // 不嵌入字型檔案，而是使用系統內建字型
    // 這樣可以確保郵件大小不會超過 AWS SES 的 10MB 限制
    // 如果收件人的系統有標楷體，會正確顯示；如果沒有，會使用 serif 作為後備
    return injectFontStyle(html);
}

module.exports = {
    embedKaitiFontInEmail,
    hasKaitiFont,
    fontToBase64,
    injectFontStyle
};

