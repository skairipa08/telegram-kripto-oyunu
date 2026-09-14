import { ApiError } from './api/client';
import { getAuthRecovery } from './auth/auth-policy';
import { usePlayerSession } from './auth/use-player-session';
import { GameShell } from './components/game-shell';
import { LoadingScreen } from './components/loading-screen';
import { ReopenScreen } from './components/reopen-screen';
import { WelcomeScreen } from './components/welcome-screen';
import { useTelegramWebApp } from './telegram/use-telegram-web-app';

export function App() {
  const { initData } = useTelegramWebApp();
  const session = usePlayerSession(initData);

  if (session.screen === 'reopen') {
    return (
      <ReopenScreen
        recovery="reopen"
        onRetry={() => undefined}
        isRetrying={false}
      />
    );
  }

  if (session.screen === 'account-unavailable') {
    return (
      <ReopenScreen
        recovery="account-unavailable"
        onRetry={() => undefined}
        isRetrying={false}
      />
    );
  }

  if (session.playerState.data) {
    return (
      <GameShell
        state={session.playerState.data}
        onLogout={session.logout}
        isLoggingOut={session.isLoggingOut}
        logoutFailed={session.logoutFailed}
      />
    );
  }

  if (session.playerState.isPending && initData) return <LoadingScreen />;

  if (!initData) {
    return (
      <WelcomeScreen
        serviceUnavailable={
          session.playerState.isError &&
          !(
            session.playerState.error instanceof ApiError &&
            session.playerState.error.status === 401
          )
        }
      />
    );
  }

  const recovery =
    session.playerState.error instanceof ApiError
      ? getAuthRecovery(session.playerState.error.code)
      : 'retry';

  return (
    <ReopenScreen
      recovery={recovery}
      onRetry={() => void session.playerState.refetch()}
      isRetrying={session.playerState.isFetching}
    />
  );
}
