import type { ReactNode } from 'react';
import type { ScreenResource } from './types';

export function formatNumber(value: number | null, compact = false) {
  if (value === null || !Number.isFinite(value)) return '—';
  return new Intl.NumberFormat(compact ? 'en-US' : 'tr-TR', {
    maximumFractionDigits: compact ? 1 : 0,
    notation: compact ? 'compact' : 'standard',
  }).format(value);
}

export function SectionTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <header className="section-heading">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
        {description && <p className="section-description">{description}</p>}
      </div>
      {action}
    </header>
  );
}

export function ResourceNotice({
  resource,
  label,
}: {
  resource: ScreenResource<unknown>;
  label: string;
}) {
  if (resource.status === 'ready') return null;
  if (resource.status === 'loading')
    return (
      <div
        className="resource-state"
        role="status"
        aria-label={`${label} yükleniyor`}
      >
        <div className="skeleton-line" />
        <div className="skeleton-line short" />
        <p>{label} yükleniyor…</p>
      </div>
    );
  return (
    <div className="resource-state" role="status">
      <span className="resource-symbol" aria-hidden="true">
        ◇
      </span>
      <h2>
        {resource.status === 'error'
          ? 'Şu anda yüklenemedi'
          : 'Burada yeni bir bölüm açılıyor'}
      </h2>
      <p>
        {resource.status === 'error'
          ? 'Bağlantını kontrol edip yeniden deneyebilirsin.'
          : 'Bu bölümün oyun bağlantısı hazırlanıyor. Hazır olduğunda ilerlemen burada görünecek.'}
      </p>
      {resource.onRetry && (
        <button className="button secondary" onClick={resource.onRetry}>
          Tekrar dene
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="empty-state">
      <span aria-hidden="true">✧</span>
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}
