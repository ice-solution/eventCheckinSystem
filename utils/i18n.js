const path = require('path');
const fs = require('fs');

const dicts = {
    zh: JSON.parse(fs.readFileSync(path.join(__dirname, '../locales/zh.json'), 'utf8')),
    en: JSON.parse(fs.readFileSync(path.join(__dirname, '../locales/en.json'), 'utf8'))
};

function lookup(dict, key) {
    return key.split('.').reduce((o, k) => (o && o[k] != null) ? o[k] : null, dict);
}

function translate(lang, key) {
    const dict = dicts[lang] || dicts['zh'];
    const result = lookup(dict, key);
    if (result != null) return result;
    const zhResult = lookup(dicts['zh'], key);
    if (zhResult != null) return zhResult;
    return key;
}

function getDict(lang) {
    return dicts[lang] || dicts['zh'];
}

function resolveLang(req) {
    if (req.session && req.session.lang === 'zh') return 'zh';
    return 'en';
}

module.exports = { translate, getDict, resolveLang };
