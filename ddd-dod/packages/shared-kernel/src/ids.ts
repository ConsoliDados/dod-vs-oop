/**
 * Branded identifiers. The brand uses a private `unique symbol` that is never
 * exported — so no code outside this module can mint a branded id without going
 * through a factory (`generate` / `fromString`). `as AccountId` still compiles,
 * but it reads as the deliberate, greppable intent it is.
 */
declare const brand: unique symbol;
type Brand<T, B extends string> = T & { readonly [brand]: B };

export type AccountId = Brand<string, "AccountId">;
export type TransactionId = Brand<string, "TransactionId">;
export type PostingId = Brand<string, "PostingId">;

export const AccountId = {
  generate: (): AccountId => Bun.randomUUIDv7() as AccountId,
  fromString: (v: string): AccountId => v as AccountId,
};

export const TransactionId = {
  generate: (): TransactionId => Bun.randomUUIDv7() as TransactionId,
  fromString: (v: string): TransactionId => v as TransactionId,
};

export const PostingId = {
  generate: (): PostingId => Bun.randomUUIDv7() as PostingId,
  fromString: (v: string): PostingId => v as PostingId,
};
