const FormConfig = require('../model/FormConfig');
const Event = require('../model/Event');

// 預設表單配置
const getDefaultFormConfig = () => ({
    sections: [
        {
            sectionName: 'contact_info',
            sectionTitle: '聯絡人資料',
            visible: true,
            order: 1,
            fields: [
                {
                    fieldName: 'email',
                    label: '電子郵件',
                    type: 'email',
                    required: true,
                    visible: true,
                    placeholder: '例如：peterwong@abccompany.com',
                    order: 1
                },
                {
                    fieldName: 'name',
                    label: '姓名',
                    type: 'text',
                    required: true,
                    visible: true,
                    placeholder: '例如：王小明',
                    order: 2
                },
                {
                    fieldName: 'phone_code',
                    label: '電話區號',
                    type: 'select',
                    required: true,
                    visible: true,
                    order: 3,
                    options: [
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
                    ]
                },
                {
                    fieldName: 'phone',
                    label: '電話號碼',
                    type: 'tel',
                    required: true,
                    visible: true,
                    placeholder: '例如：區號 - 電話號碼',
                    order: 4
                },
                {
                    fieldName: 'saluation',
                    label: '稱謂',
                    type: 'select',
                    required: true,
                    visible: true,
                    order: 5,
                    options: [
                        { value: 'Mr.', label: 'Mr.' },
                        { value: 'Ms.', label: 'Ms.' },
                        { value: 'Mrs.', label: 'Mrs.' },
                        { value: 'Dr.', label: 'Dr.' },
                        { value: 'Prof.', label: 'Prof.' }
                    ]
                },
                {
                    fieldName: 'company',
                    label: '公司名稱',
                    type: 'text',
                    required: true,
                    visible: true,
                    placeholder: '例如：ABC 公司',
                    order: 6
                },
                {
                    fieldName: 'role',
                    label: '職位',
                    type: 'text',
                    required: true,
                    visible: true,
                    placeholder: '例如：資深經理',
                    order: 7
                },
                {
                    fieldName: 'industry',
                    label: '行業',
                    type: 'select',
                    required: false,
                    visible: true,
                    order: 8,
                    options: [
                        { value: '科技', label: '科技' },
                        { value: '金融', label: '金融' },
                        { value: '教育', label: '教育' },
                        { value: '醫療', label: '醫療' },
                        { value: '零售', label: '零售' },
                        { value: '其他', label: '其他' }
                    ]
                },
                {
                    fieldName: 'transport',
                    label: '交通方式',
                    type: 'select',
                    required: false,
                    visible: true,
                    order: 9,
                    options: [
                        { value: '地鐵', label: '地鐵' },
                        { value: '巴士', label: '巴士' },
                        { value: '計程車', label: '計程車' },
                        { value: '自駕', label: '自駕' },
                        { value: '其他', label: '其他' }
                    ]
                },
                {
                    fieldName: 'meal',
                    label: '餐飲選擇',
                    type: 'select',
                    required: false,
                    visible: true,
                    order: 10,
                    options: [
                        { value: '葷食', label: '葷食' },
                        { value: '素食', label: '素食' },
                        { value: '清真', label: '清真' },
                        { value: '無特殊要求', label: '無特殊要求' }
                    ]
                },
                {
                    fieldName: 'remarks',
                    label: '備註',
                    type: 'textarea',
                    required: false,
                    visible: true,
                    placeholder: '請輸入任何特殊需求或備註',
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
        const { sections } = req.body;
        
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
            // 更新現有配置
            formConfig.sections = sections;
            await formConfig.save();
        } else {
            // 創建新配置
            formConfig = new FormConfig({
                eventId: eventId,
                sections: sections
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

