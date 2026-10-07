const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY); //[cite: 3]
const Order = require('../models/Order'); //[cite: 3]
const Cart = require('../models/Cart'); //[cite: 3]
const Product = require('../models/Product'); //[cite: 3]
const mailer = require('../config/mailer'); // Importado para el envío de correos //[cite: 3]

// @desc    Crear una sesión de Stripe Checkout desde el carrito activo
// @route   POST /api/orders/checkout
// @access  Private
const createOrder = async (req, res, next) => { //[cite: 3]
    try { //[cite: 3]
        const userId = req.session.user._id || req.session.user.id; //[cite: 3]

        // 1. Buscar el carrito del usuario con la información de los productos //[cite: 3]
        const cart = await Cart.findOne({ user: userId }).populate('items.product'); //[cite: 3]

        if (!cart || cart.items.length === 0) { //[cite: 3]
            return res.status(400).json({ //[cite: 3]
                success: false, //[cite: 3]
                error: 'El carrito está vacío. Añade productos antes de procesar el pago.' //[cite: 3]
            }); //[cite: 3]
        } //[cite: 3]

        // 2. Filtro de seguridad: Ignorar y limpiar productos eliminados/fantasmas (null) //[cite: 3]
        const validItems = cart.items.filter(item => item && item.product !== null && item.product !== undefined); //[cite: 3]

        // Si la cantidad de ítems válidos cambió respecto al carrito original, actualizamos la BD //[cite: 3]
        if (validItems.length !== cart.items.length) { //[cite: 3]
            cart.items = validItems; //[cite: 3]
            await cart.save(); //[cite: 3]
        } //[cite: 3]

        if (validItems.length === 0) { //[cite: 3]
            return res.status(400).json({ //[cite: 3]
                success: false, //[cite: 3]
                error: 'Los productos en tu carrito ya no están disponibles. Tu carrito ha sido actualizado.' //[cite: 3]
            }); //[cite: 3]
        } //[cite: 3]

        // 3. Verificar disponibilidad de stock para cada producto válido //[cite: 3]
        for (const item of validItems) { //[cite: 3]
            if (item.product.stock < item.quantity) { //[cite: 3]
                return res.status(400).json({ //[cite: 3]
                    success: false, //[cite: 3]
                    error: `Stock insuficiente para "${item.product.name}". Disponible: ${item.product.stock}` //[cite: 3]
                }); //[cite: 3]
            } //[cite: 3]
        } //[cite: 3]

        // 4. Mapear ítems válidos para la orden y calcular el total //[cite: 3]
        let totalAmount = 0; //[cite: 3]
        const orderItems = validItems.map(item => { //[cite: 3]
            const price = item.product.price; //[cite: 3]
            totalAmount += price * item.quantity; //[cite: 3]
            return { //[cite: 3]
                product: item.product._id, //[cite: 3]
                quantity: item.quantity, //[cite: 3]
                price: price //[cite: 3]
            }; //[cite: 3]
        }); //[cite: 3]

        // 5. Crear la orden en la BD con estado 'pending' //[cite: 3]
        const order = await Order.create({ //[cite: 3]
            user: userId, //[cite: 3]
            items: orderItems, //[cite: 3]
            totalAmount, //[cite: 3]
            total: totalAmount, //[cite: 3]
            paymentMethod: 'card', //[cite: 3]
            paymentStatus: 'pending', //[cite: 3]
            status: 'pending' //[cite: 3]
        }); //[cite: 3]

        // 6. Crear la sesión de checkout en Stripe usando los ítems válidos //[cite: 3]
        const lineItems = validItems.map(item => ({ //[cite: 3]
            price_data: { //[cite: 3]
                currency: 'usd', //[cite: 3]
                product_data: { //[cite: 3]
                    name: item.product.name, //[cite: 3]
                    images: item.product.image ? [item.product.image] : [] //[cite: 3]
                }, //[cite: 3]
                unit_amount: Math.round(item.product.price * 100) // Convertir a centavos //[cite: 3]
            }, //[cite: 3]
            quantity: item.quantity //[cite: 3]
        })); //[cite: 3]

        const session = await stripe.checkout.sessions.create({ //[cite: 3]
            line_items: lineItems, //[cite: 3]
            mode: 'payment', //[cite: 3]
            success_url: `${req.protocol}://${req.get('host')}/api/orders/confirm?session_id={CHECKOUT_SESSION_ID}&order_id=${order._id}`, //[cite: 3]
            cancel_url: `${req.protocol}://${req.get('host')}/catalogo`, //[cite: 3]
            metadata: { //[cite: 3]
                orderId: order._id.toString() //[cite: 3]
            } //[cite: 3]
        }); //[cite: 3]

        order.stripeSessionId = session.id; //[cite: 3]
        await order.save(); //[cite: 3]

        res.status(200).json({ //[cite: 3]
            success: true, //[cite: 3]
            url: session.url //[cite: 3]
        }); //[cite: 3]
    } catch (error) { //[cite: 3]
        next(error); //[cite: 3]
    } //[cite: 3]
}; //[cite: 3]

