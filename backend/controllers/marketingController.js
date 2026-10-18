const Campaign = require('../models/Campaign');
const Coupon = require('../models/Coupon');
const Membership = require('../models/Membership');
const Newsletter = require('../models/Newsletter');
const { sendMarketingCampaignEmail } = require('../config/mailer');
const logger = require('../config/logger');
const crypto = require('crypto');
const { getFrontendBaseUrl } = require('../config/frontendUrl');

const getAdminMarketing = async (req, res, next) => {
    try {
        const [coupons, campaigns] = await Promise.all([
            Coupon.find().sort({ createdAt: -1 }).limit(50).lean(),
            Campaign.find().sort({ createdAt: -1 }).limit(20).lean()
        ]);
        return res.json({ success: true, data: { coupons, campaigns } });
    } catch (error) {
        next(error);
    }
};

const createAdminCoupon = async (req, res, next) => {
    try {
        const code = String(req.body.code || '').trim().toUpperCase();
        const discountPercent = Number(req.body.discountPercent);
        const maxDiscountAmount = Number(req.body.maxDiscountAmount);
        const minOrderAmount = Number(req.body.minOrderAmount);
        const maxRedemptions = req.body.maxRedemptions === ''
            ? undefined
            : Number(req.body.maxRedemptions);

        if (!/^[A-Z0-9_-]{4,32}$/.test(code)) {
            return res.status(400).json({ success: false, error: 'El código debe tener 4 a 32 caracteres: letras, números, guiones o guion bajo.' });
        }
        if (!Number.isFinite(discountPercent) || discountPercent < 1 || discountPercent > 100) {
            return res.status(400).json({ success: false, error: 'El descuento debe estar entre 1% y 100%.' });
        }
        if (!Number.isFinite(maxDiscountAmount) || maxDiscountAmount <= 0 ||
            !Number.isFinite(minOrderAmount) || minOrderAmount < 0) {
            return res.status(400).json({ success: false, error: 'Revisa los montos máximo y mínimo del cupón.' });
        }
        if (maxRedemptions !== undefined && (!Number.isInteger(maxRedemptions) || maxRedemptions < 1)) {
            return res.status(400).json({ success: false, error: 'El límite de usos debe ser un entero positivo.' });
        }

        const expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : undefined;
        if (expiresAt && (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date())) {
            return res.status(400).json({ success: false, error: 'La fecha de vencimiento debe ser futura.' });
        }

        const coupon = await Coupon.create({
            code,
            type: 'campaign',
            discountPercent,
            maxDiscountAmount,
            minOrderAmount,
            maxRedemptions,
            expiresAt,
            description: String(req.body.description || '').trim()
        });
        res.status(201).json({ success: true, coupon });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ success: false, error: 'Ya existe un cupón con ese código.' });
        }
        next(error);
    }
};

const updateAdminCouponStatus = async (req, res, next) => {
    try {
        const coupon = await Coupon.findById(req.params.id);
        if (!coupon) {
            return res.status(404).json({ success: false, error: 'Cupón no encontrado.' });
        }
        coupon.active = !coupon.active;
        await coupon.save();
        res.json({ success: true, coupon });
    } catch (error) {
        next(error);
    }
};

const getCampaignRecipients = async (audience) => {
    const [newsletterRecipients, vipRecipients] = await Promise.all([
        audience === 'vip'
            ? Promise.resolve([])
            : Newsletter.find({ isSubscribed: { $ne: false } }).select('email unsubscribeToken').limit(1001).lean(),
        audience === 'newsletter'
            ? Promise.resolve([])
            : Membership.find({
                status: 'active',
                currentPeriodEnd: { $gt: new Date() },
                ...(process.env.NODE_ENV === 'production' ? { provider: { $exists: true, $ne: 'mock' } } : {}),
                marketingOptIn: true,
                marketingToken: { $exists: true, $ne: '' }
            }).populate('user', 'email name').select('marketingToken user').limit(1001).lean()
    ]);

    const recipients = [
        ...await Promise.all(newsletterRecipients.map(async recipient => {
            let token = recipient.unsubscribeToken;
            if (!token) {
                const generatedToken = crypto.randomBytes(24).toString('hex');
                const updated = await Newsletter.updateOne(
                    { _id: recipient._id, $or: [{ unsubscribeToken: { $exists: false } }, { unsubscribeToken: null }] },
                    { $set: { unsubscribeToken: generatedToken } }
                );
                token = updated.modifiedCount
                    ? generatedToken
                    : (await Newsletter.findById(recipient._id).select('unsubscribeToken').lean())?.unsubscribeToken;
            }
            if (!token) throw new Error(`No se pudo generar enlace de baja para ${recipient.email}.`);
            return {
                email: recipient.email,
                name: '',
                newsletterToken: token
            };
        })),
        ...vipRecipients
            .filter(membership => membership.user?.email)
            .map(membership => ({
                email: membership.user.email,
                name: membership.user.name || '',
                vipToken: membership.marketingToken
            }))
    ];

    const deduplicated = new Map();
    recipients.forEach(recipient => {
        const key = recipient.email.toLowerCase();
        const existing = deduplicated.get(key) || { email: recipient.email, name: '' };
        deduplicated.set(key, {
            ...existing,
            ...recipient,
            name: recipient.name || existing.name
        });
    });

    const appUrl = getFrontendBaseUrl() || (process.env.APP_URL || 'http://localhost:3001').replace(/\/$/, '');
    return [...deduplicated.values()].map(recipient => {
        const params = new URLSearchParams();
        if (recipient.newsletterToken) params.set('newsletter', recipient.newsletterToken);
        if (recipient.vipToken) params.set('vip', recipient.vipToken);
        return {
            ...recipient,
            unsubscribeUrl: `${appUrl}/marketing/unsubscribe?${params.toString()}`
        };
    });
};

