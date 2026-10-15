const Newsletter = require('../models/Newsletter');
const Membership = require('../models/Membership');
const crypto = require('crypto');
const logger = require('../config/logger');

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
            return res.render('newsletter-unsubscribed', {
                title: 'Confirmar baja | TechStore',
                unsubscribeAction: validToken ? `/api/newsletter/unsubscribe/${token}` : null,
                unsubscribeCompleted: false,
                newsletterToken: null,
                vipToken: null
            });
        }
        if (!validToken) {
            return res.status(400).render('newsletter-unsubscribed', {
                title: 'Enlace de baja inválido | TechStore',
                unsubscribeAction: null,
                unsubscribeCompleted: false
            });
        }

        await Newsletter.updateOne(
            { unsubscribeToken: token, isSubscribed: { $ne: false } },
            { $set: { isSubscribed: false }, $unset: { unsubscribeToken: 1 } }
        );
        res.render('newsletter-unsubscribed', {
            title: 'Preferencias actualizadas | TechStore',
            unsubscribeCompleted: true
        });
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
            return res.render('newsletter-unsubscribed', {
                title: 'Confirmar baja | TechStore',
                newsletterToken,
                vipToken,
                unsubscribeAction: newsletterToken || vipToken ? '/api/marketing/unsubscribe' : null,
                unsubscribeCompleted: false
            });
        }

        if (!newsletterToken && !vipToken) {
            return res.status(400).render('newsletter-unsubscribed', {
                title: 'Enlace de baja inválido | TechStore',
                unsubscribeAction: null,
                unsubscribeCompleted: false
            });
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
        res.render('newsletter-unsubscribed', {
            title: 'Preferencias actualizadas | TechStore',
            unsubscribeCompleted: true
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    subscribeNewsletter,
    unsubscribeNewsletter,
    unsubscribeCampaignMarketing
};