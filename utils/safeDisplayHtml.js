/**
 * Display 欄位 Label 允許的簡單 HTML（粗體／斜體等）。
 * 會移除 script／事件 handler／javascript: 等危險內容。
 */
function safeDisplayHtml(input) {
    let s = String(input == null ? '' : input);
    if (!s) return '';

    // 移除高風險標籤（含內容）
    s = s.replace(/<\s*(script|style|iframe|object|embed|link|meta|form|input|button|textarea|select|svg|math)(\s[^>]*)?>[\s\S]*?<\s*\/\s*\1\s*>/gi, '');
    s = s.replace(/<\s*\/?\s*(script|style|iframe|object|embed|link|meta|form|input|button|textarea|select|svg|math)(\s[^>]*)?\/?\s*>/gi, '');

    // 移除 on* 事件屬性
    s = s.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');

    // 阻擋 javascript: / data: 偽協議
    s = s.replace(/\s(href|src|xlink:href)\s*=\s*(["'])\s*(javascript|data|vbscript):[\s\S]*?\2/gi, ' $1=$2#$2');

    return s;
}

/** safeDisplayHtml + 將 Enter 換行轉成 <br> */
function formatDisplayHtml(input) {
    return safeDisplayHtml(input).replace(/\r\n|\r|\n/g, '<br>');
}

/** 移除所有 HTML 標籤（用於 <title> 等純文字位置） */
function stripHtml(input) {
    return String(input == null ? '' : input)
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]*>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

module.exports = { safeDisplayHtml, formatDisplayHtml, stripHtml };
