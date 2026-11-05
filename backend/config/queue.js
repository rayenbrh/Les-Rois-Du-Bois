import { Queue, Worker } from 'bullmq';
import Redis from 'ioredis';

let redisConnection = null;
let pdfQueue = null;
let emailQueue = null;
let exportQueue = null;
let redisAvailable = false;

// Check if Redis should be used
const shouldUseRedis = () => {
  return process.env.REDIS_HOST && process.env.USE_JOB_QUEUE === 'true';
};

// Initialize Redis connection (only if explicitly enabled)
const initializeRedis = () => {
  if (!shouldUseRedis()) {
    return false;
  }

  // If already initialized, return
  if (redisConnection !== null) {
    return redisConnection;
  }

  try {
    redisConnection = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379,
      maxRetriesPerRequest: null,
      retryStrategy: () => null, // Don't retry - fail fast
      lazyConnect: true, // Don't connect automatically
      enableReadyCheck: false,
      connectTimeout: 2000,
      enableOfflineQueue: false, // Don't queue commands when offline
    });

    // Silent error handling - don't spam logs
    redisConnection.on('error', () => {
      redisAvailable = false;
    });

    redisConnection.on('ready', () => {
      redisAvailable = true;
    });

    redisConnection.on('connect', () => {
      redisAvailable = true;
    });

    return redisConnection;
  } catch (error) {
    console.warn('⚠️  Redis initialization failed. Application will continue without job queue.');
    redisConnection = null;
    redisAvailable = false;
    return null;
  }
};

// Only initialize if Redis is explicitly enabled
if (shouldUseRedis()) {
  initializeRedis();
  
  // Create queue objects only if Redis connection exists
  // They won't connect until actually used
  if (redisConnection) {
    try {
      pdfQueue = new Queue('pdf-generation', {
        connection: redisConnection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      });

      emailQueue = new Queue('email-sending', {
        connection: redisConnection,
        defaultJobOptions: {
          attempts: 3,
          backoff: {
            type: 'exponential',
            delay: 2000,
          },
        },
      });

      exportQueue = new Queue('data-export', {
        connection: redisConnection,
        defaultJobOptions: {
          attempts: 2,
          backoff: {
            type: 'fixed',
            delay: 5000,
          },
        },
      });
    } catch (error) {
      console.warn('⚠️  Queue initialization failed. Application will continue without job queue.');
    }
  }
}

// Export queues (will be null if Redis is not available)
export { pdfQueue, emailQueue, exportQueue, redisConnection, redisAvailable };

// Helper function to check if queue is available
export const isQueueAvailable = () => {
  if (!shouldUseRedis()) {
    return false;
  }
  return redisAvailable && redisConnection !== null;
};
