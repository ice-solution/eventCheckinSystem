// routes/website.js
const express = require('express');
const router = express.Router();
const path = require('path');
const Event = require('../model/Event');
const eventsController = require('../controllers/eventsController');
const Transaction = require('../model/Transaction');

// 路由到 demo_website/index.ejs
router.get('/:event_id', (req, res) => {
    const { event_id } = req.params; // 獲取 event_id
    res.render('exvent/index', { event_id }); // 渲染 index.ejs，並傳遞 event_id
});

// 路由到 event_website/register.ejs
router.get('/:event_id/register', async (req, res) => {
    const { event_id } = req.params;
    const event = await Event.findById(event_id);
    let paymentTickets = [];
    if (event && event.isPaymentEvent && Array.isArray(event.PaymentTickets)) {
        paymentTickets = event.PaymentTickets;
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
    } else {
        // 檢查是否需要數據遷移（只在第一次訪問時進行，避免覆蓋用戶設置）
        const formConfigController = require('../controllers/formConfigController');
        const migratedConfig = formConfigController.migrateFormConfig(formConfig);
        
        // 只有在數據結構真正需要遷移時才保存（避免覆蓋用戶的 defaultLanguage 設置）
        const needsMigration = !formConfig.defaultLanguage || 
                              (formConfig.sections && formConfig.sections.length > 0 && 
                               formConfig.sections[0].fields && formConfig.sections[0].fields.length > 0 &&
                               typeof formConfig.sections[0].fields[0].label === 'string');
        
        if (needsMigration && JSON.stringify(migratedConfig) !== JSON.stringify(formConfig)) {
            // 保留用戶設置的 defaultLanguage
            const userDefaultLanguage = formConfig.defaultLanguage;
            Object.assign(formConfig, migratedConfig);
            if (userDefaultLanguage) {
                formConfig.defaultLanguage = userDefaultLanguage;
            }
            await formConfig.save();
            console.log('FormConfig 數據已遷移，保留用戶設置的 defaultLanguage:', userDefaultLanguage);
        }
    }
    
    res.render('exvent/register', { event_id, paymentTickets, formConfig: formConfig });
});
// 路由到註冊成功頁面（session_id 可為 Wonder order_id 或 Transaction _id）
router.get('/:event_id/register/success', async (req, res) => {
    const { event_id } = req.params;
    const { session_id, lang } = req.query;
    let transaction = null;
    if (session_id) {
        transaction = await Transaction.findOne({
            $or: [
                { stripeSessionId: session_id },
                { _id: session_id }
            ]
        });
    }
    res.render('exvent/success', { event_id, transaction, lang: lang || null });
});

// 路由到付款失敗頁面
router.get('/:event_id/register/fail', async (req, res) => {
    const { event_id } = req.params;
    const { session_id, errorMsg, lang } = req.query;
    let transaction = null;
    if (session_id) {
        transaction = await Transaction.findOne({
            $or: [
                { stripeSessionId: session_id },
                { _id: session_id }
            ]
        });
    }
    res.render('exvent/fail', { event_id, transaction, errorMsg, lang: lang || null });
});

// Wonder Payment Checkout（沿用舊路徑以相容前端）
router.post('/:event_id/stripe-checkout', eventsController.stripeCheckout);

// Wonder Payment 回調（GET/POST 皆可，依 Wonder 文件設定 callback_url）
router.get('/webhook/wonder', eventsController.wonderWebhook);
router.post('/webhook/wonder', eventsController.wonderWebhook);

module.exports = router;