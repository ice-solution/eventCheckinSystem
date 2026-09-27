/**
 * Promote nested custom-form attendees (users[].attendees.list[]) into real Event.users
 * so each attendee gets a Mongo _id for QR / check-in.
 */

function fullName(firstname, lastname, fallback) {
    const n = [firstname, lastname].filter(Boolean).join(' ').trim();
    return n || fallback || '';
}

function normEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function nestedAttendeeKey(primaryId, attendee, index) {
    const email = normEmail(attendee && attendee.email);
    if (email) return `${String(primaryId)}:${email}`;
    const fn = String((attendee && (attendee.firstname || attendee.firstName)) || '').trim().toLowerCase();
    const ln = String((attendee && (attendee.lastname || attendee.lastName)) || '').trim().toLowerCase();
    return `${String(primaryId)}:${fn}|${ln}|${index}`;
}

function getNestedList(primary) {
    if (!primary || !primary.attendees) return [];
    const list = primary.attendees.list;
    return Array.isArray(list) ? list : [];
}

function getSponsorTier(primary) {
    if (!primary) return '';
    if (primary.sponsorTier) return String(primary.sponsorTier);
    if (primary.attendees && primary.attendees.sponsorTier) {
        return String(primary.attendees.sponsorTier);
    }
    return '';
}

function alreadyPromoted(event, primaryId, attendee, index) {
    const key = nestedAttendeeKey(primaryId, attendee, index);
    const email = normEmail(attendee && attendee.email);
    return (event.users || []).some((u) => {
        if (!u) return false;
        if (u.nestedAttendeeKey && String(u.nestedAttendeeKey) === key) return true;
        if (
            u.promotedAttendee &&
            u.linkedPrimaryUserId &&
            String(u.linkedPrimaryUserId) === String(primaryId) &&
            email &&
            normEmail(u.email) === email
        ) {
            return true;
        }
        return false;
    });
}

/**
 * Build a plain user object for Event.users.push (no _id yet).
 */
function buildAttendeeUserDoc(primary, attendee, index) {
    const firstname = (attendee && (attendee.firstname || attendee.firstName)) || '';
    const lastname = (attendee && (attendee.lastname || attendee.lastName)) || '';
    const email = (attendee && attendee.email) || '';
    const company = (attendee && attendee.company) || (primary && primary.company) || '';
    const title = (attendee && (attendee.title || attendee.jobTitle || attendee.job_title)) || '';
    const name = fullName(firstname, lastname, email || company || 'Attendee');
    const primaryId = primary && primary._id ? primary._id : null;

    return {
        name,
        firstname,
        lastname,
        email,
        company,
        jobTitle: title,
        title,
        attendeeCategory: (attendee && (attendee.attendeeCategory || attendee.attendee_category)) || '',
        attendeeCategoryOther: (attendee && attendee.attendeeCategoryOther) || '',
        role: 'attendee',
        recordType: 'Attendee',
        promotedAttendee: true,
        linkedPrimaryUserId: primaryId,
        linkedPrimaryEmail: (primary && primary.email) || '',
        linkedPrimaryName: fullName(
            primary && (primary.firstname || primary.firstName),
            primary && (primary.lastname || primary.lastName),
            (primary && primary.name) || ''
        ),
        sponsorTier: getSponsorTier(primary),
        nestedAttendeeKey: nestedAttendeeKey(primaryId, attendee, index),
        isCheckIn: false,
        paymentStatus: 'unpaid',
        applicationCompleted: false,
        create_at: new Date(),
        modified_at: new Date()
    };
}

/**
 * Promote all nested attendees on an event into Event.users.
 * Idempotent via nestedAttendeeKey / linkedPrimaryUserId+email.
 * @returns {{ created: number, skipped: number, createdUsers: object[] }}
 */
function promoteNestedAttendeesOnEvent(event) {
    let created = 0;
    let skipped = 0;
    const createdUsers = [];

    const primaries = (event.users || []).filter((u) => {
        if (!u) return false;
        if (u.promotedAttendee) return false;
        if (u.role === 'attendee' || u.recordType === 'Attendee') return false;
        return getNestedList(u).length > 0;
    });

    for (const primary of primaries) {
        const list = getNestedList(primary);
        for (let i = 0; i < list.length; i += 1) {
            const attendee = list[i];
            if (!attendee) {
                skipped += 1;
                continue;
            }
            const hasIdentity =
                normEmail(attendee.email) ||
                attendee.firstname ||
                attendee.firstName ||
                attendee.lastname ||
                attendee.lastName;
            if (!hasIdentity) {
                skipped += 1;
                continue;
            }
            if (alreadyPromoted(event, primary._id, attendee, i)) {
                skipped += 1;
                continue;
            }
            const doc = buildAttendeeUserDoc(primary, attendee, i);
            event.users.push(doc);
            created += 1;
            createdUsers.push(doc);
        }
    }

    if (created > 0) {
        event.markModified('users');
    }

    return { created, skipped, createdUsers };
}

/**
 * After a primary was just pushed, promote that primary's nested list only.
 * Call after event.users.push(primary) + before or after save (needs primary._id).
 */
function promoteAttendeesForPrimary(event, primaryUser) {
    if (!primaryUser || !primaryUser._id) {
        return { created: 0, skipped: 0, createdUsers: [] };
    }
    let created = 0;
    let skipped = 0;
    const createdUsers = [];
    const list = getNestedList(primaryUser);
    for (let i = 0; i < list.length; i += 1) {
        const attendee = list[i];
        if (!attendee) {
            skipped += 1;
            continue;
        }
        const hasIdentity =
            normEmail(attendee.email) ||
            attendee.firstname ||
            attendee.firstName ||
            attendee.lastname ||
            attendee.lastName;
        if (!hasIdentity) {
            skipped += 1;
            continue;
        }
        if (alreadyPromoted(event, primaryUser._id, attendee, i)) {
            skipped += 1;
            continue;
        }
        const doc = buildAttendeeUserDoc(primaryUser, attendee, i);
        event.users.push(doc);
        created += 1;
        createdUsers.push(doc);
    }
    if (created > 0) {
        event.markModified('users');
    }
    return { created, skipped, createdUsers };
}

module.exports = {
    fullName,
    normEmail,
    nestedAttendeeKey,
    getNestedList,
    buildAttendeeUserDoc,
    promoteNestedAttendeesOnEvent,
    promoteAttendeesForPrimary
};
