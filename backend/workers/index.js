import './pdfWorker.js';
import './emailWorker.js';

console.log('🚀 Workers started successfully');
console.log('  - PDF Generation Worker');
console.log('  - Email Sending Worker');

// Keep process alive
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

