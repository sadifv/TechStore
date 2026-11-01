const crypto = require('node:crypto');
const tokenHash = (token) =>
  typeof token === 'string' && /^[a-f0-9]{64}$/i.test(token)
    ? crypto.createHash('sha256').update(token).digest('hex')
    : null;
const issueToken = () => {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: tokenHash(token) };
};
const emailKey = (email) => crypto.createHash('sha256').update(`restock:${email}`).digest('hex');
module.exports = { tokenHash, issueToken, emailKey };
