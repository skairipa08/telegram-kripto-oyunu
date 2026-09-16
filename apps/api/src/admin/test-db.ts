import {
  createFraudTestDatabase,
  type TestDatabaseHarness,
  type SeedAdminResult,
  type SeedUserResult,
  createSessionCookie,
} from '../fraud/test-db';

export async function createAdminTestDatabase(): Promise<TestDatabaseHarness> {
  return createFraudTestDatabase();
}

export {
  createFraudTestDatabase,
  type TestDatabaseHarness,
  type SeedAdminResult,
  type SeedUserResult,
  createSessionCookie,
};
