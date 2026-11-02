// A single mailbox, never an RFC address list or a display-name expression.
// Keep this policy shared by public input, persisted accounts and mail delivery.
const isSingleEmail = (value) => {
  if (typeof value !== 'string' || value.length > 254 || value !== value.trim()) return false;
  const parts = value.split('@');
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (
    !local ||
    local.length > 64 ||
    !/^[a-z\d.!#$%&'*+/=?^_`{|}~-]+$/i.test(local) ||
    local.startsWith('.') ||
    local.endsWith('.') ||
    local.includes('..')
  )
    return false;
  const labels = domain.split('.');
  return (
    labels.length >= 2 &&
    labels.at(-1).length >= 2 &&
    labels.every((label) => label.length <= 63 && /^[a-z\d](?:[a-z\d-]*[a-z\d])?$/i.test(label))
  );
};
module.exports = { isSingleEmail };
