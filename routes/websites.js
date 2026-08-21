// routes/website.js
const express = require('express');
const router = express.Router();
const path = require('path');
const Event = require('../model/Event');
const eventsController = require('../controllers/eventsController');
const registerPageController = require('../controllers/registerPageController');
const Transaction = require('../model/Transaction');
const { getBannerRenderData } = require('../utils/bannerCache');
const { isFreePaymentTicketPrice } = require('../utils/paymentTicket');

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
router.get('/:event_id/register', registerPageController.renderRegisterPageByEventId);

// Custom HTML 報名頁（獨立於 FormConfig 動態表單）
router.get('/:event_id/custom-form', registerPageController.renderCustomFormPage);
router.post('/:event_id/custom-form', eventsController.publicCustomFormRegister);
// 路由到註冊成功頁面（session_id 可為 Stripe session_id、Wonder order_id 或 Transaction _id）
router.get('/:event_id/register/success', async (req, res) => {
    const { event_id } = req.params;
    const { session_id, lang, thankYouYesNo: thankYouYesNoQuery } = req.query;
    let transaction = null;
    if (session_id) {
        const isObjectId = /^[0-9a-fA-F]{24}$/.test(session_id);
        const query = isObjectId
            ? { $or: [{ stripeSessionId: session_id }, { _id: session_id }] }
            : { stripeSessionId: session_id };
        transaction = await Transaction.findOne(query);
        if (transaction && (transaction.status === 'free' || isFreePaymentTicketPrice(transaction.ticketPrice))) {
            transaction = null;
        }
    }

    const FormConfig = require('../model/FormConfig');
    const formConfigController = require('../controllers/formConfigController');
    let formConfig = await FormConfig.findOne({ eventId: event_id });
    if (!formConfig) {
        formConfig = formConfigController.getDefaultFormConfig();
    } else {
        formConfig = formConfigController.getFormConfigForRender(formConfig);
    }

    // Yes/No 答案：query 優先；付費則從 transaction.userFormData 讀
    let thankYouYesNo = thankYouYesNoQuery || null;
    if (!thankYouYesNo && transaction && transaction.userFormData) {
        thankYouYesNo = transaction.userFormData.thankYouYesNo || null;
    }

    res.render('exvent/success', {
        event_id,
        transaction,
        lang: lang || null,
        formConfig,
        thankYouYesNo
    });
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

// 專屬 Application（已 import 用戶補填；獨立於公開 register）
router.get('/:event_id/application/:userId', eventsController.renderApplicationForm);
router.post('/:event_id/application/:userId', eventsController.submitApplicationForm);

// Wonder Payment Checkout（沿用舊路徑以相容前端）
router.post('/:event_id/stripe-checkout', eventsController.stripeCheckout);

// Wonder Payment 回調（GET/POST 皆可，依 Wonder 文件設定 callback_url）
router.get('/webhook/wonder', eventsController.wonderWebhook);
router.post('/webhook/wonder', eventsController.wonderWebhook);

module.exports = router;