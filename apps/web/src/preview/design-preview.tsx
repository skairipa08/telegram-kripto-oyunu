import { useEffect, useState } from 'react';
import { GameLayout } from '../game/game-layout';
import type { GameTab, ScreenResource } from '../game/types';
import { EmpireScreen } from '../screens/empire-screen';
import { MissionsScreen } from '../screens/missions-screen';
import { FriendsScreen } from '../screens/friends-screen';
import { LeaderboardScreen } from '../screens/leaderboard-screen';
import { ShopScreen } from '../screens/shop-screen';
import { AnalyticsScreen } from '../screens/analytics-screen';
import { ArcadeScreen } from '../screens/arcade-screen';
import {
  analyticsFixture,
  empireFixture,
  friendsFixture,
  leaderboardFixture,
  missionsFixture,
  shopFixture,
} from './fixtures';

export function DesignPreview() {
  const [tab, setTab] = useState<GameTab>('empire');
  const [analytics, setAnalytics] = useState(false);
  const [arcade, setArcade] = useState(false);
  const [theme, setTheme] = useState('dark');
  const [variant, setVariant] = useState('ready');
  const [scope, setScope] = useState<'global' | 'friends'>('global');
  const [cash, setCash] = useState(empireFixture.cash);
  const [claimable, setClaimable] = useState(empireFixture.claimable);
  const [missions, setMissions] = useState(missionsFixture.missions);
  const [more, setMore] = useState(false);
  const [toast, setToast] = useState('');
  useEffect(() => {
    document.documentElement.dataset.designTheme = theme;
    return () => {
      delete document.documentElement.dataset.designTheme;
    };
  }, [theme]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 3000);
    return () => clearTimeout(timer);
  }, [toast]);
  function resource<T>(data: T): ScreenResource<T> {
    return {
      status:
        variant === 'empty'
          ? 'ready'
          : (variant as ScreenResource<T>['status']),
      data,
      onRetry: () => setVariant('ready'),
    };
  }
  const board = {
    ...leaderboardFixture,
    scope,
    entries:
      variant === 'empty'
        ? []
        : scope === 'friends'
          ? leaderboardFixture.entries
              .slice(3)
              .map((e, i) => ({ ...e, rank: i + 1 }))
          : more
            ? [
                ...leaderboardFixture.entries,
                {
                  rank: 7,
                  userId: 'design-7',
                  name: 'Arda',
                  points: 16440,
                  isYou: false,
                },
                {
                  rank: 8,
                  userId: 'design-8',
                  name: 'Selin',
                  points: 15300,
                  isYou: false,
                },
              ]
            : leaderboardFixture.entries,
    hasMore: !more && scope === 'global',
  };
  return (
    <div className="design-preview">
      <div className="design-toolbar">
        <div>
          <strong>Tasarım önizlemesi</strong>
          <small>Örnek veriler · Gerçek hesap veya ödeme kullanılmaz</small>
        </div>
        <div className="design-controls">
          <select
            aria-label="Görünüm teması"
            value={theme}
            onChange={(e) => setTheme(e.target.value)}
          >
            <option value="dark">Koyu tema</option>
            <option value="light">Açık tema</option>
          </select>
          <select
            aria-label="Ekran durumu"
            value={variant}
            onChange={(e) => setVariant(e.target.value)}
          >
            <option value="ready">Dolu görünüm</option>
            <option value="empty">Boş görünüm</option>
            <option value="loading">Yükleniyor</option>
            <option value="error">Bağlantı hatası</option>
            <option value="unavailable">Hazırlanıyor</option>
          </select>
          <button
            aria-pressed={analytics}
            onClick={() => {
              setAnalytics(!analytics);
              setArcade(false);
            }}
          >
            {analytics ? 'Oyuna dön' : 'Analitik'}
          </button>
          <button
            aria-pressed={arcade}
            onClick={() => {
              setArcade(!arcade);
              setAnalytics(false);
            }}
          >
            {arcade ? 'Oyuna dön' : 'Arcade'}
          </button>
        </div>
      </div>
      <GameLayout
        tab={tab}
        onTab={(value) => {
          setTab(value);
          setAnalytics(false);
          setArcade(false);
        }}
        name="Baran"
        cash={cash}
        points={empireFixture.seasonPoints}
        preview
      >
        {arcade ? (
          <ArcadeScreen
            preview
            playerCash={cash}
            onReward={(amount) => {
              setCash((val) => val + amount);
              setToast(`Arcade oyunundan ${amount} örnek nakit kazandın.`);
            }}
          />
        ) : analytics ? (
          <AnalyticsScreen
            resource={resource({
              ...analyticsFixture,
              cohorts: variant === 'empty' ? [] : analyticsFixture.cohorts,
            })}
          />
        ) : (
          <>
            {tab === 'empire' && (
              <EmpireScreen
                resource={resource({
                  ...empireFixture,
                  cash,
                  claimable,
                  businesses:
                    variant === 'empty' ? [] : empireFixture.businesses,
                })}
                onClaim={() => {
                  if (claimable) {
                    setCash(cash + claimable);
                    setClaimable(0);
                    setToast('Örnek gelir toplandı. Gerçek bakiye değişmedi.');
                  }
                }}
                onUpgrade={() =>
                  setToast(
                    'Yükseltme tasarımı hazır. Bu önizleme ekonomi işlemi yapmaz.',
                  )
                }
                previewMiniGame
                onPreviewMiniGameReward={(amount) => {
                  setCash((value) => value + amount);
                  setToast(`Darphane turundan ${amount} örnek nakit kazandın.`);
                }}
              />
            )}
            {tab === 'missions' && (
              <MissionsScreen
                resource={resource({
                  ...missionsFixture,
                  missions: variant === 'empty' ? [] : missions,
                })}
                onClaim={(id) => {
                  setMissions(
                    missions.map((m) =>
                      m.id === id ? { ...m, status: 'claimed' } : m,
                    ),
                  );
                  setToast('Örnek görev tamamlandı. Gerçek puan eklenmedi.');
                }}
              />
            )}
            {tab === 'friends' && (
              <FriendsScreen
                resource={resource(
                  variant === 'empty'
                    ? {
                        ...friendsFixture,
                        totalInvites: 0,
                        qualified: 0,
                        earnedPoints: 0,
                        friends: [],
                      }
                    : friendsFixture,
                )}
              />
            )}
            {tab === 'leaderboard' && (
              <LeaderboardScreen
                resource={resource(board)}
                scope={scope}
                onScopeChange={(value) => {
                  setScope(value);
                  setMore(false);
                }}
                onLoadMore={() => setMore(true)}
              />
            )}
            {tab === 'shop' && (
              <ShopScreen
                resource={resource({
                  ...shopFixture,
                  products: variant === 'empty' ? [] : shopFixture.products,
                })}
              />
            )}
          </>
        )}
      </GameLayout>
      {toast && (
        <div role="status" className="design-toast">
          {toast}
        </div>
      )}
    </div>
  );
}
