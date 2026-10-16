const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses")

const sesClient = new SESClient({
  region: process.env.AWS_SES_REGION,
  credentials: {
    accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY,
  },
})

const EMAIL_SENDER = process.env.SENDER_EMAIL // 替換為您的 SES 電子郵件地址

/** 有顯示名稱時組成 "Name" <email>；否則只用寄件地址 */
function buildSource(senderName) {
  const email = (EMAIL_SENDER || '').trim()
  const name = senderName ? String(senderName).replace(/[\r\n"]/g, '').trim() : ''
  if (!name || !email || email.includes('<')) return email
  return `"${name}" <${email}>`
}

const sendCommand = (userEmail, subject, html, senderName) => {
  return new SendEmailCommand({
    Destination: {
      ToAddresses: Array.isArray(userEmail) ? userEmail : [userEmail],
    },
    Message: {
      Body: {
        Html: {
          Data: html,
        },
        Text: {
          Data: html,
        },
      },
      Subject: {
        Data: subject,
      },
    },
    Source: buildSource(senderName),
  })
}

exports.sendEmail = async (to, subject, body, senderName) => {
  try {
    const sendEmailCommand = sendCommand(to, subject, body, senderName)
    const result = await sesClient.send(sendEmailCommand)
    console.log("sent: ", result)
    return result
  } catch (err) {
    console.error("Error sending email:", err)
    if (err instanceof Error && err.name === "MessageRejected") {
      return err
    }
    throw err
  }
}
