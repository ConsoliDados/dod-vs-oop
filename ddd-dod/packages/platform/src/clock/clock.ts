/**
 * Time as an injected dependency — never `new Date()` inside a use case. The
 * system clock is the production wiring; `fixedClock` makes time deterministic
 * in tests. (Pure domain functions receive `now: Date` as data; the `Clock`
 * port is what the composition root injects into use cases that need it.)
 */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

export function fixedClock(instant: Date): Clock {
  return { now: () => instant };
}
