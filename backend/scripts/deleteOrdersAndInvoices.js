import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Order from '../models/Order.model.js';
import Invoice from '../models/Invoice.model.js';
import SupplierInvoice from '../models/SupplierInvoice.model.js';
import readline from 'readline';

dotenv.config();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const deleteOrdersAndInvoices = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/les-rois-des-bois');
    console.log('✅ Connected to MongoDB\n');

    // Count documents
    const ordersCount = await Order.countDocuments({});
    const invoicesCount = await Invoice.countDocuments({});
    const supplierInvoicesCount = await SupplierInvoice.countDocuments({});

    console.log('='.repeat(60));
    console.log('📊 STATISTIQUES ACTUELLES');
    console.log('='.repeat(60));
    console.log(`Commandes: ${ordersCount}`);
    console.log(`Factures clients: ${invoicesCount}`);
    console.log(`Factures fournisseurs: ${supplierInvoicesCount}`);
    console.log(`Total: ${ordersCount + invoicesCount + supplierInvoicesCount} documents\n`);

    if (ordersCount === 0 && invoicesCount === 0 && supplierInvoicesCount === 0) {
      console.log('✅ Aucun document à supprimer.');
      await mongoose.connection.close();
      rl.close();
      process.exit(0);
    }

    // Ask what to delete
    console.log('Que voulez-vous supprimer ?');
    console.log('1. Toutes les commandes (Orders)');
    console.log('2. Toutes les factures clients (Invoices)');
    console.log('3. Toutes les factures fournisseurs (Supplier Invoices)');
    console.log('4. Tout (Commandes + Factures clients + Factures fournisseurs)');
    console.log('5. Annuler\n');

    const choice = await question('Votre choix (1-5): ');

    let deleteOrders = false;
    let deleteInvoices = false;
    let deleteSupplierInvoices = false;

    switch (choice.trim()) {
      case '1':
        deleteOrders = true;
        break;
      case '2':
        deleteInvoices = true;
        break;
      case '3':
        deleteSupplierInvoices = true;
        break;
      case '4':
        deleteOrders = true;
        deleteInvoices = true;
        deleteSupplierInvoices = true;
        break;
      case '5':
        console.log('\n❌ Opération annulée.');
        await mongoose.connection.close();
        rl.close();
        process.exit(0);
        break;
      default:
        console.log('\n❌ Choix invalide.');
        await mongoose.connection.close();
        rl.close();
        process.exit(1);
    }

    // Confirm deletion
    let confirmMessage = 'Vous allez supprimer:\n';
    if (deleteOrders) confirmMessage += `  - ${ordersCount} commandes\n`;
    if (deleteInvoices) confirmMessage += `  - ${invoicesCount} factures clients\n`;
    if (deleteSupplierInvoices) confirmMessage += `  - ${supplierInvoicesCount} factures fournisseurs\n`;
    confirmMessage += '\n⚠️  Cette action est IRRÉVERSIBLE !\n';
    confirmMessage += 'Tapez "SUPPRIMER" pour confirmer: ';

    const confirmation = await question(confirmMessage);

    if (confirmation.trim() !== 'SUPPRIMER') {
      console.log('\n❌ Opération annulée. Vous devez taper "SUPPRIMER" pour confirmer.');
      await mongoose.connection.close();
      rl.close();
      process.exit(0);
    }

    console.log('\n🗑️  Suppression en cours...\n');

    // Delete orders
    if (deleteOrders) {
      if (ordersCount > 0) {
        const result = await Order.deleteMany({});
        console.log(`✅ ${result.deletedCount} commandes supprimées`);
      } else {
        console.log('ℹ️  Aucune commande à supprimer');
      }
    }

    // Delete client invoices
    if (deleteInvoices) {
      if (invoicesCount > 0) {
        const result = await Invoice.deleteMany({});
        console.log(`✅ ${result.deletedCount} factures clients supprimées`);
      } else {
        console.log('ℹ️  Aucune facture client à supprimer');
      }
    }

    // Delete supplier invoices
    if (deleteSupplierInvoices) {
      if (supplierInvoicesCount > 0) {
        const result = await SupplierInvoice.deleteMany({});
        console.log(`✅ ${result.deletedCount} factures fournisseurs supprimées`);
      } else {
        console.log('ℹ️  Aucune facture fournisseur à supprimer');
      }
    }

    // Verify deletion
    console.log('\n' + '='.repeat(60));
    console.log('✅ VÉRIFICATION');
    console.log('='.repeat(60));
    const remainingOrders = await Order.countDocuments({});
    const remainingInvoices = await Invoice.countDocuments({});
    const remainingSupplierInvoices = await SupplierInvoice.countDocuments({});
    
    console.log(`Commandes restantes: ${remainingOrders}`);
    console.log(`Factures clients restantes: ${remainingInvoices}`);
    console.log(`Factures fournisseurs restantes: ${remainingSupplierInvoices}`);

    if (remainingOrders === 0 && remainingInvoices === 0 && remainingSupplierInvoices === 0) {
      console.log('\n✅ Tous les documents ont été supprimés avec succès !');
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    rl.close();
    console.log('\n✅ Connection closed');
    process.exit(0);
  }
};

deleteOrdersAndInvoices();


