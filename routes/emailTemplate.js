const express = require("express")
const router = express.Router()
const emailTemplateController = require("../controllers/emailTemplateController")

router.route("/").get(emailTemplateController.renderEmailTemplateList)

// 必須在 /:id 之前：否則 GET/POST /upload 會被當成 id="upload" → ObjectId cast error
router.route("/upload")
  .post(emailTemplateController.uploadEmailTemplateImage)
  .get((req, res) => res.status(405).json({ message: "Use POST to upload images" }))

// 公開預覽（須在 /:id 之前註冊，避免被當成 id）
router.get("/preview/:id", emailTemplateController.renderEmailTemplatePreview)

router.get("/seed", emailTemplateController.getEmailTemplateSeed)

router
  .route("/create")
  .get(emailTemplateController.renderCreateEmailTemplatePage)
  .post(emailTemplateController.createEmailTemplate)

router.route("/:id/send").post(emailTemplateController.sendEmailById)
router.get("/:id/send-records/export", emailTemplateController.exportEmailTemplateSendRecords)

router
  .route("/:id")
  .get(emailTemplateController.renderEmailTemplateDetail)
  .put(emailTemplateController.updateEmailTemplate)
  .delete(emailTemplateController.deleteEmailTemplate)
  
module.exports = router
