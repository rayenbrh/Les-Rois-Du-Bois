// Amounts from the customer / supplier accounts come in integer millimes (1 TND = 1000).
const fmt = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export const fromMillimes = (m) => Math.round(Number(m) || 0) / 1000;

/** 1250500 -> "1 250,500 TND" */
export const formatMillimes = (m) => `${fmt.format(fromMillimes(m)).replace(/ | /g, ' ')} TND`;

/** Date and time shown in Tunis time. */
export const formatTunisDateTime = (value) =>
  value
    ? new Intl.DateTimeFormat('fr-FR', {
        timeZone: 'Africa/Tunis',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(new Date(value))
    : '-';

export const formatTunisDate = (value) =>
  value
    ? new Intl.DateTimeFormat('fr-FR', { timeZone: 'Africa/Tunis', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value))
    : '-';

/** One key per checkout / payment attempt, reused on retry so nothing is saved twice. */
export const newIdempotencyKey = () =>
  globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
