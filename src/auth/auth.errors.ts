import { DomainException } from '../common/errors/index.js';

/** Deliberately vague: register/login/forgot must answer identically whether the email exists or
 * not (docs/11 §2.3 enumeration rule). */
export class InvalidCredentialsException extends DomainException {
  readonly code = 'invalid_credentials';
  readonly status = 401;
  constructor() {
    super('Incorrect email or password.');
  }
}

export class AccountLockedException extends DomainException {
  readonly code = 'account_locked';
  readonly status = 429;
  constructor() {
    super('Too many failed attempts. Try again later.');
  }
}

export class EmailNotVerifiedException extends DomainException {
  readonly code = 'email_not_verified';
  readonly status = 403;
  constructor() {
    super('Please verify your email before signing in.');
  }
}

export class InvalidVerificationCodeException extends DomainException {
  readonly code = 'invalid_verification_code';
  readonly status = 400;
  constructor() {
    super('That code is incorrect or has expired.');
  }
}

export class SessionRevokedException extends DomainException {
  readonly code = 'session_revoked';
  readonly status = 401;
  constructor() {
    super('Your session has ended. Please sign in again.');
  }
}

export class AccountUnavailableException extends DomainException {
  readonly code = 'account_unavailable';
  readonly status = 403;
  constructor() {
    super('This account is not available.');
  }
}

export class PasswordRequiredException extends DomainException {
  readonly code = 'current_password_required';
  readonly status = 400;
  constructor() {
    super('Your current password is required to make this change.');
  }
}

export class InvalidGoogleTokenException extends DomainException {
  readonly code = 'invalid_google_token';
  readonly status = 401;
  constructor() {
    super('Could not verify that Google sign-in.');
  }
}

/** An unverified password account already owns this email (docs/11 §2.4: "an unverified one
 * doesn't link"). Reported, not silently linked — linking here would hand Google-token access to
 * whoever registered that email+password first, verified or not. */
export class EmailPendingVerificationException extends DomainException {
  readonly code = 'email_pending_verification';
  readonly status = 409;
  constructor() {
    super('An account with this email already exists and needs to be verified first.');
  }
}
