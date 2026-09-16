export const DESIGNATED_ADMIN_HANDLES = ['barandnz', 'mberked'] as const;

export type DesignatedAdminHandle = (typeof DESIGNATED_ADMIN_HANDLES)[number];

/**
 * Normalizes a Telegram username by trimming whitespace, converting to lower case,
 * and stripping any leading '@' characters.
 */
export function normalizeAdminUsername(
  username: string | null | undefined,
): string {
  if (!username) return '';
  return username.trim().toLowerCase().replace(/^@+/, '');
}

/**
 * Checks whether the given user object has a username that matches one of the
 * designated superadmin handles ('barandnz' or 'mberked').
 *
 * This provides defense-in-depth on the frontend; unauthorized users are blocked
 * from seeing or accessing any administrative controls.
 */
export function isDesignatedAdmin(
  user?: { username?: string | null } | null,
): boolean {
  if (!user || !user.username) return false;
  const normalized = normalizeAdminUsername(user.username);
  return DESIGNATED_ADMIN_HANDLES.includes(normalized as DesignatedAdminHandle);
}
