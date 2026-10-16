const sendGrid = require("@sendgrid/mail")

sendGrid.setApiKey(process.env.SENDGRID_API_KEY)
const EMAIL_SENDER = process.env.SENDER_EMAIL // 替換為您的 SendGrid 電子郵件地址

const msg = {
  to: "test@example.com",
  from: "test@example.com", // Use the email address or domain you verified above
  subject: "Sending with Twilio SendGrid is Fun",
  text: "and easy to do anywhere, even with Node.js",
  html: "<strong>and easy to do anywhere, even with Node.js</strong>",
}

exports.sendEmail = async (to, subject, body, senderName) => {
  console.log("Sending email to:", to)
  console.log("Email subject:", subject)
  console.log("Email body:", body)
  console.log(  "Email sender:", EMAIL_SENDER)
  const name = senderName ? String(senderName).replace(/[\r\n]/g, ' ').trim() : ''
  const from = name ? { email: EMAIL_SENDER, name } : EMAIL_SENDER
  try {
    return await sendGrid.send({
      to: {email: to},
      from,
      subject: subject,
      html: body,
    })
  } catch (error) {
    console.error("Error sending email:", error)
    return error
  }
}
