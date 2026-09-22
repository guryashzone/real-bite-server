import { SetMetadata } from '@nestjs/common';

export const SKIP_ENVELOPE_KEY = 'skipEnvelope';

/**
 * Opts a controller or handler out of the success envelope. The one user: `/v1/health`, whose
 * body must stay exactly what `@nestjs/terminus` returns because the external uptime check reads
 * it (docs/11 §4). Nothing else should need this — a new endpoint should get the envelope.
 */
export const SkipEnvelope = () => SetMetadata(SKIP_ENVELOPE_KEY, true);
