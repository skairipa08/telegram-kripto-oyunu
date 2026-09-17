// Browser shim for node:crypto used when bundling packages/game-core
export function createHmac() {
  return {
    update() {
      return this;
    },
    digest() {
      return '0'.repeat(64);
    },
  };
}
