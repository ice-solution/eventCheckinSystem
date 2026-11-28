const mongoose = require('mongoose');
const Vote = require('../model/Vote');
const Event = require('../model/Event');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const QUESTION_COUNT = 3;
const DEFAULT_SLOT_COUNTS = [3, 5, 5]; // Team / King / Queen 參考
const DEFAULT_TITLES = [
    'Best Dressed Team',
    'Best Dressed King',
    'Best Dressed Queen'
];

const uploadDir = path.join(__dirname, '..', 'public', 'votes', 'img');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const uploadVoteImage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const eventId = req.params.eventId;
        const qid = String(req.params.questionId || 'q').slice(-6);
        const ext = path.extname(file.originalname) || '.jpg';
        cb(null, `${eventId}_${qid}_${Date.now()}${ext}`);
    }
});

const uploadVoteImageMulter = multer({
    storage: uploadVoteImage,
    limits: { fileSize: 1024 * 1024 * 8 },
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('只允許上傳圖片'), false);
        }
        cb(null, true);
    }
});

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function findRsvpUserByEmail(event, email) {
    const target = normalizeEmail(email);
    if (!target) return null;
    return (event.users || []).find((u) => normalizeEmail(u.email) === target) || null;
}

/** 只拎匹配 email 嘅一位 RSVP user，唔拉成份 Event（users/guestList 好大） */
async function findRsvpUserByEmailFast(eventId, email) {
    const target = normalizeEmail(email);
    if (!target || !mongoose.Types.ObjectId.isValid(eventId)) {
        return { ok: false, reason: 'invalid' };
    }
    const oid = new mongoose.Types.ObjectId(eventId);
    const rows = await Event.aggregate([
        { $match: { _id: oid } },
        {
            $project: {
                user: {
                    $arrayElemAt: [
                        {
                            $filter: {
                                input: { $ifNull: ['$users', []] },
                                as: 'u',
                                cond: {
                                    $eq: [
                                        {
                                            $toLower: {
                                                $trim: { input: { $ifNull: ['$$u.email', ''] } }
                                            }
                                        },
                                        target
                                    ]
                                }
                            }
                        },
                        0
                    ]
                }
            }
        }
    ]);
    if (!rows.length) return { ok: false, reason: 'event_missing' };
    if (!rows[0].user) return { ok: false, reason: 'not_in_rsvp' };
    return { ok: true, user: rows[0].user };
}

function buildSlots(count) {
    const n = Math.max(1, Math.min(10, Number(count) || 1));
    return Array.from({ length: n }, (_, i) => ({
        label: String(i + 1),
        votes: 0
    }));
}

/** 確保永遠有 3 條題目（舊 vote 會遷移）；只喺真係有改動先 markModified */
async function ensureThreeQuestions(vote) {
    if (!vote.questions) vote.questions = [];
    let changed = false;

    // 舊版 options → 當作第 1 題 slots（一次性遷移）
    if (vote.questions.length === 0 && Array.isArray(vote.options) && vote.options.length) {
        vote.questions.push({
            title: vote.title || DEFAULT_TITLES[0],
            kvImage: '',
            order: 0,
            slots: vote.options.map((o, i) => ({
                label: o.name || String(i + 1),
                votes: o.votes || 0
            }))
        });
        vote.options = undefined;
        vote.markModified('options');
        changed = true;
    }

    while (vote.questions.length < QUESTION_COUNT) {
        const idx = vote.questions.length;
        vote.questions.push({
            title: DEFAULT_TITLES[idx] || `Question ${idx + 1}`,
            kvImage: '',
            order: idx,
            slots: buildSlots(DEFAULT_SLOT_COUNTS[idx] || 5)
        });
        changed = true;
    }
    if (vote.questions.length > QUESTION_COUNT) {
        vote.questions.splice(QUESTION_COUNT);
        changed = true;
    }

    // 依 order 排（admin drag & drop）
    const orderBefore = vote.questions.map((q) => String(q._id)).join(',');
    vote.questions.sort((a, b) => (a.order || 0) - (b.order || 0));
    vote.questions.forEach((q, i) => {
        if ((q.order || 0) !== i) {
            q.order = i;
            changed = true;
        }
        if (!Array.isArray(q.slots) || q.slots.length === 0) {
            q.slots = buildSlots(DEFAULT_SLOT_COUNTS[i] || 5);
            changed = true;
        }
    });
    const orderAfter = vote.questions.map((q) => String(q._id)).join(',');
    if (orderBefore !== orderAfter) changed = true;

    if (changed) vote.markModified('questions');
    return vote;
}

