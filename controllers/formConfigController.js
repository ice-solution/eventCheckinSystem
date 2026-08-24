const FormConfig = require('../model/FormConfig');
const Event = require('../model/Event');
const { normalizePaymentTicketUi } = require('../utils/paymentTicket');
const { normalizeRegisterSlug, validateRegisterSlug } = require('../utils/registerSlug');
const { syncAgreementsOnConfig, cloneDefaultAgreement } = require('../utils/agreementFields');

async function applyRegisterSlugToFormConfig(formConfig, rawSlug, eventId) {
    if (rawSlug === undefined) {
        return { ok: true };
    }
    const normalized = normalizeRegisterSlug(rawSlug);
    const validation = validateRegisterSlug(normalized);
    if (!validation.valid) {
        return { ok: false, message: validation.message };
    }
    if (!normalized) {
        formConfig.registerSlug = undefined;
        return { ok: true, unset: true };
    }
    const existing = await FormConfig.findOne({
        registerSlug: normalized,
        eventId: { $ne: eventId }
    }).select({ _id: 1, eventId: 1 });
    if (existing) {
        return { ok: false, message: '此 slug 已被其他活動使用' };
    }
    formConfig.registerSlug = normalized;
    return { ok: true, unset: false };
}

/** Mongoose document → plain object（供 migrate / render 使用） */
function toPlainFormConfig(formConfig) {
    if (!formConfig) return formConfig;
    if (typeof formConfig.toObject === 'function') {
        return formConfig.toObject({ minimize: false });
    }
    if (typeof formConfig.toJSON === 'function') {
        return formConfig.toJSON();
    }
    return { ...formConfig };
}

// 數據遷移函數：將舊格式轉換為新格式
const migrateFormConfig = (formConfig) => {
    if (!formConfig) return formConfig;

    const src = toPlainFormConfig(formConfig);
    if (!src.sections || !Array.isArray(src.sections)) {
        return applyFormConfigMetaDefaults(src);
    }

    const migratedConfig = { ...src };
    
    migratedConfig.sections = src.sections.map(section => {
        const migratedSection = { ...section };
        
        // 遷移 sectionTitle
        if (typeof section.sectionTitle === 'string') {
            migratedSection.sectionTitle = {
                zh: section.sectionTitle,
                en: section.sectionTitle
            };
        } else if (!section.sectionTitle || (!section.sectionTitle.zh && !section.sectionTitle.en)) {
            migratedSection.sectionTitle = {
                zh: '聯絡人資料',
                en: 'Contact Information'
            };
        }
        
        // 遷移 fields
        if (section.fields) {
            migratedSection.fields = section.fields.map(field => {
                const migratedField = { ...field };
                
                // 遷移 label
                if (typeof field.label === 'string') {
                    migratedField.label = {
                        zh: field.label,
                        en: field.label
                    };
                } else if (!field.label || (!field.label.zh && !field.label.en)) {
                    migratedField.label = {
                        zh: field.fieldName || '',
                        en: field.fieldName || ''
                    };
                }
                
                // 遷移 placeholder
                if (typeof field.placeholder === 'string') {
                    migratedField.placeholder = {
                        zh: field.placeholder,
                        en: field.placeholder
                    };
                } else if (!field.placeholder || (!field.placeholder.zh && !field.placeholder.en)) {
                    migratedField.placeholder = {
                        zh: '',
                        en: ''
                    };
                }
                
                // 遷移 options
                if (migratedField.display === undefined) {
                    migratedField.display = field.visible !== false;
                }
                if (migratedField.visible === undefined) {
                    migratedField.visible = migratedField.display !== false;
                }
                // Display 僅輸出文字，不可設為必填、不需 options
                if (migratedField.type === 'display') {
                    migratedField.required = false;
                    delete migratedField.options;
                }
                if (migratedField.confirmEmail === undefined) {
                    migratedField.confirmEmail = false;
                }
                if (migratedField.type !== 'email') {
                    migratedField.confirmEmail = false;
                }
                
                if (field.options && migratedField.type !== 'display') {
                    migratedField.options = field.options.map(option => {
                        const migratedOption = { ...option };
                        
                        if (typeof option.label === 'string') {
                            migratedOption.label = {
                                zh: option.label,
                                en: option.label
                            };
                        } else if (!option.label || (!option.label.zh && !option.label.en)) {
                            migratedOption.label = {
                                zh: option.value || '',
                                en: option.value || ''
                            };
                        }
                        if (migratedOption.isOther === undefined) {
                            migratedOption.isOther = false;
                        }
                        
                        return migratedOption;
                    });
                }
                
                return migratedField;
            });
        }
        
        return migratedSection;
    });
    
    return applyFormConfigMetaDefaults(migratedConfig);
};

