import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { AdminScreen } from '../screens/admin-screen';
import { FeatureFlagsTab } from './feature-flags-tab';
import { FraudReviewTab } from './fraud-review-tab';
import { AuditLogTab } from './audit-log-tab';
import {
  AdminSwitch,
  DiffPill,
  ReasonTag,
  RiskBadge,
  StatusBadge,
} from './admin-ui';
import type {
  FeatureFlagItem,
  FraudAccountView,
  FrozenRewardView,
  AuditLogView,
} from './admin-types';

describe('AdminScreen component', () => {
  describe('Defense-in-depth access control (403 Forbidden)', () => {
    it('renders 403 Forbidden alert for non-admin regular users', () => {
      const markup = renderToStaticMarkup(
        <AdminScreen
          user={{
            id: 'u-reg-1',
            username: 'regular_player',
            firstName: 'Normal',
          }}
          onBackToGame={() => undefined}
        />,
      );

      expect(markup).toContain('403 - Yetkisiz Erişim');
      expect(markup).toContain('role="alert"');
      expect(markup).toContain(
        'Bu panele yalnızca yetkili süper yöneticiler (@Barandnz ve @Mberked) erişebilir.',
      );
      expect(markup).not.toContain('Özellik Bayrakları');
      expect(markup).not.toContain('Sahtekarlık İnceleme');
      expect(markup).not.toContain('Denetim Günlüğü');
      expect(markup).toContain('Oyuna Dön');
    });

    it('renders 403 Forbidden alert when user is null or missing username', () => {
      const markupNull = renderToStaticMarkup(<AdminScreen user={null} />);
      expect(markupNull).toContain('403 - Yetkisiz Erişim');

      const markupNoUser = renderToStaticMarkup(
        <AdminScreen
          user={{ id: 'u-anon', username: null, firstName: 'Anon' }}
        />,
      );
      expect(markupNoUser).toContain('403 - Yetkisiz Erişim');
    });
  });

  describe('Designated Superadmin Access (@Barandnz / @Mberked)', () => {
    it('renders full operations dashboard for @Barandnz', () => {
      const markup = renderToStaticMarkup(
        <AdminScreen
          user={{
            id: 'u-baran',
            username: 'Barandnz',
            firstName: 'Baran',
          }}
          onBackToGame={() => undefined}
        />,
      );

      expect(markup).toContain('Yönetici Paneli');
      expect(markup).toContain('SİSTEM VE GÜVENLİK YÖNETİMİ');
      expect(markup).toContain('Süper Yönetici: @Barandnz');
      expect(markup).toContain('Oyuna Dön');

      // Check navigation tabs
      expect(markup).toContain('Özellik Bayrakları');
      expect(markup).toContain('Sahtekarlık İnceleme');
      expect(markup).toContain('Denetim Günlüğü');
    });

    it('renders full operations dashboard for @Mberked with leading @ handle', () => {
      const markup = renderToStaticMarkup(
        <AdminScreen
          user={{
            id: 'u-berke',
            username: '@mberked',
            firstName: 'Berke',
          }}
          onBackToGame={() => undefined}
        />,
      );

      expect(markup).toContain('Yönetici Paneli');
      expect(markup).toContain('Süper Yönetici: @Mberked');
    });
  });

  describe('Tab Views Rendering', () => {
    it('renders FeatureFlagsTab by default with accessible switches', () => {
      const markup = renderToStaticMarkup(
        <AdminScreen user={{ username: 'barandnz' }} initialTab="flags" />,
      );

      expect(markup).toContain('Sistem Özellik Bayrakları');
      expect(markup).toContain('Telegram Stars (XTR) Ödemeleri');
      expect(markup).toContain('feature.stars_payments');
      expect(markup).toContain('Bakım Modu (Acil Durum Kilidi)');
      expect(markup).toContain('feature.maintenance_mode');
      expect(markup).toContain('Davet Sistemi ve Ödülleri');
      expect(markup).toContain('feature.referrals');
      expect(markup).toContain('role="switch"');
    });

    it('renders FraudReviewTab when selected', () => {
      const markup = renderToStaticMarkup(
        <AdminScreen user={{ username: 'barandnz' }} initialTab="fraud" />,
      );

      expect(markup).toContain('Sahtekarlık ve Güvenlik Denetimi');
      expect(markup).toContain('Bekleyen İncelemeler');
      expect(markup).toContain('Yüksek Riskli Hesaplar');
      expect(markup).toContain('Karantinadaki Nakit');
      expect(markup).toContain('Karantinadaki SP');
      expect(markup).toContain('Dondurulan Ödüller');
      expect(markup).toContain('İncele');
      expect(markup).toContain('Onayla');
      expect(markup).toContain('Dondurmayı Kaldır');
    });

    it('renders AuditLogTab when selected', () => {
      const markup = renderToStaticMarkup(
        <AdminScreen user={{ username: 'barandnz' }} initialTab="audit" />,
      );

      expect(markup).toContain('Sistem Denetim Günlüğü');
      expect(markup).toContain('İşlem Türü:');
      expect(markup).toContain('Değer Değişimi:');
      expect(markup).toContain('Gerekçe:');
    });
  });
});

