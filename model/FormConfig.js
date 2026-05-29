const mongoose = require('mongoose');

const formFieldSchema = new mongoose.Schema({
    fieldName: { 
        type: String, 
        required: true 
    },
    label: {
        zh: { type: String, default: '' }, // 中文標籤
        en: { type: String, default: '' }  // 英文標籤
    },
    type: { 
        type: String, 
        enum: ['text', 'email', 'select', 'textarea', 'tel', 'checkbox', 'radio'], 
        required: true 
    },
    required: { 
        type: Boolean, 
        default: false 
    },
    // 是否在註冊頁等前台表單顯示供用戶填寫
    display: {
        type: Boolean,
        default: true
    },
    visible: { 
        type: Boolean, 
        default: true 
    },
    placeholder: {
        zh: { type: String, default: '' }, // 中文佔位符
        en: { type: String, default: '' }  // 英文佔位符
    },
    options: [{ 
        value: String,
        label: {
            zh: String, // 中文選項標籤
            en: String  // 英文選項標籤
        },
        // select：勾選後，用戶選此選項時可另行輸入自訂文字（儲存為該欄位最終值）
        isOther: { type: Boolean, default: false }
    }],
    validation: {
        minLength: Number,
        maxLength: Number,
        pattern: String
    },
    order: { 
        type: Number, 
        default: 0 
    }
});

const formSectionSchema = new mongoose.Schema({
    sectionName: { 
        type: String, 
        required: true 
    },
    sectionTitle: {
        zh: { type: String, default: '' }, // 中文區塊標題
        en: { type: String, default: '' }  // 英文區塊標題
    },
    visible: { 
        type: Boolean, 
        default: true 
    },
    fields: [formFieldSchema],
    order: { 
        type: Number, 
        default: 0 
    }
});

const formConfigSchema = new mongoose.Schema({
    eventId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'Event', 
        required: true 
    },
    defaultLanguage: {
        type: String,
        enum: ['zh', 'en'],
        default: 'zh' // 默認語言為中文
    },
    // Register 版面開關：true=顯示註冊表單，false=顯示關閉頁（registerClosedMessage）
    registerPageEnabled: {
        type: Boolean,
        default: true
    },
    // 關閉註冊時顯示的訊息（支援多行）
    registerClosedMessage: {
        type: String,
        default: ''
    },
    // 註冊頁 Header 顯示名稱（可覆蓋 event.name）
    eventDisplayName: {
        zh: { type: String, default: '' },
        en: { type: String, default: '' }
    },
    // Terms & Conditions（需同意才可提交）
    terms: {
        enabled: { type: Boolean, default: false },
        // 勾選框文字（雙語）
        label: {
            zh: { type: String, default: '本人已閱讀並同意上述須知，確認繼續預約及積分扣款程序。' },
            en: { type: String, default: 'I have read and agree to the terms above, and confirm to proceed.' }
        },
        // 條款內容（雙語，可用多行文字）
        content: {
            zh: { type: String, default: '' },
            en: { type: String, default: '' }
        }
    },
    // Agreement（功能同 Terms & Conditions）
    agreement: {
        enabled: { type: Boolean, default: false },
        label: {
            zh: { type: String, default: '本人已閱讀並同意上述協議內容。' },
            en: { type: String, default: 'I have read and agree to the agreement above.' }
        },
        content: {
            zh: { type: String, default: '' },
            en: { type: String, default: '' }
        }
    },
    // 付費票券區塊文案與分類按鈕（Register 頁）
    paymentTicketUi: {
        sectionTitle: {
            zh: { type: String, default: '票券選擇' },
            en: { type: String, default: 'Ticket Selection' }
        },
        categoryLabel: {
            zh: { type: String, default: '選擇類別' },
            en: { type: String, default: 'Select Category' }
        },
        ticketLabel: {
            zh: { type: String, default: '選擇票券' },
            en: { type: String, default: 'Select Ticket' }
        },
        defaultCategoryLabel: {
            zh: { type: String, default: '其他' },
            en: { type: String, default: 'Other' }
        },
        buttons: {
            back: { zh: { type: String, default: '返回' }, en: { type: String, default: 'Back' } },
            next: { zh: { type: String, default: '下一步' }, en: { type: String, default: 'Next' } }
        },
        /** 票券下拉框下方單一提示（全區塊共用，非每張票券） */
        highlightText: {
            zh: { type: String, default: '' },
            en: { type: String, default: '' }
        },
        categoryButtons: [{
            key: { type: String, default: '' },
            label: {
                zh: { type: String, default: '' },
                en: { type: String, default: '' }
            }
        }]
    },
    sections: [formSectionSchema],
    createdAt: { 
        type: Date, 
        default: Date.now 
    },
    updatedAt: { 
        type: Date, 
        default: Date.now 
    }
});

// 更新時間中間件
formConfigSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

const FormConfig = mongoose.model('FormConfig', formConfigSchema);

module.exports = FormConfig;

