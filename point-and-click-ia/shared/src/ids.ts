/** Générateur d'identifiants lisibles et déterministes (pratique pour les tests et le débogage). */
export function createIdGenerator(prefixSeed = ''): (prefix: string) => string {
  const counters = new Map<string, number>();
  return (prefix: string) => {
    const n = (counters.get(prefix) ?? 0) + 1;
    counters.set(prefix, n);
    return `${prefix}${prefixSeed}-${n}`;
  };
}

/** Hash de chaîne stable (FNV-1a 32 bits), pour des choix pseudo-aléatoires reproductibles. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function pick<T>(list: readonly T[], seed: string): T {
  return list[hashString(seed) % list.length];
}
