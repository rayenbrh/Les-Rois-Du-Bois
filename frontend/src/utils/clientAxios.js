import { createApiClient } from '../lib/axios';

// Store API (e.g. https://backend/api/client). Shares token handling with the main client.
const clientApi = createApiClient('/client');

export default clientApi;
