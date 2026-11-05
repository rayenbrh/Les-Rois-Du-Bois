import mongoose from 'mongoose';
import slugify from 'slugify';

const combinationSchema = new mongoose.Schema({
  optionA: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  optionB: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
  finalImage: {
    type: String,
    required: true,
  },
  additionalPrice: {
    type: Number,
    default: 0,
  },
});

const specialProductSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'اسم المنتج الخاص مطلوب'],
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
    },
    baseProductA: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'المنتج الأساسي الأول مطلوب'],
    },
    baseProductB: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: [true, 'المنتج الأساسي الثاني مطلوب'],
    },
    combinations: [combinationSchema],
    finalPrice: {
      type: Number,
      required: [true, 'السعر النهائي مطلوب'],
      min: [0, 'السعر يجب أن يكون أكبر من أو يساوي 0'],
    },
    description: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['visible', 'hidden'],
      default: 'visible',
    },
  },
  {
    timestamps: true,
  }
);

// Generate slug before saving
specialProductSchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

export default mongoose.model('SpecialProduct', specialProductSchema);

