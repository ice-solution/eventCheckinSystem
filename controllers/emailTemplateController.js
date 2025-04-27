const EmailTemplate = require("../model/EmailTemplate")

exports.renderEmailTemplateList = async (req, res) => {
  try {
      const emailTemplates = await EmailTemplate.find(); 
      res.render('admin/email_template_list', { emailTemplates }); 
  } catch (error) {
      console.error('Error fetching events:', error);
      res.status(500).json({ message: 'Error fetching emailTemplates' });
  }
};

exports.renderEmailTemplateDetail = async (req, res) => {
  const { id } = req.params

  try {
    const template = await EmailTemplate.findById(id)
    if (!template) {
      return res.status(404).send("電子郵件模板未找到！")
    }
    res.render('admin/email_template_detail', { template }); 
  } catch (error) {
    console.error("Error fetching email template:", error)
    res.status(500).send("獲取電子郵件模板時出現錯誤！")
  }
}

exports.renderCreateEmailTemplatePage = async (req, res) => {
  try {
      const emailTemplates = await EmailTemplate.find();
      res.render('admin/create_email_template');
  } catch (error) {
      console.error('Error fetching events:', error);
      res.status(500).json({ message: 'Error fetching emailTemplates' });
  }
};

exports.updateEmailTemplate = async (req, res) => {
  const { id } = req.params
  const { subject, content } = req.body
  try {
    const updatedTemplate = await EmailTemplate.findByIdAndUpdate(
      id,
      { subject, content, modified_at: Date.now() },
      { new: true }
    )

    if (!updatedTemplate) {
      return res.status(404).send("電子郵件模板未找到！")
    }

    res.status(200).send("電子郵件模板更新成功！")
  } catch (error) {
    console.error("Error updating email template:", error)
    res.status(500).send("更新電子郵件模板時出現錯誤！")
  }
}

exports.createEmailTemplate = async (req, res) => {
  const { subject, content } = req.body

  try {
    // 創建新的電子郵件模板
    const newTemplate = new EmailTemplate({
      subject,
      content,
      created_at: Date.now(),
      modified_at: Date.now(),
    })

    await newTemplate.save()
    res.status(201).send("電子郵件模板創建成功！")
  } catch (error) {
    console.error("Error creating email template:", error)
    res.status(500).send("創建電子郵件模板時出現錯誤！")
  }
}

exports.sendEmailById = async (req, res) => {
  const { templateId } = req.params
  const { recipients } = req.body

  // TODO : Get email services
  // TODO : Send email using the template and recipients
  // TODO : Handle success and error responses
}