// @desc    Confirmar pago de Stripe, descontar stock, vaciar carrito y enviar correo
// @route   GET /api/orders/confirm
// @access  Private
const confirmOrderPayment = async (req, res, next) => { //[cite: 3]
    try { //[cite: 3]
        const { order_id, session_id } = req.query; //[cite: 3]

        // Poblamos el usuario para obtener su email sin necesidad de importar el modelo User //[cite: 3]
        const order = await Order.findById(order_id).populate('user', 'email'); //[cite: 3]
        
        if (!order) { //[cite: 3]
            return res.status(404).render('404', { title: 'Orden no encontrada' }); //[cite: 3]
        } //[cite: 3]

        if (order.paymentStatus === 'paid') { //[cite: 3]
            return res.render('checkout-success', { title: 'Pago Exitoso | TechStore', order }); //[cite: 3]
        } //[cite: 3]

        // Verificar la sesión con la API de Stripe //[cite: 3]
        const session = await stripe.checkout.sessions.retrieve(session_id); //[cite: 3]

        if (session.payment_status === 'paid') { //[cite: 3]
            // Actualizar la orden //[cite: 3]
            order.paymentStatus = 'paid'; //[cite: 3]
            order.status = 'completed'; //[cite: 3]
            await order.save(); //[cite: 3]

            // Descontar existencias del stock en MongoDB //[cite: 3]
            for (const item of order.items) { //[cite: 3]
                await Product.findByIdAndUpdate(item.product, { //[cite: 3]
                    $inc: { stock: -item.quantity } //[cite: 3]
                }); //[cite: 3]
            } //[cite: 3]

            // Vaciar el carrito del usuario (usamos order.user._id porque 'user' ahora es un objeto poblado) //[cite: 3]
            await Cart.findOneAndUpdate({ user: order.user._id }, { items: [] }); //[cite: 3]

            // ENVIAR CORREO DE CONFIRMACIÓN //[cite: 3]
            try { //[cite: 3]
                if (order.user && order.user.email) { //[cite: 3]
                    await mailer.sendOrderConfirmation(order.user.email, order._id, order.totalAmount); //[cite: 3]
                } //[cite: 3]
            } catch (mailError) { //[cite: 3]
                console.error("Error al enviar el correo, pero la compra fue exitosa:", mailError); //[cite: 3]
            } //[cite: 3]

            return res.render('checkout-success', { title: 'Pago Exitoso | TechStore', order }); //[cite: 3]
        } //[cite: 3]

        res.redirect('/catalogo'); //[cite: 3]
    } catch (error) { //[cite: 3]
        next(error); //[cite: 3]
    } //[cite: 3]
}; //[cite: 3]

