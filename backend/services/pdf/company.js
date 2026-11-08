import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Setting from '../../models/Setting.model.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.join(__dirname, '..', '..');
const UPLOADS_DIR = path.join(BACKEND_DIR, 'uploads');
const DEFAULT_LOGO = path.join(BACKEND_DIR, 'assets', 'brand', 'logo.webp');

/** Used when the matching Settings field is empty. */
export const COMPANY_DEFAULTS = Object.freeze({
  name: 'Les Rois Du Bois',
  address: "Rte de Monastir 4070 M'saken",
  phone: '58 111 106 - 50 429 150 - 58 111 888',
  email: '',
  taxId: '',
});

const MIME_BY_EXT = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
};

const fileToDataUri = (filePath) => {
  const mime = MIME_BY_EXT[path.extname(filePath).toLowerCase()];
  if (!mime || !fs.existsSync(filePath)) return null;
  return `data:${mime};base64,${fs.readFileSync(filePath).toString('base64')}`;
};

/** Resolve an "/uploads/..." path safely (never outside the uploads folder). */
const resolveUploadPath = (uploadPath) => {
  if (typeof uploadPath !== 'string' || !uploadPath.startsWith('/uploads/')) return null;
  const resolved = path.resolve(UPLOADS_DIR, uploadPath.slice('/uploads/'.length));
  return resolved.startsWith(UPLOADS_DIR + path.sep) ? resolved : null;
};

let defaultLogoCache = null;
const defaultLogo = () => {
  if (defaultLogoCache === null) defaultLogoCache = fileToDataUri(DEFAULT_LOGO) || '';
  return defaultLogoCache;
};

const clean = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * Company identity printed in every PDF header, from Settings with fallbacks.
 * @returns {Promise<{name:string,address:string,phone:string,email:string,taxId:string,logo:string}>}
 *   logo is a data: URI (works inside Docker without any network/file access from Chromium).
 */
export const getCompanyInfo = async () => {
  let settings = null;
  try {
    settings = await Setting.findOne().lean();
  } catch (error) {
    console.error('[pdf] Unable to read settings, using company defaults:', error.message);
  }
  const s = settings || {};
  const logoPath = resolveUploadPath(clean(s.companyLogo));
  const logo = (logoPath && fileToDataUri(logoPath)) || defaultLogo();

  return {
    name: clean(s.companyName) || COMPANY_DEFAULTS.name,
    address: clean(s.companyAddress) || COMPANY_DEFAULTS.address,
    phone: clean(s.companyPhone) || COMPANY_DEFAULTS.phone,
    email: clean(s.companyEmail) || COMPANY_DEFAULTS.email,
    taxId: clean(s.companyTaxId) || COMPANY_DEFAULTS.taxId,
    logo,
  };
};
