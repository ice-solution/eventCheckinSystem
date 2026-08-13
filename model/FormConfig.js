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
        enum: ['text', 'email', 'select', 'textarea', 'tel', 'checkbox', 'radio', 'display'], 
        required: true 
    },
    required: { 
        type: Boolean, 
        default: false 
    },
    /** email 類型：啟用後報名頁顯示「確認電子郵件」欄位 */
    confirmEmail: {
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
    /** Register 頁是否顯示中英文切換按鈕 */
    languageSwitcherEnabled: {
        type: Boolean,
        default: true
    },
    // Register 版面開關：true=顯示註冊表單，false=顯示關閉頁（registerClosedMessage）
    registerPageEnabled: {
        type: Boolean,
        default: true
    },
    /** 公開報名頁 slug：domain/:slug（留空則僅 /web/:eventId/register） */
    registerSlug: {
        type: String,
        trim: true,
        lowercase: true
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
    // 註冊頁 Header：活動名稱下方副標題（留空不顯示）
    registerSubHeader: {
        zh: { type: String, default: '' },
        en: { type: String, default: '' }
    },
    // 註冊頁 Header：灰色說明文字
    registerSubtitle: {
        zh: { type: String, default: '請填寫以下資料完成活動報名' },
        en: { type: String, default: 'Please fill in the following information to complete event registration' }
    },
    // Terms & Conditions（需同意才可提交）
    terms: {
        enabled: { type: Boolean, default: false },
        title: {
            zh: { type: String, default: '條款與細則' },
            en: { type: String, default: 'Terms & Conditions' }
        },
        linkLabel: {
            zh: { type: String, default: '(條款)' },
            en: { type: String, default: '(terms)' }
        },
        showLinkLabel: { type: Boolean, default: true },
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
        title: {
            zh: { type: String, default: '協議' },
            en: { type: String, default: 'Agreement' }
        },
        linkLabel: {
            zh: { type: String, default: '(協議)' },
            en: { type: String, default: '(agreement)' }
        },
        showLinkLabel: { type: Boolean, default: true },
        label: {
            zh: { type: String, default: '本人已閱讀並同意上述協議內容。' },
            en: { type: String, default: 'I have read and agree to the agreement above.' }
        },
        content: {
            zh: { type: String, default: '' },
            en: { type: String, default: '' }
        }
    },
    // 報名成功頁 Thank You 文案
    thankYou: {
        title: {
            zh: { type: String, default: '感謝你參加！' },
            en: { type: String, default: 'Thank you for participating!' }
        },
        message: {
            zh: { type: String, default: '我們會透過 Email 把資訊發送給你。' },
            en: { type: String, default: 'We will send the information to you via Email.' }
        },
        purchaseTitle: {
            zh: { type: String, default: '感謝您的購票！' },
            en: { type: String, default: 'Thank you for your purchase!' }
        },
        purchaseMessage: {
            zh: { type: String, default: '您的付款已成功，以下是您的交易紀錄：' },
            en: { type: String, default: 'Your payment was successful. Here are your transaction details:' }
        },
        /** Yes/No 問題（顯示於報名表；Yes 時可覆寫成功頁文案並發送指定 Email Template） */
        yesNoQuestion: {
            enabled: { type: Boolean, default: false },
            question: {
                zh: { type: String, default: '' },
                en: { type: String, default: '' }
            },
            yesLabel: {
                zh: { type: String, default: '是' },
                en: { type: String, default: 'Yes' }
            },
            noLabel: {
                zh: { type: String, default: '否' },
                en: { type: String, default: 'No' }
            },
            /** 選 Yes 時發送的 EmailTemplate _id（可選） */
            yesEmailTemplateId: { type: String, default: '' },
            /** 選 No 時發送的 EmailTemplate _id（可選） */
            noEmailTemplateId: { type: String, default: '' },
            /** 選 Yes 時 Thank You 頁標題／說明（覆寫 title/message；付費則另用 yesPurchase*） */
            yesTitle: {
                zh: { type: String, default: '' },
                en: { type: String, default: '' }
            },
            yesMessage: {
                zh: { type: String, default: '' },
                en: { type: String, default: '' }
            },
            yesPurchaseTitle: {
                zh: { type: String, default: '' },
                en: { type: String, default: '' }
            },
            yesPurchaseMessage: {
                zh: { type: String, default: '' },
                en: { type: String, default: '' }
            },
            /** 選 No 時 Thank You 頁標題／說明 */
            noTitle: {
                zh: { type: String, default: '' },
                en: { type: String, default: '' }
            },
            noMessage: {
                zh: { type: String, default: '' },
                en: { type: String, default: '' }
            },
            noPurchaseTitle: {
                zh: { type: String, default: '' },
                en: { type: String, default: '' }
            },
            noPurchaseMessage: {
                zh: { type: String, default: '' },
                en: { type: String, default: '' }
            }
        }
    },
    /** 專屬 Application 連結：已完成時顯示的標題／說明 */
    applicationCompletedPage: {
        title: {
            zh: { type: String, default: '申請已完成' },
            en: { type: String, default: 'Application completed' }
        },
        message: {
            zh: { type: String, default: '您已完成申請，此連結不可再次修改。' },
            en: { type: String, default: 'You have already completed this application. This link cannot be used to make further changes.' }
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
            next: { zh: { type: String, default: '提交' }, en: { type: String, default: 'Submit' } }
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

formConfigSchema.index({ registerSlug: 1 }, { unique: true, sparse: true });

const FormConfig = mongoose.model('FormConfig', formConfigSchema);

module.exports = FormConfig;