function applyFormConfigMetaDefaults(migratedConfig) {
    // 確保有 defaultLanguage
    if (!migratedConfig.defaultLanguage) {
        migratedConfig.defaultLanguage = 'zh';
    }
    if (typeof migratedConfig.languageSwitcherEnabled !== 'boolean') {
        migratedConfig.languageSwitcherEnabled = true;
    }
    if (typeof migratedConfig.customFormEnabled !== 'boolean') {
        migratedConfig.customFormEnabled = false;
    }
    if (typeof migratedConfig.customFormHtml !== 'string') {
        migratedConfig.customFormHtml = migratedConfig.customFormHtml != null
            ? String(migratedConfig.customFormHtml)
            : '';
    }
    if (migratedConfig.registerSlug != null && migratedConfig.registerSlug !== '') {
        migratedConfig.registerSlug = normalizeRegisterSlug(migratedConfig.registerSlug);
    } else {
        delete migratedConfig.registerSlug;
    }

    // 確保有 eventDisplayName
    if (!migratedConfig.eventDisplayName || typeof migratedConfig.eventDisplayName !== 'object') {
        migratedConfig.eventDisplayName = { zh: '', en: '' };
    } else {
        migratedConfig.eventDisplayName.zh = migratedConfig.eventDisplayName.zh || '';
        migratedConfig.eventDisplayName.en = migratedConfig.eventDisplayName.en || '';
    }

    if (!migratedConfig.registerSubHeader || typeof migratedConfig.registerSubHeader !== 'object') {
        migratedConfig.registerSubHeader = { zh: '', en: '' };
    } else {
        migratedConfig.registerSubHeader.zh = migratedConfig.registerSubHeader.zh || '';
        migratedConfig.registerSubHeader.en = migratedConfig.registerSubHeader.en || '';
    }
    if (!migratedConfig.registerSubtitle || typeof migratedConfig.registerSubtitle !== 'object') {
        migratedConfig.registerSubtitle = {
            zh: '請填寫以下資料完成活動報名',
            en: 'Please fill in the following information to complete event registration'
        };
    } else {
        migratedConfig.registerSubtitle.zh = migratedConfig.registerSubtitle.zh || '請填寫以下資料完成活動報名';
        migratedConfig.registerSubtitle.en = migratedConfig.registerSubtitle.en || 'Please fill in the following information to complete event registration';
    }

    // 確保有 terms 設定
    if (!migratedConfig.terms || typeof migratedConfig.terms !== 'object') {
        migratedConfig.terms = {
            enabled: false,
            title: { zh: '條款與細則', en: 'Terms & Conditions' },
            linkLabel: { zh: '(條款)', en: '(terms)' },
            showLinkLabel: true,
            label: {
                zh: '本人已閱讀並同意上述須知，確認繼續預約及積分扣款程序。',
                en: 'I have read and agree to the terms above, and confirm to proceed.'
            },
            content: { zh: '', en: '' }
        };
    } else {
        migratedConfig.terms.enabled = !!migratedConfig.terms.enabled;
        if (!migratedConfig.terms.title || typeof migratedConfig.terms.title !== 'object') {
            migratedConfig.terms.title = { zh: '條款與細則', en: 'Terms & Conditions' };
        } else {
            migratedConfig.terms.title.zh = migratedConfig.terms.title.zh || '條款與細則';
            migratedConfig.terms.title.en = migratedConfig.terms.title.en || 'Terms & Conditions';
        }
        if (!migratedConfig.terms.linkLabel || typeof migratedConfig.terms.linkLabel !== 'object') {
            migratedConfig.terms.linkLabel = { zh: '(條款)', en: '(terms)' };
        } else {
            migratedConfig.terms.linkLabel.zh = migratedConfig.terms.linkLabel.zh || '(條款)';
            migratedConfig.terms.linkLabel.en = migratedConfig.terms.linkLabel.en || '(terms)';
        }
        if (migratedConfig.terms.showLinkLabel === undefined) {
            migratedConfig.terms.showLinkLabel = true;
        } else {
            migratedConfig.terms.showLinkLabel = !!migratedConfig.terms.showLinkLabel;
        }
        if (!migratedConfig.terms.label || typeof migratedConfig.terms.label !== 'object') {
            migratedConfig.terms.label = {
                zh: '本人已閱讀並同意上述須知，確認繼續預約及積分扣款程序。',
                en: 'I have read and agree to the terms above, and confirm to proceed.'
            };
        } else {
            migratedConfig.terms.label.zh = migratedConfig.terms.label.zh || '本人已閱讀並同意上述須知，確認繼續預約及積分扣款程序。';
            migratedConfig.terms.label.en = migratedConfig.terms.label.en || 'I have read and agree to the terms above, and confirm to proceed.';
        }
        if (!migratedConfig.terms.content || typeof migratedConfig.terms.content !== 'object') {
            migratedConfig.terms.content = { zh: '', en: '' };
        } else {
            migratedConfig.terms.content.zh = migratedConfig.terms.content.zh || '';
            migratedConfig.terms.content.en = migratedConfig.terms.content.en || '';
        }
    }

    // 確保有 agreement / agreements（舊單一 agreement 會遷成陣列第一份）
    syncAgreementsOnConfig(migratedConfig);

    // 確保有 thankYou 設定
    const defaultThankYou = {
        title: { zh: '感謝你參加！', en: 'Thank you for participating!' },
        message: { zh: '我們會透過 Email 把資訊發送給你。', en: 'We will send the information to you via Email.' },
        purchaseTitle: { zh: '感謝您的購票！', en: 'Thank you for your purchase!' },
        purchaseMessage: {
            zh: '您的付款已成功，以下是您的交易紀錄：',
            en: 'Your payment was successful. Here are your transaction details:'
        },
        yesNoQuestion: {
            enabled: false,
            question: { zh: '', en: '' },
            yesLabel: { zh: '是', en: 'Yes' },
            noLabel: { zh: '否', en: 'No' },
            yesEmailTemplateId: '',
            noEmailTemplateId: '',
            yesTitle: { zh: '', en: '' },
            yesMessage: { zh: '', en: '' },
            yesPurchaseTitle: { zh: '', en: '' },
            yesPurchaseMessage: { zh: '', en: '' },
            noTitle: { zh: '', en: '' },
            noMessage: { zh: '', en: '' },
            noPurchaseTitle: { zh: '', en: '' },
            noPurchaseMessage: { zh: '', en: '' }
        }
    };
    if (!migratedConfig.thankYou || typeof migratedConfig.thankYou !== 'object') {
        migratedConfig.thankYou = JSON.parse(JSON.stringify(defaultThankYou));
    } else {
        ['title', 'message', 'purchaseTitle', 'purchaseMessage'].forEach((key) => {
            if (!migratedConfig.thankYou[key] || typeof migratedConfig.thankYou[key] !== 'object') {
                migratedConfig.thankYou[key] = { ...defaultThankYou[key] };
            } else {
                migratedConfig.thankYou[key].zh = migratedConfig.thankYou[key].zh || defaultThankYou[key].zh;
                migratedConfig.thankYou[key].en = migratedConfig.thankYou[key].en || defaultThankYou[key].en;
            }
        });
        const defaultYnq = defaultThankYou.yesNoQuestion;
        const ynq = migratedConfig.thankYou.yesNoQuestion;
        if (!ynq || typeof ynq !== 'object') {
            migratedConfig.thankYou.yesNoQuestion = JSON.parse(JSON.stringify(defaultYnq));
        } else {
            const bilingual = (obj) => ({
                zh: (obj && obj.zh) || '',
                en: (obj && obj.en) || ''
            });
            migratedConfig.thankYou.yesNoQuestion = {
                enabled: ynq.enabled === true,
                question: bilingual(ynq.question),
                yesLabel: {
                    zh: (ynq.yesLabel && ynq.yesLabel.zh) || defaultYnq.yesLabel.zh,
                    en: (ynq.yesLabel && ynq.yesLabel.en) || defaultYnq.yesLabel.en
                },
                noLabel: {
                    zh: (ynq.noLabel && ynq.noLabel.zh) || defaultYnq.noLabel.zh,
                    en: (ynq.noLabel && ynq.noLabel.en) || defaultYnq.noLabel.en
                },
                yesEmailTemplateId: ynq.yesEmailTemplateId != null ? String(ynq.yesEmailTemplateId) : '',
                noEmailTemplateId: ynq.noEmailTemplateId != null ? String(ynq.noEmailTemplateId) : '',
                yesTitle: bilingual(ynq.yesTitle),
                yesMessage: bilingual(ynq.yesMessage),
                yesPurchaseTitle: bilingual(ynq.yesPurchaseTitle),
                yesPurchaseMessage: bilingual(ynq.yesPurchaseMessage),
                noTitle: bilingual(ynq.noTitle),
                noMessage: bilingual(ynq.noMessage),
                noPurchaseTitle: bilingual(ynq.noPurchaseTitle),
                noPurchaseMessage: bilingual(ynq.noPurchaseMessage)
            };
        }
    }

    const defaultApplicationCompletedPage = {
        title: { zh: '申請已完成', en: 'Application completed' },
        message: {
            zh: '您已完成申請，此連結不可再次修改。',
            en: 'You have already completed this application. This link cannot be used to make further changes.'
        }
    };
    if (!migratedConfig.applicationCompletedPage || typeof migratedConfig.applicationCompletedPage !== 'object') {
        migratedConfig.applicationCompletedPage = JSON.parse(JSON.stringify(defaultApplicationCompletedPage));
    } else {
        ['title', 'message'].forEach((key) => {
            if (!migratedConfig.applicationCompletedPage[key] || typeof migratedConfig.applicationCompletedPage[key] !== 'object') {
                migratedConfig.applicationCompletedPage[key] = { ...defaultApplicationCompletedPage[key] };
            } else {
                migratedConfig.applicationCompletedPage[key].zh = migratedConfig.applicationCompletedPage[key].zh || defaultApplicationCompletedPage[key].zh;
                migratedConfig.applicationCompletedPage[key].en = migratedConfig.applicationCompletedPage[key].en || defaultApplicationCompletedPage[key].en;
            }
        });
    }

    migratedConfig.paymentTicketUi = normalizePaymentTicketUi(migratedConfig.paymentTicketUi);
    
    return migratedConfig;
}

