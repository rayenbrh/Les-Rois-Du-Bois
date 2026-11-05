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
  },
  {
    timestamps: true,
  }
);

export default mongoose.model('Setting', settingSchema);

