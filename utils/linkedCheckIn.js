/**
 * Cross-event check-in helpers.
 * Scan on event A can resolve users that live on linked events (e.g. DBC → DBC-V2).
 */

const mongoose = require('mongoose');

function toObjectId(id) {
    if (!id) return null;
    const s = String(id);
    if (!mongoose.Types.ObjectId.isValid(s)) return null;
    return new mongoose.Types.ObjectId(s);
}

function userToPlain(user) {
    if (!user) return null;
    return user.toObject ? user.toObject({ minimize: false }) : { ...user };
}

/**
 * @param {import('mongoose').Document} rootEvent
 * @returns {Promise<string[]>} linked event id strings (excluding root)
 */
function getLinkedEventIdStrings(rootEvent) {
    const ids = (rootEvent && rootEvent.linkedCheckInEventIds) || [];
    return ids
        .map((id) => (id != null ? String(id) : ''))
        .filter((id) => mongoose.Types.ObjectId.isValid(id));
}

/**
 * Find a user on root event, or on any linkedCheckInEventIds.
 * @returns {Promise<{ event, user, sourceEventId: string, sourceEventName: string }|null>}
 */
async function findUserAcrossLinkedEvents(Event, rootEventId, userId) {
    const rootOid = toObjectId(rootEventId);
    const userOid = toObjectId(userId);
    if (!rootOid || !userOid) return null;

    const rootEvent = await Event.findById(rootOid);
    if (!rootEvent) return null;

    const local = rootEvent.users.id(userOid);
    if (local) {
        return {
            event: rootEvent,
            user: local,
            sourceEventId: String(rootEvent._id),
            sourceEventName: rootEvent.name || ''
        };
    }

    const linkedIds = getLinkedEventIdStrings(rootEvent);
    for (const lid of linkedIds) {
        if (lid === String(rootEvent._id)) continue;
        const linkedEvent = await Event.findById(lid);
        if (!linkedEvent) continue;
        const linkedUser = linkedEvent.users.id(userOid);
        if (linkedUser) {
            return {
                event: linkedEvent,
                user: linkedUser,
                sourceEventId: String(linkedEvent._id),
                sourceEventName: linkedEvent.name || ''
            };
        }
    }
    return null;
}

/**
 * Users for scan list: root event users + linked events' users (tagged with source).
 */
async function listUsersAcrossLinkedEvents(Event, rootEventId) {
    const rootOid = toObjectId(rootEventId);
    if (!rootOid) return { rootEvent: null, users: [] };

    const rootEvent = await Event.findById(rootOid);
    if (!rootEvent) return { rootEvent: null, users: [] };

    const out = [];
    const seen = new Set();

    for (const u of rootEvent.users || []) {
        const id = u && u._id ? String(u._id) : '';
        if (!id || seen.has(id)) continue;
        seen.add(id);
        const plain = userToPlain(u);
        plain._sourceEventId = String(rootEvent._id);
        plain._sourceEventName = rootEvent.name || '';
        out.push(plain);
    }

    for (const lid of getLinkedEventIdStrings(rootEvent)) {
        if (lid === String(rootEvent._id)) continue;
        const linkedEvent = await Event.findById(lid);
        if (!linkedEvent) continue;
        for (const u of linkedEvent.users || []) {
            const id = u && u._id ? String(u._id) : '';
            if (!id || seen.has(id)) continue;
            seen.add(id);
            const plain = userToPlain(u);
            plain._sourceEventId = String(linkedEvent._id);
            plain._sourceEventName = linkedEvent.name || '';
            out.push(plain);
        }
    }

    return { rootEvent, users: out };
}

module.exports = {
    toObjectId,
    getLinkedEventIdStrings,
    findUserAcrossLinkedEvents,
    listUsersAcrossLinkedEvents,
    userToPlain
};
