const FormConfig = require('../model/FormConfig');
const Event = require('../model/Event');

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
    
    return migratedConfig;
};

// 預設表單配置
exports.getDefaultFormConfig = () => ({
    defaultLanguage: 'zh',
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
        const { sections, defaultLanguage } = req.body;
        
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
            await formConfig.save();
        } else {
            // 創建新配置
            const defaultConfig = getDefaultFormConfig();
            formConfig = new FormConfig({
                eventId: eventId,
                sections: sections || defaultConfig.sections,
                defaultLanguage: defaultLanguage || defaultConfig.defaultLanguage
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
        }
        
        res.render('admin/form_config', { 
            event: event, 
            formConfig: formConfig 
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

