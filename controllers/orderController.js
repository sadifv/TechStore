const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');
const Product = require('../models/Product');
const logger = require('../config/logger');

// ==========================================
// CREAR ORDEN
// ==========================================

// @desc    Crear orden y sesión de Stripe Checkout
// @route   POST /api/orders/checkout
// @access  Public (soporta invitados)
const createOrder = async (req, res, next) => {
    try {
        const { items, guestInfo, shippingAddress, paymentMethod } = req.body;

        // ✅ FIX: Validar items
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Debe proporcionar al menos un item en la orden.'
            });
        }

        // ✅ FIX: Validar límite máximo de items por orden
        if (items.length > 50) {
            return res.status(400).json({
                success: false,
                error: 'La orden no puede superar los 50 productos diferentes.'
            });
        }

        // Calcular totalAmount desde los productos en DB
        let totalAmount = 0;
        const orderItems = [];

        for (const item of items) {
            // ✅ FIX: Validar productId
            if (!item.productId) {
                return res.status(400).json({
                    success: false,
                    error: 'Cada item debe tener un productId.'
                });
            }

            // ✅ FIX: Validar cantidad (1-99)
            const quantity = Number(item.quantity) || 1;
            if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
                return res.status(400).json({
                    success: false,
                    error: `Cantidad inválida para el producto ${item.productId}. Debe ser entre 1 y 99.`
                });
            }

            const product = await Product.findById(item.productId).lean();
            if (!product) {
                return res.status(400).json({
                    success: false,
                    error: `Producto con ID ${item.productId} no encontrado.`
                });
            }

            // ✅ FIX: Validar stock
            if (product.stock < quantity) {
                return res.status(400).json({
                    success: false,
                    error: `Stock insuficiente para "${product.name}". Disponible: ${product.stock}.`
                });
            }

            totalAmount += product.price * quantity;

            // ✅ Snapshot del nombre (por si el producto se elimina después)
            orderItems.push({
                product: product._id,
                productName: product.name,
                quantity,
                price: product.price
            });
        }

        // Construir datos de la orden
        const orderData = {
            items: orderItems,
            totalAmount: Number(totalAmount.toFixed(2)),
            paymentStatus: 'pending',
            status: 'pending',
            paymentMethod: paymentMethod || 'card'
        };

        if (req.session?.user) {
            orderData.user = req.session.user.id;
        } else {
            if (!guestInfo?.name || !guestInfo?.email) {
                return res.status(400).json({
                    success: false,
                    error: 'Para compras como invitado se requiere name y email.'
                });
            }
            orderData.guestInfo = guestInfo;
        }

        if (shippingAddress) {
            orderData.shippingAddress = shippingAddress;
        }

        // Crear la orden en MongoDB
        const newOrder = await Order.create(orderData);

        // Construir line items para Stripe
        const lineItems = orderItems.map(oi => ({
            quantity: oi.quantity,
            price_data: {
                currency: 'usd',
                unit_amount: Math.round(oi.price * 100),
                product_data: {
                    name: oi.productName || 'Producto TechStore'
                }
            }
        }));

        // Crear sesión de Stripe Checkout
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            success_url: `${req.protocol}://${req.get('host')}/api/orders/confirm?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.protocol}://${req.get('host')}/cart`,
            metadata: {
                orderId: newOrder._id.toString()
            },
            customer_email: guestInfo?.email || req.session?.user?.email || undefined
        });

        // Guardar sessionId en la orden
        newOrder.stripeSessionId = session.id;
        await newOrder.save();

        logger.info(`Orden creada: ${newOrder._id} - Stripe Session: ${session.id} - Total: $${totalAmount.toFixed(2)}`);

        res.status(201).json({
            success: true,
            orderId: newOrder._id,
            sessionId: session.id,
            url: session.url
        });
    } catch (error) {
        logger.error(`Error al crear orden: ${error.message}`, { stack: error.stack });
        next(error);
    }
};

// ==========================================
// CONFIRMAR PAGO
// ==========================================

