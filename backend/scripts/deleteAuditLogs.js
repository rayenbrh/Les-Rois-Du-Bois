import mongoose from 'mongoose';
import dotenv from 'dotenv';
import AuditLog from '../models/AuditLog.model.js';
import readline from 'readline';

dotenv.config();

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

const deleteAuditLogs = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/les-rois-des-bois');
    console.log('✅ Connected to MongoDB\n');

    // Count documents
    const logsCount = await AuditLog.countDocuments({});

    console.log('='.repeat(60));
    console.log('📊 STATISTIQUES ACTUELLES');
    console.log('='.repeat(60));
    console.log(`Nombre total de logs d'audit: ${logsCount}\n`);

    if (logsCount === 0) {
      console.log('✅ Aucun log à supprimer.');
      await mongoose.connection.close();
      rl.close();
      process.exit(0);
    }

    // Statistics by resource type
    const logsByResourceType = await AuditLog.aggregate([
      { $group: { _id: '$resourceType', count: { $sum: 1 } } }
    ]);
    
    console.log('Statistiques par type de ressource:');
    logsByResourceType.forEach(stat => {
      console.log(`  ${stat._id || 'N/A'}: ${stat.count} logs`);
    });

    // Statistics by action
    const logsByAction = await AuditLog.aggregate([
      { $group: { _id: '$action', count: { $sum: 1 } } }
    ]);
    
    console.log('\nStatistiques par action:');
    logsByAction.forEach(stat => {
      console.log(`  ${stat._id || 'N/A'}: ${stat.count} logs`);
    });

    // Ask what to delete
    console.log('\n' + '='.repeat(60));
    console.log('Que voulez-vous supprimer ?');
    console.log('1. TOUS les logs (sans filtres)');
    console.log('2. Logs filtrés (par type, action, dates)');
    console.log('3. Annuler\n');
    
    const choice = await question('Votre choix (1-3): ');

    let query = {};

    if (choice.trim() === '1') {
      // Delete all logs
      query = {};
      console.log(`\n⚠️  Vous allez supprimer TOUS les ${logsCount} logs !`);
    } else if (choice.trim() === '2') {
      // Ask for filters
      console.log('\n' + '='.repeat(60));
      console.log('🔍 FILTRES');
      console.log('='.repeat(60));
      
      const resourceType = await question('Type de ressource (user, product, order, invoice, etc.) ou vide pour tout: ');
      const action = await question('Action (create, update, delete, etc.) ou vide pour tout: ');
      const startDate = await question('Date de début (YYYY-MM-DD) ou vide: ');
      const endDate = await question('Date de fin (YYYY-MM-DD) ou vide: ');

      // Build query
      if (resourceType.trim()) query.resourceType = resourceType.trim();
      if (action.trim()) query.action = action.trim();
      if (startDate.trim() || endDate.trim()) {
        query.createdAt = {};
        if (startDate.trim()) query.createdAt.$gte = new Date(startDate.trim());
        if (endDate.trim()) query.createdAt.$lte = new Date(endDate.trim());
      }

      // Count matching documents
      const matchingCount = await AuditLog.countDocuments(query);
      console.log(`\n📊 ${matchingCount} log(s) correspond(ent) aux critères.`);

      if (matchingCount === 0) {
        console.log('✅ Aucun log à supprimer avec ces critères.');
        await mongoose.connection.close();
        rl.close();
        process.exit(0);
      }
    } else {
      console.log('\n❌ Opération annulée.');
      await mongoose.connection.close();
      rl.close();
      process.exit(0);
    }

    // Count what will be deleted
    const toDeleteCount = await AuditLog.countDocuments(query);
    console.log(`\n⚠️  Vous allez supprimer ${toDeleteCount} log(s) !`);
    console.log('⚠️  Cette action est IRRÉVERSIBLE !');
    const confirmation = await question('Tapez "SUPPRIMER" pour confirmer: ');

    if (confirmation.trim() !== 'SUPPRIMER') {
      console.log('\n❌ Opération annulée. Vous devez taper "SUPPRIMER" pour confirmer.');
      await mongoose.connection.close();
      rl.close();
      process.exit(0);
    }

    console.log('\n🗑️  Suppression en cours...\n');

    // Delete logs
    const result = await AuditLog.deleteMany(query);
    console.log(`✅ ${result.deletedCount} log(s) supprimé(s) avec succès !`);

    // Verify deletion
    const remainingCount = await AuditLog.countDocuments({});
    console.log(`\n📊 Logs restants: ${remainingCount}`);

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await mongoose.connection.close();
    rl.close();
    console.log('\n✅ Connection closed');
    process.exit(0);
  }
};

deleteAuditLogs();

