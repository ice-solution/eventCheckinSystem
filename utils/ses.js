/**
 * 郵件發送
 * - 預設：AWS SES API（全站舊方法）
 * - 個別活動：Event.emailSettings.useSmtp === true → SMTP
 * - 後備：SMTP_EVENT_IDS 環境變數名單（可選）
 * - 測試全站：EMAIL_TRANSPORT=smtp（唔建議長期）
 *
 * sendEmail(to, subject, htmlBody, senderName?, options?)
 * options: { eventId, useSmtp, event }
 */

const nodemailer = require("nodemailer")

const EMAIL_SENDER = (process.env.SENDER_EMAIL || "").trim()
const EMAIL_SENDER_SMTP = (process.env.SENDER_EMAIL_SMTP || "").trim()

function parseEventIdList(raw) {
  return String(raw || "")
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function normalizeId(id) {
  if (id == null) return ""
  if (typeof id === "object" && id._id != null) return String(id._id).trim()
  return String(id).trim()
}

function eventWantsSmtp(eventLike) {
  if (!eventLike) return false
  const settings = eventLike.emailSettings || eventLike
  return !!(settings && settings.useSmtp)
}

function shouldUseSmtp(options = {}) {
  const mode = (process.env.EMAIL_TRANSPORT || "").toString().trim().toLowerCase()
  if (mode === "smtp") return true

  if (options.useSmtp === true) return true
  if (options.useSmtp === false) {
    // 明確 false 仍可被 SMTP_EVENT_IDS 覆蓋？唔好——明確 false 就唔用
    // 但通常唔會傳 false；略過
  } else if (eventWantsSmtp(options.event)) {
    return true
  }

  const allow = parseEventIdList(process.env.SMTP_EVENT_IDS)
  if (!allow.length) return false
  const eid = normalizeId(options.eventId != null ? options.eventId : options.event)
  if (!eid) return false
  return allow.some((id) => id === eid)
}

/** 由 Event document 組 sendEmail options */
function mailOptionsFromEvent(event) {
  if (!event) return {}
  return {
    eventId: event._id,
    event,
    useSmtp: eventWantsSmtp(event),
  }
}

function resolveSenderEmail(useSmtp) {
  if (useSmtp && EMAIL_SENDER_SMTP) return EMAIL_SENDER_SMTP
  return EMAIL_SENDER
}

function buildFrom(senderEmail, senderName) {
  const email = (senderEmail || "").trim()
  const name = senderName != null ? String(senderName).trim() : ""
  if (name && email) return `"${name.replace(/"/g, "")}" <${email}>`
  return email
}

function parseArgs(senderNameOrOpts, maybeOpts) {
  let senderName = ""
  let options = {}
  if (senderNameOrOpts && typeof senderNameOrOpts === "object" && !Array.isArray(senderNameOrOpts)) {
    options = senderNameOrOpts
    if (options.senderName != null) senderName = options.senderName
  } else {
    senderName = senderNameOrOpts != null ? senderNameOrOpts : ""
    options = maybeOpts && typeof maybeOpts === "object" ? maybeOpts : {}
  }
  return { senderName, options }
}

let smtpTransporter = null
function getSmtpTransporter() {
  if (smtpTransporter) return smtpTransporter
  const host = (process.env.SMTP_HOST || "email-smtp.ap-southeast-1.amazonaws.com").trim()
  const port = parseInt(process.env.SMTP_PORT || "587", 10) || 587
  const user = (process.env.SMTP_USER || "").trim()
  const pass = (process.env.SMTP_PASS || process.env.SMTP_PASSWORD || "").trim()
  const secure =
    String(process.env.SMTP_SECURE || "").toLowerCase() === "true" || port === 465

  if (!user || !pass) {
    throw new Error("SMTP_USER / SMTP_PASS 未設定（活動已開 useSmtp）")
  }

  smtpTransporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    requireTLS: !secure && port === 587,
  })
  return smtpTransporter
}

async function sendViaSmtp(to, subject, body, senderName) {
  const fromEmail = resolveSenderEmail(true)
  if (!fromEmail) throw new Error("SENDER_EMAIL_SMTP / SENDER_EMAIL 未設定")
  const transporter = getSmtpTransporter()
  const info = await transporter.sendMail({
    from: buildFrom(fromEmail, senderName),
    to: Array.isArray(to) ? to.join(", ") : to,
    subject,
    html: body,
    text: typeof body === "string" ? body.replace(/<[^>]+>/g, " ") : undefined,
  })
  const messageId = info && (info.messageId || info.response) ? String(info.messageId || info.response) : ""
  console.log("sent (smtp):", messageId || info)
  return { MessageId: messageId, smtp: true, raw: info }
}

async function sendViaSesApi(to, subject, body, senderName) {
  const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses")
  const sesClient = new SESClient({
    region: process.env.AWS_SES_REGION || process.env.AWS_REGION,
    credentials: {
      accessKeyId: process.env.AWS_SES_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SES_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
    },
  })

  const fromEmail = resolveSenderEmail(false)
  if (!fromEmail) throw new Error("SENDER_EMAIL 未設定")
  const from = buildFrom(fromEmail, senderName)
  const command = new SendEmailCommand({
    Destination: {
      ToAddresses: Array.isArray(to) ? to : [to],
    },
    Message: {
      Body: {
        Html: { Data: body },
        Text: { Data: typeof body === "string" ? body.replace(/<[^>]+>/g, " ") : "" },
      },
      Subject: { Data: subject },
    },
    Source: from,
  })

  const result = await sesClient.send(command)
  console.log("sent (ses api):", result)
  return result
}

exports.shouldUseSmtp = shouldUseSmtp
exports.mailOptionsFromEvent = mailOptionsFromEvent
exports.eventWantsSmtp = eventWantsSmtp

exports.sendEmail = async (to, subject, body, senderNameOrOpts, maybeOpts) => {
  try {
    const { senderName, options } = parseArgs(senderNameOrOpts, maybeOpts)
    const useSmtp = shouldUseSmtp(options)
    if (useSmtp) {
      return await sendViaSmtp(to, subject, body, senderName)
    }
    return await sendViaSesApi(to, subject, body, senderName)
  } catch (err) {
    console.error("Error sending email:", err)
    if (err instanceof Error && err.name === "MessageRejected") {
      return err
    }
    throw err
  }
}