function getVoteSession(req, eventId) {
    const auth = req.session && req.session.voteAuth;
    if (!auth || String(auth.eventId) !== String(eventId)) return null;
    return auth;
}

function publicQuestionPayload(question) {
    return {
        _id: question._id,
        title: question.title || '',
        kvImage: question.kvImage || '',
        order: question.order || 0,
        slots: (question.slots || []).map((s) => ({
            _id: s._id,
            label: s.label
        }))
    };
}

function buildStaticResults(vote) {
    const ballotCount = (vote.records || []).length;
    const questions = (vote.questions || []).map((q) => {
        const slots = (q.slots || []).map((s) => ({
            _id: s._id,
            label: s.label,
            votes: s.votes || 0,
            percentage: ballotCount > 0 ? Math.round(((s.votes || 0) / ballotCount) * 100) : 0
        }));
        return {
            _id: q._id,
            title: q.title,
            kvImage: q.kvImage,
            order: q.order,
            slots
        };
    });
    return { ballotCount, questions };
}

// ── Admin ──────────────────────────────────────────────

exports.renderVoteAdmin = async (req, res) => {
    const { eventId } = req.params;
    try {
        const event = await Event.findById(eventId);
        if (!event) return res.status(404).send('Event not found');

        let vote = await Vote.findOne({ eventId });
        if (!vote) {
            vote = new Vote({
                eventId,
                title: 'Best Dressed Awards',
                description: '請完成三條題目後提交',
                questions: [],
                records: [],
                isActive: true
            });
        }
        await ensureThreeQuestions(vote);
        await vote.save();

        const results = buildStaticResults(vote);
        const ballots = (vote.records || [])
            .slice()
            .sort((a, b) => new Date(b.votedAt || 0) - new Date(a.votedAt || 0))
            .map((r) => ({
                _id: r._id,
                userEmail: r.userEmail || '',
                userName: r.userName || '',
                votedAt: r.votedAt || null
            }));
        res.render('admin/vote_admin', {
            eventId,
            vote,
            event,
            results,
            ballots
        });
    } catch (error) {
        console.error('Error rendering vote admin:', error);
        res.status(500).send('Error rendering vote admin');
    }
};

function normalizeVoteEmail(email) {
    return String(email || '').trim().toLowerCase();
}

/** 取消某份選票（扣減對應 slot 票數），之後該 email 可重投 */
exports.clearBallot = async (req, res) => {
    const { eventId } = req.params;
    const email = normalizeVoteEmail(req.body && req.body.email);
    const ballotId = req.body && req.body.ballotId ? String(req.body.ballotId) : '';

    try {
        const vote = await Vote.findOne({ eventId });
        if (!vote) return res.status(404).json({ message: 'Vote not found' });
        await ensureThreeQuestions(vote);

        let idx = -1;
        if (ballotId) {
            idx = (vote.records || []).findIndex((r) => String(r._id) === ballotId);
        } else if (email) {
            idx = (vote.records || []).findIndex(
                (r) => normalizeVoteEmail(r.userEmail) === email
            );
        } else {
            return res.status(400).json({ message: 'Provide email or ballotId' });
        }

        if (idx < 0) {
            return res.status(404).json({ message: 'Ballot not found' });
        }

        const record = vote.records[idx];
        (record.answers || []).forEach((ans) => {
            const question = vote.questions.id(ans.questionId);
            if (!question) return;
            const slot = question.slots.id(ans.slotId);
            if (!slot) return;
            slot.votes = Math.max(0, (slot.votes || 0) - 1);
        });

        vote.records.splice(idx, 1);
        vote.markModified('questions');
        vote.markModified('records');
        vote.modified_at = Date.now();
        await vote.save();

        res.json({
            message: 'Ballot cleared; guest can vote again',
            email: record.userEmail || email,
            results: buildStaticResults(vote)
        });
    } catch (error) {
        console.error('Error clearing ballot:', error);
        res.status(500).json({ message: 'Failed to clear ballot' });
    }
};

