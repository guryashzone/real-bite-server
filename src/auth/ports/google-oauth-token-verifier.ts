import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import type { Env } from '../../common/config/env.schema.js';
import { InvalidGoogleTokenException } from '../auth.errors.js';
import type { GoogleIdentity, GoogleTokenVerifier } from './google-token-verifier.port.js';

/**
 * `google-auth-library`'s `OAuth2Client` handles signature verification against Google's JWKS
 * (cached internally), issuer and expiry checks (docs/11 §2.2). This wrapper adds the two things
 * it doesn't: accepting either client id as a valid audience, and requiring `email_verified`.
 */
@Injectable()
export class GoogleOAuthTokenVerifier implements GoogleTokenVerifier {
  private readonly client: OAuth2Client;
  private readonly audience: string[];

  constructor(@Inject(ConfigService) config: ConfigService<Env, true>) {
    this.client = new OAuth2Client();
    this.audience = [config.get('GOOGLE_ANDROID_CLIENT_ID'), config.get('GOOGLE_WEB_CLIENT_ID')];
  }

  async verify(idToken: string): Promise<GoogleIdentity> {
    let payload;
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience: this.audience });
      payload = ticket.getPayload();
    } catch {
      throw new InvalidGoogleTokenException();
    }

    if (!payload || !payload.email || !payload.email_verified) {
      throw new InvalidGoogleTokenException();
    }

    return {
      subject: payload.sub,
      email: payload.email,
      emailVerified: payload.email_verified,
      name: payload.name ?? null,
    };
  }
}
