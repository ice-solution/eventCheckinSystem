const Event = require('../model/Event');
const mongoose = require('mongoose');

function operatorName(req) {
    if (req.session && req.session.user && req.session.user.username) {
        return req.session.user.username;
    }
    if (req.jwt && req.jwt.username) {
        return `ipad:${req.jwt.username}`;
    }
    return '';
}

function findStation(event, stationId) {
    if (!event.checkInStations) return null;
    return event.checkInStations.id(stationId);
}

function findUser(event, userId) {
    if (!event.users) return null;
    return event.users.id(userId);
}

function alreadyCheckedIn(event, stationId, userId) {
    const sid = String(stationId);
    const uid = String(userId);
    return (event.stationCheckIns || []).some(
        (r) => String(r.stationId) === sid && String(r.userId) === uid
    );
}

function getAllowedUserIds(station) {
    return (station && station.allowedUserIds ? station.allowedUserIds : []).map((id) => String(id));
}

/** 有 section list 時才限制；空名單 = 不限制（向後相容） */
function stationHasSectionList(station) {
    return getAllowedUserIds(station).length > 0;
}

function isUserInStationList(station, userId) {
    if (!stationHasSectionList(station)) return true;
    return getAllowedUserIds(station).includes(String(userId));
}

function serializeStation(station, checkInCount = 0) {
    const allowedUserIds = getAllowedUserIds(station);
    return {
        _id: station._id,
        name: station.name,
        description: station.description || '',
        enabled: station.enabled !== false,
        order: station.order || 0,
        allowedUserIds,
        sectionListCount: allowedUserIds.length,
        created_at: station.created_at,
        modified_at: station.modified_at,
        checkInCount,
    };
}

function serializeListUser(user, checkedIn) {
    return {
        _id: user._id,
        name: user.name || '',
        email: user.email || '',
        company: user.company || '',
        table: user.table || '',
        isCheckIn: !!user.isCheckIn,
        stationCheckedIn: !!checkedIn,
    };
}

function countByStation(event) {
    const map = {};
    (event.stationCheckIns || []).forEach((r) => {
        const key = String(r.stationId);
        map[key] = (map[key] || 0) + 1;
    });
    return map;
}

/** 後台：分站簽到管理頁 */
exports.renderStationCheckinPage = async (req, res) => {
    const { eventId } = req.params;
    try {
        const event = await Event.findById(eventId);
        if (!event) return res.status(404).send('Event not found');

        const counts = countByStation(event);
        const stations = (event.checkInStations || [])
            .slice()
            .sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.name).localeCompare(String(b.name)))
            .map((s) => serializeStation(s, counts[String(s._id)] || 0));

        res.render('admin/station_checkin', {
            event,
            eventId,
            stations,
        });
    } catch (err) {
        console.error('renderStationCheckinPage:', err);
        res.status(500).send('Server error');
    }
};

