const Event = require('../model/Event');
const FormConfig = require('../model/FormConfig');
const formConfigController = require('./formConfigController');
const { getBannerRenderData } = require('../utils/bannerCache');
const { normalizeTicketsForView, ticketsUseCategories } = require('../utils/paymentTicket');
const { isRegisterSlugRouteCandidate } = require('../utils/registerSlug');
const { getCurrencySymbol, getCurrencyUpper } = require('../utils/currency');

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
        formConfig,
        currencySymbol: getCurrencySymbol(),
        currencyCode: getCurrencyUpper()
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

/**
 * 將 custom HTML 注入 eventId／submit helper（支援 {{eventId}} {{submitUrl}} {{successUrl}}）
 */
function injectCustomFormRuntime(html, eventId, defaultLanguage) {
    const submitUrl = `/web/${eventId}/custom-form`;
    const pageLang = defaultLanguage === 'en' ? 'en' : 'zh';
    const successUrl = `/web/${eventId}/register/success?lang=${pageLang}`;
    let out = String(html || '')
        .replace(/\{\{eventId\}\}/g, String(eventId))
        .replace(/\{\{submitUrl\}\}/g, submitUrl)
        .replace(/\{\{successUrl\}\}/g, successUrl);

    const runtime = `<style id="custom-form-base-font">
html,body,input,select,textarea,button,label,h1,h2,h3,h4,h5,h6,p,span,a,div{
  font-family:Arial,Helvetica,sans-serif!important;
}
body{font-weight:400;}
</style>
<script>
window.CUSTOM_FORM_EVENT_ID=${JSON.stringify(String(eventId))};
window.CUSTOM_FORM_SUBMIT_URL=${JSON.stringify(submitUrl)};
window.CUSTOM_FORM_SUCCESS_URL=${JSON.stringify(successUrl)};
window.CUSTOM_FORM_DEFAULT_LANG=${JSON.stringify(pageLang)};
window.submitCustomForm=async function(data, files){
  var res;
  if (typeof FormData !== 'undefined' && data instanceof FormData) {
    res = await fetch(window.CUSTOM_FORM_SUBMIT_URL, {
      method: 'POST',
      body: data,
      credentials: 'same-origin'
    });
  } else if (files && files.companyLogo) {
    var fd = new FormData();
    var payload = data || {};
    if (payload.companyLogo && typeof payload.companyLogo === 'string' && payload.companyLogo.indexOf('data:image') === 0) {
      payload = Object.assign({}, payload);
      delete payload.companyLogo;
    }
    fd.append('payload', JSON.stringify(payload));
    fd.append('companyLogo', files.companyLogo, files.companyLogo.name || 'logo.jpg');
    res = await fetch(window.CUSTOM_FORM_SUBMIT_URL, {
      method: 'POST',
      body: fd,
      credentials: 'same-origin'
    });
  } else {
    res = await fetch(window.CUSTOM_FORM_SUBMIT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data || {}),
      credentials: 'same-origin'
    });
  }
  var body = await res.json().catch(function(){ return {}; });
  if (!res.ok) {
    var err = new Error((body && body.message) || ('Submit failed (' + res.status + ')'));
    err.status = res.status;
    err.body = body;
    throw err;
  }
  return body;
};
</script>`;

    if (/<\/body>/i.test(out)) {
        return out.replace(/<\/body>/i, runtime + '</body>');
    }
    return out + runtime;
}

/**
 * GET /web/:event_id/custom-form — 獨立 Custom HTML 報名頁
 */
exports.renderCustomFormPage = async (req, res) => {
    try {
        const eventId = req.params.event_id;
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).send('Event not found');
        }

        const formConfig = await FormConfig.findOne({ eventId });
        if (!formConfig || formConfig.customFormEnabled !== true) {
            return res.status(404).send('Custom form is not enabled for this event.');
        }

        const html = (formConfig.customFormHtml || '').trim();
        if (!html) {
            return res.status(404).send('Custom form HTML is empty.');
        }

        // 確保瀏覽器以 UTF-8 解析（避免 JS 字串內特殊字元變 Invalid token）
        let pageHtml = html;
        if (!/<meta[^>]+charset=/i.test(pageHtml)) {
            if (/<head[^>]*>/i.test(pageHtml)) {
                pageHtml = pageHtml.replace(/<head[^>]*>/i, (m) => `${m}\n  <meta charset="utf-8">`);
            } else {
                pageHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${pageHtml}</body></html>`;
            }
        }

        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        const defaultLanguage = formConfig.defaultLanguage || 'zh';
        return res.send(injectCustomFormRuntime(pageHtml, eventId, defaultLanguage));
    } catch (err) {
        console.error('renderCustomFormPage error:', err);
        return res.status(500).send('Server error');
    }
};

/** 下載用 sample HTML（後台）— 優先用 sponsorship form 檔 */
exports.getCustomFormSampleHtml = () => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.join(__dirname, '..', 'template', 'sponsorship-custom-form.html');
    try {
        if (fs.existsSync(filePath)) {
            return fs.readFileSync(filePath, 'utf8');
        }
    } catch (err) {
        console.warn('getCustomFormSampleHtml read failed:', err.message);
    }
    return '<!DOCTYPE html><html><body><p>Sample missing. See template/sponsorship-custom-form.html</p></body></html>';
};
