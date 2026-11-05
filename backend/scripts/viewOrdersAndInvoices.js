import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../models/Order.model.js';
import Invoice from '../models/Invoice.model.js';
import SupplierInvoice from '../models/SupplierInvoice.model.js';

dotenv.config();

const viewOrdersAndInvoices = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/les-rois-des-bois');
    console.log('✅ Connected to MongoDB\n');

    // ===== ORDERS =====
    console.log('='.repeat(60));
    console.log('📦 COMMANDES (ORDERS)');
    console.log('='.repeat(60));
    
    const ordersCount = await Order.countDocuments({});
    console.log(`\nNombre total de commandes: ${ordersCount}\n`);

    if (ordersCount > 0) {
      // Statistics by status
      const ordersByStatus = await Order.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$total' } } }
      ]);
      
      console.log('Statistiques par statut:');
      ordersByStatus.forEach(stat => {
        console.log(`  ${stat._id || 'N/A'}: ${stat.count} commandes - Total: ${stat.total?.toFixed(2) || 0} TND`);
      });

      // Total revenue
      const totalRevenue = await Order.aggregate([
        { $match: { status: { $ne: 'canceled' } } },
        { $group: { _id: null, total: { $sum: '$total' } } }
      ]);
      console.log(`\nTotal des commandes (non annulées): ${totalRevenue[0]?.total?.toFixed(2) || 0} TND`);

      // Show first 10 orders
      console.log('\n--- 10 PREMIÈRES COMMANDES ---');
      const orders = await Order.find({}).limit(10).sort({ createdAt: -1 });
      orders.forEach((order, index) => {
        console.log(`\n${index + 1}. Order #${order.orderNumber}`);
        console.log(`   Client: ${order.clientName}`);
        console.log(`   Total: ${order.total} TND`);
        console.log(`   Statut: ${order.status}`);
        console.log(`   Date: ${order.createdAt}`);
      });

      if (ordersCount > 10) {
        console.log(`\n... et ${ordersCount - 10} autres commandes`);
      }
    } else {
      console.log('Aucune commande trouvée.');
    }

    // ===== CLIENT INVOICES =====
    console.log('\n\n' + '='.repeat(60));
    console.log('🧾 FACTURES CLIENTS (INVOICES)');
    console.log('='.repeat(60));
    
    const invoicesCount = await Invoice.countDocuments({});
    console.log(`\nNombre total de factures clients: ${invoicesCount}\n`);

    if (invoicesCount > 0) {
      // Statistics by status
      const invoicesByStatus = await Invoice.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$total' } } }
      ]);
      
      console.log('Statistiques par statut:');
      invoicesByStatus.forEach(stat => {
        console.log(`  ${stat._id || 'N/A'}: ${stat.count} factures - Total: ${stat.total?.toFixed(2) || 0} TND`);
      });

      // Total amounts
      const totals = await Invoice.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: '$total' },
            paid: { $sum: '$paidAmount' },
            remaining: { $sum: '$remainingAmount' }
          }
        }
      ]);
      
      if (totals[0]) {
        console.log(`\nTotal des factures: ${totals[0].total?.toFixed(2) || 0} TND`);
        console.log(`Total payé: ${totals[0].paid?.toFixed(2) || 0} TND`);
        console.log(`Total restant: ${totals[0].remaining?.toFixed(2) || 0} TND`);
      }

      // Show first 10 invoices
      console.log('\n--- 10 PREMIÈRES FACTURES CLIENTS ---');
      const invoices = await Invoice.find({}).limit(10).sort({ createdAt: -1 });
      invoices.forEach((invoice, index) => {
        console.log(`\n${index + 1}. Invoice #${invoice.invoiceNumber}`);
        console.log(`   Client: ${invoice.clientName}`);
        console.log(`   Total: ${invoice.total} TND`);
        console.log(`   Payé: ${invoice.paidAmount || 0} TND`);
        console.log(`   Restant: ${invoice.remainingAmount || invoice.total} TND`);
        console.log(`   Statut: ${invoice.status}`);
        console.log(`   Date: ${invoice.createdAt}`);
      });

      if (invoicesCount > 10) {
        console.log(`\n... et ${invoicesCount - 10} autres factures`);
      }
    } else {
      console.log('Aucune facture client trouvée.');
    }

    // ===== SUPPLIER INVOICES =====
    console.log('\n\n' + '='.repeat(60));
    console.log('🏭 FACTURES FOURNISSEURS (SUPPLIER INVOICES)');
    console.log('='.repeat(60));
    
    const supplierInvoicesCount = await SupplierInvoice.countDocuments({});
    console.log(`\nNombre total de factures fournisseurs: ${supplierInvoicesCount}\n`);

    if (supplierInvoicesCount > 0) {
      // Statistics by status
      const supplierInvoicesByStatus = await SupplierInvoice.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$total' } } }
      ]);
      
      console.log('Statistiques par statut:');
      supplierInvoicesByStatus.forEach(stat => {
        console.log(`  ${stat._id || 'N/A'}: ${stat.count} factures - Total: ${stat.total?.toFixed(2) || 0} TND`);
      });

      // Total amounts
      const supplierTotals = await SupplierInvoice.aggregate([
        {
          $group: {
            _id: null,
            total: { $sum: '$total' },
            paid: { $sum: '$paidAmount' },
            remaining: { $sum: '$remainingAmount' }
          }
        }
      ]);
      
      if (supplierTotals[0]) {
        console.log(`\nTotal des factures: ${supplierTotals[0].total?.toFixed(2) || 0} TND`);
        console.log(`Total payé: ${supplierTotals[0].paid?.toFixed(2) || 0} TND`);
        console.log(`Total restant: ${supplierTotals[0].remaining?.toFixed(2) || 0} TND`);
      }

      // Show first 10 supplier invoices
      console.log('\n--- 10 PREMIÈRES FACTURES FOURNISSEURS ---');
      const supplierInvoices = await SupplierInvoice.find({})
        .populate('supplierId', 'name')
        .limit(10)
        .sort({ createdAt: -1 });
      
      supplierInvoices.forEach((invoice, index) => {
        console.log(`\n${index + 1}. Invoice #${invoice.invoiceNumber}`);
        console.log(`   Fournisseur: ${invoice.supplierId?.name || 'N/A'}`);
        console.log(`   Total: ${invoice.total} TND`);
        console.log(`   Payé: ${invoice.paidAmount || 0} TND`);
        console.log(`   Restant: ${invoice.remainingAmount || invoice.total} TND`);
        console.log(`   Statut: ${invoice.status}`);
        console.log(`   Date: ${invoice.createdAt}`);
      });

      if (supplierInvoicesCount > 10) {
        console.log(`\n... et ${supplierInvoicesCount - 10} autres factures`);
      }
    } else {
      console.log('Aucune facture fournisseur trouvée.');
    }

    // Summary
    console.log('\n\n' + '='.repeat(60));
    console.log('📊 RÉSUMÉ');
    console.log('='.repeat(60));
    console.log(`Commandes: ${ordersCount}`);
    console.log(`Factures clients: ${invoicesCount}`);
    console.log(`Factures fournisseurs: ${supplierInvoicesCount}`);
    console.log(`Total: ${ordersCount + invoicesCount + supplierInvoicesCount} documents`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Connection closed');
    process.exit(0);
  }
};

viewOrdersAndInvoices();


