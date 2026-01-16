const EmailTemplate = require("../model/EmailTemplate")

const sendGrid = require("../utils/sendGrid")
const ses = require("../utils/ses")
const EmailRecord = require("../model/EmailRecord")
const emailTracking = require("../utils/emailTracking")

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

// 獲取指定類型的郵件模板列表 (API)
exports.getEmailTemplatesByType = async (req, res) => {
  try {
    const { eventId } = req.params
    const { type } = req.query // 郵件類型：welcome, invitation, knowledge, reminder
    
    if (!type) {
      return res.status(400).json({ message: "Email type is required" })
    }
    
    // 查詢該事件和全局的指定類型模板
    const query = {
      type: type,
      $or: [
        { eventId: eventId },
        { eventId: null } // 全局模板
      ]
    }
    
    const emailTemplates = await EmailTemplate.find(query)
      .sort({ eventId: 1, createdAt: -1 }) // 先顯示事件特定模板，再顯示全局模板，按創建時間倒序
      .select('_id subject type eventId') // 只返回需要的字段
    
    res.json(emailTemplates)
  } catch (error) {
    console.error("Error fetching email templates by type:", error)
    res.status(500).json({ message: "Error fetching email templates" })
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
    
    // 計算統計數據
    const stats = {
      total: emailRecords.length,
      sent: emailRecords.filter(r => r.status === 'sent' || r.status === 'delivered' || r.status === '成功').length,
      failed: emailRecords.filter(r => r.status === 'failed' || r.status === '失敗').length,
      opened: emailRecords.filter(r => r.opened_at).length,
      clicked: emailRecords.filter(r => r.clicked_at).length,
      openRate: 0,
      clickRate: 0,
      clickToOpenRate: 0
    };
    
    const sentCount = stats.sent;
    if (sentCount > 0) {
      stats.openRate = ((stats.opened / sentCount) * 100).toFixed(2);
      stats.clickRate = ((stats.clicked / sentCount) * 100).toFixed(2);
    }
    
    if (stats.opened > 0) {
      stats.clickToOpenRate = ((stats.clicked / stats.opened) * 100).toFixed(2);
    }
    
    if (!template) {
      return res.status(404).send("電子郵件模板未找到！")
    }
    res.render("admin/email_template_detail", { template, emailRecords, eventId, stats })
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

      // send email with tracking
      console.log("send my template");
      const results = await Promise.all(
        to.map(async (email) => {
          try {
            // 創建郵件記錄並獲取追蹤 ID
            const trackingId = await emailTracking.createEmailRecord({
              recipient: email,
              subject: subject,
              emailTemplateId: id,
              eventId: null,
              userId: null
            });
            
            // 添加追蹤到郵件內容
            let trackedBody = body;
            if (trackingId) {
              trackedBody = emailTracking.addTrackingToEmail(body, trackingId);
            }
            
            // 發送郵件
            const result = await ses.sendEmail(email, subject, trackedBody);
            
            // 更新郵件記錄狀態
            if (trackingId && result && result.MessageId) {
              await emailTracking.updateEmailRecordStatus(trackingId, 'sent', result.MessageId);
            } else if (trackingId && result instanceof Error) {
              await emailTracking.updateEmailRecordStatus(trackingId, 'failed');
            }
            
            return result;
          } catch (error) {
            console.error(`Error sending email to ${email}:`, error);
            return error;
          }
        })
      )

      // 記錄發送結果（用於向後兼容，實際記錄已在上面創建）
      const emailRecords = results.map((result, index) => {
        if (result instanceof Error) {
          return {
            recipient: to[index],
            emailTemplate: id,
            status: "失敗",
            errorLog: result.message,
            created_at: Date.now(),
          }
        } else {
          return {
            recipient: to[index],
            emailTemplate: id,
            status: "成功",
            created_at: Date.now(),
          }
        }
      })
      // 注意：實際的 EmailRecord 已經在上面創建，這裡只是為了向後兼容

      return res.status(200).send("電子郵件發送成功！")
    } catch (error) {
      console.error("Error sending email:", error)
      return res.status(500).send("發送電子郵件時出現錯誤！")
    }
  }
  return res.status(400).send("請提供有效的收件人電子郵件地址！")
}

function getPublicBaseUrl(req) {
  if (process.env.DOMAIN) {
    const configured = process.env.DOMAIN.trim();
    return configured.endsWith('/') ? configured.slice(0, -1) : configured;
  }

  const forwardedProto = req.headers['x-forwarded-proto'];
  const forwardedHost = req.headers['x-forwarded-host'] || req.headers['x-forwarded-server'];
  const protocol = forwardedProto ? forwardedProto.split(',')[0].trim() : req.protocol;
  const host = forwardedHost ? forwardedHost.split(',')[0].trim() : req.get('host');

  return `${protocol}://${host}`;
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
  
    const baseUrl = getPublicBaseUrl(req);
    const imageUrl = `${baseUrl}/uploads/email_template_images/${req.file.filename}`;
    
    res.status(200).json({ location: imageUrl })
  })
}