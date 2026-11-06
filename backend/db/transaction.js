import mongoose from 'mongoose';

// Every query run inside connection.transaction() automatically joins its session,
// so existing helpers (stock, inventory logs) become part of the transaction unchanged.
mongoose.set('transactionAsyncLocalStorage', true);

/**
 * Run fn inside a MongoDB transaction (needs a replica set). Transient errors such as
 * write conflicts between two simultaneous payments are retried by the driver, so the
 * retry re-reads the fresh balance and its own checks decide again.
 */
export const withTransaction = (fn) => mongoose.connection.transaction(fn);

/** Error carrying an HTTP status, understood by the error handler. */
export const httpError = (statusCode, message, extra = {}) =>
  Object.assign(new Error(message), { statusCode, ...extra });
