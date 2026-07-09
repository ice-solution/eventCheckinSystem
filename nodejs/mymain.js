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
MIIEoQIBAAKCAQBi+I15pLKURVqwKCpLijYOOWY4YrgFSEnzCQ3eJAf/YO4ut8IT
qcPEtMwikrr/1IWTngzJ5QaTNLON2ezHIsIuJOu/rQsmDFDOsPpgAzuUE+wDr6V2
rh5WQZBkOmoh2lDPC46zIh6xEYKEdstz5wsvh3sA9jehiZgXDE2vvUSWkQZ/s0gY
Z+mzDUKEHM5qSAV2ExjHFvM38jmUQ0BAURMcMGJqLaWeLD2XRa25XSuy5h2JCCQI
PB187ow7pk8KHtBEj/q1dXMuEcOZ/kWuHLBERb/IwADWUV8iDb7I/cMid/Akf4yG
Eeas9MHh79T6Fvdts1iV7M5NaFHFYIfLTllBAgMBAAECggEATvyvbHXVUCBJ0G09
1CvqGFAXFMk0tIKNAjonpzJ6b4ackQx3B9plM4hXowAX3jVupfFto3P1W2akJoHW
Rtemwc0VmVQxoZwSoeL878OkuPltU0PLenxcGdsZseQs7/ecpqFCshR5Cjg/QhjN
JyMt+jDWKl5W58U4bKyVE7yqEL+N2xRCBC80dBODZ4dg9P9xqw8mlOgHHkOWdGX4
0ZH4KCSyGshwREEYxepb3k8OrnpWWPOu6F6RmPDHTr/f5/2XnxRy2if+vvFbtAG0
4XgZr0/eio+XDVUZrMA0nzxSx7tzTPeyY0AwibWHo61CqFNcAZpoy94WwuvGI0Jy
+sgJQQKBgQCzabwzeUyYFRv3AKK2YrEie7wrqxrCW8jzmugIL3gow+tNc162uEsR
XBAnifC+ZYzcoTXXPK+bTUd76OxGKt/gymgePDMwGt3cfv0HG/ZjDu0mNd5bPeek
DFIkXohnRVhX6KTmH3somU99w/3Q/Vov+5+SN0tHk3Ef85CPx4RoTwKBgQCNOBk9
ETNRcbxl7cVjTf1JC2hNpb3f2u8kpxGKpb4p4lkoY0vdNz0L7sMGLpZCjmGb9zMh
+mQ1K1V2SXNngxXm9R+1FwDUEuOU2iz6HHZcDSAl21QhV6sWJum4zayjB2uUvzTy
Ox0HK9BouL44gcJRZ/GUiGph1jk+vuW1drIxbwKBgAuNd2zpFqGEWnShOdj8qeNK
jGdTcTmqp1noU6CTTe1yECjAkQy6+Tp47yFcpH/eEh/y0YC2i6g4Za345Z3vDNNw
tRudTL6APGECXFCk4EyonWSke1jst4m8sV1eKPJdaL7gYB3hURDgLlou0J0wcyo7
zZ6gqNxHBjXEfT6E3mXJAoGAUrJpRTOPY8BA3Uex8Yc4LdA6Uk4etLpWlJYpVZHd
nFVqdJZBVNgGLbiyCCq731nVmynVja49hE1ODKjSpelDqC4fVUKVP5uYHhDticGl
Jh6hlsmrqKLYE27SK2B2Gjo8K60U6kznoM1tjAWzjw+dpWJDPAHumkCC4VWU2wEZ
NI0CgYA9soo/mbkB3RsKGOL+RDd7dWcDlXevSsArAhdHrIswtTZKC/c1uYFjbX4k
bM/bhdSPK3ir+ZlJg8Ve5Zadqv1QyhbQSAeqXh/2tOCk3LMkRjz6YdQ8F5HUwL2B
JehESZyjjZEwaSkWqYifK6JyWHUoHxrq23NP95TjAKALeO8sBA==
-----END RSA PRIVATE KEY-----`;

const appid = "567e32e8-0c75-4b29-8e88-efa2c6388170";
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