/** 供 EJS / API 使用：plain object + 預設欄位 */
exports.getFormConfigForRender = (formConfigDoc) => {
    if (!formConfigDoc) return null;
    return migrateFormConfig(formConfigDoc);
};

// 預設表單配置
exports.getDefaultFormConfig = () => ({
    defaultLanguage: 'zh',
    languageSwitcherEnabled: true,
    registerPageEnabled: true,
    registerClosedMessage: '',
    eventDisplayName: { zh: '', en: '' },
    registerSubHeader: { zh: '', en: '' },
    registerSubtitle: {
        zh: '請填寫以下資料完成活動報名',
        en: 'Please fill in the following information to complete event registration'
    },
    terms: {
        enabled: false,
        title: { zh: '條款與細則', en: 'Terms & Conditions' },
        linkLabel: { zh: '(條款)', en: '(terms)' },
        showLinkLabel: true,
        label: {
            zh: '本人已閱讀並同意上述須知，確認繼續預約及積分扣款程序。',
            en: 'I have read and agree to the terms above, and confirm to proceed.'
        },
        content: { zh: '', en: '' }
    },
    agreement: cloneDefaultAgreement(),
    agreements: [cloneDefaultAgreement()],
    thankYou: {
        title: { zh: '感謝你參加！', en: 'Thank you for participating!' },
        message: { zh: '我們會透過 Email 把資訊發送給你。', en: 'We will send the information to you via Email.' },
        purchaseTitle: { zh: '感謝您的購票！', en: 'Thank you for your purchase!' },
        purchaseMessage: {
            zh: '您的付款已成功，以下是您的交易紀錄：',
            en: 'Your payment was successful. Here are your transaction details:'
        },
        yesNoQuestion: {
            enabled: false,
            question: { zh: '', en: '' },
            yesLabel: { zh: '是', en: 'Yes' },
            noLabel: { zh: '否', en: 'No' },
            yesEmailTemplateId: '',
            noEmailTemplateId: '',
            yesTitle: { zh: '', en: '' },
            yesMessage: { zh: '', en: '' },
            yesPurchaseTitle: { zh: '', en: '' },
            yesPurchaseMessage: { zh: '', en: '' },
            noTitle: { zh: '', en: '' },
            noMessage: { zh: '', en: '' },
            noPurchaseTitle: { zh: '', en: '' },
            noPurchaseMessage: { zh: '', en: '' }
        }
    },
    applicationCompletedPage: {
        title: { zh: '申請已完成', en: 'Application completed' },
        message: {
            zh: '您已完成申請，此連結不可再次修改。',
            en: 'You have already completed this application. This link cannot be used to make further changes.'
        }
    },
    customFormEnabled: false,
    customFormHtml: '',
    paymentTicketUi: normalizePaymentTicketUi(),
    sections: [
        {
            sectionName: 'contact_info',
            sectionTitle: {
                zh: '聯絡人資料',
                en: 'Contact Information'
            },
            visible: true,
            order: 1,
            fields: [
                {
                    fieldName: 'email',
                    label: {
                        zh: '電子郵件',
                        en: 'Email'
                    },
                    type: 'email',
                    required: true,
                    display: true,
                    visible: true,
                    placeholder: {
                        zh: '例如：peterwong@abccompany.com',
                        en: 'e.g. peterwong@abccompany.com'
                    },
                    order: 1
                },
                {
                    fieldName: 'name',
                    label: {
                        zh: '姓名',
                        en: 'Name'
                    },
                    type: 'text',
                    required: true,
                    display: true,
                    visible: true,
                    placeholder: {
                        zh: '例如：王小明',
                        en: 'e.g. John Doe'
                    },
                    order: 2
                },
                {
                    fieldName: 'phone_code',
                    label: {
                        zh: '電話區號',
                        en: 'Phone Code'
                    },
                    type: 'select',
                    required: true,
                    display: true,
                    visible: true,
                    order: 3,
                    options: [
                        { value: '+852', label: { zh: '香港 (+852)', en: 'Hong Kong (+852)' } },
                        { value: '+1', label: { zh: '加拿大 (+1)', en: 'Canada (+1)' } },
                        { value: '+86', label: { zh: '中國 (+86)', en: 'China (+86)' } },
                        { value: '+81', label: { zh: '日本 (+81)', en: 'Japan (+81)' } },
                        { value: '+82', label: { zh: '韓國 (+82)', en: 'South Korea (+82)' } },
                        { value: '+65', label: { zh: '新加坡 (+65)', en: 'Singapore (+65)' } },
                        { value: '+60', label: { zh: '馬來西亞 (+60)', en: 'Malaysia (+60)' } },
                        { value: '+63', label: { zh: '菲律賓 (+63)', en: 'Philippines (+63)' } },
                        { value: '+84', label: { zh: '越南 (+84)', en: 'Vietnam (+84)' } },
                        { value: '+66', label: { zh: '泰國 (+66)', en: 'Thailand (+66)' } }
                    ]
                },
                {
                    fieldName: 'phone',
                    label: {
                        zh: '電話號碼',
                        en: 'Phone Number'
                    },
                    type: 'tel',
                    required: true,
                    display: true,
                    visible: true,
                    placeholder: {
                        zh: '例如：區號 - 電話號碼',
                        en: 'e.g. 1234-5678'
                    },
                    order: 4
                },
                {
                    fieldName: 'saluation',
                    label: {
                        zh: '稱謂',
                        en: 'Salutation'
                    },
                    type: 'select',
                    required: true,
                    display: true,
                    visible: true,
                    order: 5,
                    options: [
                        { value: 'Mr.', label: { zh: 'Mr.', en: 'Mr.' } },
                        { value: 'Ms.', label: { zh: 'Ms.', en: 'Ms.' } },
                        { value: 'Mrs.', label: { zh: 'Mrs.', en: 'Mrs.' } },
                        { value: 'Dr.', label: { zh: 'Dr.', en: 'Dr.' } },
                        { value: 'Prof.', label: { zh: 'Prof.', en: 'Prof.' } }
                    ]
                },
                {
                    fieldName: 'company',
                    label: {
                        zh: '公司名稱',
                        en: 'Company Name'
                    },
                    type: 'text',
                    required: true,
                    display: true,
                    visible: true,
                    placeholder: {
                        zh: '例如：ABC 公司',
                        en: 'e.g. ABC Company'
                    },
                    order: 6
                },
                {
                    fieldName: 'role',
                    label: {
                        zh: '職位',
                        en: 'Position'
                    },
                    type: 'text',
                    required: true,
                    display: true,
                    visible: true,
                    placeholder: {
                        zh: '例如：資深經理',
                        en: 'e.g. Senior Manager'
                    },
                    order: 7
                },
                {
                    fieldName: 'industry',
                    label: {
                        zh: '行業',
                        en: 'Industry'
                    },
                    type: 'select',
                    required: false,
                    display: true,
                    visible: true,
                    order: 8,
                    options: [
                        { value: '科技', label: { zh: '科技', en: 'Technology' } },
                        { value: '金融', label: { zh: '金融', en: 'Finance' } },
                        { value: '教育', label: { zh: '教育', en: 'Education' } },
                        { value: '醫療', label: { zh: '醫療', en: 'Healthcare' } },
                        { value: '零售', label: { zh: '零售', en: 'Retail' } },
                        { value: '其他', label: { zh: '其他', en: 'Other' } }
                    ]
                },
                {
                    fieldName: 'transport',
                    label: {
                        zh: '交通方式',
                        en: 'Transportation'
                    },
                    type: 'select',
                    required: false,
                    display: true,
                    visible: true,
                    order: 9,
                    options: [
                        { value: '地鐵', label: { zh: '地鐵', en: 'MTR' } },
                        { value: '巴士', label: { zh: '巴士', en: 'Bus' } },
                        { value: '計程車', label: { zh: '計程車', en: 'Taxi' } },
                        { value: '自駕', label: { zh: '自駕', en: 'Private Car' } },
                        { value: '其他', label: { zh: '其他', en: 'Other' } }
                    ]
                },
                {
                    fieldName: 'meal',
                    label: {
                        zh: '餐飲選擇',
                        en: 'Dietary Preference'
                    },
                    type: 'select',
                    required: false,
                    display: true,
                    visible: true,
                    order: 10,
                    options: [
                        { value: '葷食', label: { zh: '葷食', en: 'Non-vegetarian' } },
                        { value: '素食', label: { zh: '素食', en: 'Vegetarian' } },
                        { value: '清真', label: { zh: '清真', en: 'Halal' } },
                        { value: '無特殊要求', label: { zh: '無特殊要求', en: 'No special requirements' } }
                    ]
                },
                {
                    fieldName: 'remarks',
                    label: {
                        zh: '備註',
                        en: 'Remarks'
                    },
                    type: 'textarea',
                    required: false,
                    display: true,
                    visible: true,
                    placeholder: {
                        zh: '請輸入任何特殊需求或備註',
                        en: 'Please enter any special requirements or remarks'
                    },
                    order: 11
                }
            ]
        }
    ]
});

