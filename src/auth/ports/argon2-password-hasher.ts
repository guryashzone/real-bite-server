import { Injectable } from '@nestjs/common';
import { hash, parseOptions, verify } from '@node-rs/argon2';
import type { PasswordHasher } from './password-hasher.port.js';

/**
 * Argon2id via `@node-rs/argon2` (docs/11 §2.3): Rust, prebuilt binaries, no C compiler needed in
 * the Docker build. Pinned explicitly rather than left at the library's defaults, so a future
 * library upgrade can't silently change what a box hashes at — `needsRehash` is what carries a
 * cost bump forward, one re-hash at a time, on the next successful login.
 *
 * `algorithm: 2` is `Algorithm.Argon2id` — the numeric literal, not the const enum member, because
 * `isolatedModules` (required for ESM + Vitest) forbids importing a const enum's *values* across
 * module boundaries; only its type may be imported.
 */
const OPTIONS = {
  algorithm: 2, // Algorithm.Argon2id
  memoryCost: 19_456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
} as const;

@Injectable()
export class Argon2PasswordHasher implements PasswordHasher {
  hash(password: string): Promise<string> {
    return hash(password, OPTIONS);
  }

  verify(hashed: string, password: string): Promise<boolean> {
    return verify(hashed, password);
  }

  needsRehash(hashed: string): boolean {
    const params = parseOptions(hashed);
    return (
      params.algorithm !== OPTIONS.algorithm ||
      params.memoryCost !== OPTIONS.memoryCost ||
      params.timeCost !== OPTIONS.timeCost ||
      params.parallelism !== OPTIONS.parallelism
    );
  }
}