exports.updateVoteSettings = async (req, res) => {
    const { eventId } = req.params;
    const {
        title,
        description,
        isActive,
        headerRight,
        gateTitle,
        pickHint,
        submitLabel,
        doneTitle
    } = req.body;
    try {
        const vote = await Vote.findOne({ eventId });
        if (!vote) return res.status(404).json({ message: 'Vote not found' });

        if (title != null) vote.title = String(title);
        if (description != null) vote.description = String(description);
        if (headerRight != null) vote.headerRight = String(headerRight);
        if (gateTitle != null) vote.gateTitle = String(gateTitle);
        if (pickHint != null) vote.pickHint = String(pickHint);
        if (submitLabel != null) vote.submitLabel = String(submitLabel);
        if (doneTitle != null) vote.doneTitle = String(doneTitle);
        if (typeof isActive === 'boolean') vote.isActive = isActive;
        else if (isActive != null) vote.isActive = String(isActive) === 'true';

        vote.modified_at = Date.now();
        await vote.save();
        res.json({ message: 'Settings updated successfully', vote });
    } catch (error) {
        console.error('Error updating vote settings:', error);
        res.status(500).json({ message: 'Error updating vote settings' });
    }
};

exports.updateQuestion = async (req, res) => {
    const { eventId, questionId } = req.params;
    const { title, slotCount, slotLabels } = req.body;
    try {
        const vote = await Vote.findOne({ eventId });
        if (!vote) return res.status(404).json({ message: 'Vote not found' });
        await ensureThreeQuestions(vote);

        const question = vote.questions.id(questionId);
        if (!question) return res.status(404).json({ message: 'Question not found' });

        if (title != null) question.title = String(title).trim();

        let labels = slotLabels;
        if (typeof labels === 'string') {
            try { labels = JSON.parse(labels); } catch (e) { labels = null; }
        }

        const prev = (question.slots || []).map((s) => ({
            label: s.label,
            votes: s.votes || 0,
            _id: s._id
        }));

        let nextCount = prev.length;
        if (Array.isArray(labels) && labels.length) {
            nextCount = Math.max(1, Math.min(10, labels.length));
        } else if (slotCount != null) {
            nextCount = Math.max(1, Math.min(10, Number(slotCount) || 1));
        }

        if (Array.isArray(labels) && labels.length || slotCount != null) {
            question.slots.splice(0, question.slots.length);
            for (let i = 0; i < nextCount; i += 1) {
                const old = prev[i];
                const label = Array.isArray(labels) && labels[i] != null
                    ? String(labels[i]).trim() || String(i + 1)
                    : (old && old.label ? old.label : String(i + 1));
                const doc = { label, votes: old ? old.votes : 0 };
                if (old && old._id) doc._id = old._id;
                question.slots.push(doc);
            }
        }

        vote.markModified('questions');
        vote.modified_at = Date.now();
        await vote.save();

        res.json({ message: 'Question updated', question });
    } catch (error) {
        console.error('Error updating question:', error);
        res.status(500).json({ message: 'Error updating question' });
    }
};

exports.reorderQuestions = async (req, res) => {
    const { eventId } = req.params;
    const order = Array.isArray(req.body.order) ? req.body.order.map(String) : [];
    try {
        const vote = await Vote.findOne({ eventId });
        if (!vote) return res.status(404).json({ message: 'Vote not found' });
        await ensureThreeQuestions(vote);

        if (order.length !== vote.questions.length) {
            return res.status(400).json({ message: 'Invalid order length' });
        }

        const map = new Map(vote.questions.map((q) => [String(q._id), q]));
        const next = [];
        for (const id of order) {
            const q = map.get(id);
            if (!q) return res.status(400).json({ message: 'Unknown question id in order' });
            next.push(q);
            map.delete(id);
        }
        if (map.size > 0) {
            return res.status(400).json({ message: 'Order must include every question' });
        }

        // 只更新 order 欄，避免整組 subdoc 重設丟資料
        order.forEach((id, i) => {
            const q = vote.questions.id(id);
            if (q) q.order = i;
        });
        vote.questions.sort((a, b) => (a.order || 0) - (b.order || 0));
        vote.markModified('questions');
        vote.modified_at = Date.now();
        await vote.save();

        res.json({
            message: 'Order updated',
            order: vote.questions.map((q) => ({ _id: q._id, title: q.title, order: q.order }))
        });
    } catch (error) {
        console.error('Error reordering questions:', error);
        res.status(500).json({ message: 'Error reordering questions' });
    }
};

exports.uploadQuestionKv = async (req, res) => {
    const { eventId, questionId } = req.params;
    try {
        const vote = await Vote.findOne({ eventId });
        if (!vote) return res.status(404).json({ message: 'Vote not found' });
        await ensureThreeQuestions(vote);

        const question = vote.questions.id(questionId);
        if (!question) return res.status(404).json({ message: 'Question not found' });
        if (!req.file) return res.status(400).json({ message: 'No image uploaded' });

        question.kvImage = `/votes/img/${req.file.filename}`;
        vote.markModified('questions');
        vote.modified_at = Date.now();
        await vote.save();

        res.json({ message: 'KV uploaded', kvImage: question.kvImage, question });
    } catch (error) {
        console.error('Error uploading KV:', error);
        res.status(500).json({ message: 'Error uploading KV' });
    }
};

