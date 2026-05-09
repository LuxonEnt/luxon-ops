export function hoursBetween(start?: string | null, end?: string | null, breakHours = 0) {
  if (!start || !end) return 0;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let startMins = sh * 60 + sm;
  let endMins = eh * 60 + em;
  if (endMins < startMins) endMins += 24 * 60;
  return Math.max(0, (endMins - startMins) / 60 - Number(breakHours || 0));
}

export function calculatePay(rate: number, rateType: 'hour' | 'day', hours: number) {
  return rateType === 'day' ? rate : rate * hours;
}

export function money(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value || 0);
}