describe('FeatureFlagsTab isolated component', () => {
  const sampleFlags: FeatureFlagItem[] = [
    {
      key: 'feature.stars_payments',
      label: 'Stars Ödemeleri',
      description: 'Telegram Stars ile ödeme altyapısı.',
      enabled: true,
      category: 'monetization',
    },
    {
      key: 'feature.maintenance_mode',
      label: 'Bakım Kilidi',
      description: 'Sistemi bakım moduna alır.',
      enabled: false,
      category: 'system',
    },
  ];

  it('renders provided feature flags and active/disabled states', () => {
    const markup = renderToStaticMarkup(
      <FeatureFlagsTab flags={sampleFlags} />,
    );

    expect(markup).toContain('Stars Ödemeleri');
    expect(markup).toContain('Bakım Kilidi');
    expect(markup).toContain('aria-checked="true"');
    expect(markup).toContain('aria-checked="false"');
    expect(markup).toContain('Aktif');
    expect(markup).toContain('Devre Dışı');
  });

  it('renders loading skeleton when isLoading is true', () => {
    const markup = renderToStaticMarkup(
      <FeatureFlagsTab flags={sampleFlags} isLoading />,
    );
    expect(markup).toContain('admin-loading-skeleton');
    expect(markup).not.toContain('Stars Ödemeleri');
  });
});

describe('FraudReviewTab isolated component', () => {
  const mockFlags: FraudAccountView[] = [
    {
      id: 'flag-1',
      userId: 'u-1',
      telegramId: '111222',
      username: 'bot_alpha',
      firstName: 'Bot 1',
      riskScore: 92,
      reasonCodes: ['RAPID_BURST_REQUESTS', 'VELOCITY_CAP_EXCEEDED'],
      severity: 'critical',
      status: 'pending',
      createdAt: '2026-09-16T08:00:00Z',
    },
  ];

  const mockRewards: FrozenRewardView[] = [
    {
      id: 'rew-1',
      userId: 'u-1',
      telegramId: '111222',
      username: 'bot_alpha',
      firstName: 'Bot 1',
      rewardType: 'cash_claim',
      amountCash: 100_000,
      amountSeasonPoints: 200,
      status: 'frozen',
      freezeReason: 'Olağanüstü üretim hızı',
      frozenAt: '2026-09-16T08:00:00Z',
    },
  ];

  it('calculates KPIs correctly from passed rewards and flags', () => {
    const markup = renderToStaticMarkup(
      <FraudReviewTab flags={mockFlags} rewards={mockRewards} />,
    );

    expect(markup).toContain('100.000'); // Total frozen cash
    expect(markup).toContain('200'); // Total frozen points
    expect(markup).toContain('Olağanüstü üretim hızı');
    expect(markup).toContain('Onayla');
    expect(markup).toContain('Dondurmayı Kaldır');
  });

  it('renders empty table message when no frozen rewards exist', () => {
    const markup = renderToStaticMarkup(
      <FraudReviewTab flags={[]} rewards={[]} />,
    );
    expect(markup).toContain('Dondurulmuş ödül kaydı bulunamadı.');
  });
});

