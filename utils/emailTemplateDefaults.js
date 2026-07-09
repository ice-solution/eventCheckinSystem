/**
 * 各郵件類型預設 HTML／主旨（建立模板時載入、無已存模板時 fallback）
 */

function getBuiltinEmailTemplateSeed(type) {
    const seeds = {
        invoice: {
            subject: '您的訂單／發票',
            content: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family: sans-serif;">
<h2>訂單／發票</h2>
<p>您好 {{user.name}}，</p>
<p>感謝您報名活動「{{event.name}}」。</p>
<p>以下為您的訂單資料，請完成付款。</p>
<table border="1" cellpadding="8" style="border-collapse:collapse;">
<tr><td>訂單編號</td><td>{{transaction._id}}</td></tr>
<tr><td>票券／項目</td><td>{{transaction.ticketTitle}}</td></tr>
<tr><td>金額</td><td>{{transaction.ticketPrice}} {{invoice.currency}}</td></tr>
<tr><td>狀態</td><td>{{transaction.status}}</td></tr>
</table>
<p>此為系統自動發送，請勿直接回覆。</p>
</body></html>`,
        },
        payment_receipt: {
            subject: '付款憑證',
            content: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family: sans-serif;">
<h2>付款憑證</h2>
<p>您好 {{user.name}}，</p>
<p>您的款項已收訖，感謝您報名「{{event.name}}」。</p>
<table border="1" cellpadding="8" style="border-collapse:collapse;">
<tr><td>訂單編號</td><td>{{transaction._id}}</td></tr>
<tr><td>票券／項目</td><td>{{transaction.ticketTitle}}</td></tr>
<tr><td>已付金額</td><td>{{invoice.paid_total}} {{invoice.currency}}</td></tr>
<tr><td>發票／單號</td><td>{{invoice.number}}</td></tr>
<tr><td>狀態</td><td>{{invoice.state}}</td></tr>
</table>
<p>此為系統自動發送，請勿直接回覆。</p>
</body></html>`,
        },
    };
    return seeds[type] || null;
}

module.exports = { getBuiltinEmailTemplateSeed };
