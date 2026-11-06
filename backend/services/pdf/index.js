/**
 * PDF toolkit — the single entry point for every PDF the app produces.
 *
 * Engine: Handlebars templates in backend/templates/pdf (shared layout.hbs, styles.css and
 * partials header / party / items-table / totals / notes) rendered by one shared headless
 * Chromium (Puppeteer) with a small concurrency limit (PDF_MAX_CONCURRENCY, default 2).
 * Fonts (Noto Sans + Noto Sans Arabic, OFL) are embedded from backend/assets/fonts, so
 * Arabic names render correctly everywhere, including inside Docker.
 *
 *   renderPdf(templateName, data, options) -> Promise<Buffer>
 *     templateName  file in backend/templates/pdf without ".hbs" ('document', 'ticket',
 *                   'statement', 'monthly-expenses', ...)
 *     data          raw values (numbers, Date objects); `company` is injected from Settings
 *     options       { format: 'A4'|'ticket', landscape, footerLabel, title, outputPath }
 *                   A4 pages get a "Page X / Y" footer; 'ticket' is a single 80 mm page.
 *
 *   renderPdfToUploads(templateName, data, { subDir, fileName, ...options }) -> "/uploads/<subDir>/<fileName>"
 *   renderHtml(templateName, data, options) -> Promise<string>      (debugging / previews)
 *   renderStatementPdf(input, options) / buildStatementData(input) -> see ./statement.js
 *   getCompanyInfo() -> { name, address, phone, email, taxId, logo(data URI) }
 *   format helpers -> see ./format.js
 */
export { renderPdf, renderPdfToUploads, renderHtml } from './render.js';
export { renderStatementPdf, buildStatementData } from './statement.js';
export { getCompanyInfo, COMPANY_DEFAULTS } from './company.js';
export { closeBrowser } from './browser.js';
export {
  formatAmount,
  formatMoney,
  formatQuantity,
  formatPercent,
  formatDate,
  formatTime,
  formatDateTime,
  formatMonthYear,
  formatPeriod,
  paymentStatus,
  PAYMENT_STATUS_LABELS,
  TIMEZONE,
  CURRENCY,
} from './format.js';
