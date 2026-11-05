import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.model.js';
import Category from '../models/Category.model.js';
import Product from '../models/Product.model.js';
import SpecialProduct from '../models/SpecialProduct.model.js';
import Store from '../models/Store.model.js';
import Order from '../models/Order.model.js';
import Invoice from '../models/Invoice.model.js';

dotenv.config();

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/les-rois-des-bois');
    console.log('✅ Connected to MongoDB\n');

    // 1. Create Admin
    console.log('📦 Creating Admin...');
    const existingAdmin = await User.findOne({ email: 'admin@lesroisdesbois.com' });
    if (!existingAdmin) {
      const admin = await User.create({
        name: 'Admin',
        email: 'admin@lesroisdesbois.com',
        password: 'admin123',
        isAdmin: true,
        role: 'admin',
      });
      console.log('✅ Created admin:', admin.email, '| Password: admin123\n');
    } else {
      console.log('ℹ️  Admin already exists\n');
    }

    // 2. Create Commercials
    console.log('📦 Creating Commercials...');
    const commercialsData = [
      {
        name: 'Commercial 1',
        email: 'commercial1@lesroisdesbois.com',
        password: 'commercial123',
        role: 'commercial',
        phone: '+216 20 123 456',
      },
      {
        name: 'Commercial 2',
        email: 'commercial2@lesroisdesbois.com',
        password: 'commercial123',
        role: 'commercial',
        phone: '+216 20 123 457',
      },
    ];

    const commercials = [];
    for (const commData of commercialsData) {
      let commercial = await User.findOne({ email: commData.email });
      if (!commercial) {
        commercial = await User.create(commData);
        console.log('✅ Created commercial:', commercial.email, '| Password: commercial123');
        commercials.push(commercial);
      } else {
        console.log('ℹ️  Commercial already exists:', commercial.email);
        commercials.push(commercial);
      }
    }
    console.log('');

    // 3. Create Stores
    console.log('📦 Creating Stores...');
    const storesData = [
      {
        name: 'المتجر الرئيسي',
        code: 'STORE-001',
        address: 'شارع الحبيب بورقيبة، تونس',
        phone: '+216 71 123 456',
        email: 'store1@lesroisdesbois.com',
        isActive: true,
      },
      {
        name: 'فرع سوسة',
        code: 'STORE-002',
        address: 'شارع بورقيبة، سوسة',
        phone: '+216 73 123 456',
        email: 'store2@lesroisdesbois.com',
        isActive: true,
      },
    ];

    const stores = [];
    for (const storeData of storesData) {
      let store = await Store.findOne({ code: storeData.code });
      if (!store) {
        store = await Store.create(storeData);
        console.log('✅ Created store:', store.name);
        stores.push(store);
      } else {
        console.log('ℹ️  Store already exists:', store.name);
        stores.push(store);
      }
    }
    console.log('');

    // 4. Create Store Cashiers
    console.log('📦 Creating Store Cashiers...');
    const cashiersData = [
      {
        name: 'Caissier Store 1',
        email: 'cashier1@lesroisdesbois.com',
        password: 'cashier123',
        role: 'store_cashier',
        phone: '+216 20 111 111',
        storeId: stores[0]._id,
      },
      {
        name: 'Caissier Store 2',
        email: 'cashier2@lesroisdesbois.com',
        password: 'cashier123',
        role: 'store_cashier',
        phone: '+216 20 111 112',
        storeId: stores[1]._id,
      },
    ];

    const cashiers = [];
    for (const cashData of cashiersData) {
      let cashier = await User.findOne({ email: cashData.email });
      if (!cashier) {
        cashier = await User.create(cashData);
        console.log('✅ Created cashier:', cashier.email, '| Password: cashier123');
        cashiers.push(cashier);
      } else {
        console.log('ℹ️  Cashier already exists:', cashier.email);
        cashiers.push(cashier);
      }
    }
    console.log('');

    // 5. Create Clients (distributed among commercials)
    console.log('📦 Creating Clients...');
    const clientsData = [
      {
        name: 'Client 1',
        email: 'client1@lesroisdesbois.com',
        password: 'client123',
        role: 'client',
        phone: '+216 12 345 678',
        clientType: 'individual',
        clientStatus: 'active',
        commercialId: commercials[0]._id,
        addresses: [
          {
            fullName: 'Client 1',
            street: '123 Rue de la République',
            city: 'Tunis',
            zip: '1000',
            phone: '+216 12 345 678',
            isDefault: true,
          },
        ],
      },
      {
        name: 'Client 2',
        email: 'client2@lesroisdesbois.com',
        password: 'client123',
        role: 'client',
        phone: '+216 12 345 679',
        clientType: 'individual',
        clientStatus: 'active',
        commercialId: commercials[0]._id,
        addresses: [
          {
            fullName: 'Client 2',
            street: '456 Avenue Habib Bourguiba',
            city: 'Sousse',
            zip: '4000',
            phone: '+216 12 345 679',
            isDefault: true,
          },
        ],
      },
      {
        name: 'Client 3',
        email: 'client3@lesroisdesbois.com',
        password: 'client123',
        role: 'client',
        phone: '+216 12 345 680',
        clientType: 'business',
        clientStatus: 'active',
        companyName: 'Entreprise Client 3',
        commercialId: commercials[0]._id,
        addresses: [
          {
            fullName: 'Client 3',
            street: '789 Boulevard de la Liberté',
            city: 'Tunis',
            zip: '1001',
            phone: '+216 12 345 680',
            isDefault: true,
          },
        ],
      },
      {
        name: 'Client 4',
        email: 'client4@lesroisdesbois.com',
        password: 'client123',
        role: 'client',
        phone: '+216 12 345 681',
        clientType: 'individual',
        clientStatus: 'active',
        commercialId: commercials[1]._id,
        addresses: [
          {
            fullName: 'Client 4',
            street: '321 Rue du Commerce',
            city: 'Sfax',
            zip: '3000',
            phone: '+216 12 345 681',
            isDefault: true,
          },
        ],
      },
      {
        name: 'Client 5',
        email: 'client5@lesroisdesbois.com',
        password: 'client123',
        role: 'client',
        phone: '+216 12 345 682',
        clientType: 'individual',
        clientStatus: 'active',
        commercialId: commercials[1]._id,
        addresses: [
          {
            fullName: 'Client 5',
            street: '654 Avenue de l\'Indépendance',
            city: 'Sousse',
            zip: '4001',
            phone: '+216 12 345 682',
            isDefault: true,
          },
        ],
      },
    ];

    const clients = [];
    for (const clientData of clientsData) {
      let client = await User.findOne({ email: clientData.email });
      if (!client) {
        client = await User.create(clientData);
        console.log('✅ Created client:', client.email, '| Password: client123');
        clients.push(client);
      } else {
        console.log('ℹ️  Client already exists:', client.email);
        clients.push(client);
      }
    }
    console.log('');

    // 6. Create Categories
    console.log('📦 Creating Categories...');
    const categoriesData = [
      { name: 'طاولات', slug: 'tables', description: 'طاولات عالية الجودة' },
      { name: 'كراسي', slug: 'chairs', description: 'كراسي مريحة وأنيقة' },
      { name: 'خزائن', slug: 'cabinets', description: 'خزائن تخزين فاخرة' },
      { name: 'أسرّة', slug: 'beds', description: 'أسرّة مريحة' },
    ];

    const categories = [];
    for (const catData of categoriesData) {
      let category = await Category.findOne({ slug: catData.slug });
      if (!category) {
        category = await Category.create(catData);
        console.log('✅ Created category:', category.name);
        categories.push(category);
      } else {
        console.log('ℹ️  Category already exists:', category.name);
        categories.push(category);
      }
    }
    console.log('');

    // 7. Create Regular Products
    console.log('📦 Creating Regular Products...');
    const productsData = [
      {
        name: 'طاولة طعام خشبية',
        category: categories[0]._id,
        price: 450,
        cost: 250,
        stock: 15,
        description: 'طاولة طعام خشبية عالية الجودة مناسبة للعائلات',
        status: 'visible',
      },
      {
        name: 'طاولة قهوة زجاجية',
        category: categories[0]._id,
        price: 180,
        cost: 100,
        stock: 20,
        description: 'طاولة قهوة زجاجية أنيقة',
        status: 'visible',
      },
      {
        name: 'كرسي مكتب مريح',
        category: categories[1]._id,
        price: 320,
        cost: 180,
        stock: 25,
        description: 'كرسي مكتب مريح مع دعم للظهر',
        status: 'visible',
      },
      {
        name: 'كرسي طعام خشبي',
        category: categories[1]._id,
        price: 120,
        cost: 70,
        stock: 30,
        description: 'كرسي طعام خشبي كلاسيكي',
        status: 'visible',
      },
      {
        name: 'خزانة ملابس كبيرة',
        category: categories[2]._id,
        price: 850,
        cost: 500,
        stock: 10,
        description: 'خزانة ملابس كبيرة مع مرايا',
        status: 'visible',
      },
      {
        name: 'سرير مزدوج',
        category: categories[3]._id,
        price: 1200,
        cost: 700,
        stock: 8,
        description: 'سرير مزدوج مريح',
        status: 'visible',
      },
    ];

    const products = [];
    for (const prodData of productsData) {
      let product = await Product.findOne({ name: prodData.name });
      if (!product) {
        product = await Product.create(prodData);
        console.log('✅ Created product:', product.name);
        products.push(product);
      } else {
        console.log('ℹ️  Product already exists:', product.name);
        products.push(product);
      }
    }
    console.log('');

    // 8. Create Special Products
    console.log('📦 Creating Special Products...');
    if (products.length >= 2) {
      // Add variants to products for special products
      await Product.findByIdAndUpdate(products[0]._id, {
        variants: [
          { name: 'اللون', value: 'أحمر', additionalPrice: 0 },
          { name: 'اللون', value: 'أزرق', additionalPrice: 0 },
          { name: 'اللون', value: 'أخضر', additionalPrice: 0 },
        ],
      });

      await Product.findByIdAndUpdate(products[1]._id, {
        variants: [
          { name: 'المادة', value: 'معدني', additionalPrice: 50 },
          { name: 'المادة', value: 'خشبي', additionalPrice: 0 },
        ],
      });

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
    console.log('');

    // 9. Create Sample Orders
    console.log('📦 Creating Sample Orders...');
    const ordersCount = await Order.countDocuments();
    
    if (ordersCount === 0 && clients.length > 0 && products.length > 0) {
      // Create a catalog order
      const catalogOrder = await Order.create({
        orderNumber: `ORD-${String(1).padStart(6, '0')}`,
        clientId: clients[0]._id,
        clientName: clients[0].name,
        clientPhone: clients[0].phone,
        clientEmail: clients[0].email,
        clientAddress: clients[0].addresses?.[0] ? 
          `${clients[0].addresses[0].street}, ${clients[0].addresses[0].city}` : '',
        items: [
          {
            productId: products[0]._id,
            productType: 'regular',
            productName: products[0].name,
            quantity: 1,
            unitPrice: products[0].price,
            cost: products[0].cost,
            subtotal: products[0].price,
            total: products[0].price,
          },
        ],
        subtotal: products[0].price,
        discount: 0,
        tax: 0,
        total: products[0].price,
        cost: products[0].cost,
        profit: products[0].price - products[0].cost,
        paymentMethod: 'credit',
        paymentStatus: 'unpaid',
        source: 'catalog',
        status: 'pending',
      });
      console.log('✅ Created catalog order:', catalogOrder.orderNumber);

      // Create a commercial POS order
      const commercialOrder = await Order.create({
        orderNumber: `ORD-${String(2).padStart(6, '0')}`,
        clientId: clients[1]._id,
        clientName: clients[1].name,
        clientPhone: clients[1].phone,
        clientEmail: clients[1].email,
        commercialId: commercials[0]._id,
        items: [
          {
            productId: products[1]._id,
            productType: 'regular',
            productName: products[1].name,
            quantity: 2,
            unitPrice: products[1].price,
            cost: products[1].cost,
            subtotal: products[1].price * 2,
            total: products[1].price * 2,
          },
        ],
        subtotal: products[1].price * 2,
        discount: 0,
        tax: 0,
        total: products[1].price * 2,
        cost: products[1].cost * 2,
        profit: (products[1].price - products[1].cost) * 2,
        paymentMethod: 'credit',
        paymentStatus: 'unpaid',
        source: 'commercial_pos',
        status: 'pending',
      });
      console.log('✅ Created commercial POS order:', commercialOrder.orderNumber);

      // Create a POS order
      const posOrder = await Order.create({
        orderNumber: `ORD-${String(3).padStart(6, '0')}`,
        clientName: 'عميل مباشر',
        items: [
          {
            productId: products[2]._id,
            productType: 'regular',
            productName: products[2].name,
            quantity: 1,
            unitPrice: products[2].price,
            cost: products[2].cost,
            subtotal: products[2].price,
            total: products[2].price,
          },
        ],
        subtotal: products[2].price,
        discount: 0,
        tax: 0,
        total: products[2].price,
        cost: products[2].cost,
        profit: products[2].price - products[2].cost,
        paymentMethod: 'cash',
        paymentStatus: 'paid',
        source: 'pos',
        cashierId: cashiers[0]._id,
        storeId: stores[0]._id,
        status: 'completed',
        completedAt: new Date(),
      });
      console.log('✅ Created POS order:', posOrder.orderNumber);
    } else {
      console.log('ℹ️  Orders already exist, skipping...');
    }
    console.log('');

    console.log('\n✅ Database seeding completed successfully!\n');
    console.log('📝 Login Credentials:\n');
    console.log('   👤 Admin:');
    console.log('      Email: admin@lesroisdesbois.com');
    console.log('      Password: admin123\n');
    console.log('   💼 Commercials:');
    console.log('      Email: commercial1@lesroisdesbois.com');
    console.log('      Password: commercial123\n');
    console.log('      Email: commercial2@lesroisdesbois.com');
    console.log('      Password: commercial123\n');
    console.log('   🏪 Cashiers:');
    console.log('      Email: cashier1@lesroisdesbois.com');
    console.log('      Password: cashier123\n');
    console.log('   👥 Clients:');
    console.log('      Email: client1@lesroisdesbois.com');
    console.log('      Password: client123\n');
    console.log('⚠️  Please change passwords after first login!\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();