// 獲取事件的表單配置
exports.getFormConfig = async (req, res) => {
    try {
        const { eventId } = req.params;
        
        let formConfig = await FormConfig.findOne({ eventId });
        
        // 如果沒有配置，創建預設配置
        if (!formConfig) {
            formConfig = new FormConfig({
                eventId: eventId,
                ...getDefaultFormConfig()
            });
            await formConfig.save();
        } else {
            // 檢查是否需要數據遷移
            const migratedConfig = migrateFormConfig(formConfig);
            
            // 如果數據有變化，保存遷移後的數據
            if (JSON.stringify(migratedConfig) !== JSON.stringify(formConfig)) {
                Object.assign(formConfig, migratedConfig);
                await formConfig.save();
                console.log('FormConfig 數據已遷移');
            }
        }
        
        res.json({
            success: true,
            formConfig: formConfig
        });
        
    } catch (error) {
        console.error('獲取表單配置錯誤:', error);
        res.status(500).json({
            success: false,
            message: '獲取表單配置失敗'
        });
    }
};

// 更新事件的表單配置
exports.updateFormConfig = async (req, res) => {
    try {
        const { eventId } = req.params;
        const { sections, defaultLanguage, languageSwitcherEnabled, registerPageEnabled, registerClosedMessage, registerSlug, terms, agreement, agreements, thankYou, applicationCompletedPage, eventDisplayName, registerSubHeader, registerSubtitle, paymentTicketUi, customFormEnabled, customFormHtml } = req.body;
        
        // 驗證事件是否存在
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({
                success: false,
                message: '找不到該事件'
            });
        }
        
        let formConfig = await FormConfig.findOne({ eventId });
        
        if (formConfig) {
            // 更新現有配置，先進行數據遷移
            const migratedSections = migrateFormConfig({ sections: sections || formConfig.sections }).sections;
            formConfig.sections = migratedSections;
            if (defaultLanguage) {
                formConfig.defaultLanguage = defaultLanguage;
            }
            if ('languageSwitcherEnabled' in req.body) {
                formConfig.languageSwitcherEnabled = languageSwitcherEnabled === true;
            }
            if (typeof registerPageEnabled === 'boolean') {
                formConfig.registerPageEnabled = registerPageEnabled;
            }
            if (typeof registerClosedMessage === 'string') {
                formConfig.registerClosedMessage = registerClosedMessage;
            }
            const slugResult = await applyRegisterSlugToFormConfig(formConfig, registerSlug, eventId);
            if (!slugResult.ok) {
                return res.status(400).json({ success: false, message: slugResult.message });
            }
            if (eventDisplayName && typeof eventDisplayName === 'object') {
                const migrated = migrateFormConfig({ sections: formConfig.sections, eventDisplayName });
                formConfig.eventDisplayName = migrated.eventDisplayName;
            }
            if (registerSubHeader && typeof registerSubHeader === 'object') {
                const migrated = migrateFormConfig({ sections: formConfig.sections, registerSubHeader });
                formConfig.registerSubHeader = migrated.registerSubHeader;
            }
            if (registerSubtitle && typeof registerSubtitle === 'object') {
                const migrated = migrateFormConfig({ sections: formConfig.sections, registerSubtitle });
                formConfig.registerSubtitle = migrated.registerSubtitle;
            }
            if (terms && typeof terms === 'object') {
                const migrated = migrateFormConfig({ sections: formConfig.sections, terms });
                formConfig.terms = migrated.terms;
            }
            if ((Array.isArray(agreements) && agreements.length) || (agreement && typeof agreement === 'object')) {
                const migrated = migrateFormConfig({
                    sections: formConfig.sections,
                    agreements: Array.isArray(agreements) && agreements.length ? agreements : [agreement],
                    agreement: Array.isArray(agreements) && agreements.length ? agreements[0] : agreement
                });
                formConfig.agreements = migrated.agreements;
                formConfig.agreement = migrated.agreement;
            }
            if (thankYou && typeof thankYou === 'object') {
                const migrated = migrateFormConfig({ sections: formConfig.sections, thankYou });
                formConfig.thankYou = migrated.thankYou;
            }
            if (applicationCompletedPage && typeof applicationCompletedPage === 'object') {
                const migrated = migrateFormConfig({ sections: formConfig.sections, applicationCompletedPage });
                formConfig.applicationCompletedPage = migrated.applicationCompletedPage;
            }
            if (paymentTicketUi && typeof paymentTicketUi === 'object') {
                formConfig.paymentTicketUi = normalizePaymentTicketUi(paymentTicketUi);
            }
            if (typeof customFormEnabled === 'boolean') {
                formConfig.customFormEnabled = customFormEnabled;
            }
            if (typeof customFormHtml === 'string') {
                formConfig.customFormHtml = customFormHtml;
            }
            await formConfig.save();
            if (slugResult.unset && formConfig._id) {
                await FormConfig.updateOne({ _id: formConfig._id }, { $unset: { registerSlug: 1 } });
            }
        } else {
            // 創建新配置
            const defaultConfig = getDefaultFormConfig();
            formConfig = new FormConfig({
                eventId: eventId,
                sections: sections || defaultConfig.sections,
                defaultLanguage: defaultLanguage || defaultConfig.defaultLanguage,
                languageSwitcherEnabled: typeof languageSwitcherEnabled === 'boolean' ? languageSwitcherEnabled : defaultConfig.languageSwitcherEnabled,
                registerPageEnabled: typeof registerPageEnabled === 'boolean' ? registerPageEnabled : defaultConfig.registerPageEnabled,
                registerClosedMessage: typeof registerClosedMessage === 'string' ? registerClosedMessage : (defaultConfig.registerClosedMessage || ''),
                eventDisplayName: eventDisplayName && typeof eventDisplayName === 'object'
                    ? migrateFormConfig({ sections: (sections || defaultConfig.sections), eventDisplayName }).eventDisplayName
                    : defaultConfig.eventDisplayName,
                registerSubHeader: registerSubHeader && typeof registerSubHeader === 'object'
                    ? migrateFormConfig({ sections: (sections || defaultConfig.sections), registerSubHeader }).registerSubHeader
                    : defaultConfig.registerSubHeader,
                registerSubtitle: registerSubtitle && typeof registerSubtitle === 'object'
                    ? migrateFormConfig({ sections: (sections || defaultConfig.sections), registerSubtitle }).registerSubtitle
                    : defaultConfig.registerSubtitle,
                terms: terms && typeof terms === 'object'
                    ? migrateFormConfig({ sections: (sections || defaultConfig.sections), terms }).terms
                    : defaultConfig.terms,
                agreement: defaultConfig.agreement,
                agreements: defaultConfig.agreements,
                thankYou: thankYou && typeof thankYou === 'object'
                    ? migrateFormConfig({ sections: (sections || defaultConfig.sections), thankYou }).thankYou
                    : defaultConfig.thankYou,
                applicationCompletedPage: applicationCompletedPage && typeof applicationCompletedPage === 'object'
                    ? migrateFormConfig({ sections: (sections || defaultConfig.sections), applicationCompletedPage }).applicationCompletedPage
                    : defaultConfig.applicationCompletedPage,
                customFormEnabled: typeof customFormEnabled === 'boolean' ? customFormEnabled : defaultConfig.customFormEnabled,
                customFormHtml: typeof customFormHtml === 'string' ? customFormHtml : defaultConfig.customFormHtml,
                paymentTicketUi: paymentTicketUi && typeof paymentTicketUi === 'object'
                    ? normalizePaymentTicketUi(paymentTicketUi)
                    : defaultConfig.paymentTicketUi
            });
            if ((Array.isArray(agreements) && agreements.length) || (agreement && typeof agreement === 'object')) {
                const migrated = migrateFormConfig({
                    sections: formConfig.sections,
                    agreements: Array.isArray(agreements) && agreements.length ? agreements : [agreement],
                    agreement: Array.isArray(agreements) && agreements.length ? agreements[0] : agreement
                });
                formConfig.agreements = migrated.agreements;
                formConfig.agreement = migrated.agreement;
            }
            const slugResult = await applyRegisterSlugToFormConfig(formConfig, registerSlug, eventId);
            if (!slugResult.ok) {
                return res.status(400).json({ success: false, message: slugResult.message });
            }
            if (slugResult.unset) {
                formConfig.registerSlug = undefined;
            }
            await formConfig.save();
            if (slugResult.unset && formConfig._id) {
                await FormConfig.updateOne({ _id: formConfig._id }, { $unset: { registerSlug: 1 } });
            }
        }
        
        const savedConfig = await FormConfig.findOne({ eventId });
        
        res.json({
            success: true,
            message: '表單配置已更新',
            formConfig: savedConfig
        });
        
    } catch (error) {
        console.error('更新表單配置錯誤:', error);
        if (error && error.code === 11000 && error.keyPattern && error.keyPattern.registerSlug) {
            return res.status(400).json({
                success: false,
                message: '此 slug 已被其他活動使用'
            });
        }
        res.status(500).json({
            success: false,
            message: '更新表單配置失敗'
        });
    }
};

