export interface GoogleIdentity {
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string | null;
}

/** Narrow port over Google ID-token verification (docs/11 §2.2). */
export interface GoogleTokenVerifier {
  /** Throws if the token's signature, issuer, audience or expiry don't check out. */
  verify(idToken: string): Promise<GoogleIdentity>;
}

export const GOOGLE_TOKEN_VERIFIER = Symbol('GOOGLE_TOKEN_VERIFIER');
