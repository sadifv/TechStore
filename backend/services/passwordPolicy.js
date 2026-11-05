const isAcceptablePassword = (password) =>
  typeof password === 'string' && Buffer.byteLength(password, 'utf8') <= 72;

module.exports = { isAcceptablePassword };
