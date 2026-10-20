const Campaign = require('../models/Campaign');
const Coupon = require('../models/Coupon');
const Newsletter = require('../models/Newsletter');
const { enqueueCampaign } = require('../services/campaignQueue');

const getAdminMarketing = async (req, res, next) => {
  try {
    const [coupons, campaigns] = await Promise.all([
      Coupon.find({ type: 'campaign' }).sort({ createdAt: -1 }).limit(50).lean(),
      Campaign.find({ audience: 'newsletter' })
        .select(
          'name subject audience status recipientCount sentCount failedCount simulated errorCode createdAt updatedAt',
        )
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    ]);
    return res.json({ success: true, data: { coupons, campaigns } });
  } catch (error) {
    next(error);
  }
};

const createAdminCoupon = async (req, res, next) => {
  try {
    const code = String(req.body.code || '')
      .trim()
      .toUpperCase();
    const discountPercent = Number(req.body.discountPercent);
    const maxDiscountAmount = Number(req.body.maxDiscountAmount);
    const minOrderAmount = Number(req.body.minOrderAmount);
    const maxRedemptions =
      req.body.maxRedemptions === '' ? undefined : Number(req.body.maxRedemptions);

    if (!/^[A-Z0-9_-]{4,32}$/.test(code)) {
      return res.status(400).json({
        success: false,
        error: 'El código debe tener 4 a 32 caracteres: letras, números, guiones o guion bajo.',
      });
    }
    if (!Number.isFinite(discountPercent) || discountPercent < 1 || discountPercent > 100) {
      return res
        .status(400)
        .json({ success: false, error: 'El descuento debe estar entre 1% y 100%.' });
    }
    if (
      !Number.isFinite(maxDiscountAmount) ||
      maxDiscountAmount <= 0 ||
      !Number.isFinite(minOrderAmount) ||
      minOrderAmount < 0
    ) {
      return res
        .status(400)
        .json({ success: false, error: 'Revisa los montos máximo y mínimo del cupón.' });
    }
    if (maxRedemptions !== undefined && (!Number.isInteger(maxRedemptions) || maxRedemptions < 1)) {
      return res
        .status(400)
        .json({ success: false, error: 'El límite de usos debe ser un entero positivo.' });
    }

    const expiresAt = req.body.expiresAt ? new Date(req.body.expiresAt) : undefined;
    if (expiresAt && (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date())) {
      return res
        .status(400)
        .json({ success: false, error: 'La fecha de vencimiento debe ser futura.' });
    }

    const coupon = await Coupon.create({
      code,
      type: 'campaign',
      discountPercent,
      maxDiscountAmount,
      minOrderAmount,
      maxRedemptions,
      expiresAt,
      description: String(req.body.description || '').trim(),
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
    const coupon = await Coupon.findOne({ _id: req.params.id, type: 'campaign' });
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

const sendAdminCampaign = async (req, res, next) => {
  let campaign;
  try {
    const { name, subject, content, audience, couponCode } = req.body;
    if (audience !== 'newsletter') {
      return res.status(400).json({ success: false, error: 'Selecciona un público válido.' });
    }
    if (
      !String(name || '').trim() ||
      !String(subject || '').trim() ||
      !String(content || '').trim()
    ) {
      return res
        .status(400)
        .json({ success: false, error: 'Completa el nombre, asunto y contenido de la campaña.' });
    }
    if (/[\r\n]/.test(subject)) {
      return res
        .status(400)
        .json({ success: false, error: 'El asunto no puede contener saltos de línea.' });
    }

    const normalizedCouponCode = String(couponCode || '')
      .trim()
      .toUpperCase();
    if (normalizedCouponCode) {
      const coupon = await Coupon.findOne({
        code: normalizedCouponCode,
        type: 'campaign',
        active: true,
        $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }],
      })
        .select('_id')
        .lean();
      if (!coupon) {
        return res.status(400).json({
          success: false,
          error: 'El cupón incluido no existe, venció o está desactivado.',
        });
      }
    }

    const recipientCount = await Newsletter.countDocuments({ isSubscribed: { $ne: false } });
    if (!recipientCount) {
      return res.status(400).json({
        success: false,
        error: 'No hay destinatarios con consentimiento para esta campaña.',
      });
    }
    if (recipientCount > 1000) {
      return res.status(413).json({
        success: false,
        error: 'La campaña supera el límite de 1000 destinatarios. Usa segmentos más pequeños.',
      });
    }

    campaign = await Campaign.create({
      name: String(name).trim(),
      subject: String(subject).trim(),
      content: String(content).trim(),
      audience,
      couponCode: normalizedCouponCode || undefined,
      recipientCount,
      status: 'queued',
      results: [],
    });
    enqueueCampaign(campaign._id);

    res.status(202).json({
      success: true,
      message: `Campaña en cola para ${recipientCount} destinatario(s). El avance aparecerá en el historial.`,
      campaign: {
        _id: campaign._id,
        name: campaign.name,
        status: campaign.status,
        recipientCount: campaign.recipientCount,
        createdAt: campaign.createdAt,
      },
    });
  } catch (error) {
    if (campaign) {
      campaign.status = 'failed';
      await campaign.save();
    }
    return next(error);
  }
};

module.exports = {
  getAdminMarketing,
  createAdminCoupon,
  updateAdminCouponStatus,
  sendAdminCampaign,
};
