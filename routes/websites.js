// routes/website.js
const express = require('express');
const router = express.Router();
const path = require('path');
const Event = require('../model/Event');
const eventsController = require('../controllers/eventsController');
const Transaction = require('../model/Transaction');
const { getBannerRenderData } = require('../utils/bannerCache');
const { normalizeTicketsForView, ticketsUseCategories } = require('../utils/paymentTicket');

function getWebApiKeys() {
    const raw = (process.env.WEB_SITE_API_KEYS || process.env.WEB_API_KEYS || '').toString().trim();
    if (!raw) return [];
    return raw.split(',').map(s => s.trim()).filter(Boolean);
}

function getApiKeyFromRequest(req) {
    const headerKey = req.get('X-WEB-API-KEY') || req.get('X-Api-Key') || req.get('X-API-KEY');
    const queryKey = req.query && (req.query.apiKey || req.query.api_key);
    return (headerKey || queryKey || '').toString().trim();
}

function requireWebApiKey(req, res, next) {
    const keys = getWebApiKeys();
    if (!keys.length) {
        return res.status(500).json({ message: 'WEB_API_KEYS is not configured' });
    }
    const key = getApiKeyFromRequest(req);
    if (!key || !keys.includes(key)) {
        return res.status(401).json({ message: 'Unauthorized' });
    }
    return next();
}

// 為活動頁面注入帶 ?t= 的 banner URL（依檔案修改時間，避免 CDN 快取舊圖）
router.param('event_id', (req, res, next, eventId) => {
    if (/^[0-9a-fA-F]{24}$/.test(eventId)) {
        Object.assign(res.locals, getBannerRenderData(eventId));
    }
    next();
});

// 路由到 demo_website/index.ejs
router.get('/:event_id', (req, res) => {
    const { event_id } = req.params; // 獲取 event_id
    res.render('exvent/index', { event_id }); // 渲染 index.ejs，並傳遞 event_id
});

/**
 * 外部系統（網站）用：透過 eventId + userId 取得用戶資料
 * 需提供 X-WEB-API-KEY（或 query apiKey），並在 .env 設定 WEB_API_KEYS
 */
router.get('/:event_id/users/:userId', requireWebApiKey, async (req, res) => {
    const { event_id, userId } = req.params;
    if (!/^[0-9a-fA-F]{24}$/.test(event_id) || !/^[0-9a-fA-F]{24}$/.test(userId)) {
        return res.status(400).json({ message: 'Invalid event_id or userId' });
    }
    try {
        const event = await Event.findById(event_id).select({ users: 1 });
        if (!event) return res.status(404).json({ message: 'Event not found' });
        const user = event.users && event.users.id ? event.users.id(userId) : null;
        if (!user) return res.status(404).json({ message: 'User not found' });
        const userObject = user.toObject ? user.toObject({ minimize: false }) : user;
        return res.json(userObject);
    } catch (err) {
        console.error('web api get user by id error:', err);
        return res.status(500).json({ message: 'Server error' });
    }
});

// 路由到 event_website/register.ejs
router.get('/:event_id/register', async (req, res) => {
    const { event_id } = req.params;
    const event = await Event.findById(event_id);
    let paymentTickets = [];
    if (event && event.isPaymentEvent && Array.isArray(event.PaymentTickets)) {
        paymentTickets = normalizeTicketsForView(event.PaymentTickets);
    }
    
    // 獲取表單配置
    const FormConfig = require('../model/FormConfig');
    let formConfig = await FormConfig.findOne({ eventId: event_id });
    
    // 如果沒有配置，使用預設配置
    if (!formConfig) {
        const formConfigController = require('../controllers/formConfigController');
        // 使用完整的預設配置
        const defaultConfig = formConfigController.getDefaultFormConfig();
        formConfig = new FormConfig({
            eventId: event_id,
            ...defaultConfig
        });
        await formConfig.save();
    }

    const formConfigController = require('../controllers/formConfigController');
    formConfig = formConfigController.getFormConfigForRender(formConfig);
    
    // Register 版面關閉時顯示關閉頁，否則顯示註冊表單
    if (formConfig.registerPageEnabled === false) {
        return res.render('exvent/register_closed', {
            event_id,
            event,
            message: formConfig.registerClosedMessage || 'Registration is currently closed.'
        });
    }
    
    const ticketsForView = paymentTickets;
    res.render('exvent/register', {
        event_id,
        event,
        paymentTickets: ticketsForView,
        ticketsUseCategories: ticketsUseCategories(ticketsForView),
        formConfig: formConfig
    });
});
// 路由到註冊成功頁面（session_id 可為 Stripe session_id、Wonder order_id 或 Transaction _id）
router.get('/:event_id/register/success', async (req, res) => {
    const { event_id } = req.params;
    const { session_id, lang } = req.query;
    let transaction = null;
    if (session_id) {
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(session_id);
        const query = isObjectId
            ? { $or: [{ stripeSessionId: session_id }, { _id: session_id }] }
            : { stripeSessionId: session_id };
        transaction = await Transaction.findOne(query);
    }
    res.render('exvent/success', { event_id, transaction, lang: lang || null });
});

// 路由到付款失敗頁面
router.get('/:event_id/register/fail', async (req, res) => {
    const { event_id } = req.params;
    const { session_id, errorMsg, lang } = req.query;
    let transaction = null;
    if (session_id) {
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(session_id);
        const query = isObjectId
            ? { $or: [{ stripeSessionId: session_id }, { _id: session_id }] }
            : { stripeSessionId: session_id };
        transaction = await Transaction.findOne(query);
    }
    res.render('exvent/fail', { event_id, transaction, errorMsg, lang: lang || null });
});

// 公開 Email Template HTML 預覽（與 /emailTemplate/preview/:id 相同，方便 iframe 嵌入）
const emailTemplateController = require('../controllers/emailTemplateController');
router.get('/email-template/:id', emailTemplateController.renderEmailTemplatePreview);

// 公開免費報名（iframe / 前台，不需登入；勿用 /events/.../users）
router.post('/:event_id/register', eventsController.publicRegister);

// Wonder Payment Checkout（沿用舊路徑以相容前端）
router.post('/:event_id/stripe-checkout', eventsController.stripeCheckout);

// Wonder Payment 回調（GET/POST 皆可，依 Wonder 文件設定 callback_url）
router.get('/webhook/wonder', eventsController.wonderWebhook);
router.post('/webhook/wonder', eventsController.wonderWebhook);

module.exports = router;