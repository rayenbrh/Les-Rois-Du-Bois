import mongoose from 'mongoose';

const featuredProductSchema = new mongoose.Schema(
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
  },
  {
    timestamps: true,
  }
);

featuredProductSchema.index({ sort_order: 1 });

const FeaturedProduct = mongoose.model('FeaturedProduct', featuredProductSchema);

export default FeaturedProduct;