/** 後台：單一站點簽到頁（手動 + 掃 QR + Section List） */
exports.renderStationDetailPage = async (req, res) => {
    const { eventId, stationId } = req.params;
    try {
        const event = await Event.findById(eventId);
        if (!event) return res.status(404).send('Event not found');
        const station = findStation(event, stationId);
        if (!station) return res.status(404).send('Station not found');

        const records = (event.stationCheckIns || [])
            .filter((r) => String(r.stationId) === String(stationId))
            .slice()
            .sort((a, b) => new Date(b.checkedInAt) - new Date(a.checkedInAt));

        const checkedInUserIds = new Set(records.map((r) => String(r.userId)));
        const allowedIds = getAllowedUserIds(station);
        const hasSectionList = allowedIds.length > 0;
        const allowedSet = new Set(allowedIds);

        const sectionListUsers = allowedIds
            .map((id) => findUser(event, id))
            .filter(Boolean)
            .map((u) => serializeListUser(u, checkedInUserIds.has(String(u._id))));

        // 可加入 section list 的 RSVP 用戶：僅已進場、且尚未在名單內
        const addableUsers = (event.users || [])
            .filter((u) => !!u.isCheckIn && !allowedSet.has(String(u._id)))
            .map((u) => ({
                _id: u._id,
                name: u.name || '',
                email: u.email || '',
                company: u.company || '',
                table: u.table || '',
                isCheckIn: true,
            }))
            .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'zh-HK'));

        // 融合 Section List + 簽到記錄：名單用戶 + 僅有簽到記錄但不在名單者
        const listIdSet = new Set(sectionListUsers.map((u) => String(u._id)));
        const unifiedUsers = sectionListUsers.map((u) => ({
            ...u,
            onSectionList: true,
        }));
        records.forEach((r) => {
            const uid = String(r.userId);
            if (listIdSet.has(uid)) return;
            unifiedUsers.push({
                _id: r.userId,
                name: r.userName || '',
                email: r.userEmail || '',
                company: '',
                table: '',
                isCheckIn: true,
                stationCheckedIn: true,
                onSectionList: false,
            });
        });
        unifiedUsers.sort((a, b) => {
            if (!!a.stationCheckedIn !== !!b.stationCheckedIn) {
                return a.stationCheckedIn ? 1 : -1; // 未簽到在上，方便操作
            }
            return String(a.name || '').localeCompare(String(b.name || ''), 'zh-HK');
        });

        res.render('admin/station_checkin_detail', {
            event,
            eventId,
            station,
            records,
            sectionListUsers,
            unifiedUsers,
            addableUsers,
            hasSectionList,
        });
    } catch (err) {
        console.error('renderStationDetailPage:', err);
        res.status(500).send('Server error');
    }
};

/** 建立站點 */
exports.createStation = async (req, res) => {
    const { eventId } = req.params;
    const { name, description, order } = req.body || {};
    try {
        const trimmed = name != null ? String(name).trim() : '';
        if (!trimmed) {
            return res.status(400).json({ message: 'Station name is required' });
        }
        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ message: 'Event not found' });

        event.checkInStations = event.checkInStations || [];
        const station = {
            name: trimmed,
            description: description != null ? String(description).trim() : '',
            enabled: true,
            order: order != null && order !== '' ? Number(order) || 0 : event.checkInStations.length,
            created_at: new Date(),
            modified_at: new Date(),
        };
        event.checkInStations.push(station);
        event.markModified('checkInStations');
        await event.save();

        const saved = event.checkInStations[event.checkInStations.length - 1];
        return res.status(201).json(serializeStation(saved, 0));
    } catch (err) {
        console.error('createStation:', err);
        return res.status(500).json({ message: err.message || 'Server error' });
    }
};

/** 更新站點 */
exports.updateStation = async (req, res) => {
    const { eventId, stationId } = req.params;
    const { name, description, enabled, order } = req.body || {};
    try {
        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ message: 'Event not found' });
        const station = findStation(event, stationId);
        if (!station) return res.status(404).json({ message: 'Station not found' });

        if (name !== undefined) {
            const trimmed = String(name).trim();
            if (!trimmed) return res.status(400).json({ message: 'Station name is required' });
            station.name = trimmed;
        }
        if (description !== undefined) station.description = String(description).trim();
        if (enabled !== undefined) station.enabled = !!enabled;
        if (order !== undefined && order !== '') station.order = Number(order) || 0;
        station.modified_at = new Date();

        event.markModified('checkInStations');
        await event.save();

        const counts = countByStation(event);
        return res.json(serializeStation(station, counts[String(station._id)] || 0));
    } catch (err) {
        console.error('updateStation:', err);
        return res.status(500).json({ message: err.message || 'Server error' });
    }
};

/** 刪除站點（連同該站簽到記錄） */
exports.deleteStation = async (req, res) => {
    const { eventId, stationId } = req.params;
    try {
        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ message: 'Event not found' });
        const station = findStation(event, stationId);
        if (!station) return res.status(404).json({ message: 'Station not found' });

        event.checkInStations.pull(stationId);
        event.stationCheckIns = (event.stationCheckIns || []).filter(
            (r) => String(r.stationId) !== String(stationId)
        );
        event.markModified('checkInStations');
        event.markModified('stationCheckIns');
        await event.save();

        return res.json({ message: 'Station deleted' });
    } catch (err) {
        console.error('deleteStation:', err);
        return res.status(500).json({ message: err.message || 'Server error' });
    }
};

