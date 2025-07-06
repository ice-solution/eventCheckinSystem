const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");

const sesClient = new SESClient({
  region: process.env.AWS_REGION,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
}); 

const EMAIL_SENDER = process.env.SENDER_EMAIL; // 替換為您的 SES 電子郵件地址

const sendCommand = (userEmail, subject, html) => {
  return new SendEmailCommand({
	Destination: {
		ToAddresses: Array.isArray(userEmail) ? userEmail : [ userEmail ]
	},
    Message: {
	    Body: {
	      Html: {
	      	Data: html
	      },
	      Text: {
	        Data: html
	      }
	    },
	    Subject: {
	      Data: subject
	    }
	},
	Source: EMAIL_SENDER
  });
};

exports.sendEmail = async (to, subject, body) => {
  	try {
		const sendEmailCommand = sendCommand(to, subject, body);
		const result = await sesClient.send(sendEmailCommand);
		console.log('sent: ', result);
		return result;
	} catch (err) {
		if (err instanceof Error && err.name === "MessageRejected") {
			return messageRejectedError;
		}
		throw err;
	}

};