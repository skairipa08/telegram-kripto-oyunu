export function formatRatioPercent(value: number) {
  if (!Number.isFinite(value)) return '—';
  return `${new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 1 }).format(value * 100)}%`;
}
