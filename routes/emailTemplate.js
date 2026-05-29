const express = require("express")
const router = express.Router()
const emailTemplateController = require("../controllers/emailTemplateController")

router.route("/").get(emailTemplateController.renderEmailTemplateList)

router.route("/upload").post(emailTemplateController.uploadEmailTemplateImage)

// 公開預覽（須在 /:id 之前註冊，避免被當成 id）
router.get("/preview/:id", emailTemplateController.renderEmailTemplatePreview)

router
  .route("/create")
  .get(emailTemplateController.renderCreateEmailTemplatePage)
  .post(emailTemplateController.createEmailTemplate)

router.route("/:id/send").post(emailTemplateController.sendEmailById)

router
  .route("/:id")
  .get(emailTemplateController.renderEmailTemplateDetail)
  .put(emailTemplateController.updateEmailTemplate)
  .delete(emailTemplateController.deleteEmailTemplate)
  
module.exports = router
