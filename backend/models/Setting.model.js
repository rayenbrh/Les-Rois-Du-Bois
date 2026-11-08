import mongoose from 'mongoose';

const settingSchema = new mongoose.Schema(
  {
    vat: {
      type: Number,
      default: 19,
    },
    deliveryFee: {
      type: Number,
      default: 10,
    },
    storeOpen: {
      type: Boolean,
      default: true,
    },
    storeLogo: {
      type: String,
    },
    // Company identity printed on every PDF (empty = built-in defaults)
    companyName: { type: String, trim: true, default: '' },
    companyAddress: { type: String, trim: true, default: '' },
    companyPhone: { type: String, trim: true, default: '' },
    companyEmail: { type: String, trim: true, default: '' },
    companyTaxId: { type: String, trim: true, default: '' },
    companyLogo: { type: String, trim: true, default: '' }, // "/uploads/settings/<file>"
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Setting', settingSchema);