// 重置為預設配置
exports.resetToDefault = async (req, res) => {
    try {
        const { eventId } = req.params;
        
        const formConfig = await FormConfig.findOneAndUpdate(
            { eventId },
            {
                eventId: eventId,
                ...getDefaultFormConfig()
            },
            { upsert: true, new: true }
        );
        
        res.json({
            success: true,
            message: '已重置為預設表單配置',
            formConfig: formConfig
        });
        
    } catch (error) {
        console.error('重置表單配置錯誤:', error);
        res.status(500).json({
            success: false,
            message: '重置表單配置失敗'
        });
    }
};

/**
 * 用 sample user / template JSON 更新 FormConfig.sections fields
 * Body: { sampleUser?, fields?, mode? } 或直接把整份 sponsorship-custom-form.json 放喺 sampleUser / 根
 */
exports.syncFieldsFromUserSample = async (req, res) => {
    try {
        const { eventId } = req.params;
        const mode = (req.body && req.body.mode) === 'merge' ? 'merge' : 'replace';
        const body = req.body || {};

        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).json({ success: false, message: '找不到該事件' });
        }

        const {
            resolveFieldsFromSyncPayload,
            applyFieldsToSections
        } = require('../utils/syncFormFieldsFromUserSample');

        // 相容：前端可能把成份 JSON 放喺 sampleUser，或放喺根
        const payload = (body.sampleUser && typeof body.sampleUser === 'object')
            ? body.sampleUser
            : body;
        const built = resolveFieldsFromSyncPayload(payload);
        if (!built.ok) {
            return res.status(400).json({ success: false, message: built.message });
        }

        let formConfig = await FormConfig.findOne({ eventId });
        if (!formConfig) {
            formConfig = new FormConfig({
                eventId,
                ...getDefaultFormConfig()
            });
        }

        formConfig.sections = applyFieldsToSections(formConfig.sections, built.fields, mode);
        await formConfig.save();

        const saved = await FormConfig.findOne({ eventId });
        return res.json({
            success: true,
            message: mode === 'merge'
                ? `已合併 ${built.fields.length} 個欄位（來源：${built.source}）`
                : `已取代 FormConfig 欄位 ${built.fields.length} 個（來源：${built.source}）`,
            mode,
            source: built.source,
            fieldNames: built.fields.map((f) => f.fieldName),
            formConfig: exports.getFormConfigForRender(saved)
        });
    } catch (error) {
        console.error('syncFieldsFromUserSample error:', error);
        return res.status(500).json({
            success: false,
            message: '同步欄位失敗'
        });
    }
};

