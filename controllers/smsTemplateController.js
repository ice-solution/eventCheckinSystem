const SmsTemplate = require("../model/SmsTemplate");
const FormConfig = require("../model/FormConfig");
const formConfigController = require("./formConfigController");

// 獲取 SMS 模板列表
exports.renderSmsTemplateList = async (req, res) => {
    try {
        const { eventId } = req.params;
        const smsTemplates = await SmsTemplate.find(eventId ? { eventId } : {});
        res.render("admin/sms_template_list", { smsTemplates, eventId });
    } catch (error) {
        console.error("Error fetching SMS templates:", error);
        res.status(500).json({ message: "Error fetching SMS templates" });
    }
};

// 渲染 SMS 模板詳情頁面
exports.renderSmsTemplateDetail = async (req, res) => {
    const { eventId, id } = req.params;

    try {
        const template = await SmsTemplate.findById(id);
        if (!template) {
            return res.status(404).send("SMS 模板未找到！");
        }
        let formConfig = eventId ? await FormConfig.findOne({ eventId }) : null;
        if (!formConfig) {
            formConfig = { sections: formConfigController.getDefaultFormConfig().sections || [] };
        }
        res.render("admin/sms_template_detail", { template, eventId, formConfig: formConfig || { sections: [] } });
    } catch (error) {
        console.error("Error fetching SMS template:", error);
        res.status(500).send("獲取 SMS 模板時出現錯誤！");
    }
};

// 渲染創建 SMS 模板頁面
exports.renderCreateSmsTemplatePage = async (req, res) => {
    try {
        const { eventId } = req.params;
        let formConfig = eventId ? await FormConfig.findOne({ eventId }) : null;
        if (!formConfig) {
            formConfig = { sections: formConfigController.getDefaultFormConfig().sections || [] };
        }
        res.render("admin/create_sms_template", { eventId, formConfig: formConfig || { sections: [] } });
    } catch (error) {
        console.error("Error rendering create SMS template page:", error);
        res.status(500).json({ message: "Error rendering create SMS template page" });
    }
};

// 更新 SMS 模板
exports.updateSmsTemplate = async (req, res) => {
    const { id } = req.params;
    const { type, content } = req.body;
    try {
        const updatedTemplate = await SmsTemplate.findByIdAndUpdate(
            id,
            { type, content, modified_at: Date.now() },
            { new: true }
        );

        if (!updatedTemplate) {
            return res.status(404).send("SMS 模板未找到！");
        }

        res.status(200).send("SMS 模板更新成功！");
    } catch (error) {
        console.error("Error updating SMS template:", error);
        res.status(500).send("更新 SMS 模板時出現錯誤！");
    }
};

// 創建 SMS 模板
exports.createSmsTemplate = async (req, res) => {
    const { eventId } = req.params;
    const { type, content } = req.body;

    try {
        // 檢查是否已存在相同類型的模板
        const existingTemplate = await SmsTemplate.findOne({ eventId, type });
        if (existingTemplate) {
            return res.status(400).json({ message: "該類型的 SMS 模板已存在！" });
        }

        const newTemplate = new SmsTemplate({
            eventId: eventId || null,
            type: type || "welcome",
            content: content || ""
        });

        await newTemplate.save();
        res.status(201).json({ message: "SMS 模板創建成功！", template: newTemplate });
    } catch (error) {
        console.error("Error creating SMS template:", error);
        res.status(500).json({ message: "創建 SMS 模板時出現錯誤！" });
    }
};

// 刪除 SMS 模板
exports.deleteSmsTemplate = async (req, res) => {
    const { id } = req.params;

    try {
        const template = await SmsTemplate.findByIdAndDelete(id);
        if (!template) {
            return res.status(404).json({ message: "SMS 模板未找到！" });
        }

        res.status(200).json({ message: "SMS 模板刪除成功！" });
    } catch (error) {
        console.error("Error deleting SMS template:", error);
        res.status(500).json({ message: "刪除 SMS 模板時出現錯誤！" });
    }
};

// 獲取 SMS 模板列表 (API)
exports.getSmsTemplates = async (req, res) => {
    try {
        const { eventId } = req.params;
        // 同時查詢該事件的模板和全局模板（eventId 為 null）
        const query = eventId 
            ? { $or: [{ eventId: eventId }, { eventId: null }] }
            : {};
        const smsTemplates = await SmsTemplate.find(query).sort({ eventId: 1, type: 1 }); // 先顯示事件特定模板，再顯示全局模板
        res.json(smsTemplates);
    } catch (error) {
        console.error("Error fetching SMS templates:", error);
        res.status(500).json({ message: "Error fetching SMS templates" });
    }
};