/**
 * 共用：執行分站簽到
 * 規則：必須先完成進場 isCheckIn；同一站同一人只能一次；
 * 若站點有 Section List，用戶必須在名單內
 */
async function performStationCheckIn(event, stationId, userId, checkedInBy) {
    const station = findStation(event, stationId);
    if (!station) {
        return { status: 404, body: { message: 'Station not found' } };
    }
    if (station.enabled === false) {
        return { status: 400, body: { message: 'Station is disabled' } };
    }

    const user = findUser(event, userId);
    if (!user) {
        return { status: 404, body: { message: 'User not found' } };
    }
    if (!isUserInStationList(station, userId)) {
        return {
            status: 400,
            body: {
                message: 'User is not in this station section list',
                code: 'NOT_IN_STATION_LIST',
                user: {
                    _id: user._id,
                    name: user.name || '',
                    email: user.email || '',
                },
                station: { _id: station._id, name: station.name },
            },
        };
    }
    if (!user.isCheckIn) {
        return {
            status: 400,
            body: {
                message: 'Entry check-in required before station check-in',
                code: 'ENTRY_CHECKIN_REQUIRED',
            },
        };
    }
    if (alreadyCheckedIn(event, stationId, userId)) {
        return {
            status: 400,
            body: {
                message: 'User already checked in at this station',
                code: 'ALREADY_CHECKED_IN',
            },
        };
    }

    const record = {
        stationId: station._id,
        userId: user._id,
        userName: user.name || '',
        userEmail: user.email || '',
        checkedInAt: new Date(),
        checkedInBy: checkedInBy || '',
    };
    event.stationCheckIns = event.stationCheckIns || [];
    event.stationCheckIns.push(record);
    event.markModified('stationCheckIns');
    await event.save();

    const saved = event.stationCheckIns[event.stationCheckIns.length - 1];
    return {
        status: 200,
        body: {
            message: 'Station check-in successful',
            station: { _id: station._id, name: station.name },
            record: saved,
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                isCheckIn: user.isCheckIn,
            },
        },
    };
}

/** 後台 / API：對站點簽到 */
exports.checkInToStation = async (req, res) => {
    const { eventId, stationId } = req.params;
    const { userId } = req.body || {};
    try {
        if (!userId) {
            return res.status(400).json({ message: 'userId is required' });
        }
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid userId' });
        }
        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ message: 'Event not found' });

        const result = await performStationCheckIn(event, stationId, userId, operatorName(req));
        return res.status(result.status).json(result.body);
    } catch (err) {
        console.error('checkInToStation:', err);
        return res.status(500).json({ message: err.message || 'Server error' });
    }
};

/**
 * 取消分站簽到（誤點可還原）
 * Body 可傳 userId，或用 URL :userId
 */
exports.uncheckStationCheckIn = async (req, res) => {
    const { eventId, stationId } = req.params;
    const userId = (req.body && req.body.userId) || req.params.userId;
    try {
        if (!userId) {
            return res.status(400).json({ message: 'userId is required' });
        }
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid userId' });
        }

        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ message: 'Event not found' });

        const station = findStation(event, stationId);
        if (!station) return res.status(404).json({ message: 'Station not found' });

        const before = (event.stationCheckIns || []).length;
        event.stationCheckIns = (event.stationCheckIns || []).filter(
            (r) => !(String(r.stationId) === String(stationId) && String(r.userId) === String(userId))
        );

        if (event.stationCheckIns.length === before) {
            return res.status(404).json({
                message: 'Station check-in record not found',
                code: 'NOT_CHECKED_IN',
            });
        }

        event.markModified('stationCheckIns');
        await event.save();

        const user = findUser(event, userId);
        return res.json({
            message: 'Station check-in removed',
            station: { _id: station._id, name: station.name },
            userId: String(userId),
            user: user
                ? { _id: user._id, name: user.name, email: user.email, isCheckIn: !!user.isCheckIn }
                : null,
        });
    } catch (err) {
        console.error('uncheckStationCheckIn:', err);
        return res.status(500).json({ message: err.message || 'Server error' });
    }
};

/** 別名：供 routes/events.js 使用 */
exports.uncheckInFromStation = exports.uncheckStationCheckIn;

