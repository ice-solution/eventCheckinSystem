const FormConfig = require('../model/FormConfig');
const Event = require('../model/Event');
const { normalizePaymentTicketUi } = require('../utils/paymentTicket');

// 數據遷移函數：將舊格式轉換為新格式
const migrateFormConfig = (formConfig) => {
    if (!formConfig || !formConfig.sections) return formConfig;
    
    const migratedConfig = { ...formConfig };
    
    migratedConfig.sections = formConfig.sections.map(section => {
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
                
                if (field.options) {
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
    
    // 確保有 defaultLanguage
    if (!migratedConfig.defaultLanguage) {
        migratedConfig.defaultLanguage = 'zh';
    }
    if (typeof migratedConfig.languageSwitcherEnabled !== 'boolean') {
        migratedConfig.languageSwitcherEnabled = true;
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
            label: {
                zh: '本人已閱讀並同意上述須知，確認繼續預約及積分扣款程序。',
                en: 'I have read and agree to the terms above, and confirm to proceed.'
            },
            content: { zh: '', en: '' }
        };
    } else {
        migratedConfig.terms.enabled = !!migratedConfig.terms.enabled;
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

    // 確保有 agreement 設定
    if (!migratedConfig.agreement || typeof migratedConfig.agreement !== 'object') {
        migratedConfig.agreement = {
            enabled: false,
            label: {
                zh: '本人已閱讀並同意上述協議內容。',
                en: 'I have read and agree to the agreement above.'
            },
            content: { zh: '', en: '' }
        };
    } else {
        migratedConfig.agreement.enabled = !!migratedConfig.agreement.enabled;
        if (!migratedConfig.agreement.label || typeof migratedConfig.agreement.label !== 'object') {
            migratedConfig.agreement.label = {
                zh: '本人已閱讀並同意上述協議內容。',
                en: 'I have read and agree to the agreement above.'
            };
        } else {
            migratedConfig.agreement.label.zh = migratedConfig.agreement.label.zh || '本人已閱讀並同意上述協議內容。';
            migratedConfig.agreement.label.en = migratedConfig.agreement.label.en || 'I have read and agree to the agreement above.';
        }
        if (!migratedConfig.agreement.content || typeof migratedConfig.agreement.content !== 'object') {
            migratedConfig.agreement.content = { zh: '', en: '' };
        } else {
            migratedConfig.agreement.content.zh = migratedConfig.agreement.content.zh || '';
            migratedConfig.agreement.content.en = migratedConfig.agreement.content.en || '';
        }
    }

    migratedConfig.paymentTicketUi = normalizePaymentTicketUi(migratedConfig.paymentTicketUi);
    
    return migratedConfig;
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
        label: {
            zh: '本人已閱讀並同意上述須知，確認繼續預約及積分扣款程序。',
            en: 'I have read and agree to the terms above, and confirm to proceed.'
        },
        content: { zh: '', en: '' }
    },
    agreement: {
        enabled: false,
        label: {
            zh: '本人已閱讀並同意上述協議內容。',
            en: 'I have read and agree to the agreement above.'
        },
        content: { zh: '', en: '' }
    },
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
        const { sections, defaultLanguage, languageSwitcherEnabled, registerPageEnabled, registerClosedMessage, terms, agreement, eventDisplayName, registerSubHeader, registerSubtitle, paymentTicketUi } = req.body;
        
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
            const migratedSections = migrateFormConfig({ sections }).sections;
            formConfig.sections = migratedSections;
            if (defaultLanguage) {
                formConfig.defaultLanguage = defaultLanguage;
            }
            if (typeof languageSwitcherEnabled === 'boolean') {
                formConfig.languageSwitcherEnabled = languageSwitcherEnabled;
            }
            if (typeof registerPageEnabled === 'boolean') {
                formConfig.registerPageEnabled = registerPageEnabled;
            }
            if (typeof registerClosedMessage === 'string') {
                formConfig.registerClosedMessage = registerClosedMessage;
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
            if (agreement && typeof agreement === 'object') {
                const migrated = migrateFormConfig({ sections: formConfig.sections, agreement });
                formConfig.agreement = migrated.agreement;
            }
            if (paymentTicketUi && typeof paymentTicketUi === 'object') {
                formConfig.paymentTicketUi = normalizePaymentTicketUi(paymentTicketUi);
            }
            await formConfig.save();
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
                agreement: agreement && typeof agreement === 'object'
                    ? migrateFormConfig({ sections: (sections || defaultConfig.sections), agreement }).agreement
                    : defaultConfig.agreement,
                paymentTicketUi: paymentTicketUi && typeof paymentTicketUi === 'object'
                    ? normalizePaymentTicketUi(paymentTicketUi)
                    : defaultConfig.paymentTicketUi
            });
            await formConfig.save();
        }
        
        res.json({
            success: true,
            message: '表單配置已更新',
            formConfig: formConfig
        });
        
    } catch (error) {
        console.error('更新表單配置錯誤:', error);
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
        } else {
            const migratedConfig = migrateFormConfig(formConfig);
            const needsDisplayMigration = formConfig.sections && formConfig.sections.some(sec =>
                (sec.fields || []).some(f => f.display === undefined)
            );
            if (needsDisplayMigration) {
                Object.assign(formConfig, migratedConfig);
                await formConfig.save();
            }
        }
        
        const { getCurrentBannerPreviewUrl } = require('../utils/bannerCache');
        const currentBanner = getCurrentBannerPreviewUrl(eventId);

        res.render('admin/form_config', { 
            event: event, 
            formConfig: formConfig,
            currentBanner
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
    getDefaultFormConfig: exports.getDefaultFormConfig,
    migrateFormConfig
};

