import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ApiError,
  authenticateTelegram,
  getPlayerState,
  logout,
} from '../api/client';
import { getAuthRecovery, isSessionExpired } from './auth-policy';

export type SessionScreen = 'session' | 'reopen' | 'account-unavailable';

const playerStateQueryKey = ['player-state'] as const;

export function usePlayerSession(initData: string | null) {
  const queryClient = useQueryClient();
  const [requestId] = useState(() => crypto.randomUUID());
  const [screen, setScreen] = useState<SessionScreen>('session');
  const initialAuthenticationAllowed = useRef(Boolean(initData));

  const playerState = useQuery({
    queryKey: playerStateQueryKey,
    enabled: screen === 'session',
    retry: false,
    staleTime: 30_000,
    refetchOnWindowFocus: 'always',
    queryFn: async () => {
      try {
        const state = await getPlayerState();
        initialAuthenticationAllowed.current = false;
        return state;
      } catch (error) {
        const canAuthenticate =
          error instanceof ApiError &&
          error.status === 401 &&
          Boolean(initData) &&
          initialAuthenticationAllowed.current;

        if (!canAuthenticate || !initData) throw error;

        try {
          const authenticatedState = await authenticateTelegram(
            initData,
            requestId,
          );
          initialAuthenticationAllowed.current = false;
          return authenticatedState;
        } catch (authError) {
          const recovery =
            authError instanceof ApiError
              ? getAuthRecovery(authError.code)
              : 'retry';
          initialAuthenticationAllowed.current = recovery === 'retry';
          throw authError;
        }
      }
    },
  });

  useEffect(() => {
    const error = playerState.error;
    if (!(error instanceof ApiError)) return;

    const recovery = getAuthRecovery(error.code);
    if (recovery === 'reopen') setScreen('reopen');
    if (recovery === 'account-unavailable') {
      setScreen('account-unavailable');
    }
  }, [playerState.error]);

  useEffect(() => {
    const expiresAt = playerState.data?.session.expiresAt;
    if (!expiresAt) return;

    const remaining = Date.parse(expiresAt) - Date.now();
    if (isSessionExpired(expiresAt)) {
      initialAuthenticationAllowed.current = false;
      setScreen('reopen');
      queryClient.removeQueries({ queryKey: playerStateQueryKey });
      return;
    }

    const timeout = window.setTimeout(() => {
      initialAuthenticationAllowed.current = false;
      setScreen('reopen');
      queryClient.removeQueries({ queryKey: playerStateQueryKey });
    }, remaining);
    return () => window.clearTimeout(timeout);
  }, [playerState.data?.session.expiresAt, queryClient]);

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSuccess: async () => {
      initialAuthenticationAllowed.current = false;
      setScreen('reopen');
      await queryClient.cancelQueries({ queryKey: playerStateQueryKey });
      queryClient.removeQueries({ queryKey: playerStateQueryKey });
    },
  });

  return {
    playerState,
    screen,
    logout: () => logoutMutation.mutate(),
    isLoggingOut: logoutMutation.isPending,
    logoutFailed: logoutMutation.isError,
  };
}
