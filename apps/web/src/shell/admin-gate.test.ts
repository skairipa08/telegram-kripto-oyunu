import { describe, expect, it } from 'vitest';
import {
  DESIGNATED_ADMIN_HANDLES,
  isDesignatedAdmin,
  normalizeAdminUsername,
} from './admin-gate';

describe('admin-gate', () => {
  describe('normalizeAdminUsername', () => {
    it('normalizes standard usernames by lowercasing', () => {
      expect(normalizeAdminUsername('Barandnz')).toBe('barandnz');
      expect(normalizeAdminUsername('Mberked')).toBe('mberked');
    });

    it('strips leading @ symbol', () => {
      expect(normalizeAdminUsername('@barandnz')).toBe('barandnz');
      expect(normalizeAdminUsername('@Barandnz')).toBe('barandnz');
      expect(normalizeAdminUsername('@@mberked')).toBe('mberked');
    });

    it('trims leading and trailing whitespace', () => {
      expect(normalizeAdminUsername('  @barandnz  ')).toBe('barandnz');
      expect(normalizeAdminUsername('\t@Mberked\n')).toBe('mberked');
    });

    it('handles null, undefined, and empty string gracefully', () => {
      expect(normalizeAdminUsername(null)).toBe('');
      expect(normalizeAdminUsername(undefined)).toBe('');
      expect(normalizeAdminUsername('')).toBe('');
      expect(normalizeAdminUsername('   ')).toBe('');
    });
  });

  describe('isDesignatedAdmin', () => {
    it('recognizes designated admins regardless of case or leading @', () => {
      expect(isDesignatedAdmin({ username: 'barandnz' })).toBe(true);
      expect(isDesignatedAdmin({ username: 'Barandnz' })).toBe(true);
      expect(isDesignatedAdmin({ username: '@Barandnz' })).toBe(true);
      expect(isDesignatedAdmin({ username: '  @BARANDNZ  ' })).toBe(true);

      expect(isDesignatedAdmin({ username: 'mberked' })).toBe(true);
      expect(isDesignatedAdmin({ username: 'Mberked' })).toBe(true);
      expect(isDesignatedAdmin({ username: '@Mberked' })).toBe(true);
      expect(isDesignatedAdmin({ username: '  @MBERKED  ' })).toBe(true);
    });

    it('rejects non-designated usernames', () => {
      expect(isDesignatedAdmin({ username: 'regular_player' })).toBe(false);
      expect(isDesignatedAdmin({ username: 'crypto_whale_99' })).toBe(false);
      expect(isDesignatedAdmin({ username: 'admin' })).toBe(false);
      expect(isDesignatedAdmin({ username: 'superadmin' })).toBe(false);
      expect(isDesignatedAdmin({ username: 'baran' })).toBe(false);
      expect(isDesignatedAdmin({ username: 'berke' })).toBe(false);
    });

    it('rejects empty, null, or undefined users and usernames', () => {
      expect(isDesignatedAdmin(null)).toBe(false);
      expect(isDesignatedAdmin(undefined)).toBe(false);
      expect(isDesignatedAdmin({})).toBe(false);
      expect(isDesignatedAdmin({ username: null })).toBe(false);
      expect(isDesignatedAdmin({ username: '' })).toBe(false);
      expect(isDesignatedAdmin({ username: '   ' })).toBe(false);
    });

    it('ensures DESIGNATED_ADMIN_HANDLES constant contains exactly barandnz and mberked', () => {
      expect(DESIGNATED_ADMIN_HANDLES).toEqual(['barandnz', 'mberked']);
    });
  });
});
