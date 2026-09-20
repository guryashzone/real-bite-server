import { vi } from 'vitest';

/** Silent stand-in for PinoLogger; every method is a spy you can assert on. */
export function createFakePinoLogger() {
  return {
    setContext: vi.fn(),
    trace: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  };
}
