// The one seam to the logging library: feature code imports from here, so a
// change of logger touches this folder only.
//
// Usage: inject `PinoLogger` and set the context once. PinoLogger is
// transient-scoped, so every class gets its own instance (the one deliberate
// exception to "everything is a singleton").
//
//   constructor(@Inject(PinoLogger) private readonly logger: PinoLogger) {
//     this.logger.setContext(Foo.name);
//   }
//   this.logger.warn({ err }, 'Database ping failed');   // object first, message second
export { LoggingModule } from './logging.module.js';
export { Logger as NestPinoLogger, PinoLogger } from 'nestjs-pino';
