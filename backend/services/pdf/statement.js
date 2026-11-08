import { formatDate, formatPeriod } from './format.js';
import { renderPdf } from './render.js';

/**
 * "Relevé de compte" (account statement) — template backend/templates/pdf/statement.hbs.
 *
 * Input shape (everything except party.name and entries is optional):
 * {
 *   number?:  string,                       // statement reference, e.g. "REL-2026-0001"
 *   date?:    Date|string,                  // issue date (default: now)
 *   party: {
 *     title?:   string,                     // block title, default "Client" (use "Fournisseur" for suppliers)
 *     name:     string,
 *     contact?: string, phone?: string, email?: string, address?: string, taxId?: string,
 *   },
 *   period?:  { from?: Date|string, to?: Date|string },
 *   openingBalance?: number,                // default 0
 *   entries: [{
 *     date:       Date|string,              // printed as dd/mm/yyyy + HH:mm (Africa/Tunis)
 *     operation:  string,                   // e.g. "Facture", "Paiement espèces", "Avoir"
 *     reference?: string,                   // e.g. "INV-2026-000012"
 *     debit?:     number,                   // increases the balance (amount owed by the party)
 *     credit?:    number,                   // decreases the balance (payment received / credit note)
 *     balance?:   number,                   // optional; computed as running balance when omitted
 *   }],
 *   closingBalance?: number,                // default: last running balance
 *   notes?: string,
 * }
 * Balance convention: balance = previous balance + debit - credit (positive = the party owes us).
 * Entries are printed in the given order (sort them by date before calling).
 */
export const buildStatementData = (input = {}) => {
  const opening = Number(input.openingBalance) || 0;
  let running = opening;
  let totalDebit = 0;
  let totalCredit = 0;

  const entries = (input.entries || []).map((entry) => {
    const debit = Number(entry.debit) || 0;
    const credit = Number(entry.credit) || 0;
    totalDebit += debit;
    totalCredit += credit;
    running = Number.isFinite(Number(entry.balance)) && entry.balance !== null && entry.balance !== undefined
      ? Number(entry.balance)
      : running + debit - credit;
    return { ...entry, debit, credit, balance: running };
  });

  const closing = Number.isFinite(Number(input.closingBalance)) && input.closingBalance !== null && input.closingBalance !== undefined
    ? Number(input.closingBalance)
    : running;
  const period = input.period || {};
  const issueDate = input.date || new Date();

  return {
    documentTitle: `Relevé de compte${input.number ? ` ${input.number}` : ''}`,
    doc: {
      title: 'Relevé de compte',
      number: input.number || '',
      meta: [{ label: 'Date', value: formatDate(issueDate) }],
    },
    party: { title: 'Client', ...(input.party || {}) },
    period: { from: period.from || null, to: period.to || null, label: formatPeriod(period.from, period.to) },
    openingBalance: opening,
    entries,
    totalDebit,
    totalCredit,
    closingBalance: closing,
    notes: input.notes || '',
  };
};

/**
 * Render a statement PDF.
 * @param {object} input - see buildStatementData
 * @param {object} [options] - renderPdf options (outputPath, footerLabel…)
 * @returns {Promise<Buffer>}
 */
export const renderStatementPdf = (input, options = {}) => {
  const data = buildStatementData(input);
  return renderPdf('statement', data, {
    footerLabel: data.documentTitle,
    ...options,
  });
};