/** 將 RSVP 用戶加入站點 Section List */
exports.addUsersToStationList = async (req, res) => {
    const { eventId, stationId } = req.params;
    const raw = (req.body && (req.body.userIds || req.body.userId)) || [];
    const userIds = (Array.isArray(raw) ? raw : [raw])
        .map((id) => String(id || '').trim())
        .filter(Boolean);
    try {
        if (!userIds.length) {
            return res.status(400).json({ message: 'userIds is required' });
        }
        for (const id of userIds) {
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({ message: 'Invalid userId: ' + id });
            }
        }

        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ message: 'Event not found' });
        const station = findStation(event, stationId);
        if (!station) return res.status(404).json({ message: 'Station not found' });

        station.allowedUserIds = station.allowedUserIds || [];
        const existing = new Set(getAllowedUserIds(station));
        const added = [];
        const skipped = [];

        for (const id of userIds) {
            const user = findUser(event, id);
            if (!user) {
                skipped.push({ userId: id, reason: 'USER_NOT_FOUND' });
                continue;
            }
            if (!user.isCheckIn) {
                skipped.push({ userId: id, reason: 'NOT_ENTERED' });
                continue;
            }
            if (existing.has(id)) {
                skipped.push({ userId: id, reason: 'ALREADY_IN_LIST' });
                continue;
            }
            station.allowedUserIds.push(user._id);
            existing.add(id);
            added.push(serializeListUser(user, alreadyCheckedIn(event, stationId, id)));
        }

        station.modified_at = new Date();
        event.markModified('checkInStations');
        await event.save();

        return res.status(200).json({
            message: 'Section list updated',
            station: serializeStation(station, countByStation(event)[String(station._id)] || 0),
            added,
            skipped,
        });
    } catch (err) {
        console.error('addUsersToStationList:', err);
        return res.status(500).json({ message: err.message || 'Server error' });
    }
};

function parseIncludeCell(raw) {
    if (typeof raw === 'boolean') return raw;
    if (typeof raw === 'number') return raw === 1;
    const v = raw != null ? String(raw).trim().toLowerCase() : '';
    return v === 'y' || v === 'yes' || v === 'true' || v === '1' || v === '是';
}

function findHeaderIndex(headerRow, candidates) {
    const normalized = headerRow.map((h) => String(h || '').trim().toLowerCase());
    for (const name of candidates) {
        const idx = normalized.indexOf(String(name).toLowerCase());
        if (idx !== -1) return idx;
    }
    return -1;
}

