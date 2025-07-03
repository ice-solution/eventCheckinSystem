const ses = require('aws-sdk/clients/ses');
const sesClient = new ses({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
}); 

const EMAIL_SENDER = process.env.SENDER_EMAIL; // 替換為您的 SES 電子郵件地址
exports.sendEmail = async (to, subject, body) => {

  const params = {
    Source: EMAIL_SENDER,
    Destination: {
      ToAddresses: [to],
    },
    Message: {
      Subject: {
        Data: subject,
      },
      Body: {
        Html: {
          Data: body,
        },
      },
    },
  };

  try {
    return await sesClient.sendEmail(params).promise();
  } catch (error) {
    console.error("Error sending email:", error);
    return error;
  }
};