const sendAdminCampaign = async (req, res, next) => {
    let campaign;
    try {
        const { name, subject, content, audience, couponCode } = req.body;
        if (!['newsletter', 'vip', 'all'].includes(audience)) {
            return res.status(400).json({ success: false, error: 'Selecciona un público válido.' });
        }
        if (!String(name || '').trim() || !String(subject || '').trim() || !String(content || '').trim()) {
            return res.status(400).json({ success: false, error: 'Completa el nombre, asunto y contenido de la campaña.' });
        }
        if (/[\r\n]/.test(subject)) {
            return res.status(400).json({ success: false, error: 'El asunto no puede contener saltos de línea.' });
        }

        const normalizedCouponCode = String(couponCode || '').trim().toUpperCase();
        if (normalizedCouponCode) {
            const coupon = await Coupon.findOne({
                code: normalizedCouponCode,
                active: true,
                $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }]
            }).select('_id').lean();
            if (!coupon) {
                return res.status(400).json({ success: false, error: 'El cupón incluido no existe, venció o está desactivado.' });
            }
        }

        const recipients = await getCampaignRecipients(audience);
        if (!recipients.length) {
            return res.status(400).json({ success: false, error: 'No hay destinatarios con consentimiento para esta campaña.' });
        }
        if (recipients.length > 1000) {
            return res.status(413).json({ success: false, error: 'La campaña supera el límite de 1000 destinatarios. Usa segmentos más pequeños.' });
        }

        campaign = await Campaign.create({
            name: String(name).trim(),
            subject: String(subject).trim(),
            content: String(content).trim(),
            audience,
            couponCode: normalizedCouponCode || undefined,
            recipientCount: recipients.length,
            status: 'sending'
        });

        const results = [];
        for (const recipient of recipients) {
            try {
                const result = await sendMarketingCampaignEmail({
                    to: recipient.email,
                    subject: campaign.subject,
                    name: recipient.name,
                    content: campaign.content,
                    couponCode: campaign.couponCode,
                    unsubscribeUrl: recipient.unsubscribeUrl
                });
                results.push({
                    email: recipient.email,
                    status: result.simulated ? 'simulated' : 'sent'
                });
            } catch (error) {
                logger.error(`Falló el envío de campaña ${campaign._id} a ${recipient.email}: ${error.message}`);
                results.push({ email: recipient.email, status: 'failed' });
            }
        }

        const failedCount = results.filter(result => result.status === 'failed').length;
        const simulated = results.some(result => result.status === 'simulated');
        const sentCount = results.filter(result => result.status === 'sent').length;
        campaign.results = results;
        campaign.failedCount = failedCount;
        campaign.sentCount = sentCount;
        campaign.simulated = simulated;
        campaign.status = failedCount
            ? (failedCount === results.length ? 'failed' : 'partial')
            : (simulated ? 'simulated' : 'sent');
        await campaign.save();

        res.status(201).json({
            success: true,
            message: simulated
                ? `Campaña registrada en modo simulado para ${recipients.length} destinatario(s); no se enviaron correos.`
                : `Campaña procesada: ${sentCount} enviado(s), ${failedCount} fallido(s).`,
            campaign
        });
    } catch (error) {
        if (campaign) {
            campaign.status = 'failed';
            await campaign.save();
        }
        next(error);
    }
};

module.exports = {
    getAdminMarketing,
    createAdminCoupon,
    updateAdminCouponStatus,
    sendAdminCampaign
};
