import { authenticate, optionalAuth } from './auth.middleware.js';

// Any logged-in account can use the client (shop) endpoints.
export const clientAuth = authenticate;
export { optionalAuth };