/** 匯出完整 RSVP 表（含 _id + include）供 Section List 編輯後再匯入 */
exports.exportStationSectionListTemplate = async (req, res) => {
    const { eventId, stationId } = req.params;
    try {
        const XLSX = require('xlsx');
        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ message: 'Event not found' });
        const station = findStation(event, stationId);
        if (!station) return res.status(404).json({ message: 'Station not found' });

        const allowedSet = new Set(getAllowedUserIds(station));
        const header = ['_id', 'name', 'email', 'phone', 'isCheckIn', 'include'];
        const rows = [header];

        (event.users || []).forEach((u) => {
            const id = u && u._id ? String(u._id) : '';
            if (!id) return;
            rows.push([
                id,
                u.name != null ? String(u.name) : '',
                u.email != null ? String(u.email) : '',
                u.phone != null ? String(u.phone) : '',
                u.isCheckIn ? 'Y' : '',
                allowedSet.has(id) ? 'Y' : '',
            ]);
        });

        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'SectionList');
        const buffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

        const safeName = String(station.name || 'station').replace(/[\\/:*?"<>|]+/g, '_').slice(0, 40);
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename=station_section_list_${safeName}.xlsx`
        );
        return res.send(Buffer.from(buffer));
    } catch (err) {
        console.error('exportStationSectionListTemplate:', err);
        return res.status(500).json({ message: err.message || 'Server error' });
    }
};

/**
 * 以 xlsx 同步 Section List：
 * - 只認 _id + include（Y = 加入／保留；非 Y = 移出）
 * - 不依賴 name / email / phone
 * - 已在名單且仍為 Y → 不重覆加入
 * - 上次有 Y、今次清走 → 移出
 */
exports.importStationSectionList = async (req, res) => {
    const { eventId, stationId } = req.params;
    const multer = require('multer');
    const XLSX = require('xlsx');
    const upload = multer({
        storage: multer.memoryStorage(),
        limits: { fileSize: 8 * 1024 * 1024 },
    }).single('file');

    upload(req, res, async (uploadErr) => {
        if (uploadErr) {
            return res.status(400).json({ message: uploadErr.message || 'Upload failed' });
        }
        try {
            if (!req.file || !req.file.buffer) {
                return res.status(400).json({ message: 'No file uploaded' });
            }

            const event = await Event.findById(eventId);
            if (!event) return res.status(404).json({ message: 'Event not found' });
            const station = findStation(event, stationId);
            if (!station) return res.status(404).json({ message: 'Station not found' });

            const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
            const sheetName = workbook.SheetNames[0];
            if (!sheetName) {
                return res.status(400).json({ message: 'Workbook has no sheets' });
            }
            const sheet = workbook.Sheets[sheetName];
            const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
            if (!aoa || aoa.length < 2) {
                return res.status(400).json({ message: 'File is empty or missing data rows' });
            }

            const headerRow = aoa[0] || [];
            const idIdx = findHeaderIndex(headerRow, ['_id', 'id', 'userid', 'user_id', 'objectid']);
            const includeIdx = findHeaderIndex(headerRow, ['include', 'y', 'included', 'in_list']);
            if (idIdx === -1) {
                return res.status(400).json({ message: 'Missing required column: _id' });
            }
            if (includeIdx === -1) {
                return res.status(400).json({ message: 'Missing required column: include' });
            }

            station.allowedUserIds = station.allowedUserIds || [];
            const existing = new Set(getAllowedUserIds(station));
            const added = [];
            const removed = [];
            const unchanged = [];
            const skipped = [];
            const seenIds = new Set();

            for (let r = 1; r < aoa.length; r++) {
                const row = aoa[r] || [];
                const rawId = row[idIdx];
                const id = rawId != null ? String(rawId).trim() : '';
                if (!id) continue;
                if (seenIds.has(id)) {
                    skipped.push({ userId: id, reason: 'DUPLICATE_ROW' });
                    continue;
                }
                seenIds.add(id);

                if (!mongoose.Types.ObjectId.isValid(id)) {
                    skipped.push({ userId: id, reason: 'INVALID_ID' });
                    continue;
                }

                const user = findUser(event, id);
                if (!user) {
                    skipped.push({ userId: id, reason: 'USER_NOT_FOUND' });
                    continue;
                }

                const wantInclude = parseIncludeCell(row[includeIdx]);
                const isInList = existing.has(id);

                if (wantInclude) {
                    if (isInList) {
                        unchanged.push(id);
                    } else {
                        station.allowedUserIds.push(user._id);
                        existing.add(id);
                        added.push(id);
                    }
                } else if (isInList) {
                    station.allowedUserIds = station.allowedUserIds.filter(
                        (uid) => String(uid) !== id
                    );
                    existing.delete(id);
                    removed.push(id);
                } else {
                    unchanged.push(id);
                }
            }

            station.modified_at = new Date();
            event.markModified('checkInStations');
            await event.save();

            return res.status(200).json({
                message: 'Section list imported',
                station: serializeStation(station, countByStation(event)[String(station._id)] || 0),
                summary: {
                    added: added.length,
                    removed: removed.length,
                    unchanged: unchanged.length,
                    skipped: skipped.length,
                },
                added,
                removed,
                skipped,
            });
        } catch (err) {
            console.error('importStationSectionList:', err);
            return res.status(500).json({ message: err.message || 'Server error' });
        }
    });
};

/** 從站點 Section List 移除用戶 */
exports.removeUserFromStationList = async (req, res) => {
    const { eventId, stationId, userId } = req.params;
    try {
        if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(400).json({ message: 'Invalid userId' });
        }

        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ message: 'Event not found' });
        const station = findStation(event, stationId);
        if (!station) return res.status(404).json({ message: 'Station not found' });

        const before = getAllowedUserIds(station).length;
        station.allowedUserIds = (station.allowedUserIds || []).filter(
            (id) => String(id) !== String(userId)
        );
        if (getAllowedUserIds(station).length === before) {
            return res.status(404).json({
                message: 'User not in station section list',
                code: 'NOT_IN_STATION_LIST',
            });
        }

        station.modified_at = new Date();
        event.markModified('checkInStations');
        await event.save();

        return res.json({
            message: 'User removed from section list',
            station: serializeStation(station, countByStation(event)[String(station._id)] || 0),
            userId: String(userId),
        });
    } catch (err) {
        console.error('removeUserFromStationList:', err);
        return res.status(500).json({ message: err.message || 'Server error' });
    }
};

/** 取得站點 Section List */
exports.getStationSectionList = async (req, res) => {
    const { eventId, stationId } = req.params;
    try {
        const event = await Event.findById(eventId);
        if (!event) return res.status(404).json({ message: 'Event not found' });
        const station = findStation(event, stationId);
        if (!station) return res.status(404).json({ message: 'Station not found' });

        const checkedInUserIds = new Set(
            (event.stationCheckIns || [])
                .filter((r) => String(r.stationId) === String(stationId))
                .map((r) => String(r.userId))
        );
        const users = getAllowedUserIds(station)
            .map((id) => findUser(event, id))
            .filter(Boolean)
            .map((u) => serializeListUser(u, checkedInUserIds.has(String(u._id))));

        return res.json({
            station: serializeStation(station, checkedInUserIds.size),
            users,
        });
    } catch (err) {
        console.error('getStationSectionList:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};

/** 取得站點列表（含簽到人數） */
exports.listStations = async (req, res) => {
    const { eventId } = req.params;
    try {
        const event = await Event.findById(eventId).select({
            checkInStations: 1,
            stationCheckIns: 1,
            owner: 1,
        });
        if (!event) return res.status(404).json({ message: 'Event not found' });

        const counts = countByStation(event);
        const stations = (event.checkInStations || [])
            .slice()
            .sort((a, b) => (a.order || 0) - (b.order || 0))
            .map((s) => serializeStation(s, counts[String(s._id)] || 0));

        return res.json(stations);
    } catch (err) {
        console.error('listStations:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};

/** 取得單一站點簽到記錄 */
exports.listStationCheckIns = async (req, res) => {
    const { eventId, stationId } = req.params;
    try {
        const event = await Event.findById(eventId).select({
            checkInStations: 1,
            stationCheckIns: 1,
            owner: 1,
        });
        if (!event) return res.status(404).json({ message: 'Event not found' });
        const station = findStation(event, stationId);
        if (!station) return res.status(404).json({ message: 'Station not found' });

        const records = (event.stationCheckIns || [])
            .filter((r) => String(r.stationId) === String(stationId))
            .slice()
            .sort((a, b) => new Date(b.checkedInAt) - new Date(a.checkedInAt));

        return res.json({
            station: serializeStation(station, records.length),
            checkIns: records,
        });
    } catch (err) {
        console.error('listStationCheckIns:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};

/** 取得某用戶在各站點的簽到狀態 */
exports.getUserStationCheckIns = async (req, res) => {
    const { eventId, userId } = req.params;
    try {
        const event = await Event.findById(eventId).select({
            users: 1,
            checkInStations: 1,
            stationCheckIns: 1,
            owner: 1,
        });
        if (!event) return res.status(404).json({ message: 'Event not found' });
        const user = findUser(event, userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const userRecords = (event.stationCheckIns || []).filter(
            (r) => String(r.userId) === String(userId)
        );
        const byStation = {};
        userRecords.forEach((r) => {
            byStation[String(r.stationId)] = r;
        });

        const stations = (event.checkInStations || []).map((s) => {
            const rec = byStation[String(s._id)];
            return {
                ...serializeStation(s),
                checkedIn: !!rec,
                checkedInAt: rec ? rec.checkedInAt : null,
            };
        });

        return res.json({
            user: {
                _id: user._id,
                name: user.name,
                email: user.email,
                isCheckIn: !!user.isCheckIn,
                checkInAt: user.checkInAt || null,
            },
            stations,
        });
    } catch (err) {
        console.error('getUserStationCheckIns:', err);
        return res.status(500).json({ message: 'Server error' });
    }
};

exports.performStationCheckIn = performStationCheckIn;
