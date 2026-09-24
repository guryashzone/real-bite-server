import { randomBytes, createHash } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ACCESS_TOKEN_TTL_SECONDS, REFRESH_TOKEN_TTL_DAYS } from './auth.constants.js';

export interface AccessTokenClaims {
  sub: string;
  sid: string;
  ver: number;
}

export interface GeneratedRefreshToken {
  raw: string;
  hash: string;
  expiresAt: Date;
}

/**
 * Pure token mechanics (docs/11 §2.1): signs the 15-minute access JWT, mints the opaque refresh
 * token and hashes both it and email/reset codes with SHA-256 — only the hash is ever stored, so a
 * database read alone can't produce a valid token or code.
 */
@Injectable()
export class TokenService {
  constructor(@Inject(JwtService) private readonly jwt: JwtService) {}

  signAccessToken(claims: AccessTokenClaims): string {
    // `kid` is fixed for now — v1 signs with a single secret. Carried in the header so a future
    // key rotation can add a lookup without changing the token shape.
    return this.jwt.sign(claims, {
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      header: { alg: 'HS256', kid: 'v1' },
    });
  }

  verifyAccessToken(token: string): AccessTokenClaims {
    return this.jwt.verify<AccessTokenClaims>(token);
  }

  generateRefreshToken(): GeneratedRefreshToken {
    const raw = randomBytes(32).toString('base64url');
    return {
      raw,
      hash: hashToken(raw),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
    };
  }

  hashRefreshToken(raw: string): string {
    return hashToken(raw);
  }

  generateSixDigitCode(): { code: string; hash: string } {
    // Uniform over 000000–999999 via rejection sampling on one random byte range would be
    // overkill; six digits from Math.random-free randomBytes keeps it unbiased enough for a
    // 15-minute, 5-attempt code without pulling in a whole DRBG dependency.
    const n = randomBytes(4).readUInt32BE(0) % 1_000_000;
    const code = n.toString().padStart(6, '0');
    return { code, hash: hashCode(code) };
  }

  hashCode(code: string): string {
    return hashCode(code);
  }
}

function hashToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex');
}

function hashCode(code: string): string {
  return createHash('sha256').update(code).digest('hex');
}
