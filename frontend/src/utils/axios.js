// Re-export the API client from lib/axios.js
// This ensures the initialization code (interceptors, baseURL setup) runs when this module is imported
import api, { API_BASE } from '../lib/axios';

// The initialization code in ../lib/axios.js will run when this import happens
// This ensures all interceptors and configuration are set up correctly

export { API_BASE };
export default api;