describe('AuditLogTab isolated component', () => {
  const sampleLogs: AuditLogView[] = [
    {
      id: 'log-1',
      adminUserId: 'admin-1',
      adminUsername: 'barandnz',
      action: 'set_feature_flag',
      targetType: 'feature_flag',
      targetKey: 'feature.stars_payments',
      oldValue: false,
      newValue: true,
      reason: 'Ödeme entegrasyonu test edildi.',
      createdAt: '2026-09-16T08:00:00Z',
    },
  ];

  it('renders chronological audit log cards with diffs and reasons', () => {
    const markup = renderToStaticMarkup(<AuditLogTab logs={sampleLogs} />);

    expect(markup).toContain('@barandnz');
    expect(markup).toContain('feature.stars_payments');
    expect(markup).toContain('Ödeme entegrasyonu test edildi.');
    expect(markup).toContain('Devre Dışı');
    expect(markup).toContain('Aktif');
  });

  it('renders empty state message when logs array is empty', () => {
    const markup = renderToStaticMarkup(<AuditLogTab logs={[]} />);
    expect(markup).toContain('Kayıtlı denetim işlemi bulunamadı.');
  });
});

describe('Admin UI reusable primitives', () => {
  it('AdminSwitch handles checked state and accessibility', () => {
    const markupChecked = renderToStaticMarkup(
      <AdminSwitch
        checked={true}
        onChange={() => undefined}
        label="Örnek Bayrak"
      />,
    );
    expect(markupChecked).toContain('aria-checked="true"');
    expect(markupChecked).toContain('aria-label="Örnek Bayrak"');
    expect(markupChecked).toContain('Aktif');

    const markupUnchecked = renderToStaticMarkup(
      <AdminSwitch
        checked={false}
        onChange={() => undefined}
        label="Örnek Bayrak"
      />,
    );
    expect(markupUnchecked).toContain('aria-checked="false"');
    expect(markupUnchecked).toContain('Devre Dışı');
  });

  it('RiskBadge applies correct severity bands (Green/Amber/Red)', () => {
    const markupLow = renderToStaticMarkup(<RiskBadge score={20} />);
    expect(markupLow).toContain('admin-badge-green');
    expect(markupLow).toContain('20');
    expect(markupLow).toContain('(Düşük)');

    const markupMedium = renderToStaticMarkup(<RiskBadge score={50} />);
    expect(markupMedium).toContain('admin-badge-amber');
    expect(markupMedium).toContain('50');
    expect(markupMedium).toContain('(Orta)');

    const markupHigh = renderToStaticMarkup(<RiskBadge score={85} />);
    expect(markupHigh).toContain('admin-badge-red');
    expect(markupHigh).toContain('85');
    expect(markupHigh).toContain('(Kritik)');
  });

  it('ReasonTag formats known error codes into Turkish explanations', () => {
    const markupBurst = renderToStaticMarkup(
      <ReasonTag code="RAPID_BURST_REQUESTS" />,
    );
    expect(markupBurst).toContain('Seri İstek Patlaması');

    const markupCluster = renderToStaticMarkup(
      <ReasonTag code="DEVICE_CLUSTER_DETECTED" />,
    );
    expect(markupCluster).toContain('Cihaz Kümelenmesi');
  });

  it('StatusBadge renders appropriate pill styles', () => {
    const markupFrozen = renderToStaticMarkup(<StatusBadge status="frozen" />);
    expect(markupFrozen).toContain('Donduruldu');
    expect(markupFrozen).toContain('badge-frozen');

    const markupApproved = renderToStaticMarkup(
      <StatusBadge status="approved" />,
    );
    expect(markupApproved).toContain('Onaylandı');
    expect(markupApproved).toContain('badge-approved');
  });

  it('DiffPill renders boolean and string transformations', () => {
    const markup = renderToStaticMarkup(
      <DiffPill oldValue={false} newValue={true} />,
    );
    expect(markup).toContain('Devre Dışı');
    expect(markup).toContain('Aktif');
    expect(markup).toContain('→');
  });
});
