const Event = require('../model/Event');
const FormConfig = require('../model/FormConfig');
const formConfigController = require('./formConfigController');
const { getBannerRenderData } = require('../utils/bannerCache');
const { normalizeTicketsForView, ticketsUseCategories } = require('../utils/paymentTicket');
const { isRegisterSlugRouteCandidate } = require('../utils/registerSlug');

async function loadOrCreateFormConfig(eventId) {
    let formConfig = await FormConfig.findOne({ eventId });
    if (!formConfig) {
        const defaultConfig = formConfigController.getDefaultFormConfig();
        formConfig = new FormConfig({
            eventId,
            ...defaultConfig
        });
        await formConfig.save();
    }
    return formConfigController.getFormConfigForRender(formConfig);
}

async function renderRegisterPage(req, res, eventId) {
    const event = await Event.findById(eventId);
    if (!event) {
        return res.status(404).send('Event not found');
    }

    Object.assign(res.locals, getBannerRenderData(String(eventId)));

    let paymentTickets = [];
    if (event.isPaymentEvent && Array.isArray(event.PaymentTickets)) {
        paymentTickets = normalizeTicketsForView(event.PaymentTickets);
    }

    const formConfig = await loadOrCreateFormConfig(eventId);

    if (formConfig.registerPageEnabled === false) {
        return res.render('exvent/register_closed', {
            event_id: eventId,
            event,
            message: formConfig.registerClosedMessage || 'Registration is currently closed.'
        });
    }

    const ticketsForView = paymentTickets;
    return res.render('exvent/register', {
        event_id: eventId,
        event,
        paymentTickets: ticketsForView,
        ticketsUseCategories: ticketsUseCategories(ticketsForView),
        formConfig
    });
}

exports.renderRegisterPageByEventId = async (req, res) => {
    try {
        await renderRegisterPage(req, res, req.params.event_id);
    } catch (err) {
        console.error('renderRegisterPageByEventId error:', err);
        res.status(500).send('Server error');
    }
};

/** GET /:slug — 依 FormConfig.registerSlug 開啟報名頁；非 slug 則 next() */
exports.renderRegisterPageBySlug = async (req, res, next) => {
    const { slug } = req.params;
    if (!isRegisterSlugRouteCandidate(slug)) {
        return next();
    }

    try {
        const formConfigDoc = await FormConfig.findOne({ registerSlug: slug.toLowerCase() });
        if (!formConfigDoc) {
            return next();
        }
        await renderRegisterPage(req, res, String(formConfigDoc.eventId));
    } catch (err) {
        console.error('renderRegisterPageBySlug error:', err);
        res.status(500).send('Server error');
    }
};