// ── Public ─────────────────────────────────────────────

exports.renderVotePage = async (req, res) => {
    const { eventId } = req.params;
    try {
        // 前台唔使整份 Event（含 users[]），exists 夠用
        const eventExists = await Event.exists({ _id: eventId });
        if (!eventExists) return res.status(404).send('Event not found');

        let vote = await Vote.findOne({ eventId });
        if (!vote) {
            return res.status(404).render('events/vote', {
                eventId,
                inactive: true,
                inactiveMessage: 'Vote not found or inactive',
                voter: null,
                hasVoted: false,
                questions: [],
                voteTitle: '',
                voteDescription: '',
                headerRight: '',
                gateTitle: '',
                pickHint: '',
                submitLabel: '',
                doneTitle: ''
            });
        }
        if (!vote.isActive) {
            return res.status(403).render('events/vote', {
                eventId,
                inactive: true,
                inactiveMessage: 'Voting is not open yet',
                voter: null,
                hasVoted: false,
                questions: [],
                voteTitle: vote.title || '',
                voteDescription: '',
                headerRight: vote.headerRight || '',
                gateTitle: '',
                pickHint: '',
                submitLabel: '',
                doneTitle: ''
            });
        }
        await ensureThreeQuestions(vote);
        if (vote.isModified('questions')) await vote.save();

        const auth = getVoteSession(req, eventId);
        let hasVoted = false;
        let voter = null;
        if (auth) {
            voter = { email: auth.email, name: auth.name, userId: auth.userId };
            hasVoted = (vote.records || []).some(
                (r) => String(r.userId) === String(auth.userId) || normalizeEmail(r.userEmail) === normalizeEmail(auth.email)
            );
        }

        res.render('events/vote', {
            eventId,
            inactive: false,
            inactiveMessage: '',
            vote,
            voter,
            hasVoted,
            questions: (vote.questions || []).map(publicQuestionPayload),
            voteTitle: vote.title || '',
            voteDescription: vote.description || '',
            headerRight: vote.headerRight || '',
            gateTitle: vote.gateTitle || '',
            pickHint: vote.pickHint || '',
            submitLabel: vote.submitLabel || '',
            doneTitle: vote.doneTitle || ''
        });
    } catch (error) {
        console.error('Error rendering vote page:', error);
        res.status(500).send('Error rendering vote page');
    }
};

exports.authVoteEmail = async (req, res) => {
    const { eventId } = req.params;
    const email = normalizeEmail(req.body.email);
    try {
        if (!email) {
            return res.status(400).json({ message: 'Please enter your email' });
        }

        const vote = await Vote.findOne({ eventId }).select('isActive records');
        if (!vote || !vote.isActive) {
            return res.status(404).json({ message: 'Vote not found or inactive' });
        }

        const found = await findRsvpUserByEmailFast(eventId, email);
        if (!found.ok && found.reason === 'event_missing') {
            return res.status(404).json({ message: 'Event not found' });
        }
        if (!found.ok) {
            return res.status(403).json({
                message: 'This email is not on the RSVP list for this event',
                code: 'NOT_IN_RSVP'
            });
        }

        const user = found.user;
        req.session.voteAuth = {
            eventId: String(eventId),
            userId: String(user._id),
            email: normalizeEmail(user.email),
            name: user.name || ''
        };

        const hasVoted = (vote.records || []).some(
            (r) => String(r.userId) === String(user._id) || normalizeEmail(r.userEmail) === normalizeEmail(user.email)
        );

        // 等 session 寫入完成先回應用，避免 reload 時仲未登入
        await new Promise((resolve, reject) => {
            req.session.save((err) => (err ? reject(err) : resolve()));
        });

        res.json({
            message: 'OK',
            voter: { email: req.session.voteAuth.email, name: req.session.voteAuth.name },
            hasVoted
        });
    } catch (error) {
        console.error('Error auth vote email:', error);
        res.status(500).json({ message: 'Login failed' });
    }
};

exports.logoutVote = async (req, res) => {
    try {
        if (req.session) {
            delete req.session.voteAuth;
            await new Promise((resolve, reject) => {
                req.session.save((err) => (err ? reject(err) : resolve()));
            });
        }
        res.json({ message: 'Logged out' });
    } catch (error) {
        console.error('Error logging out vote session:', error);
        res.status(500).json({ message: 'Logout failed' });
    }
};

