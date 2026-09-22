import { Module } from '@nestjs/common';
import { GeoController } from './geo.controller.js';
import { GeoRepository } from './geo.repository.js';
import { GeoService } from './geo.service.js';

@Module({
  controllers: [GeoController],
  providers: [GeoService, GeoRepository],
  // Other features (outlets, photos, search) read geography through the service, never the tables.
  exports: [GeoService],
})
export class GeoModule {}
