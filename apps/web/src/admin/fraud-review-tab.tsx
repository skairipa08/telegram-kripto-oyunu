import { useState } from 'react';
import type {
  FraudAccountView,
  FrozenRewardView,
  FraudSummaryMetrics,
} from './admin-types';
import { AdminModal, ReasonTag, RiskBadge, StatusBadge } from './admin-ui';

export interface FraudReviewTabProps {
  flags?: FraudAccountView[];
  rewards?: FrozenRewardView[];
  isLoading?: boolean;
  onReview?: (
    rewardId: string,
    decision: 'approve' | 'reject',
    reason: string,
  ) => Promise<void> | void;
}

const DEFAULT_MOCK_FLAGS: FraudAccountView[] = [
  {
    id: 'flag-101',
    userId: 'u-101-alpha',
    telegramId: '987654321',
    username: 'suspect_trader',
    firstName: 'Ahmet',
    riskScore: 88,
    reasonCodes: ['RAPID_BURST_REQUESTS', 'VELOCITY_CAP_EXCEEDED'],
    severity: 'critical',
    status: 'pending',
    createdAt: '2026-09-16T08:15:00Z',
    metadata: { burstRate: '45 req/sec', ceilingRatio: '3.4x' },
  },
  {
    id: 'flag-102',
    userId: 'u-102-beta',
    telegramId: '123987456',
    username: 'sybil_farm_01',
    firstName: 'Mehmet',
    riskScore: 74,
    reasonCodes: ['DEVICE_CLUSTER_DETECTED', 'CIRCULAR_REFERRAL_SUSPECT'],
    severity: 'high',
    status: 'investigating',
    createdAt: '2026-09-16T07:45:00Z',
    metadata: { clusterSize: 6, sharedIp: '198.51.100.42' },
  },
  {
    id: 'flag-103',
    userId: 'u-103-gamma',
    telegramId: '555444333',
    username: 'casual_runner',
    firstName: 'Can',
    riskScore: 24,
    reasonCodes: ['MACRO_BEHAVIOR'],
    severity: 'low',
    status: 'resolved',
    createdAt: '2026-09-15T22:30:00Z',
  },
];

const DEFAULT_MOCK_REWARDS: FrozenRewardView[] = [
  {
    id: 'rew-201',
    userId: 'u-101-alpha',
    telegramId: '987654321',
    username: 'suspect_trader',
    firstName: 'Ahmet',
    rewardType: 'cash_claim',
    amountCash: 250_000,
    amountSeasonPoints: 500,
    status: 'frozen',
    freezeReason: 'Olağanüstü nakit üretim hızı (RAPID_BURST_REQUESTS)',
    frozenAt: '2026-09-16T08:15:10Z',
  },
  {
    id: 'rew-202',
    userId: 'u-102-beta',
    telegramId: '123987456',
    username: 'sybil_farm_01',
    firstName: 'Mehmet',
    rewardType: 'referral_bonus',
    amountCash: 50_000,
    amountSeasonPoints: 1_200,
    status: 'frozen',
    freezeReason: 'Döngüsel referans kümelenmesi şüphesi',
    frozenAt: '2026-09-16T07:45:30Z',
  },
];

