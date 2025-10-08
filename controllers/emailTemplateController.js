const EmailTemplate = require("../model/EmailTemplate")

const sendGrid = require("../utils/sendGrid")
const ses = require("../utils/ses")
const EmailRecord = require("../model/EmailRecord")

const {sampleHtmlTemplate} = require("../template/sample");

// 刪除電子郵件模板
exports.deleteEmailTemplate = async (req, res) => {
  const { id } = req.params
  
  try {
    const template = await EmailTemplate.findByIdAndDelete(id)
    if (!template) {
      return res.status(404).json({ message: "電子郵件模板未找到！" })
    }
    
    res.status(200).json({ message: "電子郵件模板刪除成功！" })
  } catch (error) {
    console.error("Error deleting email template:", error)
    res.status(500).json({ message: "刪除電子郵件模板時出現錯誤！" })
  }
}

const multer = require("multer")
const upload = multer({
  dest: "public/uploads/email_template_images/",
  limits: {
    fileSize: 1024 * 1024 * 5, // 5MB
  },
  fileFilter: (req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith("image/")) {
      return cb(new Error("只允許上傳圖片！"), false)
    }
    cb(null, true)
  },
})

exports.renderEmailTemplateList = async (req, res) => {
  try {
    const { eventId } = req.params
    const emailTemplates = await EmailTemplate.find(eventId ? { eventId } : {})
    res.render("admin/email_template_list", {emailTemplates, eventId })
  } catch (error) {
    console.error("Error fetching events:", error)
    res.status(500).json({ message: "Error fetching emailTemplates" })
  }
}

exports.renderEmailTemplateDetail = async (req, res) => {
  const { eventId, id } = req.params

  try {
    const template = await EmailTemplate.findById(id)
    const emailRecords =
      (await EmailRecord.find({ emailTemplate: id }).sort({
        created_at: -1,
      })) || []
    if (!template) {
      return res.status(404).send("電子郵件模板未找到！")
    }
    res.render("admin/email_template_detail", { template, emailRecords, eventId })
  } catch (error) {
    console.error("Error fetching email template:", error)
    res.status(500).send("獲取電子郵件模板時出現錯誤！")
  }
}

exports.renderCreateEmailTemplatePage = async (req, res) => {
  try {
    const { eventId } = req.params
    let sampleEmailTemplate = sampleHtmlTemplate
    res.render("admin/create_email_template", {
      sampleEmailTemplate, eventId
    })
  } catch (error) {
    console.error("Error fetching events:", error)
    res.status(500).json({ message: "Error fetching emailTemplates" })
  }
}

exports.updateEmailTemplate = async (req, res) => {
  const { id } = req.params
  const { subject, type, content } = req.body
  try {
    const updatedTemplate = await EmailTemplate.findByIdAndUpdate(
      id,
      { subject, type, content, modified_at: Date.now() },
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
  const { eventId, subject, type, content } = req.body

  const insertBody = {
    subject,
    type: type || 'welcome',
    content,
  }

  if (eventId) {
    insertBody.eventId = eventId
  }

  try {
    // 創建新的電子郵件模板
    const newTemplate = new EmailTemplate(insertBody)

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
      console.log("send my template");
      const results = await Promise.all(
        to.map((email) => {
          // send email
          return ses.sendEmail(email, subject, body)
        })
      )

      // save email record with status
      /**
       * Result sent:  {
          '$metadata': {
            httpStatusCode: 200,
            requestId: '7696f044-eb19-417d-a3ec-c9352343f23e',
            extendedRequestId: undefined,
            cfId: undefined,
            attempts: 1,
            totalRetryDelay: 0
          },
          MessageId: '010e019827c73c33-d88e5f97-b23e-494b-ac16-deda3d99c0c8-000000'
        }
       */
      const emailRecords = results.map((result, index) => {
        if (result instanceof Error) {
          return new EmailRecord({
            recipient: to[index],
            emailTemplate: id,
            status: "失敗",
            errorLog: result.message,
            created_at: Date.now(),
          })
        }else{
          return new EmailRecord({
            recipient: to[index],
            emailTemplate: id,
            status: "成功",
            created_at: Date.now(),
          })
        }
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

exports.uploadEmailTemplateImage = async (req, res) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      console.error("Error uploading image:", err)
      return res.status(500).send("上傳圖片時出現錯誤！")
    }
    if (!req.file) {
      return res.status(400).send("請選擇一個圖片文件！")
    }
    
    // 構建完整的絕對 URL
    const protocol = req.protocol;
    const host = req.get('host');
    const imageUrl = `${protocol}://${host}/uploads/email_template_images/${req.file.filename}`;
    
    res.status(200).json({ location: imageUrl })
  })
}