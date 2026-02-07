const crypto = require('crypto');

class WonderSignature {
    static generateRandomString(length) {
        const alphabet = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
        const alphabetLength = alphabet.length;
        let randomString = '';
        for (let i = 0; i < length; i++) {
            const randomIndex = Math.floor(Math.random() * alphabetLength);
            randomString += alphabet[randomIndex];
        }
        return randomString;
    }

    parseCredential(credential) {
        const parts = credential.split('/');
        if (parts.length !== 3) {
            throw new Error('Invalid credential format');
        }
        return {
            appid: parts[0],
            request_time: parts[1],
            algorithm: parts[2]
        };
    }

    generateSignatureMessage(credential, nonce, method, uri, body = null) {
        const parsedCredential = this.parseCredential(credential);
        let signatureKey = crypto.createHmac('sha256', nonce)
            .update(parsedCredential.request_time)
            .digest();

        signatureKey = crypto.createHmac('sha256', signatureKey)
            .update(parsedCredential.algorithm)
            .digest();

        let content = method.toUpperCase() + "\n" + uri;
        if (body !== null && body.trim().length > 0) {
            content += "\n" + body;
        }

        return crypto.createHmac('sha256', signatureKey)
            .update(content)
            .digest('hex');
    }

    signature(privateKey, credential, nonce, method, uri, body = null) {
        const plainSignature = this.generateSignatureMessage(credential, nonce, method, uri, body);
        const sign = crypto.createSign('RSA-SHA256');
        sign.update(plainSignature);
        sign.end();
        const signature = sign.sign(privateKey, 'base64');
        return signature;
    }

    verifySignature(publicKey, receivedSignature, credential, nonce, method, uri, body = null) {
        const plainSignature = this.generateSignatureMessage(credential, nonce, method, uri, body);
        const verify = crypto.createVerify('RSA-SHA256');
        verify.update(plainSignature);
        verify.end();
        const receivedSignatureBytes = Buffer.from(receivedSignature, 'base64');
        return verify.verify(publicKey, receivedSignatureBytes);
    }
}

module.exports = WonderSignature;