/**
 * One-shot / idempotent:
 * 1) Set DBC.linkedCheckInEventIds = [DBC-V2]
 * 2) Promote DBC-V2 nested attendees.list → Event.users (with _id for QR)
 *
 * Usage (from repo root, .env → dbc URI):
 *   node scripts/dbc-promote-attendees-and-link-checkin.js
 *   node scripts/dbc-promote-attendees-and-link-checkin.js --send-email
 *   node scripts/dbc-promote-attendees-and-link-checkin.js --dry-run
 */
require('dotenv').config();
const mongoose = require('mongoose');
const Event = require('../model/Event');
const { promoteNestedAttendeesOnEvent } = require('../utils/promoteAttendees');

const DBC_ID = '6a8538367e5dde5cd1c9e0ba';
const DBC_V2_ID = '6a87d017b4faa4ccf781020f';

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const sendEmail = args.has('--send-email');

async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
        console.error('MONGODB_URI is not set');
        process.exit(1);
    }

    await mongoose.connect(uri);
    console.log('Connected', uri.replace(/\/\/.*@/, '//***@').split('/').pop());

    const dbc = await Event.findById(DBC_ID);
    const v2 = await Event.findById(DBC_V2_ID);
    if (!dbc || !v2) {
        console.error('Missing events', { dbc: !!dbc, v2: !!v2 });
        process.exit(1);
    }

    const linked = (dbc.linkedCheckInEventIds || []).map((id) => String(id));
    if (!linked.includes(DBC_V2_ID)) {
        console.log('Linking DBC → DBC-V2 for check-in');
        if (!dryRun) {
            dbc.linkedCheckInEventIds = [...(dbc.linkedCheckInEventIds || []), new mongoose.Types.ObjectId(DBC_V2_ID)];
            await dbc.save();
        }
    } else {
        console.log('DBC already linked to DBC-V2');
    }

    const beforeUsers = (v2.users || []).length;
    const result = promoteNestedAttendeesOnEvent(v2);
    console.log(JSON.stringify({
        dryRun,
        sendEmail,
        v2Name: v2.name,
        usersBefore: beforeUsers,
        created: result.created,
        skipped: result.skipped,
        usersAfter: beforeUsers + (dryRun ? 0 : result.created)
    }, null, 2));

    if (!dryRun && result.created > 0) {
        await v2.save();
        // re-load to get real _ids for created users
        const saved = await Event.findById(DBC_V2_ID);
        const promoted = (saved.users || []).filter((u) => u && u.promotedAttendee);
        console.log('Promoted attendees with _id:', promoted.length);

        const keys = new Set(result.createdUsers.map((c) => c.nestedAttendeeKey));
        const justCreated = promoted.filter((u) => keys.has(u.nestedAttendeeKey));

        // Always print QR payload URLs for newly promoted (badge / manual send)
        const raw = (process.env.DOMAIN || process.env.domain || 'http://localhost:3377').toString().trim().replace(/\/+$/, '');
        const base = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
        console.log('--- QR for newly promoted attendees ---');
        for (const u of justCreated) {
            const id = String(u._id);
            console.log(JSON.stringify({
                name: u.name,
                email: u.email || '',
                userId: id,
                qrPayload: id,
                qrImage: `https://api.qrserver.com/v1/create-qr-code/?data=${id}&size=250x250`,
                qrPage: `${base}/qrcode?userId=${id}`
            }));
        }

        if (sendEmail) {
            const eventsController = require('../controllers/eventsController');
            let sent = 0;
            let failed = 0;
            for (const u of justCreated) {
                if (!u.email) continue;
                try {
                    await eventsController.sendPostRegistrationEmailByPolicy(u, saved, { mode: 'welcome' });
                    sent += 1;
                } catch (e) {
                    failed += 1;
                    console.error('Email failed for', u.email, e.message);
                }
            }
            console.log({ emailsSent: sent, emailsFailed: failed });
        } else {
            console.log('Skip emails (pass --send-email to send welcome/QR to newly promoted attendees)');
        }
    } else if (!dryRun) {
        // Already promoted earlier: still allow listing QR for all promoted
        if (args.has('--list-qr')) {
            const saved = await Event.findById(DBC_V2_ID);
            const promoted = (saved.users || []).filter((u) => u && u.promotedAttendee);
            const raw = (process.env.DOMAIN || process.env.domain || 'http://localhost:3377').toString().trim().replace(/\/+$/, '');
            const base = raw.startsWith('http://') || raw.startsWith('https://') ? raw : `https://${raw}`;
            console.log('--- QR for all promoted attendees ---');
            for (const u of promoted) {
                const id = String(u._id);
                console.log(JSON.stringify({
                    name: u.name,
                    email: u.email || '',
                    userId: id,
                    qrPayload: id,
                    qrImage: `https://api.qrserver.com/v1/create-qr-code/?data=${id}&size=250x250`,
                    qrPage: `${base}/qrcode?userId=${id}`
                }));
            }
        }
    }

    await mongoose.disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
