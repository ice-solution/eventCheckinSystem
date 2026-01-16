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
 * 在 HTML 的 <head> 中添加嵌入的字型樣式
 * @param {string} html - HTML 內容
 * @param {string} base64Font - base64 編碼的字型
 * @returns {string} 添加了字型樣式的 HTML
 */
function injectFontStyle(html, base64Font) {
    const fontStyle = `
    <style type="text/css">
        @font-face {
            font-family: 'DFKai-SB';
            src: url(data:font/truetype;charset=utf-8;base64,${base64Font}) format('truetype');
            font-weight: normal;
            font-style: normal;
            font-display: swap;
        }
        @font-face {
            font-family: 'BiauKai';
            src: url(data:font/truetype;charset=utf-8;base64,${base64Font}) format('truetype');
            font-weight: normal;
            font-style: normal;
            font-display: swap;
        }
        @font-face {
            font-family: '標楷體';
            src: url(data:font/truetype;charset=utf-8;base64,${base64Font}) format('truetype'),
                 local('AR PL UKai TW'), 
                 local('DFKai-SB'), 
                 local('BiauKai'), 
                 local('STKaiti'), 
                 local('ST Kaiti'), 
                 local('標楷體'),
                 local('Kaiti SC'), 
                 local('Kaiti TC');
            font-weight: normal;
            font-style: normal;
            font-display: swap;
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
 * 為電子郵件 HTML 嵌入標楷體字型
 * @param {string} html - 電子郵件 HTML 內容
 * @returns {string} 嵌入了字型的 HTML
 */
function embedKaitiFontInEmail(html) {
    // 檢查是否需要嵌入字型
    if (!hasKaitiFont(html)) {
        return html;
    }

    // 字型檔案路徑
    const fontPath = path.join(__dirname, '../public/admin/assets/fonts/kaiti/Iansui-Regular.ttf');
    
    // 檢查字型檔案是否存在
    if (!fs.existsSync(fontPath)) {
        console.warn(`Font file not found: ${fontPath}. Email will use system fonts as fallback.`);
        return html;
    }

    // 將字型轉換為 base64
    const base64Font = fontToBase64(fontPath);
    if (!base64Font) {
        console.warn('Failed to convert font to base64. Email will use system fonts as fallback.');
        return html;
    }

    // 注入字型樣式到 HTML
    return injectFontStyle(html, base64Font);
}

module.exports = {
    embedKaitiFontInEmail,
    hasKaitiFont,
    fontToBase64,
    injectFontStyle
};