// @desc    Confirmar pago de orden después de Stripe Checkout
// @route   GET /api/orders/confirm
// @access  Public
const confirmOrderPayment = async (req, res, next) => {
    try {
        const { session_id } = req.query;

        if (!session_id) {
            return res.status(400).json({
                success: false,
                error: 'Falta el parámetro session_id.'
            });
        }

        // Verificar sesión en Stripe
        const session = await stripe.checkout.sessions.retrieve(session_id);

        if (session.payment_status !== 'paid') {
            return res.status(400).json({
                success: false,
                error: 'El pago no ha sido completado.'
            });
        }

        const orderId = session.metadata?.orderId;
        if (!orderId) {
            return res.status(400).json({
                success: false,
                error: 'No se encontró la orden asociada.'
            });
        }

        // Actualizar orden
        const order = await Order.findByIdAndUpdate(
            orderId,
            {
                paymentStatus: 'paid',
                status: 'processing'
            },
            { new: true }
        );

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Orden no encontrada.'
            });
        }

        logger.info(`Pago confirmado para orden: ${order._id}`);

        // ✅ FIX: Redirigir a la página de éxito si es navegación HTML
        if (req.accepts('html')) {
            return res.redirect(`/api/orders/success?orderId=${order._id}`);
        }

        res.status(200).json({
            success: true,
            message: 'Pago confirmado exitosamente.',
            order
        });
    } catch (error) {
        logger.error(`Error al confirmar pago: ${error.message}`, { stack: error.stack });
        next(error);
    }
};

// ==========================================
// HISTORIAL DE ÓRDENES
// ==========================================

// @desc    Obtener historial de órdenes del usuario
// @route   GET /api/orders
// @access  Private (requiere login)
const getUserOrders = async (req, res, next) => {
    try {
        if (!req.session?.user) {
            return res.status(401).json({
                success: false,
                error: 'Debes iniciar sesión para ver tus órdenes.'
            });
        }

        const orders = await Order.find({ user: req.session.user.id })
            .populate('items.product', 'name price image')
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json({
            success: true,
            count: orders.length,
            orders
        });
    } catch (error) {
        logger.error(`Error al obtener órdenes del usuario: ${error.message}`, { stack: error.stack });
        next(error);
    }
};

// ==========================================
// WEBHOOK DE STRIPE
// ==========================================

// @desc    Webhook de Stripe para eventos de pago
// @route   POST /api/orders/webhook
// @access  Public (validado con Stripe Signature)
const handleStripeWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    // ✅ FIX: Validar que el webhook secret esté configurado
    if (!endpointSecret) {
        logger.error('STRIPE_WEBHOOK_SECRET no está configurado en .env');
        return res.status(500).send('Webhook no configurado.');
    }

    // ✅ FIX: Validar que req.body sea Buffer (raw)
    if (!Buffer.isBuffer(req.body)) {
        logger.error('El body del webhook no está en formato raw. Verifica express.raw() en server.js');
        return res.status(500).send('Configuración de webhook incorrecta.');
    }

    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
        logger.error(`Error en firma de webhook: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // ✅ try/catch para evitar que el webhook falle y Stripe reintente
    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object;
                const orderId = session.metadata?.orderId;

                if (orderId) {
                    await Order.findByIdAndUpdate(orderId, {
                        paymentStatus: 'paid',
                        status: 'processing'
                    });
                    logger.info(`Webhook: Orden ${orderId} pagada exitosamente.`);
                }
                break;
            }

            case 'checkout.session.expired': {
                const session = event.data.object;
                const orderId = session.metadata?.orderId;

                if (orderId) {
                    await Order.findByIdAndUpdate(orderId, {
                        paymentStatus: 'failed',
                        status: 'cancelled'
                    });
                    logger.info(`Webhook: Orden ${orderId} expirada/cancelada.`);
                }
                break;
            }

            default:
                logger.info(`Webhook: Evento no manejado: ${event.type}`);
        }

        // ✅ Siempre responder 200 para que Stripe no reintente
        res.json({ received: true });
    } catch (dbError) {
        logger.error(`Error procesando webhook de Stripe: ${dbError.message}`, { stack: dbError.stack });
        res.status(500).json({ error: 'Error procesando webhook.' });
    }
};

// ==========================================
// ACTUALIZAR ESTADO DE ORDEN (Admin)
// ==========================================

// @desc    Actualizar el estado de una orden
// @route   PUT /api/orders/:id/status o /admin/orders/:id/status
// @access  Private/Admin
const updateOrderStatus = async (req, res, next) => {
    try {
        const { status } = req.body;
        const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'completed', 'cancelled'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                error: 'Estado no válido. Opciones: pending, processing, shipped, delivered, completed, cancelled'
            });
        }

        const order = await Order.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );

        if (!order) {
            return res.status(404).json({
                success: false,
                error: 'Orden no encontrada.'
            });
        }

        logger.info(`Estado de orden #${order._id} actualizado a: ${status}`);

        res.status(200).json({
            success: true,
            message: 'Estado de la orden actualizado correctamente.',
            order
        });
    } catch (error) {
        logger.error(`Error al actualizar estado de orden: ${error.message}`, { stack: error.stack });
        next(error);
    }
};

module.exports = {
    createOrder,
    confirmOrderPayment,
    getUserOrders,
    handleStripeWebhook,
    updateOrderStatus
};