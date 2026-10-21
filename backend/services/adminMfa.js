const crypto = require('node:crypto');

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const PERIOD_MS = 30_000;

const base32Encode = (input) => {
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of input) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits) output += BASE32[(value << (5 - bits)) & 31];
  return output;
};

const base32Decode = (input) => {
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of input.toUpperCase().replace(/=+$/, '')) {
    const index = BASE32.indexOf(char);
    if (index < 0) throw new Error('Secreto TOTP inválido.');
    value = (value << 5) | index;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
};

const generateSecret = () => base32Encode(crypto.randomBytes(20));

const generateTotp = (secret, step) => {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));
  const digest = crypto.createHmac('sha1', base32Decode(secret)).update(counter).digest();
  const offset = digest[digest.length - 1] & 15;
  const binary = digest.readUInt32BE(offset) & 0x7fffffff;
  return String(binary % 1_000_000).padStart(6, '0');
};

const verifyTotp = (secret, code, now = Date.now()) => {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return null;
  const currentStep = Math.floor(now / PERIOD_MS);
  for (const step of [currentStep - 1, currentStep, currentStep + 1]) {
    const expected = generateTotp(secret, step);
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(code))) return { step };
  }
  return null;
};

const otpauthUri = (secret, account, issuer = 'TechStore') =>
  `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(account)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

const deriveKey = () => {
  if (!process.env.SESSION_SECRET) throw new Error('SESSION_SECRET no está configurado.');
  return Buffer.from(
    crypto.hkdfSync(
      'sha256',
      process.env.SESSION_SECRET,
      'techstore-admin-mfa',
      'totp-secret-v1',
      32,
    ),
  );
};

const encryptSecret = (secret) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', deriveKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map((part) => part.toString('base64url')).join('.');
};

const decryptSecret = (encrypted) => {
  const [ivPart, tagPart, ciphertextPart] = String(encrypted).split('.');
  if (!ivPart || !tagPart || !ciphertextPart) throw new Error('Secreto MFA cifrado inválido.');
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    deriveKey(),
    Buffer.from(ivPart, 'base64url'),
  );
  decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertextPart, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
};

const generateRecoveryCodes = () =>
  Array.from({ length: 10 }, () => {
    const value = crypto.randomBytes(12).toString('hex').toUpperCase();
    return value.match(/.{4}/g).join('-');
  });

const hashRecoveryCode = (code) =>
  crypto.createHash('sha256').update(String(code).replace(/-/g, '').toUpperCase()).digest('hex');

module.exports = {
  generateSecret,
  generateTotp,
  verifyTotp,
  otpauthUri,
  encryptSecret,
  decryptSecret,
  generateRecoveryCodes,
  hashRecoveryCode,
};