// @desc    Obtener el historial de órdenes del usuario con paginación
// @route   GET /api/orders
// @access  Private
const getUserOrders = async (req, res, next) => { //[cite: 3]
    try { //[cite: 3]
        const userId = req.session.user._id || req.session.user.id; //[cite: 3]
        const { page = 1, limit = 5 } = req.query; //[cite: 3]

        const pageNum = Math.max(1, parseInt(page, 10) || 1); //[cite: 3]
        const limitNum = Math.max(1, Math.min(20, parseInt(limit, 10) || 5)); // Límite máximo de 20 por página //[cite: 3]
        const skip = (pageNum - 1) * limitNum; //[cite: 3]

        const [orders, totalOrders] = await Promise.all([ //[cite: 3]
            Order.find({ user: userId }) //[cite: 3]
                .populate('items.product') //[cite: 3]
                .sort({ createdAt: -1 }) //[cite: 3]
                .skip(skip) //[cite: 3]
                .limit(limitNum) //[cite: 3]
                .lean(), //[cite: 3]
            Order.countDocuments({ user: userId }) //[cite: 3]
        ]); //[cite: 3]

        const totalPages = Math.ceil(totalOrders / limitNum) || 1; //[cite: 3]

        res.status(200).json({ //[cite: 3]
            success: true, //[cite: 3]
            count: orders.length, //[cite: 3]
            data: orders, //[cite: 3]
            orders, // Mantener compatibilidad con ambas lecturas en frontend //[cite: 3]
            pagination: { //[cite: 3]
                totalOrders, //[cite: 3]
                totalPages, //[cite: 3]
                currentPage: pageNum, //[cite: 3]
                limit: limitNum, //[cite: 3]
                hasNextPage: pageNum < totalPages, //[cite: 3]
                hasPrevPage: pageNum > 1 //[cite: 3]
            } //[cite: 3]
        }); //[cite: 3]
    } catch (error) { //[cite: 3]
        next(error); //[cite: 3]
    } //[cite: 3]
}; //[cite: 3]

// @desc    Webhook de Stripe para procesar eventos de pago asíncronos
// @route   POST /api/orders/webhook
// @access  Public (Validado con Stripe Signature)
const handleStripeWebhook = async (req, res, next) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error(`Error de firma en Webhook: ${err.message}`);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const orderId = session.metadata.orderId;

        try {
            // Poblamos el usuario para obtener su email
            const order = await Order.findById(orderId).populate('user', 'email');
            
            if (order && order.paymentStatus !== 'paid') {
                order.paymentStatus = 'paid';
                order.status = 'completed';
                await order.save();

                // Descontar existencias del stock
                for (const item of order.items) {
                    await Product.findByIdAndUpdate(item.product, {
                        $inc: { stock: -item.quantity }
                    });
                }

                // Vaciar carrito (usamos order.user._id porque 'user' está poblado)
                await Cart.findOneAndUpdate({ user: order.user._id }, { items: [] });

                // ENVIAR CORREO DE CONFIRMACIÓN DESDE EL WEBHOOK
                try {
                    if (order.user && order.user.email) {
                        await mailer.sendOrderConfirmation(order.user.email, order._id, order.totalAmount);
                        console.log("✅ ¡Correo de confirmación enviado exitosamente desde el Webhook!");
                    }
                } catch (mailError) {
                    console.error("❌ Error enviando correo desde webhook:", mailError);
                }
            }
        } catch (error) {
            console.error('Error procesando webhook de Stripe:', error);
            return res.status(500).json({ error: 'Error interno procesando webhook' });
        }
    }

    res.status(200).json({ received: true });
};

module.exports = { //[cite: 3]
    createOrder, //[cite: 3]
    confirmOrderPayment, //[cite: 3]
    getUserOrders, //[cite: 3]
    handleStripeWebhook
}; //[cite: 3]