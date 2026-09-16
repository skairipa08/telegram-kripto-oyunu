import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EmpireScreen } from '../screens/empire-screen';
import { MissionsScreen } from '../screens/missions-screen';
import { FriendsScreen } from '../screens/friends-screen';

describe('live mutation controls', () => {
  it('disables economy actions and exposes pending and error feedback accessibly', () => {
    const markup = renderToStaticMarkup(
      <EmpireScreen
        resource={{
          status: 'ready',
          data: {
            cash: 1_000,
            seasonPoints: 20,
            production: 2,
            claimable: 100,
            offlineHours: 4,
            businesses: [
              {
                slug: 'stand',
                name: 'Limonata Standı',
                level: 1,
                production: 2,
                upgradeCost: 100,
                paybackSeconds: 50,
                recommended: true,
              },
            ],
          },
        }}
        onClaim={() => undefined}
        onUpgrade={() => undefined}
        isClaimPending
        upgradingSlug="stand"
        claimFeedback={{
          kind: 'error',
          message: 'Gelir işlemi tamamlanamadı.',
        }}
      />,
    );

    expect(markup).toContain('Toplanıyor…');
    expect(markup).toContain('Yükseltiliyor…');
    expect(markup.match(/disabled=""/g)).toHaveLength(2);
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Gelir işlemi tamamlanamadı.');
  });

  it('disables mission claims while one claim is pending and announces status', () => {
    const markup = renderToStaticMarkup(
      <MissionsScreen
        resource={{
          status: 'ready',
          data: {
            streak: 1,
            missions: [
              {
                id: 'mission-1',
                title: 'İlk görev',
                description: 'Tamamlandı',
                difficulty: 'easy',
                progress: 1,
                target: 1,
                reward: 10,
                status: 'completed',
              },
            ],
          },
        }}
        onClaim={() => undefined}
        pendingMissionId="mission-1"
        claimFeedback={{ kind: 'status', message: 'Görev ödülü alınıyor…' }}
      />,
    );

    expect(markup).toContain('Alınıyor…');
    expect(markup).toContain('disabled=""');
    expect(markup).toContain('role="status"');
    expect(markup).toContain('Görev ödülü alınıyor…');
  });

  it('offers explicit retries for uncertain economy operations', () => {
    const markup = renderToStaticMarkup(
      <EmpireScreen
        resource={{
          status: 'ready',
          data: {
            cash: 1_000,
            seasonPoints: 20,
            production: 2,
            claimable: 100,
            offlineHours: 4,
            businesses: [
              {
                slug: 'stand',
                name: 'Limonata Standı',
                level: 1,
                production: 2,
                upgradeCost: 100,
                paybackSeconds: 50,
                recommended: false,
              },
            ],
          },
        }}
        onClaim={() => undefined}
        onUpgrade={() => undefined}
        claimRetryAvailable
        retryUpgradeSlug="stand"
      />,
    );

    expect(markup.match(/>Tekrar dene<\/button>/g)).toHaveLength(2);
    expect(markup).not.toContain('disabled=""');
  });

  it('offers an explicit mission retry after an uncertain failure', () => {
    const markup = renderToStaticMarkup(
      <MissionsScreen
        resource={{
          status: 'ready',
          data: {
            streak: 1,
            missions: [
              {
                id: 'mission-1',
                title: 'İlk görev',
                description: 'Tamamlandı',
                difficulty: 'easy',
                progress: 1,
                target: 1,
                reward: 10,
                status: 'completed',
              },
            ],
          },
        }}
        onClaim={() => undefined}
        retryMissionId="mission-1"
      />,
    );

    expect(markup).toContain('>Tekrar dene</button>');
    expect(markup).not.toContain('disabled=""');
  });

  it('offers an explicit referral retry with the retained attempt', () => {
    const markup = renderToStaticMarkup(
      <FriendsScreen
        resource={{ status: 'loading', data: null }}
        bindingFeedback={{
          kind: 'error',
          message: 'Davet kodu işlemi tamamlanamadı.',
        }}
        onRetryBinding={() => undefined}
      />,
    );

    expect(markup).toContain('>Tekrar dene</button>');
    expect(markup).toContain('role="alert"');
  });

  it('marks referral details as unavailable instead of showing a fake empty list', () => {
    const markup = renderToStaticMarkup(
      <FriendsScreen
        resource={{
          status: 'ready',
          data: {
            link: '',
            totalInvites: 7,
            qualified: 3,
            earnedPoints: 20,
            friends: null,
          },
        }}
      />,
    );

    expect(markup).toContain('Davet ayrıntıları sunulmuyor');
    expect(markup).toContain('Toplam davet</span><strong>7</strong>');
    expect(markup).not.toContain('İlk ortağın için yer hazır');
  });
});
