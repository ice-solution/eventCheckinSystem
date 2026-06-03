require('dotenv').config();
const mongoose = require('mongoose');
const Auth = require('./model/Auth');

async function main() {
    await mongoose.connect(process.env.MONGODB_URI);
    const existing = await Auth.findOne({ username: 'admin' });
    if (existing) {
        existing.password = 'admin_password';
        await existing.save();
        console.log('Admin password reset to: password');
        process.exit(0);
    }
    const user = new Auth({ username: 'admin', password: 'admin_password', role: 'admin' });
    await user.save();
    console.log('Admin created: username=admin, password=admin_password');
    process.exit(0);
}

main().catch(err => { console.error(err); process.exit(1); });
