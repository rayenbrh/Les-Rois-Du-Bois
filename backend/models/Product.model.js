import mongoose from 'mongoose';
import slugify from 'slugify';

const variantSchema = new mongoose.Schema({
  value: {
    type: String,
    required: true,
  },
  stock: {
    type: Number,
    required: true,
    min: 0,
    default: 0,
  },
  image: {
    type: String,
    default: '',
  },
});

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'اسم المنتج مطلوب'],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'الفئة مطلوبة'],
    },
    price: {
      type: Number,
      required: [true, 'السعر مطلوب'],
      min: [0, 'السعر يجب أن يكون أكبر من أو يساوي 0'],
    },
    cost: {
      type: Number,
      default: 0,
      min: [0, 'التكلفة يجب أن تكون أكبر من أو تساوي 0'],
    },
    stock: {
      type: Number,
      required: [true, 'الكمية المتوفرة مطلوبة'],
      min: [0, 'الكمية يجب أن تكون أكبر من أو تساوي 0'],
      default: 0,
    },
    unit: {
      type: String,
      required: [true, 'الوحدة مطلوبة'],
      enum: ['kg', 'piece', 'meter', 'liter', 'box', 'set'],
      default: 'piece',
    },
    wholesalePrice: {
      type: Number,
      default: 0,
    },
    wholesaleUnit: {
      type: String,
      default: 'piece',
    },
    facebookPrice: {
      type: Number,
      default: 0,
    },
    images: [
      {
        type: String,
      },
    ],
    description: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['visible', 'hidden'],
      default: 'visible',
    },
    variantName: {
      type: String,
      default: '',
      trim: true,
    },
    variants: [variantSchema],
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Supplier',
    },
  },
  {
    timestamps: true,
  }
);

// Generate slug before saving
productSchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

// Index for search
productSchema.index({ name: 'text', description: 'text' });

export default mongoose.model('Product', productSchema);

