const EmailTemplate = require("../model/EmailTemplate")

const sendGrid = require("../utils/sendGrid")
const EmailRecord = require("../model/EmailRecord")

exports.renderEmailTemplateList = async (req, res) => {
  try {
    const emailTemplates = await EmailTemplate.find()
    res.render("admin/email_template_list", { emailTemplates })
  } catch (error) {
    console.error("Error fetching events:", error)
    res.status(500).json({ message: "Error fetching emailTemplates" })
  }
}

exports.renderEmailTemplateDetail = async (req, res) => {
  const { id } = req.params

  try {
    const template = await EmailTemplate.findById(id)
    const emailRecords = await EmailRecord.find({ emailTemplate: id }) || []
    if (!template) {
      return res.status(404).send("電子郵件模板未找到！")
    }
    res.render("admin/email_template_detail", { template, emailRecords })
  } catch (error) {
    console.error("Error fetching email template:", error)
    res.status(500).send("獲取電子郵件模板時出現錯誤！")
  }
}

exports.renderCreateEmailTemplatePage = async (req, res) => {
  try {
    const emailTemplates = await EmailTemplate.find()
    res.render("admin/create_email_template")
  } catch (error) {
    console.error("Error fetching events:", error)
    res.status(500).json({ message: "Error fetching emailTemplates" })
  }
}

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

// to is an array of email addresses
exports.sendEmailById = async (req, res) => {
  const { id } = req.params
  const { recipient } = req.body

  const to = recipient.split(",").map((email) => email.trim())
  console.log("to", to)
  console.log("id", id)

  if (!!to && to.length > 0) {
    try {
      // get email body from email template
      const template = await EmailTemplate.findById(id)
      if (!template) {
        return res.status(404).send("電子郵件模板未找到！")
      }
      const subject = template.subject
      const body = template.content

      // send email
      const results =  await Promise.all(
        to.map((email) => {
          // send email
          return sendGrid.sendEmail(email, subject, body)          
        })
      )

      // save email record with status 
      const emailRecords = results.map((result, index) => {
        console.log(result)
        return new EmailRecord({
          recipient: to[index],
          emailTemplate: id,
          status: result.code === 200 ? "成功" : "失敗",
          errorMessage: result.code === 200? "" : result.response.body.errors.map((error) => error.message).join(", "),
          created_at: Date.now(),
        })
      })
      await EmailRecord.insertMany(emailRecords)

      return res.status(200).send("電子郵件發送成功！")
    } catch (error) {
      console.error("Error sending email:", error)
      return res.status(500).send("發送電子郵件時出現錯誤！")
    }
  }
  return res.status(400).send("請提供有效的收件人電子郵件地址！")
}
