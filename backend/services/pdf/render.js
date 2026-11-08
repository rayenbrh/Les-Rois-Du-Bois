import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Handlebars from 'handlebars';
import { withPage } from './browser.js';
import { getCompanyInfo } from './company.js';
import {
  formatAmount,
  formatMoney,
  formatQuantity,
  formatPercent,
  formatDate,
  formatTime,
  formatDateTime,
} from './format.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = path.join(__dirname, '..', '..');
const TEMPLATES_DIR = path.join(BACKEND_DIR, 'templates', 'pdf');
const PARTIALS_DIR = path.join(TEMPLATES_DIR, 'partials');
const FONTS_DIR = path.join(BACKEND_DIR, 'assets', 'fonts');

const CACHE_TEMPLATES = process.env.NODE_ENV === 'production';
const MM_PER_PX = 25.4 / 96;

/** A4 page margins; the bottom one also hosts the "Page X / Y" footer. */
const A4_MARGIN = { top: '15mm', right: '15mm', bottom: '18mm', left: '15mm' };
const TICKET_WIDTH_MM = 80;
const TICKET_MARGIN_MM = 4;

const FONT_FACES = [
  { family: 'Noto Sans', weight: 400, file: 'NotoSans-Regular.ttf' },
  { family: 'Noto Sans', weight: 700, file: 'NotoSans-Bold.ttf' },
  { family: 'Noto Sans Arabic', weight: 400, file: 'NotoSansArabic-Regular.ttf' },
  { family: 'Noto Sans Arabic', weight: 700, file: 'NotoSansArabic-Bold.ttf' },
];

// ---------------------------------------------------------------------------
// Handlebars environment (isolated instance, shared helpers + partials)
// ---------------------------------------------------------------------------
const hbs = Handlebars.create();
const escape = (value) => Handlebars.escapeExpression(value === null || value === undefined ? '' : String(value));
const isEmpty = (value) => value === null || value === undefined || String(value).trim() === '';

hbs.registerHelper({
  money: (value) => formatMoney(value),
  amount: (value) => formatAmount(value),
  qty: (value) => formatQuantity(value),
  percent: (value) => formatPercent(value),
  date: (value) => formatDate(value),
  time: (value) => formatTime(value),
  datetime: (value) => formatDateTime(value),
  /** User-provided text (names, products, notes): isolated so Arabic shapes and orders correctly. */
  bdi: (value, fallback) => {
    const fb = typeof fallback === 'string' ? fallback : '—';
    return new Handlebars.SafeString(isEmpty(value) ? escape(fb) : `<bdi dir="auto">${escape(value)}</bdi>`);
  },
  /** Multi-line user text (notes). */
  multiline: (value) => new Handlebars.SafeString(
    `<bdi dir="auto">${escape(value).replace(/\r?\n/g, '<br>')}</bdi>`
  ),
  positive: (value) => Number(value) > 0.0005,
  negative: (value) => Number(value) < -0.0005,
  eq: (a, b) => a === b,
});

const readText = (file) => fs.readFileSync(file, 'utf8');

let partialsLoaded = false;
const loadPartials = () => {
  if (partialsLoaded && CACHE_TEMPLATES) return;
  for (const file of fs.readdirSync(PARTIALS_DIR)) {
    if (file.endsWith('.hbs')) hbs.registerPartial(path.basename(file, '.hbs'), readText(path.join(PARTIALS_DIR, file)));
  }
  partialsLoaded = true;
};

const templateCache = new Map();
const compile = (name) => {
  if (CACHE_TEMPLATES && templateCache.has(name)) return templateCache.get(name);
  if (!/^[a-z0-9-]+$/i.test(name)) throw new Error(`Invalid PDF template name: ${name}`);
  const file = path.join(TEMPLATES_DIR, `${name}.hbs`);
  if (!fs.existsSync(file)) throw new Error(`PDF template not found: ${name}`);
  const template = hbs.compile(readText(file), { strict: false });
  templateCache.set(name, template);
  return template;
};

