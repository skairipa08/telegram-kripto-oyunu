import { useState } from 'react';
import type { AuditLogView } from './admin-types';
import { DiffPill } from './admin-ui';

export interface AuditLogTabProps {
  logs?: AuditLogView[];
  isLoading?: boolean;
  onRefresh?: () => Promise<void> | void;
}

const DEFAULT_MOCK_LOGS: AuditLogView[] = [
  {
    id: 'log-001',
    adminUserId: 'admin-baran-id',
    adminUsername: 'barandnz',
    action: 'set_feature_flag',
    targetType: 'feature_flag',
    targetKey: 'feature.stars_payments',
    oldValue: false,
    newValue: true,
    reason:
      'Telegram Stars ödeme testleri başarıyla tamamlandı, canlıya alındı.',
    createdAt: '2026-09-16T08:30:00Z',
  },
  {
    id: 'log-002',
    adminUserId: 'admin-berke-id',
    adminUsername: 'mberked',
    action: 'fraud_review_approve',
    targetType: 'reward',
    targetKey: 'rew-109-gamma',
    oldValue: 'frozen',
    newValue: 'approved',
    reason:
      'Kullanıcının offline kazanım hesaplaması incelendi, normal sınırlarda.',
    createdAt: '2026-09-16T07:15:00Z',
  },
  {
    id: 'log-003',
    adminUserId: 'admin-baran-id',
    adminUsername: 'barandnz',
    action: 'update_config',
    targetType: 'economy_config',
    targetKey: 'economy.multiplier',
    oldValue: 1.0,
    newValue: 1.2,
    reason: 'Hafta sonu etkinlik bonus çarpanı uygulandı.',
    createdAt: '2026-09-15T18:00:00Z',
  },
];

export function AuditLogTab({
  logs: propLogs,
  isLoading = false,
  onRefresh,
}: AuditLogTabProps) {
  const [logs] = useState<AuditLogView[]>(() => propLogs || DEFAULT_MOCK_LOGS);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionFilter, setActionFilter] = useState<string>('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const activeLogs = propLogs || logs;

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const filteredLogs = activeLogs.filter((log) => {
    if (actionFilter !== 'all' && log.action !== actionFilter) return false;
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      log.targetKey.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      (log.reason && log.reason.toLowerCase().includes(q)) ||
      (log.adminUsername && log.adminUsername.toLowerCase().includes(q))
    );
  });

  const getActionBadgeClass = (action: string): string => {
    if (action.includes('flag') || action.includes('config'))
      return 'action-config';
    if (action.includes('approve')) return 'action-approve';
    if (action.includes('reject') || action.includes('ban'))
      return 'action-reject';
    return 'action-default';
  };

  const getActionLabel = (action: string): string => {
    const map: Record<string, string> = {
      set_feature_flag: 'Bayrak Değişikliği',
      update_config: 'Ayar Güncelleme',
      fraud_review_approve: 'Ödül Onayı',
      fraud_review_reject: 'Ödül Reddi',
      freeze_season: 'Sezon Dondurma',
      ban_user: 'Kullanıcı Engelleme',
    };
    return map[action] || action;
  };

  return (
    <div className="admin-tab-panel admin-audit-tab">
      <div className="admin-panel-header">
        <div>
          <h2 className="admin-panel-title">Sistem Denetim Günlüğü</h2>
          <p className="admin-panel-desc">
            Yöneticiler tarafından gerçekleştirilen tüm konfigürasyon, özellik
            bayrağı ve güvenlik işlemlerinin kronolojik kaydı.
          </p>
        </div>

        <div className="admin-panel-header-actions">
          {onRefresh && (
            <button
              type="button"
              className="button secondary button-sm"
              onClick={handleRefresh}
              disabled={isRefreshing || isLoading}
            >
              {isRefreshing ? 'Yenileniyor…' : 'Günlüğü Yenile'}
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search */}
      <div className="admin-audit-filters">
        <div className="admin-filter-group">
          <label htmlFor="action-filter-select">İşlem Türü:</label>
          <select
            id="action-filter-select"
            className="admin-select"
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          >
            <option value="all">Tüm İşlemler</option>
            <option value="set_feature_flag">Özellik Bayrağı</option>
            <option value="update_config">Ayar Güncelleme</option>
            <option value="fraud_review_approve">Ödül Onayı</option>
            <option value="fraud_review_reject">Ödül Reddi</option>
          </select>
        </div>

        <div className="admin-search-box">
          <input
            type="search"
            className="admin-input"
            placeholder="Anahtar, yönetici veya gerekçe ara…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Denetim kayıtlarında ara"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="admin-loading-skeleton">
          <div className="skeleton-line" />
          <div className="skeleton-line" />
          <div className="skeleton-line" />
        </div>
      ) : filteredLogs.length === 0 ? (
        <div className="admin-empty-state">
          <p>Kayıtlı denetim işlemi bulunamadı.</p>
        </div>
      ) : (
        <div className="admin-audit-timeline">
          {filteredLogs.map((log) => (
            <div key={log.id} className="admin-audit-card">
              <div className="audit-card-top">
                <div className="audit-meta-left">
                  <span
                    className={`audit-action-badge ${getActionBadgeClass(log.action)}`}
                  >
                    {getActionLabel(log.action)}
                  </span>
                  <code className="audit-target-key">{log.targetKey}</code>
                </div>

                <div className="audit-meta-right">
                  <span className="audit-admin-handle">
                    {log.adminUsername
                      ? `@${log.adminUsername}`
                      : 'Süper Yönetici'}
                  </span>
                  <time className="audit-timestamp" dateTime={log.createdAt}>
                    {new Date(log.createdAt).toLocaleString('tr-TR', {
                      day: '2-digit',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </time>
                </div>
              </div>

              <div className="audit-card-body">
                <div className="audit-diff-row">
                  <span className="diff-label">Değer Değişimi:</span>
                  <DiffPill oldValue={log.oldValue} newValue={log.newValue} />
                </div>

                {log.reason && (
                  <div className="audit-reason-row">
                    <span className="reason-label">Gerekçe:</span>
                    <p className="reason-text">“{log.reason}”</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
