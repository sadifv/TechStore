const validateStripeSecretKey = (secretKey, nodeEnv) => {
    if (typeof secretKey !== 'string' || !/^sk_(test|live)_/.test(secretKey)) {
        throw new Error('STRIPE_SECRET_KEY debe ser una clave secreta válida de Stripe.');
    }
    if (nodeEnv === 'production' && !secretKey.startsWith('sk_live_')) {
        throw new Error('Producción requiere una clave Stripe live (sk_live_).');
    }
    if (nodeEnv !== 'production' && secretKey.startsWith('sk_live_')) {
        throw new Error('No se permiten claves Stripe live fuera de producción.');
    }
    return secretKey;
};

module.exports = { validateStripeSecretKey };
