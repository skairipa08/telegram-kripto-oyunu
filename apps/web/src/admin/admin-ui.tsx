import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { RiskSeverity } from './admin-types';

export function AdminSwitch({
  checked,
  onChange,
  disabled = false,
  label,
  id,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label: string;
  id?: string;
}) {
  return (
    <div className="admin-switch-container">
      <button
        type="button"
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`admin-switch ${checked ? 'active' : ''} ${disabled ? 'disabled' : ''}`}
      >
        <span className="admin-switch-thumb" />
      </button>
      <span
        className={`admin-switch-status ${checked ? 'status-active' : 'status-disabled'}`}
      >
        {checked ? 'Aktif' : 'Devre Dışı'}
      </span>
    </div>
  );
}

export function RiskBadge({
  score,
  severity,
}: {
  score: number;
  severity?: RiskSeverity;
}) {
  let colorClass = 'admin-badge-green';
  let label = 'Düşük';

  if (score >= 70 || severity === 'critical' || severity === 'high') {
    colorClass = 'admin-badge-red';
    label = score >= 85 || severity === 'critical' ? 'Kritik' : 'Yüksek';
  } else if (score >= 31 || severity === 'medium') {
    colorClass = 'admin-badge-amber';
    label = 'Orta';
  }

  return (
    <span
      className={`admin-risk-badge ${colorClass}`}
      title={`Risk Skoru: ${score}/100`}
    >
      <span className="risk-dot" aria-hidden="true" />
      <span className="risk-score">{score}</span>
      <span className="risk-label">({label})</span>
    </span>
  );
}

export function ReasonTag({ code }: { code: string }) {
  const translations: Record<string, string> = {
    RAPID_BURST_REQUESTS: 'Seri İstek Patlaması',
    VELOCITY_CAP_EXCEEDED: 'Üretim Tavanı Aşıldı',
    DEVICE_CLUSTER_DETECTED: 'Cihaz Kümelenmesi',
    CIRCULAR_REFERRAL_SUSPECT: 'Döngüsel Davet Şüphesi',
    MACRO_BEHAVIOR: 'Makro Davranışı',
    MULTI_ACCOUNT: 'Çoklu Hesap',
    ABNORMAL_BALANCE_GROWTH: 'Anormal Bakiye Artışı',
  };

  const label = translations[code] || code;

  return (
    <span className="admin-reason-tag" title={code}>
      {label}
    </span>
  );
}

export function StatusBadge({
  status,
}: {
  status:
    | 'frozen'
    | 'approved'
    | 'rejected'
    | 'pending'
    | 'resolved'
    | 'dismissed'
    | string;
}) {
  const map: Record<string, { label: string; className: string }> = {
    frozen: { label: 'Donduruldu', className: 'badge-frozen' },
    approved: { label: 'Onaylandı', className: 'badge-approved' },
    rejected: { label: 'Reddedildi', className: 'badge-rejected' },
    pending: { label: 'İnceleme Bekliyor', className: 'badge-pending' },
    investigating: { label: 'İnceleniyor', className: 'badge-investigating' },
    resolved: { label: 'Çözüldü', className: 'badge-approved' },
    dismissed: { label: 'Yok Sayıldı', className: 'badge-dismissed' },
  };

  const item = map[status] || { label: status, className: 'badge-neutral' };

  return (
    <span className={`admin-status-badge ${item.className}`}>{item.label}</span>
  );
}

export function DiffPill({
  oldValue,
  newValue,
}: {
  oldValue: unknown;
  newValue: unknown;
}) {
  const formatVal = (v: unknown): string => {
    if (typeof v === 'boolean') return v ? 'Aktif' : 'Devre Dışı';
    if (v === null || v === undefined) return 'Yok';
    if (typeof v === 'object') return JSON.stringify(v);
    return String(v);
  };

  return (
    <div className="admin-diff-box">
      <span className="admin-diff-old">{formatVal(oldValue)}</span>
      <span className="admin-diff-arrow" aria-hidden="true">
        →
      </span>
      <span className="admin-diff-new">{formatVal(newValue)}</span>
    </div>
  );
}

export function AdminModal({
  isOpen,
  title,
  children,
  onClose,
}: {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  // Lock background scrolling when modal is open
  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    const originalTouchAction = document.body.style.touchAction;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.touchAction = originalTouchAction;
    };
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="admin-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-dialog-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="admin-modal-card">
        <div className="admin-modal-header">
          <h3 id="admin-dialog-title">{title}</h3>
          <button
            type="button"
            className="admin-modal-close"
            onClick={onClose}
            aria-label="Kapat"
          >
            ×
          </button>
        </div>
        <div className="admin-modal-body">{children}</div>
      </div>
    </div>
  );

  if (typeof document === 'undefined') {
    return modalContent;
  }

  return createPortal(modalContent, document.body);
}
