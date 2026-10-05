const setUserLocals = (req, res, next) => {
    res.locals.user = req.user || req.session?.user || null;
    next();
};

const requireAdmin = (req, res, next) => {
    const currentUser = req.user || req.session?.user;
    if (currentUser && currentUser.role === 'admin') {
        return next();
    }
    return res.status(403).redirect('/login');
};

module.exports = {
    setUserLocals,
    requireAdmin
};