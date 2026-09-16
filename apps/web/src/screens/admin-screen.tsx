import { useState } from 'react';
import type { AdminTab } from '../admin/admin-types';
import { isDesignatedAdmin, normalizeAdminUsername } from '../shell/admin-gate';
import { FeatureFlagsTab } from '../admin/feature-flags-tab';
import { FraudReviewTab } from '../admin/fraud-review-tab';
import { AuditLogTab } from '../admin/audit-log-tab';
import '../admin/admin.css';

export interface AdminScreenProps {
  user?: {
    id?: string;
    username?: string | null;
    firstName?: string;
  } | null;
  onBackToGame?: () => void;
  initialTab?: AdminTab;
}

export function AdminScreen({
  user,
  onBackToGame,
  initialTab = 'flags',
}: AdminScreenProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);

  // Defense-in-depth: Immediately block non-designated admins
  if (!isDesignatedAdmin(user)) {
    return (
      <div className="admin-screen">
        <div className="admin-forbidden" role="alert">
          <div className="forbidden-icon" aria-hidden="true">
            🔒
          </div>
          <h1>403 - Yetkisiz Erişim</h1>
          <p>
            Bu panele yalnızca yetkili süper yöneticiler (@Barandnz ve @Mberked)
            erişebilir. Mevcut hesabınız bu işlem için yetkilendirilmemiştir.
          </p>
          {onBackToGame && (
            <button
              type="button"
              className="button primary"
              onClick={onBackToGame}
            >
              Oyuna Dön
            </button>
          )}
        </div>
      </div>
    );
  }

  const normalizedHandle = normalizeAdminUsername(user?.username);
  const displayHandle =
    normalizedHandle === 'barandnz'
      ? 'Barandnz'
      : normalizedHandle === 'mberked'
        ? 'Mberked'
        : normalizedHandle;

  return (
    <div className="admin-screen">
      {/* Top Header */}
      <header className="admin-header">
        <div className="admin-header-main">
          <p className="admin-eyebrow">SİSTEM VE GÜVENLİK YÖNETİMİ</p>
          <h1 className="admin-title">Yönetici Paneli</h1>
          <p className="admin-subtitle">
            Özellik bayrakları, sahtekarlık denetimi ve sistem denetim
            kayıtları.
          </p>
        </div>

        <div className="admin-header-actions">
          <span className="admin-badge-handle" title="Yetkili Süper Yönetici">
            <span className="admin-status-dot" aria-hidden="true" />
            <span>Süper Yönetici: @{displayHandle}</span>
          </span>

          {onBackToGame && (
            <button
              type="button"
              className="button secondary"
              onClick={onBackToGame}
              aria-label="Oyuna Dön"
            >
              Oyuna Dön
            </button>
          )}
        </div>
      </header>

      {/* Tab Navigation */}
      <nav
        className="admin-nav-tabs"
        role="tablist"
        aria-label="Yönetici Sekmeleri"
      >
        <button
          type="button"
          role="tab"
          id="admin-tab-flags"
          aria-selected={activeTab === 'flags'}
          aria-controls="admin-panel-flags"
          className={`admin-tab-btn ${activeTab === 'flags' ? 'active' : ''}`}
          onClick={() => setActiveTab('flags')}
        >
          Özellik Bayrakları
        </button>
        <button
          type="button"
          role="tab"
          id="admin-tab-fraud"
          aria-selected={activeTab === 'fraud'}
          aria-controls="admin-panel-fraud"
          className={`admin-tab-btn ${activeTab === 'fraud' ? 'active' : ''}`}
          onClick={() => setActiveTab('fraud')}
        >
          Sahtekarlık İnceleme
        </button>
        <button
          type="button"
          role="tab"
          id="admin-tab-audit"
          aria-selected={activeTab === 'audit'}
          aria-controls="admin-panel-audit"
          className={`admin-tab-btn ${activeTab === 'audit' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit')}
        >
          Denetim Günlüğü
        </button>
      </nav>

      {/* Tab Panels */}
      <main id={`admin-panel-${activeTab}`} role="tabpanel" tabIndex={0}>
        {activeTab === 'flags' && <FeatureFlagsTab />}
        {activeTab === 'fraud' && <FraudReviewTab />}
        {activeTab === 'audit' && <AuditLogTab />}
      </main>
    </div>
  );
}
