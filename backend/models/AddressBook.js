const mongoose = require('mongoose');
const address = new mongoose.Schema({
  label: String,
  recipient: String,
  street: String,
  city: String,
  country: String,
  reference: String,
});
const schema = new mongoose.Schema(
  {
    _id: { type: mongoose.Schema.Types.ObjectId, required: true },
    addresses: { type: [address], default: [] },
    defaultAddressId: { type: mongoose.Schema.Types.ObjectId, default: null },
    version: { type: Number, default: 0 },
  },
  { timestamps: true, autoIndex: false },
);
module.exports = mongoose.model('AddressBook', schema);
