const express = require("express")
const router = express.Router()
const emailTemplateController = require("../controllers/emailTemplateController")

router.route("/").get(emailTemplateController.renderEmailTemplateList)

router.route("/upload").post(emailTemplateController.uploadEmailTemplateImage)

router
  .route("/create")
  .get(emailTemplateController.renderCreateEmailTemplatePage)
  .post(emailTemplateController.createEmailTemplate)

router.route("/:id/send").post(emailTemplateController.sendEmailById)

router
  .route("/:id")
  .get(emailTemplateController.renderEmailTemplateDetail)
  .put(emailTemplateController.updateEmailTemplate)

module.exports = router
