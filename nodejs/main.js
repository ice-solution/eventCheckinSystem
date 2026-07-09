const WonderSignature = require("./wonder_signature")

function formatTimeToYYYYMMDDHHMMSS(date = new Date()) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    const seconds = String(date.getUTCSeconds()).padStart(2, '0');
    return year + month + day + hours + minutes + seconds;
}

// 设置时区为UTC
process.env.TZ = 'UTC';

const wonderSignature = new WonderSignature();

const private_key = `-----BEGIN RSA PRIVATE KEY-----
MIIEogIBAAKCAQBS1Gv7Z34T1RnbNYS4TbvUOtF+zqbkNhQxHt8YAdlAjVUV9pAV
eZR7WAVVcK5oGD5PAH/U5RwdGNMXYYdaqSmHTa0ZWUcHb/juRtLuEgUegQo/e5GW
7Rs2QmPny0rWTEbqFUV3WUP96bGNpidy7jvR+NHKk/iUynASPMPXib4fKL3atGyD
5/nCPgyEYdwC/c+C9JGL+jBhe2xbDYzld13XbJzPucHCZklM9kfca5Sfj8p2lM8v
4feIdJf4zFDwcjjU9X3PkWOrXos1UNoNzTSe46OvKrlQE0zO4VQ9I0gj/jnLbQ3d
u358q9a073wnZAKi1ZugmkSNR7TvKrPGymGfAgMBAAECggEAD54X4iZIYmrq3idA
KBQYF1Mjzxod46fCtORSQk+O7Bn58hM0Zagv8/XLw6lkaSIxFWpNsBGm9GGK47yy
7cg5mVZvDfmEaAWX1S2rddIV/wNrsD6XW/LHD7sC5WCycqedM2PhXjiJlmWq4b9z
brs2skeNHvo5g6yL5xRoBMrm+y7XK78FYXCGj2yZU+5UkOcRjoyAoRi3puU/lPWg
UvdW1UANr3i7cCO0abzmezhZKUcUqUW34iHLbb4vQFFq84g/izbLUhC9c/BGjUaO
flkihtm3JfU6bvwNyU6lNilHK+uHj93IasKNskZSGYEmQj7MFWlqcyYxql4BETwL
8uupwQKBgQCh/A0OSlZahnjFy0Zo9UKL1koh7cJmSAV6hGfaJDR1mDGY/tuyqpcX
qlaYM+7MhXFHlO7qZ1/XFI2bCYBVM7o7vKbDK4E15jNYebRwWEUYB35gf8sL70e4
fHJC1H5hlIfg4l2mn1d8e33xGdkb2HAKwvYwg2nNFweXmUV7efruPwKBgQCC52nA
yW39H7y5q7XdGWHMf1tAfsMobpbFcAgZIEbJE4+6YkrInc3Qq6ZfiwK62dRN4Um4
c7MXE9h3LOUzYlOHw9ZaKinA6LQ7Ie4VibPD1w3Ll7JfFYp9xkDw8wC7cbgH61+S
fVRbZuuNpSFHO4+Lz28NYOurWKxks14+rnp0oQKBgQCA76Zcx6Mw73TWzFVBWmgb
8viTRTPGQnHJ8fbQVp1DNV/VTpgGAW+/MKE5Ca19MoLW3Z/HCX3qL7v/unJiX4hP
4HxFQi3Zf2FDfay4+CoXVG+t1EsFNvO5z6ULuSTX+2ilAspUxOTYe1vmPBLq7T9R
8ZoRR6lBzKEIdMIv5Qpt9QKBgHfGQAgrBl2N9YO5rmzAdbDEcv0/P1g2X/QFfxNm
af4/zMnQd/a6FQCynkdbjULkXxJnaanBC4O5H95jkNAETsOxl+bmH1AoXAijEhJY
7cfqdO/tPEMuFYrhpLgS0H+yHJ36andB/7amJC91gU6JG93kDguiu+ALAaoeSMR3
pwohAoGAChmnupFN8b9PmIgkm5nrmpSMa489E4mKQHPZakXT9osL3IpcOoCasnds
a8ar/BO+bKLcGr67tZiR222/RI9W90aa1E+4fHRJAgXBoVGXbVOFTjnt0ftK5R6K
U8nGC++qqT6WJB7omNnLsbq8+urZQgmkfqJCPZ0yHr+J3PylUO4=
-----END RSA PRIVATE KEY-----`;

const appid = "a74cb280-b3bd-4892-9a80-05090663d71e";
const nonce = WonderSignature.generateRandomString(16);
const now =  formatTimeToYYYYMMDDHHMMSS();

const domain = "https://gateway-stg.wonder.today";
const uri = "/svc/payment/api/v1/openapi/echo";
const method = "POST";
const credential = `${appid}/${now}/Wonder-RSA-SHA256`;

const body = {
    "message": `Hello, Current timestamp is ${now}`
};

const plainText = JSON.stringify(body);
const signature = wonderSignature.signature(private_key, credential, nonce, method, uri, plainText);
const cmd =  `curl -X${method} -H 'Content-Type: application/json' -H 'Credential: ${credential}' -H 'Nonce: ${nonce}' -H 'Signature: ${signature}' ${domain}${uri} -d '${plainText}'`;

console.log("\n\n\n");
console.log("Successful generated a test CURL command:\n");
console.log("\n\n");
console.log(cmd);
console.log("\n\n");