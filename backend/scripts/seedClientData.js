import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.model.js';
import Category from '../models/Category.model.js';
import Product from '../models/Product.model.js';
import SpecialProduct from '../models/SpecialProduct.model.js';

dotenv.config();

const seedClientData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/les-rois-des-bois');
    console.log('✅ Connected to MongoDB');

    // Clear existing data (optional - comment out if you want to keep existing data)
    // await User.deleteMany({ isAdmin: false });
    // await Category.deleteMany();
    // await Product.deleteMany();
    // await SpecialProduct.deleteMany();

    // 1. Create client user
    const existingClient = await User.findOne({ email: 'client@example.com' });
    if (!existingClient) {
      const clientUser = await User.create({
        name: 'John Client',
        email: 'client@example.com',
        password: '12345678',
        phone: '+216 12 345 678',
        isAdmin: false,
        role: 'user',
        clientType: 'individual',
        clientStatus: 'active',
        addresses: [
          {
            fullName: 'John Client',
            street: '123 Main Street',
            city: 'Tunis',
            zip: '1000',
            phone: '+216 12 345 678',
            isDefault: true,
          },
        ],
      });
      console.log('✅ Created client user:', clientUser.email);
    } else {
      console.log('ℹ️  Client user already exists');
    }

    // 2. Create categories
    const categoriesData = [
      { name: 'طاولات', slug: 'tables', description: 'طاولات عالية الجودة' },
      { name: 'كراسي', slug: 'chairs', description: 'كراسي مريحة وأنيقة' },
      { name: 'خزائن', slug: 'cabinets', description: 'خزائن تخزين فاخرة' },
      { name: 'أسرّة', slug: 'beds', description: 'أسرّة مريحة' },
      { name: 'مكتبات', slug: 'bookshelves', description: 'مكتبات أنيقة' },
      { name: 'مقاعد', slug: 'sofas', description: 'مقاعد مريحة' },
    ];

    const categories = [];
    for (const catData of categoriesData) {
      let category = await Category.findOne({ slug: catData.slug });
      if (!category) {
        category = await Category.create(catData);
        console.log('✅ Created category:', category.name);
      } else {
        console.log('ℹ️  Category already exists:', category.name);
      }
      categories.push(category);
    }

    // 3. Create regular products
    const productsData = [
      {
        name: 'طاولة طعام خشبية',
        category: categories[0]._id,
        price: 450,
        cost: 250,
        stock: 15,
        description: 'طاولة طعام خشبية عالية الجودة مناسبة للعائلات',
        images: ['/uploads/products/table-1.jpg'],
        status: 'visible',
      },
      {
        name: 'طاولة قهوة زجاجية',
        category: categories[0]._id,
        price: 180,
        cost: 100,
        stock: 20,
        description: 'طاولة قهوة زجاجية أنيقة',
        images: ['/uploads/products/coffee-table-1.jpg'],
        status: 'visible',
      },
      {
        name: 'كرسي مكتب مريح',
        category: categories[1]._id,
        price: 320,
        cost: 180,
        stock: 25,
        description: 'كرسي مكتب مريح مع دعم للظهر',
        images: ['/uploads/products/office-chair-1.jpg'],
        status: 'visible',
      },
      {
        name: 'كرسي طعام خشبي',
        category: categories[1]._id,
        price: 120,
        cost: 70,
        stock: 30,
        description: 'كرسي طعام خشبي كلاسيكي',
        images: ['/uploads/products/dining-chair-1.jpg'],
        status: 'visible',
      },
      {
        name: 'خزانة ملابس كبيرة',
        category: categories[2]._id,
        price: 850,
        cost: 500,
        stock: 10,
        description: 'خزانة ملابس كبيرة مع مرايا',
        images: ['/uploads/products/wardrobe-1.jpg'],
        status: 'visible',
      },
      {
        name: 'خزانة كتب',
        category: categories[2]._id,
        price: 380,
        cost: 220,
        stock: 18,
        description: 'خزانة كتب أنيقة',
        images: ['/uploads/products/bookshelf-1.jpg'],
        status: 'visible',
      },
      {
        name: 'سرير مزدوج',
        category: categories[3]._id,
        price: 1200,
        cost: 700,
        stock: 8,
        description: 'سرير مزدوج مريح',
        images: ['/uploads/products/bed-1.jpg'],
        status: 'visible',
      },
      {
        name: 'مكتبة جدارية',
        category: categories[4]._id,
        price: 420,
        cost: 250,
        stock: 12,
        description: 'مكتبة جدارية عصرية',
        images: ['/uploads/products/wall-bookshelf-1.jpg'],
        status: 'visible',
      },
      {
        name: 'كنبة 3 مقاعد',
        category: categories[5]._id,
        price: 1500,
        cost: 900,
        stock: 6,
        description: 'كنبة 3 مقاعد مريحة',
        images: ['/uploads/products/sofa-1.jpg'],
        status: 'visible',
      },
      {
        name: 'كنبة 2 مقعد',
        category: categories[5]._id,
        price: 950,
        cost: 550,
        stock: 10,
        description: 'كنبة 2 مقعد أنيقة',
        images: ['/uploads/products/sofa-2.jpg'],
        status: 'visible',
      },
    ];

    const products = [];
    for (const prodData of productsData) {
      let product = await Product.findOne({ name: prodData.name });
      if (!product) {
        product = await Product.create(prodData);
        console.log('✅ Created product:', product.name);
      } else {
        console.log('ℹ️  Product already exists:', product.name);
      }
      products.push(product);
    }

    // 4. Add variants to some products for special products
    // Table top variants
    await Product.findByIdAndUpdate(products[0]._id, {
      variants: [
        { name: 'اللون', value: 'أحمر', image: '/uploads/products/table-top-red.jpg', additionalPrice: 0 },
        { name: 'اللون', value: 'أزرق', image: '/uploads/products/table-top-blue.jpg', additionalPrice: 0 },
        { name: 'اللون', value: 'أخضر', image: '/uploads/products/table-top-green.jpg', additionalPrice: 0 },
      ],
    });

    // Table legs variants
    await Product.findByIdAndUpdate(products[1]._id, {
      variants: [
        { name: 'المادة', value: 'معدني', image: '/uploads/products/legs-metal.jpg', additionalPrice: 50 },
        { name: 'المادة', value: 'خشبي', image: '/uploads/products/legs-wood.jpg', additionalPrice: 0 },
      ],
    });

    // 5. Create special products
    if (products.length >= 2) {
      const specialProductsData = [
        {
          name: 'طاولة مخصصة كاملة',
          baseProductA: products[0]._id,
          baseProductB: products[1]._id,
          finalPrice: 650,
          description: 'طاولة مخصصة تجمع بين سطح الطاولة والأرجل',
          status: 'visible',
          combinations: [
            {
              optionA: { name: 'اللون', value: 'أحمر' },
              optionB: { name: 'المادة', value: 'معدني' },
              finalImage: '/uploads/special-products/table-red-metal.jpg',
            },
            {
              optionA: { name: 'اللون', value: 'أحمر' },
              optionB: { name: 'المادة', value: 'خشبي' },
              finalImage: '/uploads/special-products/table-red-wood.jpg',
            },
            {
              optionA: { name: 'اللون', value: 'أزرق' },
              optionB: { name: 'المادة', value: 'معدني' },
              finalImage: '/uploads/special-products/table-blue-metal.jpg',
            },
            {
              optionA: { name: 'اللون', value: 'أزرق' },
              optionB: { name: 'المادة', value: 'خشبي' },
              finalImage: '/uploads/special-products/table-blue-wood.jpg',
            },
            {
              optionA: { name: 'اللون', value: 'أخضر' },
              optionB: { name: 'المادة', value: 'معدني' },
              finalImage: '/uploads/special-products/table-green-metal.jpg',
            },
            {
              optionA: { name: 'اللون', value: 'أخضر' },
              optionB: { name: 'المادة', value: 'خشبي' },
              finalImage: '/uploads/special-products/table-green-wood.jpg',
            },
          ],
        },
      ];

      for (const spData of specialProductsData) {
        let specialProduct = await SpecialProduct.findOne({ name: spData.name });
        if (!specialProduct) {
          specialProduct = await SpecialProduct.create(spData);
          console.log('✅ Created special product:', specialProduct.name);
        } else {
          console.log('ℹ️  Special product already exists:', specialProduct.name);
        }
      }
    }

    console.log('\n✅ Seeding completed successfully!');
    console.log('\n📝 Test credentials:');
    console.log('   Email: client@example.com');
    console.log('   Password: 12345678');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  }
};

seedClientData();

