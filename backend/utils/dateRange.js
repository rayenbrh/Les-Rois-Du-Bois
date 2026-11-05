const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Upper bound of a date filter.
 * A bare date (YYYY-MM-DD) means "through the end of that day", not its first instant.
 * A full timestamp is kept as sent, and no value means "now".
 */
export const endOfRange = (endDate) => {
  if (!endDate) return new Date();
  return DATE_ONLY.test(endDate) ? new Date(`${endDate}T23:59:59.999Z`) : new Date(endDate);
};
