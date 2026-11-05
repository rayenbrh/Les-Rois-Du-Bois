/**
 * Lightweight in-memory rate limiter (no external dependency).
 * Good enough for a single-instance deployment; counters reset on restart.
 */
const createLimiter = ({ windowMs, max, message, skipSuccessfulRequests = false }) => {
  const hits = new Map();

  // Periodically drop expired entries so memory stays bounded
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) if (entry.reset <= now) hits.delete(key);
  }, windowMs);
  sweep.unref?.();

  return (req, res, next) => {
    const key = `${req.ip}|${req.baseUrl}${req.path}`;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.reset <= now) {
      entry = { count: 0, reset: now + windowMs };
      hits.set(key, entry);
    }

    if (entry.count >= max) {
      res.set('Retry-After', String(Math.ceil((entry.reset - now) / 1000)));
      return res.status(429).json({ success: false, message });
    }

    entry.count += 1;
    if (skipSuccessfulRequests) {
      res.on('finish', () => {
        if (res.statusCode < 400) entry.count = Math.max(0, entry.count - 1);
      });
    }
    next();
  };
};

// Failed login / register attempts
export const authLimiter = createLimiter({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'محاولات كثيرة، يرجى المحاولة بعد قليل',
  skipSuccessfulRequests: true,
});

// Order creation from the store
export const orderLimiter = createLimiter({
  windowMs: 60 * 1000,
  max: 10,
  message: 'طلبات كثيرة، يرجى المحاولة بعد قليل',
});

export default createLimiter;
