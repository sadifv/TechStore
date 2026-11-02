const mongoose = require('mongoose');
const Book = require('../models/AddressBook');
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode });
const fields = {
  label: [0, 40],
  recipient: [2, 100],
  street: [3, 200],
  city: [2, 100],
  country: [2, 80],
  reference: [0, 200],
};
function validateAddress(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw fail('Dirección inválida.');
  const result = {};
  for (const [field, [min, max]] of Object.entries(fields)) {
    const value = input[field] ?? '';
    if (
      typeof value !== 'string' ||
      value.length > max ||
      /[<>\x00-\x1f\x7f]/.test(value) ||
      value.trim().length < min
    )
      throw fail(`Revisa el campo de dirección: ${field}.`);
    result[field] = value.trim().replace(/\s+/g, ' ');
  }
  return result;
}
const view = (book) => ({
  addresses: book?.addresses || [],
  defaultAddressId: book?.defaultAddressId ? String(book.defaultAddressId) : null,
  version: book?.version || 0,
});
async function getAddressBook(user) {
  return view(await Book.findById(user).lean());
}
async function ensureBook(user) {
  try {
    await Book.updateOne(
      { _id: user },
      { $setOnInsert: { addresses: [], version: 0, defaultAddressId: null } },
      { upsert: true },
    );
  } catch (e) {
    if (e.code !== 11000) throw e;
  }
}
async function addAddress(user, input) {
  const value = validateAddress(input);
  await ensureBook(user);
  const id = new mongoose.Types.ObjectId();
  for (let retry = 0; retry < 15; retry++) {
    const book = await Book.findById(user).lean();
    if (
      book.addresses.some((entry) =>
        Object.keys(fields).every((key) => (entry[key] || '') === value[key]),
      )
    )
      return view(book);
    if (book.addresses.length >= 5) throw fail('Puedes guardar hasta cinco direcciones.', 409);
    const result = await Book.findOneAndUpdate(
      { _id: user, version: book.version },
      {
        $push: { addresses: { ...value, _id: id } },
        $inc: { version: 1 },
        ...(!book.addresses.length ? { $set: { defaultAddressId: id } } : {}),
      },
      { returnDocument: 'after' },
    ).lean();
    if (result) return view(result);
  }
  throw fail('La libreta cambió. Actualiza e inténtalo de nuevo.', 409);
}
async function changeAddress(user, id, action, input = {}) {
  if (typeof id !== 'string' || !/^[a-f0-9]{24}$/i.test(id) || !Number.isInteger(input.version))
    throw fail('Dirección o versión inválida.');
  id = id.toLowerCase();
  const book = await Book.findById(user).lean();
  const entry = book?.addresses.find((a) => String(a._id) === id);
  if (!entry) throw fail('No se encontró la dirección.', 404);
  if (book.version !== input.version)
    throw fail('La libreta cambió. Actualiza e inténtalo de nuevo.', 409);
  let addresses = book.addresses;
  let defaultAddressId = book.defaultAddressId;
  if (action === 'delete') {
    addresses = addresses.filter((a) => String(a._id) !== id);
    if (String(defaultAddressId) === id) defaultAddressId = addresses[0]?._id || null;
  } else if (action === 'default') defaultAddressId = entry._id;
  else if (action === 'edit') {
    const value = validateAddress(input);
    addresses = addresses.map((a) => (String(a._id) === id ? { ...value, _id: a._id } : a));
  } else throw fail('Acción inválida.');
  const updated = await Book.findOneAndUpdate(
    { _id: user, version: input.version },
    { $set: { addresses, defaultAddressId }, $inc: { version: 1 } },
    { returnDocument: 'after' },
  ).lean();
  if (!updated) throw fail('La libreta cambió. Actualiza e inténtalo de nuevo.', 409);
  return view(updated);
}
async function resolveShippingAddress(user, savedId, address, { session } = {}) {
  if (savedId !== undefined && address !== undefined)
    throw fail('Elige una dirección guardada o una puntual, no ambas.');
  if (savedId !== undefined) {
    if (!user || typeof savedId !== 'string' || !/^[a-f0-9]{24}$/i.test(savedId))
      throw fail('No se encontró la dirección.', 404);
    let query = Book.findById(user);
    if (session) query = query.session(session);
    const book = await query.lean();
    const found = book?.addresses.find((a) => String(a._id) === savedId.toLowerCase());
    if (!found) throw fail('No se encontró la dirección. Actualiza tu selección.', 404);
    return validateAddress(found);
  }
  return address === undefined ? null : validateAddress(address);
}
module.exports = {
  validateAddress,
  getAddressBook,
  addAddress,
  changeAddress,
  resolveShippingAddress,
};