let fontCssCache = null;
const fontCss = () => {
  if (fontCssCache) return fontCssCache;
  fontCssCache = FONT_FACES.map(({ family, weight, file }) => {
    const data = fs.readFileSync(path.join(FONTS_DIR, file)).toString('base64');
    return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:block;`
      + `src:url(data:font/ttf;base64,${data}) format('truetype');}`;
  }).join('\n');
  return fontCssCache;
};

let baseCssCache = null;
const baseCss = () => {
  if (baseCssCache && CACHE_TEMPLATES) return baseCssCache;
  baseCssCache = readText(path.join(TEMPLATES_DIR, 'styles.css'));
  return baseCssCache;
};

/**
 * Build the full HTML document for a template (no browser involved).
 * @param {string} templateName - file name in backend/templates/pdf without ".hbs"
 * @param {object} data - template data; `company` is added from Settings when absent
 * @param {{ format?: 'A4'|'ticket', title?: string }} [options]
 * @returns {Promise<string>}
 */
export const renderHtml = async (templateName, data = {}, options = {}) => {
  loadPartials();
  const company = data.company || await getCompanyInfo();
  const context = { generatedAt: new Date(), ...data, company };
  const body = compile(templateName)(context);
  const layout = compile('layout');
  return layout({
    title: options.title || data.documentTitle || company.name,
    bodyClass: options.format === 'ticket' ? 'ticket' : 'a4',
    css: new Handlebars.SafeString(`${fontCss()}\n${baseCss()}`),
    body: new Handlebars.SafeString(body),
  });
};

// The footer is rendered in its own context: it gets its own (Latin-only) font face so it
// matches the document typography. Labels are document titles/numbers, never user text.
let footerFontCache = null;
const footerFontCss = () => {
  if (!footerFontCache) {
    const data = fs.readFileSync(path.join(FONTS_DIR, 'NotoSans-Regular.ttf')).toString('base64');
    footerFontCache = `@font-face{font-family:'PdfFooter';src:url(data:font/ttf;base64,${data}) format('truetype');}`;
  }
  return footerFontCache;
};

const footerTemplate = (label) => `
  <style>${footerFontCss()}</style>
  <div style="width:100%;font-size:7.5pt;color:#6b7280;padding:0 15mm;box-sizing:border-box;
              display:flex;justify-content:space-between;font-family:'PdfFooter','Noto Sans',sans-serif;">
    <span>${escape(label)}</span>
    <span>Page <span class="pageNumber"></span> / <span class="totalPages"></span></span>
  </div>`;

const printA4 = async (page, { landscape = false, footerLabel = '' }) => page.pdf({
  format: 'A4',
  landscape,
  printBackground: true,
  displayHeaderFooter: true,
  headerTemplate: '<span></span>',
  footerTemplate: footerTemplate(footerLabel),
  margin: A4_MARGIN,
});

const printTicket = async (page) => {
  const heightPx = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
  const heightMm = Math.ceil(heightPx * MM_PER_PX) + TICKET_MARGIN_MM * 2 + 2;
  const margin = `${TICKET_MARGIN_MM}mm`;
  return page.pdf({
    width: `${TICKET_WIDTH_MM}mm`,
    height: `${heightMm}mm`,
    printBackground: true,
    margin: { top: margin, right: margin, bottom: margin, left: margin },
    pageRanges: '1',
  });
};

/**
 * Render a Handlebars template from backend/templates/pdf to a PDF.
 *
 * @param {string} templateName - e.g. 'invoice', 'bon-commande', 'statement'
 * @param {object} data - template data (raw numbers/dates; templates format them with helpers)
 * @param {object} [options]
 * @param {'A4'|'ticket'} [options.format='A4'] - 'ticket' = 80 mm wide roll, single page, no footer
 * @param {boolean} [options.landscape=false]
 * @param {string} [options.footerLabel] - left part of the footer ("Facture INV-…"); right part is "Page X / Y"
 * @param {string} [options.title] - HTML <title> (PDF metadata)
 * @param {string} [options.outputPath] - when set, the PDF is also written to this absolute path
 * @returns {Promise<Buffer>}
 */
export const renderPdf = async (templateName, data = {}, options = {}) => {
  const format = options.format === 'ticket' ? 'ticket' : 'A4';
  const html = await renderHtml(templateName, data, { ...options, format });

  const pdf = await withPage(async (page) => {
    if (format === 'ticket') {
      await page.setViewport({ width: Math.round((TICKET_WIDTH_MM - TICKET_MARGIN_MM * 2) / MM_PER_PX), height: 600 });
    }
    await page.emulateMediaType('print');
    await page.setContent(html, { waitUntil: 'load', timeout: 30000 });
    await page.evaluate(() => document.fonts.ready);
    const bytes = format === 'ticket' ? await printTicket(page) : await printA4(page, options);
    return Buffer.from(bytes);
  });

  if (options.outputPath) {
    // Write then rename so a concurrent reader never sees a half-written file
    await fs.promises.mkdir(path.dirname(options.outputPath), { recursive: true });
    const tmpPath = `${options.outputPath}.${process.pid}-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`;
    await fs.promises.writeFile(tmpPath, pdf);
    await fs.promises.rename(tmpPath, options.outputPath);
  }
  return pdf;
};

/**
 * Render and store under backend/uploads/<subDir>/<fileName>.
 * @returns {Promise<string>} public path, e.g. "/uploads/invoices/INV-1.pdf"
 */
export const renderPdfToUploads = async (templateName, data, { subDir, fileName, ...options }) => {
  const safeName = path.basename(fileName);
  const outputPath = path.join(BACKEND_DIR, 'uploads', subDir, safeName);
  await renderPdf(templateName, data, { ...options, outputPath });
  return `/uploads/${subDir}/${safeName}`;
};
