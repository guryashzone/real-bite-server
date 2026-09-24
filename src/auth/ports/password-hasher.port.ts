/** Narrow port over the password algorithm (docs/11 §2.3): nothing else in the codebase names it. */
export interface PasswordHasher {
  hash(password: string): Promise<string>;
  verify(hash: string, password: string): Promise<boolean>;
  /** True when `hash` was produced with weaker cost parameters than we use today. */
  needsRehash(hash: string): boolean;
}

export const PASSWORD_HASHER = Symbol('PASSWORD_HASHER');
