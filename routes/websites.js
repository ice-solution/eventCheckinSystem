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
    res.render('exvent/register', { event_id, paymentTickets });
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