export function FraudReviewTab({
  flags: propFlags,
  rewards: propRewards,
  isLoading = false,
  onReview,
}: FraudReviewTabProps) {
  const [flags] = useState<FraudAccountView[]>(
    () => propFlags || DEFAULT_MOCK_FLAGS,
  );
  const [rewards, setRewards] = useState<FrozenRewardView[]>(
    () => propRewards || DEFAULT_MOCK_REWARDS,
  );

  const activeFlags = propFlags || flags;
  const activeRewards = propRewards || rewards;

  // Selected item for inspect modal
  const [inspectedFlag, setInspectedFlag] = useState<FraudAccountView | null>(
    null,
  );

  // Review modal state
  const [reviewTarget, setReviewTarget] = useState<{
    reward: FrozenRewardView;
    decision: 'approve' | 'reject';
  } | null>(null);
  const [reviewReason, setReviewReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Filter & Sub-view
  const [activeSubTab, setActiveSubTab] = useState<'rewards' | 'flags'>(
    'rewards',
  );
  const [filterQuery, setFilterQuery] = useState('');

  // Calculate KPIs
  const metrics: FraudSummaryMetrics = {
    pendingReviews: activeRewards.filter((r) => r.status === 'frozen').length,
    highRiskCount: activeFlags.filter((f) => f.riskScore >= 70).length,
    totalFrozenCash: activeRewards
      .filter((r) => r.status === 'frozen')
      .reduce((sum, r) => sum + r.amountCash, 0),
    totalFrozenPoints: activeRewards
      .filter((r) => r.status === 'frozen')
      .reduce((sum, r) => sum + r.amountSeasonPoints, 0),
  };

  const handleOpenReview = (
    reward: FrozenRewardView,
    decision: 'approve' | 'reject',
  ) => {
    setReviewTarget({ reward, decision });
    setReviewReason('');
    setFeedback(null);
  };

  const handleConfirmReview = async () => {
    if (!reviewTarget) return;
    const trimmedReason = reviewReason.trim();
    if (!trimmedReason) {
      setFeedback({
        type: 'error',
        message: 'Lütfen inceleme kararı için açıklama girin.',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      if (onReview) {
        await onReview(
          reviewTarget.reward.id,
          reviewTarget.decision,
          trimmedReason,
        );
      } else {
        // Fallback local update
        setRewards((prev) =>
          prev.map((r) =>
            r.id === reviewTarget.reward.id
              ? {
                  ...r,
                  status:
                    reviewTarget.decision === 'approve'
                      ? 'approved'
                      : 'rejected',
                  reviewNotes: trimmedReason,
                  reviewedAt: new Date().toISOString(),
                }
              : r,
          ),
        );
      }

      setFeedback({
        type: 'success',
        message:
          reviewTarget.decision === 'approve'
            ? 'Ödül onaylandı ve oyuncu bakiyesine aktarıldı.'
            : 'Ödül dondurması kaldırıldı / iptal edildi.',
      });
      setReviewTarget(null);
    } catch (err) {
      setFeedback({
        type: 'error',
        message:
          err instanceof Error
            ? err.message
            : 'İnceleme kararı iletilirken hata oluştu.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Filtered views
  const filteredRewards = activeRewards.filter((r) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      (r.username && r.username.toLowerCase().includes(q)) ||
      r.telegramId.includes(q) ||
      r.firstName.toLowerCase().includes(q)
    );
  });

  const filteredFlags = activeFlags.filter((f) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    return (
      (f.username && f.username.toLowerCase().includes(q)) ||
      f.telegramId.includes(q) ||
      f.firstName.toLowerCase().includes(q) ||
      f.reasonCodes.some((rc) => rc.toLowerCase().includes(q))
    );
  });

  return (
    <div className="admin-tab-panel admin-fraud-tab">
      <div className="admin-panel-header">
        <div>
          <h2 className="admin-panel-title">
            Sahtekarlık ve Güvenlik Denetimi
          </h2>
          <p className="admin-panel-desc">
            Algoritmik risk skorlama tarafından karantinaya alınan ödülleri
            inceleyin, onaylayın veya iptal edin.
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`admin-alert ${feedback.type === 'success' ? 'admin-alert-success' : 'admin-alert-error'}`}
          role="alert"
        >
          {feedback.message}
        </div>
      )}

      {/* KPI Summary Cards */}
      <div className="admin-kpi-grid">
        <div className="admin-kpi-card">
          <span className="kpi-label">Bekleyen İncelemeler</span>
          <span className="kpi-value kpi-pending">
            {metrics.pendingReviews}
          </span>
          <small className="kpi-sub">Karar bekleyen ödül</small>
        </div>
        <div className="admin-kpi-card">
          <span className="kpi-label">Yüksek Riskli Hesaplar</span>
          <span className="kpi-value kpi-danger">{metrics.highRiskCount}</span>
          <small className="kpi-sub">Skor 70 ve üzeri</small>
        </div>
        <div className="admin-kpi-card">
          <span className="kpi-label">Karantinadaki Nakit</span>
          <span className="kpi-value">
            {metrics.totalFrozenCash.toLocaleString('tr-TR')}
          </span>
          <small className="kpi-sub">Dondurulmuş bakiye</small>
        </div>
        <div className="admin-kpi-card">
          <span className="kpi-label">Karantinadaki SP</span>
          <span className="kpi-value">
            {metrics.totalFrozenPoints.toLocaleString('tr-TR')}
          </span>
          <small className="kpi-sub">Dondurulmuş sezon puanı</small>
        </div>
      </div>

      {/* Sub navigation & Search bar */}
      <div className="admin-fraud-controls">
        <div className="admin-subtabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'rewards'}
            className={`admin-subtab ${activeSubTab === 'rewards' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('rewards')}
          >
            Dondurulan Ödüller ({activeRewards.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeSubTab === 'flags'}
            className={`admin-subtab ${activeSubTab === 'flags' ? 'active' : ''}`}
            onClick={() => setActiveSubTab('flags')}
          >
            Şüpheli Bayraklar ({activeFlags.length})
          </button>
        </div>

        <div className="admin-search-box">
          <input
            type="search"
            className="admin-input"
            placeholder="Kullanıcı adı, Telegram ID veya sinyal ara…"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            aria-label="Sahtekarlık kayıtlarında ara"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="admin-loading-skeleton">
          <div className="skeleton-line" />
          <div className="skeleton-line" />
          <div className="skeleton-line" />
        </div>
      ) : activeSubTab === 'rewards' ? (
        /* Frozen Rewards Table */
        <div className="admin-table-container">
          <table
            className="admin-table"
            aria-label="Dondurulan Ödüller Tablosu"
          >
            <thead>
              <tr>
                <th>Oyuncu</th>
                <th>Ödül Türü</th>
                <th>Dondurulan Tutar</th>
                <th>Gerekçe</th>
                <th>Durum</th>
                <th className="th-actions">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {filteredRewards.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-empty">
                    Dondurulmuş ödül kaydı bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredRewards.map((item) => (
                  <tr key={item.id} className={`row-status-${item.status}`}>
                    <td className="td-user">
                      <strong>{item.firstName}</strong>
                      <span className="user-handle">
                        {item.username
                          ? `@${item.username}`
                          : `ID: ${item.telegramId}`}
                      </span>
                    </td>
                    <td>
                      <span className="reward-type-tag">{item.rewardType}</span>
                    </td>
                    <td className="td-amounts">
                      <div>
                        <strong>
                          {item.amountCash.toLocaleString('tr-TR')}
                        </strong>{' '}
                        <small>Nakit</small>
                      </div>
                      {item.amountSeasonPoints > 0 && (
                        <div>
                          <strong>
                            {item.amountSeasonPoints.toLocaleString('tr-TR')}
                          </strong>{' '}
                          <small>SP</small>
                        </div>
                      )}
                    </td>
                    <td className="td-reason">
                      <span title={item.freezeReason}>{item.freezeReason}</span>
                    </td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="td-actions">
                      <div className="action-button-group">
                        <button
                          type="button"
                          className="button-sm button-inspect"
                          onClick={() => {
                            const matched = activeFlags.find(
                              (f) => f.userId === item.userId,
                            );
                            if (matched) {
                              setInspectedFlag(matched);
                            } else {
                              setInspectedFlag({
                                id: item.id,
                                userId: item.userId,
                                telegramId: item.telegramId,
                                username: item.username,
                                firstName: item.firstName,
                                riskScore: 75,
                                reasonCodes: ['REWARD_QUARANTINED'],
                                severity: 'high',
                                status: 'pending',
                                createdAt: item.frozenAt,
                              });
                            }
                          }}
                        >
                          İncele
                        </button>
                        {item.status === 'frozen' && (
                          <>
                            <button
                              type="button"
                              className="button-sm button-approve"
                              onClick={() => handleOpenReview(item, 'approve')}
                            >
                              Onayla
                            </button>
                            <button
                              type="button"
                              className="button-sm button-dismiss"
                              onClick={() => handleOpenReview(item, 'reject')}
                            >
                              Dondurmayı Kaldır
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* Flagged Accounts Table */
        <div className="admin-table-container">
          <table className="admin-table" aria-label="Şüpheli Bayraklar Tablosu">
            <thead>
              <tr>
                <th>Oyuncu</th>
                <th>Risk Skoru</th>
                <th>Tespit Edilen Sinyaller</th>
                <th>Durum</th>
                <th>Tarih</th>
                <th className="th-actions">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {filteredFlags.length === 0 ? (
                <tr>
                  <td colSpan={6} className="table-empty">
                    Şüpheli bayrak kaydı bulunamadı.
                  </td>
                </tr>
              ) : (
                filteredFlags.map((item) => (
                  <tr key={item.id}>
                    <td className="td-user">
                      <strong>{item.firstName}</strong>
                      <span className="user-handle">
                        {item.username
                          ? `@${item.username}`
                          : `ID: ${item.telegramId}`}
                      </span>
                    </td>
                    <td>
                      <RiskBadge
                        score={item.riskScore}
                        severity={item.severity}
                      />
                    </td>
                    <td>
                      <div className="reasons-wrap">
                        {item.reasonCodes.map((rc) => (
                          <ReasonTag key={rc} code={rc} />
                        ))}
                      </div>
                    </td>
                    <td>
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="td-date">
                      {new Date(item.createdAt).toLocaleDateString('tr-TR', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="td-actions">
                      <button
                        type="button"
                        className="button-sm button-inspect"
                        onClick={() => setInspectedFlag(item)}
                      >
                        İncele
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Inspect Detail Modal */}
      <AdminModal
        isOpen={inspectedFlag !== null}
        title="Güvenlik ve Hesap Detayları"
        onClose={() => setInspectedFlag(null)}
      >
        {inspectedFlag && (
          <div className="admin-inspect-detail">
            <div className="inspect-header-row">
              <div>
                <h4>{inspectedFlag.firstName}</h4>
                <p className="muted">
                  {inspectedFlag.username
                    ? `@${inspectedFlag.username}`
                    : 'Kullanıcı adı yok'}{' '}
                  • Telegram ID: {inspectedFlag.telegramId}
                </p>
              </div>
              <div>
                <RiskBadge
                  score={inspectedFlag.riskScore}
                  severity={inspectedFlag.severity}
                />
              </div>
            </div>

            <div className="inspect-section">
              <h5>Tespit Edilen Güvenlik Sinyalleri</h5>
              <div className="reasons-wrap">
                {inspectedFlag.reasonCodes.map((rc) => (
                  <ReasonTag key={rc} code={rc} />
                ))}
              </div>
            </div>

            <div className="inspect-section">
              <h5>İnceleme Metadata Bilgileri</h5>
              {inspectedFlag.metadata ? (
                <pre className="admin-inspect-meta">
                  {JSON.stringify(inspectedFlag.metadata, null, 2)}
                </pre>
              ) : (
                <p className="muted">Ek metadata bulunmuyor.</p>
              )}
            </div>

            <div className="admin-dialog-actions">
              <button
                type="button"
                className="button primary"
                onClick={() => setInspectedFlag(null)}
              >
                Kapat
              </button>
            </div>
          </div>
        )}
      </AdminModal>

      {/* Action Confirmation Modal (Approve / Reject) */}
      <AdminModal
        isOpen={reviewTarget !== null}
        title={
          reviewTarget?.decision === 'approve'
            ? 'Ödülü Onayla ve Serbest Bırak'
            : 'Dondurmayı Kaldır / Ödülü İptal Et'
        }
        onClose={() => {
          if (!isSubmitting) setReviewTarget(null);
        }}
      >
        {reviewTarget && (
          <div className="admin-review-dialog-content">
            <p>
              Oyuncu: <strong>{reviewTarget.reward.firstName}</strong> (
              {reviewTarget.reward.username
                ? `@${reviewTarget.reward.username}`
                : reviewTarget.reward.telegramId}
              )<br />
              Dondurulan Tutar:{' '}
              <strong>
                {reviewTarget.reward.amountCash.toLocaleString('tr-TR')} Nakit
                {reviewTarget.reward.amountSeasonPoints > 0
                  ? ` + ${reviewTarget.reward.amountSeasonPoints} SP`
                  : ''}
              </strong>
            </p>
            <p>
              {reviewTarget.decision === 'approve'
                ? 'Bu ödülü onaylamak üzeresiniz. Nakit ve puanlar oyuncunun hesabına hemen aktarılacaktır.'
                : 'Bu ödülü kalıcı olarak iptal etmek veya dondurmasını kaldırmak üzeresiniz.'}
            </p>

            <div className="admin-form-group">
              <label htmlFor="review-reason-input">
                Yönetici Karar Notu / Gerekçe{' '}
                <span className="required-mark">*</span>
              </label>
              <textarea
                id="review-reason-input"
                className="admin-textarea"
                rows={3}
                placeholder="Örn: Manuel kontrol yapıldı, oyun içi üretim ritmi olağan bulundu."
                value={reviewReason}
                onChange={(e) => setReviewReason(e.target.value)}
                disabled={isSubmitting}
                autoFocus
              />
            </div>

            <div className="admin-dialog-actions">
              <button
                type="button"
                className="button secondary"
                onClick={() => setReviewTarget(null)}
                disabled={isSubmitting}
              >
                Vazgeç
              </button>
              <button
                type="button"
                className={`button ${reviewTarget.decision === 'approve' ? 'primary' : 'danger'}`}
                onClick={handleConfirmReview}
                disabled={isSubmitting || !reviewReason.trim()}
              >
                {isSubmitting
                  ? 'İşleniyor…'
                  : reviewTarget.decision === 'approve'
                    ? 'Onayla ve Gönder'
                    : 'Dondurmayı Kaldır'}
              </button>
            </div>
          </div>
        )}
      </AdminModal>
    </div>
  );
}