exports.submitVote = async (req, res) => {
    const { eventId } = req.params;
    const answers = req.body.answers;

    try {
        const auth = getVoteSession(req, eventId);
        if (!auth) {
            return res.status(401).json({ message: 'Please sign in with your RSVP email first', code: 'NEED_LOGIN' });
        }

        const vote = await Vote.findOne({ eventId });
        if (!vote || !vote.isActive) {
            return res.status(404).json({ message: 'Vote not found or inactive' });
        }
        await ensureThreeQuestions(vote);

        const already = (vote.records || []).some(
            (r) => String(r.userId) === String(auth.userId) || normalizeEmail(r.userEmail) === normalizeEmail(auth.email)
        );
        if (already) {
            return res.status(400).json({ message: 'You have already voted', code: 'ALREADY_VOTED' });
        }

        if (!Array.isArray(answers) || answers.length !== QUESTION_COUNT) {
            return res.status(400).json({
                message: `Please complete all ${QUESTION_COUNT} questions before submitting`,
                code: 'INCOMPLETE'
            });
        }

        const normalized = [];
        const seenQ = new Set();
        for (const ans of answers) {
            const qid = String(ans.questionId || '');
            const sid = String(ans.slotId || '');
            if (!qid || !sid) {
                return res.status(400).json({ message: 'Incomplete answers', code: 'INCOMPLETE' });
            }
            if (seenQ.has(qid)) {
                return res.status(400).json({ message: 'Only one choice per question', code: 'DUPLICATE_Q' });
            }
            const question = vote.questions.id(qid);
            if (!question) {
                return res.status(400).json({ message: 'Question not found', code: 'BAD_QUESTION' });
            }
            const slot = question.slots.id(sid);
            if (!slot) {
                return res.status(400).json({ message: 'Option not found', code: 'BAD_SLOT' });
            }
            seenQ.add(qid);
            normalized.push({ questionId: question._id, slotId: slot._id, _slot: slot });
        }

        if (seenQ.size !== QUESTION_COUNT || vote.questions.length < QUESTION_COUNT) {
            return res.status(400).json({
                message: `Please complete all ${QUESTION_COUNT} questions before submitting`,
                code: 'INCOMPLETE'
            });
        }

        for (const q of vote.questions.slice(0, QUESTION_COUNT)) {
            if (!seenQ.has(String(q._id))) {
                return res.status(400).json({
                    message: `Please complete all ${QUESTION_COUNT} questions before submitting`,
                    code: 'INCOMPLETE'
                });
            }
        }

        normalized.forEach((a) => {
            a._slot.votes = (a._slot.votes || 0) + 1;
        });

        vote.records.push({
            userId: auth.userId,
            userEmail: auth.email,
            userName: auth.name || '',
            answers: normalized.map((a) => ({
                questionId: a.questionId,
                slotId: a.slotId
            })),
            votedAt: new Date()
        });

        vote.markModified('questions');
        vote.markModified('records');
        vote.modified_at = Date.now();
        await vote.save();

        res.json({
            message: 'Vote submitted',
            hasVoted: true,
            results: buildStaticResults(vote)
        });
    } catch (error) {
        console.error('Error submitting vote:', error);
        res.status(500).json({ message: 'Error submitting vote' });
    }
};

exports.getVoteResults = async (req, res) => {
    const { eventId } = req.params;
    try {
        if (!req.session || !req.session.user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        const vote = await Vote.findOne({ eventId });
        if (!vote) return res.status(404).json({ message: 'Vote not found' });
        await ensureThreeQuestions(vote);
        res.json(buildStaticResults(vote));
    } catch (error) {
        console.error('Error getting vote results:', error);
        res.status(500).json({ message: 'Error getting vote results' });
    }
};

// 舊 API 佔位（避免外連壞掉）
exports.checkUserVote = async (req, res) => {
    res.status(410).json({ message: 'Deprecated; use email session ballot' });
};
exports.addVoteOption = async (req, res) => {
    res.status(410).json({ message: 'Deprecated; configure question slots instead' });
};
exports.deleteVoteOption = async (req, res) => {
    res.status(410).json({ message: 'Deprecated; configure question slots instead' });
};

exports.uploadVoteImageMulter = uploadVoteImageMulter;
exports.ensureThreeQuestions = ensureThreeQuestions;
exports.QUESTION_COUNT = QUESTION_COUNT;
