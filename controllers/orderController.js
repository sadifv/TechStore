const Order = require('../models/Order');
const Cart = require('../models/Cart');

// @desc    Crear una nueva orden desde el carrito activo
// @route   POST /api/orders/checkout
// @access  Private
const createOrder = async (req, res, next) => {
    try {
        const userId = req.session.user.id;

        // Buscar el carrito del usuario con los datos de productos
        const cart = await Cart.findOne({ user: userId }).populate('items.product');

        if (!cart || cart.items.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'El carrito está vacío. Añade productos antes de procesar el pago.'
            });
        }

        // Construir los ítems de la orden y calcular total
        let totalAmount = 0;
        const orderItems = cart.items.map(item => {
            const price = item.product ? item.product.price : 0;
            totalAmount += price * item.quantity;
            return {
                product: item.product._id,
                quantity: item.quantity,
                price: price
            };
        });

        const paymentMethod = req.body.paymentMethod || 'card';

        // Crear la orden en la base de datos
        const order = await Order.create({
            user: userId,
            items: orderItems,
            totalAmount,
            paymentMethod,
            status: 'completed'
        });

        // Vaciar el carrito de MongoDB de forma atómica
        cart.items = [];
        await cart.save();

        res.status(201).json({
            success: true,
            message: '¡Pedido realizado con éxito!',
            orderId: order._id,
            data: order
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Obtener el historial de órdenes del usuario
// @route   GET /api/orders
// @access  Private
const getUserOrders = async (req, res, next) => {
    try {
        const userId = req.session.user.id;
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
    getUserOrders
};