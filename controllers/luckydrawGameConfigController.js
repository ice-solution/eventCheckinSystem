const LuckydrawGameConfig = require('../model/LuckydrawGameConfig');

function getDefaultConfig(eventId, baseUrl) {
    return {
        api: {
            serverUrl: baseUrl || '',
            eventId: eventId || ''
        },
        timing: {
            accelerate: 1500,
            fullSpeed: 2500,
            stopFirst: 5000,
            stopSecond: 1500,
            stopThird: 1500,
            reveal: 1500,
            celebrate: 3000
        },
        speed: { max: 2000, min: 100 },
        visual: { fontSize: 48, highlightScale: 1.15 },
        animations: {
            fadeIn: 500,
            fadeOut: 300,
            scaleUp: 400,
            scaleDown: 300
        },
        draw: { drawCount: 10 },
        ui: {
            subtitle: 'ANNUAL PARTY 2026',
            waitingText: '等待控制器開始抽獎...',
            welcomeHint: '等待主持開始',
            congratsTitle: '恭喜得獎！',
            drawingText: '抽獎中...',
            winnerNumberLabel: '第1號',
            winnerCardSlots: [
                { type: 'label', text: '第1號', yPosition: 0.18, fontSize: 28, color: '#ffd700', bold: true, fontType: 'subtitle' },
                { type: 'prize', yPosition: 0.28, fontSize: 36, color: '#ffd700', bold: true, fontType: 'subtitle' },
                { type: 'divider', yPosition: 0.40 },
                { type: 'field', key: 'name', yPosition: 0.52, fontSize: 64, color: '#ffffff', bold: true, fontType: 'title' },
                { type: 'field', key: 'staff_num', yPosition: 0.68, fontSize: 24, color: '#ffffff', fontType: 'body' },
                { type: 'field', key: 'department', fallback: 'company', yPosition: 0.80, fontSize: 28, color: '#333333', bold: true, fontType: 'body', hasBackground: true }
            ]
        }
    };
}

function getBaseUrl(req) {
    const protocol = req.get('x-forwarded-proto') || req.protocol || 'http';
    const host = req.get('x-forwarded-host') || req.get('host') || '';
    return `${protocol}://${host}`;
}

/** 公開 API：前端取得該活動的 game config（會自動帶入 api.serverUrl 與 api.eventId）*/
exports.getConfigApi = async (req, res) => {
    const { eventId } = req.params;
    try {
        let doc = await LuckydrawGameConfig.findOne({ eventId }).lean();
        const baseUrl = getBaseUrl(req);
        const config = doc ? doc.config : getDefaultConfig(eventId, baseUrl);
        config.api = config.api || {};
        config.api.serverUrl = baseUrl;
        config.api.eventId = eventId;
        res.json(config);
    } catch (err) {
        console.error('getConfigApi error:', err);
        const baseUrl = getBaseUrl(req);
        res.json(getDefaultConfig(eventId, baseUrl));
    }
};

/** 後台：顯示編輯頁 */
exports.renderConfigPage = async (req, res) => {
    const { eventId } = req.params;
    try {
        const event = await require('../model/Event').findById(eventId);
        if (!event) return res.status(404).send('Event not found');
        let doc = await LuckydrawGameConfig.findOne({ eventId }).lean();
        const baseUrl = getBaseUrl(req);
        const config = doc ? doc.config : getDefaultConfig(eventId, baseUrl);
        res.render('admin/luckydraw_game_config', { eventId, event, config });
    } catch (err) {
        console.error('renderConfigPage error:', err);
        res.status(500).send('Server error');
    }
};

/** 後台：儲存 config */
exports.saveConfig = async (req, res) => {
    const { eventId } = req.params;
    let body = req.body;
    if (typeof body.config === 'string') {
        try {
            body = JSON.parse(body.config);
        } catch (e) {
            return res.status(400).json({ success: false, message: 'Invalid JSON config' });
        }
    }
    try {
        const config = body.config != null ? body.config : body;
        if (!config || typeof config !== 'object') {
            return res.status(400).json({ success: false, message: 'Config object required' });
        }
        await LuckydrawGameConfig.findOneAndUpdate(
            { eventId },
            { config, updatedAt: new Date() },
            { upsert: true, new: true }
        );
        res.json({ success: true });
    } catch (err) {
        console.error('saveConfig error:', err);
        res.status(500).json({ success: false, message: 'Save failed' });
    }
};
