import mongoose from 'mongoose';

const homepageConfigSchema = new mongoose.Schema(
  {
    hero_image: {
      type: String,
      default: '',
    },
    hero_title: {
      type: String,
      default: 'ملوك الخشب',
    },
    hero_subtitle: {
      type: String,
      default: 'أثاث فاخر بتصاميم عصرية وجودة عالية',
    },
    hero_description: {
      type: String,
      default: 'اكتشف مجموعتنا المميزة من الأثاث المصنوع يدوياً من أجود أنواع الخشب الطبيعي',
    },
    hero_cta_text: {
      type: String,
      default: 'تسوق الآن',
    },
    hero_cta_link: {
      type: String,
      default: '/shop/products',
    },
    hero_cta2_text: {
      type: String,
      default: 'المنتجات المركبة',
    },
    hero_cta2_link: {
      type: String,
      default: '/shop/special-products',
    },
  },
  {
    timestamps: true,
  }
);

// Ensure only one document exists
homepageConfigSchema.statics.getConfig = async function () {
  let config = await this.findOne();
  if (!config) {
    config = await this.create({});
  }
  return config;
};

const HomepageConfig = mongoose.model('HomepageConfig', homepageConfigSchema);

export default HomepageConfig;

