import { useState } from 'react';
import type { FeatureFlagItem } from './admin-types';
import { DEFAULT_FEATURE_FLAGS } from './admin-api';
import { AdminModal, AdminSwitch } from './admin-ui';

export interface FeatureFlagsTabProps {
  flags?: FeatureFlagItem[];
  isLoading?: boolean;
  onToggle?: (
    key: string,
    nextValue: boolean,
    reason: string,
  ) => Promise<void> | void;
}

export function FeatureFlagsTab({
  flags: propFlags,
  isLoading = false,
  onToggle,
}: FeatureFlagsTabProps) {
  const [flags, setFlags] = useState<FeatureFlagItem[]>(
    () => propFlags || DEFAULT_FEATURE_FLAGS,
  );
  const [pendingFlag, setPendingFlag] = useState<{
    item: FeatureFlagItem;
    targetValue: boolean;
  } | null>(null);
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Synchronize when propFlags changes
  const activeFlags = propFlags || flags;

  const handleSwitchClick = (item: FeatureFlagItem, targetValue: boolean) => {
    setPendingFlag({ item, targetValue });
    setReason('');
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleConfirm = async () => {
    if (!pendingFlag) return;
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setErrorMsg('Lütfen değişiklik gerekçesini belirtin.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      if (onToggle) {
        await onToggle(
          pendingFlag.item.key,
          pendingFlag.targetValue,
          trimmedReason,
        );
      } else {
        // Fallback local update
        setFlags((prev) =>
          prev.map((f) =>
            f.key === pendingFlag.item.key
              ? { ...f, enabled: pendingFlag.targetValue }
              : f,
          ),
        );
      }
      setSuccessMsg(
        `"${pendingFlag.item.label}" başarıyla ${pendingFlag.targetValue ? 'etkinleştirildi' : 'devre dışı bırakıldı'}.`,
      );
      setPendingFlag(null);
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Özellik bayrağı güncellenirken bir hata oluştu.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="admin-tab-panel admin-flags-tab">
      <div className="admin-panel-header">
        <div>
          <h2 className="admin-panel-title">Sistem Özellik Bayrakları</h2>
          <p className="admin-panel-desc">
            Kritik oyun ve ekonomi fonksiyonlarını gerçek zamanlı olarak açıp
            kapatın. Tüm değişiklikler denetim günlüğünde kayıt altına alınır.
          </p>
        </div>
      </div>

      {errorMsg && (
        <div className="admin-alert admin-alert-error" role="alert">
          <strong>Hata:</strong> {errorMsg}
        </div>
      )}

      {successMsg && (
        <div className="admin-alert admin-alert-success" role="status">
          <strong>Başarılı:</strong> {successMsg}
        </div>
      )}

      {isLoading ? (
        <div className="admin-loading-skeleton">
          <div className="skeleton-line" />
          <div className="skeleton-line" />
          <div className="skeleton-line" />
        </div>
      ) : (
        <div className="admin-flags-grid">
          {activeFlags.map((item) => (
            <div
              key={item.key}
              className={`admin-flag-card ${item.enabled ? 'card-enabled' : 'card-disabled'}`}
            >
              <div className="admin-flag-meta">
                <span className="admin-flag-category">
                  {item.category.toUpperCase()}
                </span>
                <h3 className="admin-flag-name">{item.label}</h3>
                <code className="admin-flag-key">{item.key}</code>
                <p className="admin-flag-desc">{item.description}</p>
              </div>

              <div className="admin-flag-control">
                <AdminSwitch
                  id={`switch-${item.key}`}
                  label={item.label}
                  checked={item.enabled}
                  disabled={isSubmitting}
                  onChange={(targetVal) => handleSwitchClick(item, targetVal)}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Confirmation & Reason Dialog */}
      <AdminModal
        isOpen={pendingFlag !== null}
        title="Özellik Bayrağı Değişikliği Onayı"
        onClose={() => {
          if (!isSubmitting) setPendingFlag(null);
        }}
      >
        {pendingFlag && (
          <div className="admin-flag-dialog-content">
            <p>
              <strong>{pendingFlag.item.label}</strong> bayrağının durumunu{' '}
              <span
                className={
                  pendingFlag.targetValue
                    ? 'text-active-strong'
                    : 'text-disabled-strong'
                }
              >
                {pendingFlag.targetValue ? 'AKTİF' : 'DEVRE DIŞI'}
              </span>{' '}
              olarak güncellemek üzeresiniz.
            </p>

            <div className="admin-form-group">
              <label htmlFor="flag-reason-input">
                Değişiklik Gerekçesi <span className="required-mark">*</span>
              </label>
              <textarea
                id="flag-reason-input"
                className="admin-textarea"
                rows={3}
                placeholder="Örn: Geçici sunucu bakımı, planlı güncelleme veya güvenlik testi..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                disabled={isSubmitting}
                autoFocus
              />
              <small className="admin-form-hint">
                Bu açıklama sisteme kalıcı olarak denetim kaydı olarak
                işlenecektir.
              </small>
            </div>

            {errorMsg && (
              <p className="dialog-error" role="alert">
                {errorMsg}
              </p>
            )}

            <div className="admin-dialog-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setPendingFlag(null)}
                disabled={isSubmitting}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className="button primary"
                onClick={handleConfirm}
                disabled={isSubmitting || !reason.trim()}
              >
                {isSubmitting ? 'Kaydediliyor…' : 'Onayla ve Kaydet'}
              </button>
            </div>
          </div>
        )}
      </AdminModal>
    </div>
  );
}
