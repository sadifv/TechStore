const Newsletter = require('../models/Newsletter');
const Membership = require('../models/Membership');
const crypto = require('crypto');
const logger = require('../config/logger');
const { redirectToFrontend } = require('../config/frontendUrl');

// @desc    Suscribir correo al newsletter
// @route   POST /api/newsletter
// @access  Public
const subscribeNewsletter = async (req, res, next) => {
    try {
        const email = String(req.body?.email || '').trim().toLowerCase();
        if (!/^\S+@\S+\.\S+$/.test(email)) {
            return res.status(400).json({ success: false, error: 'Ingresa un correo electrónico válido.' });
        }
        if (req.body?.consent !== true && req.body?.consent !== 'true' && req.body?.consent !== 'on') {
            return res.status(400).json({ success: false, error: 'Debes aceptar recibir el boletín para suscribirte.' });
        }

        const existingSubscriber = await Newsletter.findOne({ email });
        if (existingSubscriber && existingSubscriber.isSubscribed !== false) {
            return res.status(400).json({ 
                success: false, 
                error: 'Este correo ya se encuentra suscrito.' 
            });
        }

        if (existingSubscriber) {
            existingSubscriber.isSubscribed = true;
            existingSubscriber.unsubscribeToken = crypto.randomBytes(24).toString('hex');
            existingSubscriber.consentedAt = new Date();
            await existingSubscriber.save();
        } else {
            await Newsletter.create({ email });
        }
        logger.info(`Nuevo suscriptor al boletín: ${email}`);

        res.status(201).json({
            success: true,
            message: '¡Suscripción exitosa al boletín!'
        });
    } catch (error) {
        next(error);
    }
};

const unsubscribeNewsletter = async (req, res, next) => {
    try {
        const { token } = req.params;
        const validToken = typeof token === 'string' && /^[a-f0-9]{48}$/i.test(token);
        if (req.method === 'GET') {
            return redirectToFrontend(req, res, `/newsletter/unsubscribe/${encodeURIComponent(token || '')}`);
        }
        if (!validToken) {
            return res.status(400).json({ success: false, error: 'El enlace de baja no es válido.' });
        }

        await Newsletter.updateOne(
            { unsubscribeToken: token, isSubscribed: { $ne: false } },
            { $set: { isSubscribed: false }, $unset: { unsubscribeToken: 1 } }
        );
        return res.json({ success: true, message: 'Tus preferencias del boletín se actualizaron.' });
    } catch (error) {
        next(error);
    }
};

const unsubscribeCampaignMarketing = async (req, res, next) => {
    try {
        const source = (req.method === 'POST' ? req.body : req.query) || {};
        const newsletterToken = typeof source.newsletter === 'string' &&
            /^[a-f0-9]{48}$/i.test(source.newsletter) ? source.newsletter : null;
        const vipToken = typeof source.vip === 'string' &&
            /^[a-f0-9]{48}$/i.test(source.vip) ? source.vip : null;

        if (req.method === 'GET') {
            const queryStart = req.originalUrl.indexOf('?');
            const queryString = queryStart === -1 ? '' : req.originalUrl.slice(queryStart);
            return redirectToFrontend(req, res, `/marketing/unsubscribe${queryString}`);
        }

        if (!newsletterToken && !vipToken) {
            return res.status(400).json({ success: false, error: 'El enlace de baja no es válido.' });
        }

        const updates = [];
        if (newsletterToken) {
            updates.push(Newsletter.updateOne(
                { unsubscribeToken: newsletterToken, isSubscribed: { $ne: false } },
                { $set: { isSubscribed: false }, $unset: { unsubscribeToken: 1 } }
            ));
        }
        if (vipToken) {
            updates.push(Membership.updateOne(
                { marketingToken: vipToken, marketingOptIn: true },
                { $set: { marketingOptIn: false }, $unset: { marketingToken: 1 } }
            ));
        }
        await Promise.all(updates);
        return res.json({ success: true, message: 'Tus preferencias de marketing se actualizaron.' });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    subscribeNewsletter,
    unsubscribeNewsletter,
    unsubscribeCampaignMarketing
};
