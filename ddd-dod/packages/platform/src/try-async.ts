/**
 * Boundary adapter for native exceptions: run `fn`, returning `Ok` on success
 * or converting a thrown error into a typed `Err` via `onError`. This is the
 * one place infrastructure is allowed to `catch` — domain/application stay
 * `throw`-free (ADR-0002). Use it to wrap DB driver / I/O calls in adapters.
 */
export async function tryAsync<T, E>(
  fn: () => Promise<T>,
  onError: (cause: unknown) => E,
): Promise<Result<T, E>> {
  // The `as Result<T, E>` bridges the lib's `OkType`/`ErrType` conditional
  // types, which don't reduce over a naked generic param (`Ok<T>`/`Err<E>` are
  // already members of the `Result<T, E>` union — the cast is a widening).
  try {
    return Ok(await fn()) as Result<T, E>;
  } catch (cause) {
    return Err(onError(cause)) as Result<T, E>;
  }
}
