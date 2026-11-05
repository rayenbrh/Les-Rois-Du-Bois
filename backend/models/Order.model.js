import mongoose from 'mongoose';
import { generateOrderNumber } from '../utils/sequence.js';

const orderItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  productType: {
    type: String,
    enum: ['regular', 'special'],
    required: true,
  },
  productName: {
    type: String,
    required: true,
  },
  variantA: {
    type: Object,
  },
  variantB: {
    type: Object,
  },
  combinationId: {
    type: String,
  },
  combinationImage: {
    type: String,
  },
  variant: {
    type: Object,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  unitPrice: {
    type: Number,
    required: true,
    min: 0,
  },
  cost: {
    type: Number,
    default: 0,
    min: 0,
  },
  discount: {
    type: Number,
    default: 0,
    min: 0,
  },
  subtotal: {
    type: Number,
    required: true,
    min: 0,
  },
  total: {
    type: Number,
    required: true,
    min: 0,
  },
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
      required: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    clientName: {
      type: String,
      required: true,
    },
    clientPhone: {
      type: String,
    },
    clientEmail: {
      type: String,
    },
    clientAddress: {
      type: String,
    },
    status: {
      type: String,
      enum: ['pending', 'preparing', 'ready', 'delivered', 'completed', 'canceled'],
      default: 'pending',
    },
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
    },
    commercialId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // Order source to track origin
    source: {
      type: String,
      enum: ['catalog', 'pos', 'commercial_pos', 'admin', 'page'],
      default: 'catalog',
    },
    // Order source type for analytics (ecommerce, pos, page)
    orderSource: {
      type: String,
      enum: ['ecommerce', 'pos', 'page'],
      default: null,
    },
    // Price type used in the order
    priceType: {
      type: String,
      enum: ['gros', 'detail', 'page'],
      default: null,
    },
    // For POS orders - track cashier who created the sale
    cashierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // For POS orders - sale mode
    saleMode: {
      type: String,
      enum: ['gros', 'detail'],
    },
    items: [orderItemSchema],
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discount: {
      type: Number,
      default: 0,
      min: 0,
    },
    tax: {
      type: Number,
      default: 0,
      min: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    cost: {
      type: Number,
      default: 0,
      min: 0,
    },
    profit: {
      type: Number,
      default: 0,
    },
    paymentMethod: {
      type: String,
      enum: ['cash', 'card', 'credit', 'mixed'],
      default: 'cash',
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'partial', 'paid'],
      default: 'unpaid',
    },
    notes: {
      type: String,
      default: '',
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    completedAt: {
      type: Date,
    },
    canceledAt: {
      type: Date,
    },
    canceledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    cancelReason: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Generate order number (atomic counter, safe under concurrency and deletions)
orderSchema.pre('validate', async function () {
  if (!this.orderNumber) {
    this.orderNumber = await generateOrderNumber();
  }
});

// Auto-set orderSource and priceType based on source
orderSchema.pre('save', function (next) {
  // Only set if not already set (allow manual override)
  if (!this.orderSource || !this.priceType) {
    switch (this.source) {
      case 'catalog':
        // Catalog orders are e-commerce with gros (wholesale) pricing
        if (!this.orderSource) this.orderSource = 'ecommerce';
        if (!this.priceType) this.priceType = 'gros';
        break;
      case 'pos':
      case 'commercial_pos':
      case 'admin':
        // POS/commercial/admin orders are POS with detail (retail) pricing
        if (!this.orderSource) this.orderSource = 'pos';
        if (!this.priceType) this.priceType = 'detail';
        break;
      case 'page':
        // Page/social orders are page with page pricing
        if (!this.orderSource) this.orderSource = 'page';
        if (!this.priceType) this.priceType = 'page';
        break;
      default:
        // Default fallback
        if (!this.orderSource) this.orderSource = 'ecommerce';
        if (!this.priceType) this.priceType = 'gros';
    }
  }
  next();
});

// Indexes
// Note: orderNumber already has unique: true, which creates an index automatically
orderSchema.index({ clientId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ commercialId: 1, createdAt: -1 });
orderSchema.index({ storeId: 1, createdAt: -1 });
orderSchema.index({ source: 1, createdAt: -1 });
orderSchema.index({ cashierId: 1, createdAt: -1 });
orderSchema.index({ commercialId: 1, source: 1, createdAt: -1 });

export default mongoose.model('Order', orderSchema);

