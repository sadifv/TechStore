const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

// @desc    Crear una sesión de Stripe Checkout desde el carrito activo
// @route   POST /api/orders/checkout
// @access  Private
const createOrder = async (req, res, next) => {
    try {
        const userId = req.session.user._id || req.session.user.id;

        // 1. Buscar el carrito del usuario con la información de los productos
        const cart = await Cart.findOne({ user: userId }).populate('items.product');

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'El carrito está vacío. Añade productos antes de procesar el pago.'
            });
        }

        // 2. Filtro de seguridad: Ignorar y limpiar productos eliminados/fantasmas (null)
        const validItems = cart.items.filter(item => item && item.product !== null && item.product !== undefined);

        // Si la cantidad de ítems válidos cambió respecto al carrito original, actualizamos la BD
        if (validItems.length !== cart.items.length) {
            cart.items = validItems;
            await cart.save();
        }

        if (validItems.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'Los productos en tu carrito ya no están disponibles. Tu carrito ha sido actualizado.'
            });
        }

        // 3. Verificar disponibilidad de stock para cada producto válido
        for (const item of validItems) {
            if (item.product.stock < item.quantity) {
                return res.status(400).json({
                    success: false,
                    error: `Stock insuficiente para "${item.product.name}". Disponible: ${item.product.stock}`
                });
            }
        }

        // 4. Mapear ítems válidos para la orden y calcular el total
        let totalAmount = 0;
        const orderItems = validItems.map(item => {
            const price = item.product.price;
            totalAmount += price * item.quantity;
            return {
                product: item.product._id,
                quantity: item.quantity,
                price: price
            };
        });

        // 5. Crear la orden en la BD con estado 'pending' (asignamos tanto totalAmount como total)
        const order = await Order.create({
            user: userId,
            items: orderItems,
            totalAmount,
            total: totalAmount,
            paymentMethod: 'card',
            paymentStatus: 'pending',
            status: 'pending'
        });

        // 6. Crear la sesión de checkout en Stripe usando los ítems válidos
        const lineItems = validItems.map(item => ({
            price_data: {
                currency: 'usd',
                product_data: {
                    name: item.product.name,
                    images: item.product.image ? [item.product.image] : []
                },
                unit_amount: Math.round(item.product.price * 100) // Convertir a centavos
            },
            quantity: item.quantity
        }));

        const session = await stripe.checkout.sessions.create({
            line_items: lineItems,
            mode: 'payment',
            success_url: `${req.protocol}://${req.get('host')}/api/orders/confirm?session_id={CHECKOUT_SESSION_ID}&order_id=${order._id}`,
            cancel_url: `${req.protocol}://${req.get('host')}/catalogo`,
            metadata: {
                orderId: order._id.toString()
            }
        });

        order.stripeSessionId = session.id;
        await order.save();

        res.status(200).json({
            success: true,
            url: session.url
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Confirmar pago de Stripe, descontar stock y vaciar carrito
// @route   GET /api/orders/confirm
// @access  Private
const confirmOrderPayment = async (req, res, next) => {
    try {
        const { order_id, session_id } = req.query;

        const order = await Order.findById(order_id);
        if (!order) {
            return res.status(404).render('404', { title: 'Orden no encontrada' });
        }

        if (order.paymentStatus === 'paid') {
            return res.render('checkout-success', { title: 'Pago Exitoso | TechStore', order });
        }

        // Verificar la sesión con la API de Stripe
        const session = await stripe.checkout.sessions.retrieve(session_id);

        if (session.payment_status === 'paid') {
            // Actualizar la orden
            order.paymentStatus = 'paid';
            order.status = 'completed';
            await order.save();

            // Descontar existencias del stock en MongoDB
            for (const item of order.items) {
                await Product.findByIdAndUpdate(item.product, {
                    $inc: { stock: -item.quantity }
                });
            }

            // Vaciar el carrito del usuario
            await Cart.findOneAndUpdate({ user: order.user }, { items: [] });

            return res.render('checkout-success', { title: 'Pago Exitoso | TechStore', order });
        }

        res.redirect('/catalogo');
    } catch (error) {
        next(error);
    }
};

// @desc    Obtener el historial de órdenes del usuario
// @route   GET /api/orders
// @access  Private
const getUserOrders = async (req, res, next) => {
    try {
        const userId = req.session.user._id || req.session.user.id;
        const orders = await Order.find({ user: userId })
            .populate('items.product')
            .sort({ createdAt: -1 })
            .lean();

        res.status(200).json({
            success: true,
            count: orders.length,
            data: orders
        });
    } catch (error) {
        next(error);
    }
};

module.exports = {
    createOrder,
    confirmOrderPayment,
    getUserOrders
};