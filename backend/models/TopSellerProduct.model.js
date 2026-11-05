import mongoose from 'mongoose';

const topSellerProductSchema = new mongoose.Schema(
  {
    product_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
      unique: true,
    },
    sort_order: {
      type: Number,
      default: 0,
    },
    is_manual: {
      type: Boolean,
      default: true, // true = manually added, false = auto-calculated
    },
  },
  {
    timestamps: true,
  }
);

topSellerProductSchema.index({ sort_order: 1 });

const TopSellerProduct = mongoose.model('TopSellerProduct', topSellerProductSchema);

export default TopSellerProduct;

