import { API_BASE } from '../lib/axios';

// Backend origin (API base without the trailing /api) - uploaded images are served from there
const BACKEND_URL = API_BASE.replace(/\/api\/?$/, '');

export const withBase = (path = '') => {
  if (!path) return '';
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  return `${BACKEND_URL}${path.startsWith('/') ? '' : '/'}${path}`;
};

// Transparent background: the image container's own colour shows through, so it suits both themes
export const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><path d="M150 250l40-50 30 35 25-30 55 65H120z" fill="#a8a29e" fill-opacity="0.55"/><circle cx="170" cy="160" r="20" fill="#a8a29e" fill-opacity="0.55"/></svg>'
  );
