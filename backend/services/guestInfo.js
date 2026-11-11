const { isSingleEmail } = require('./emailAddress');
const MAX_GUEST_NAME_LENGTH = 120;
const controls = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;

const isGuestName = (name) =>
  typeof name === 'string' &&
  name.trim().length > 0 &&
  name.trim().length <= MAX_GUEST_NAME_LENGTH &&
  !controls.test(name);

function normalizeGuestInfo(info) {
  if (
    !isGuestName(info?.name) ||
    typeof info?.email !== 'string' ||
    !isSingleEmail(info.email.trim())
  ) {
    throw Object.assign(
      new Error(
        'Para compras como invitado se requiere un nombre de hasta 120 caracteres sin controles y un correo válido.',
      ),
      { statusCode: 400 },
    );
  }
  return { name: info.name.trim(), email: info.email.trim().toLowerCase() };
}

// Older orders and registered users can predate checkout validation.
const whatsappBuyerName = (name) =>
  typeof name === 'string'
    ? name
        .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ')
        .trim()
        .slice(0, MAX_GUEST_NAME_LENGTH) || 'Cliente'
    : 'Cliente';

module.exports = { normalizeGuestInfo, whatsappBuyerName };
