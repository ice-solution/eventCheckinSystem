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
        // 這裡我們需要獲取預設配置，但由於是靜態函數，我們直接創建
        const defaultConfig = {
            sections: [
                {
                    sectionName: 'contact_info',
                    sectionTitle: '聯絡人資料',
                    visible: true,
                    fields: [
                        { fieldName: 'email', label: '電子郵件', type: 'email', required: true, visible: true, placeholder: '例如：peterwong@abccompany.com' },
                        { fieldName: 'name', label: '姓名', type: 'text', required: true, visible: true, placeholder: '例如：王小明' },
                        { fieldName: 'phone_code', label: '電話區號', type: 'select', required: true, visible: true, options: [
                            { value: '+852', label: '香港 (+852)' },
                            { value: '+1', label: '加拿大 (+1)' },
                            { value: '+86', label: '中國 (+86)' },
                            { value: '+81', label: '日本 (+81)' },
                            { value: '+82', label: '韓國 (+82)' },
                            { value: '+65', label: '新加坡 (+65)' },
                            { value: '+60', label: '馬來西亞 (+60)' },
                            { value: '+63', label: '菲律賓 (+63)' },
                            { value: '+84', label: '越南 (+84)' },
                            { value: '+66', label: '泰國 (+66)' }
                        ]},
                        { fieldName: 'phone', label: '電話號碼', type: 'tel', required: true, visible: true, placeholder: '例如：區號 - 電話號碼' },
                        { fieldName: 'saluation', label: '稱謂', type: 'select', required: true, visible: true, options: [
                            { value: 'Mr.', label: 'Mr.' },
                            { value: 'Ms.', label: 'Ms.' },
                            { value: 'Mrs.', label: 'Mrs.' },
                            { value: 'Dr.', label: 'Dr.' },
                            { value: 'Prof.', label: 'Prof.' }
                        ]},
                        { fieldName: 'company', label: '公司名稱', type: 'text', required: true, visible: true, placeholder: '例如：ABC 公司' },
                        { fieldName: 'role', label: '職位', type: 'text', required: true, visible: true, placeholder: '例如：資深經理' },
                        { fieldName: 'industry', label: '行業', type: 'select', required: false, visible: true, options: [
                            { value: '科技', label: '科技' },
                            { value: '金融', label: '金融' },
                            { value: '教育', label: '教育' },
                            { value: '醫療', label: '醫療' },
                            { value: '零售', label: '零售' },
                            { value: '其他', label: '其他' }
                        ]},
                        { fieldName: 'transport', label: '交通方式', type: 'select', required: false, visible: true, options: [
                            { value: '地鐵', label: '地鐵' },
                            { value: '巴士', label: '巴士' },
                            { value: '計程車', label: '計程車' },
                            { value: '自駕', label: '自駕' },
                            { value: '其他', label: '其他' }
                        ]},
                        { fieldName: 'meal', label: '餐飲選擇', type: 'select', required: false, visible: true, options: [
                            { value: '葷食', label: '葷食' },
                            { value: '素食', label: '素食' },
                            { value: '清真', label: '清真' },
                            { value: '無特殊要求', label: '無特殊要求' }
                        ]},
                        { fieldName: 'remarks', label: '備註', type: 'textarea', required: false, visible: true, placeholder: '請輸入任何特殊需求或備註' }
                    ]
                }
            ]
        };
        formConfig = { sections: defaultConfig.sections };
    }
    
    res.render('exvent/register', { event_id, paymentTickets, formConfig: formConfig.sections });
});
// 路由到註冊成功頁面
router.get('/:event_id/register/success', async (req, res) => {
    const { event_id } = req.params;
    const { session_id } = req.query;
    let transaction = null;
    if (session_id) {
        transaction = await Transaction.findOne({ stripeSessionId: session_id });
    }
    res.render('exvent/success', { event_id, transaction });
});

// 路由到付款失敗頁面
router.get('/:event_id/register/fail', async (req, res) => {
    const { event_id } = req.params;
    const { session_id, errorMsg } = req.query;
    let transaction = null;
    if (session_id) {
        transaction = await Transaction.findOne({ stripeSessionId: session_id });
    }
    res.render('exvent/fail', { event_id, transaction, errorMsg });
});

// Stripe Checkout
router.post('/:event_id/stripe-checkout', eventsController.stripeCheckout);

// Stripe Webhook
// router.post('/webhook/stripe', express.raw({type: 'application/json'}), eventsController.stripeWebhook);

module.exports = router;