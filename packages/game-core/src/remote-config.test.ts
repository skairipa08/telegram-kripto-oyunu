import { describe, expect, it } from 'vitest';
import { DEFAULT_ECONOMY_CONFIG } from './config';
import {
  formatAuditEntry,
  isFeatureEnabled,
  resolveEconomyConfig,
} from './remote-config';

describe('Remote Config & Feature Flag Engine', () => {
  it('falls back to in-memory defaults when database overrides are absent or null', () => {
    const configFromNull = resolveEconomyConfig(null);
    expect(configFromNull).toEqual(DEFAULT_ECONOMY_CONFIG);

    const configFromUndefined = resolveEconomyConfig(undefined);
    expect(configFromUndefined).toEqual(DEFAULT_ECONOMY_CONFIG);

    const configFromEmpty = resolveEconomyConfig({});
    expect(configFromEmpty).toEqual(DEFAULT_ECONOMY_CONFIG);
  });

  it('correctly applies valid database overrides using snake_case and camelCase keys', () => {
    const dbOverrides = {
      'economy.offline_cap_free_sec': 18000,
      'pass.price_stars': 300,
      upgradeCostGrowth: 1.2,
      'feature.stars_payments': true,
    };

    const resolved = resolveEconomyConfig(dbOverrides);
    expect(resolved.offlineCapFreeSec).toBe(18000);
    expect(resolved.passPriceStars).toBe(300);
    expect(resolved.upgradeCostGrowth).toBe(1.2);
    expect(resolved.featureStarsPayments).toBe(true);
    // Non-overridden values remain default
    expect(resolved.offlineCapPassSec).toBe(
      DEFAULT_ECONOMY_CONFIG.offlineCapPassSec,
    );
  });

  it('safely falls back to defaults when override values are invalid, corrupt, or out-of-bounds', () => {
    const corruptedOverrides = {
      'economy.offline_cap_free_sec': -100, // negative not allowed
      'economy.upgrade_cost_growth': 'not-a-number',
      'pass.price_stars': NaN,
      'feature.token': 'invalid-boolean',
    };

    const resolved = resolveEconomyConfig(corruptedOverrides);
    expect(resolved.offlineCapFreeSec).toBe(
      DEFAULT_ECONOMY_CONFIG.offlineCapFreeSec,
    );
    expect(resolved.upgradeCostGrowth).toBe(
      DEFAULT_ECONOMY_CONFIG.upgradeCostGrowth,
    );
    expect(resolved.passPriceStars).toBe(DEFAULT_ECONOMY_CONFIG.passPriceStars);
    expect(resolved.featureToken).toBe(false);
  });

  it('allows negative values for parameters that permit them (such as seasonSruExponent)', () => {
    const overrides = {
      'season.sru_exponent': -0.15,
    };
    const resolved = resolveEconomyConfig(overrides);
    expect(resolved.seasonSruExponent).toBe(-0.15);
  });

  it('strictly defaults feature.token to false unless explicitly enabled', () => {
    // Missing flag
    expect(isFeatureEnabled({}, 'feature.token')).toBe(false);
    expect(isFeatureEnabled(null, 'feature.token')).toBe(false);

    // Corrupt value
    expect(isFeatureEnabled({ 'feature.token': 'yes' }, 'feature.token')).toBe(
      false,
    );

    // Explicitly true
    expect(isFeatureEnabled({ 'feature.token': true }, 'feature.token')).toBe(
      true,
    );
    expect(isFeatureEnabled({ 'feature.token': 'true' }, 'feature.token')).toBe(
      true,
    );

    // Explicitly false
    expect(isFeatureEnabled({ 'feature.token': false }, 'feature.token')).toBe(
      false,
    );
  });

  it('formats audit log entries consistently with reason truncation', () => {
    const longReason = 'A'.repeat(300);
    const audit = formatAuditEntry({
      adminUserId: '11111111-1111-1111-1111-111111111111',
      action: 'update_config',
      targetType: 'economy_config',
      targetKey: 'pass.price_stars',
      oldValue: 250,
      newValue: 300,
      reason: longReason,
    });

    expect(audit.adminUserId).toBe('11111111-1111-1111-1111-111111111111');
    expect(audit.action).toBe('update_config');
    expect(audit.targetKey).toBe('pass.price_stars');
    expect(audit.oldValue).toBe(250);
    expect(audit.newValue).toBe(300);
    expect(audit.reason?.length).toBe(256);
  });
});