// 渲染表單配置管理頁面
exports.renderFormConfigPage = async (req, res) => {
    try {
        const { eventId } = req.params;
        
        // 獲取事件信息
        const event = await Event.findById(eventId);
        if (!event) {
            return res.status(404).send('找不到該事件');
        }
        
        // 獲取表單配置
        let formConfig = await FormConfig.findOne({ eventId });
        if (!formConfig) {
            formConfig = new FormConfig({
                eventId: eventId,
                ...getDefaultFormConfig()
            });
            await formConfig.save();
        }

        const formConfigForView = exports.getFormConfigForRender(formConfig);
        
        const { getCurrentBannerPreviewUrl } = require('../utils/bannerCache');
        const currentBanner = getCurrentBannerPreviewUrl(eventId);

        const EmailTemplate = require('../model/EmailTemplate');
        const emailTemplates = await EmailTemplate.find({
            $or: [{ eventId: eventId }, { eventId: null }]
        }).select('_id type subject eventId').sort({ type: 1, subject: 1 }).lean();

        res.render('admin/form_config', { 
            event: event, 
            formConfig: formConfigForView,
            currentBanner,
            emailTemplates,
            publicDomain: (process.env.DOMAIN || '').replace(/\/$/, '')
        });
        
    } catch (error) {
        console.error('渲染表單配置頁面錯誤:', error);
        res.status(500).send('載入表單配置頁面失敗');
    }
};

// 導出函數
module.exports = {
    getFormConfig: exports.getFormConfig,
    updateFormConfig: exports.updateFormConfig,
    renderFormConfigPage: exports.renderFormConfigPage,
    resetToDefault: exports.resetToDefault,
    syncFieldsFromUserSample: exports.syncFieldsFromUserSample,
    getDefaultFormConfig: exports.getDefaultFormConfig,
    getFormConfigForRender: exports.getFormConfigForRender,
    migrateFormConfig
};

