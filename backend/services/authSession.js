const regenerateSession = (req) =>
  new Promise((resolve, reject) => {
    req.session.regenerate((error) => (error ? reject(error) : resolve()));
  });

const createSessionUser = (user) => ({
  id: String(user._id),
  name: user.name,
  email: user.email,
  role: user.role,
  authVersion: user.authVersion || 0,
});

const saveSession = (req) =>
  new Promise((resolve, reject) => {
    req.session.save((error) => (error ? reject(error) : resolve()));
  });

module.exports = { regenerateSession, saveSession, createSessionUser };
