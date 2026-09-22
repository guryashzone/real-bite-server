import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import {
  listCitiesQuery,
  listCountriesQuery,
  listStatesQuery,
  resolveQuery,
  searchQuery,
  type ListCitiesQuery,
  type ListCountriesQuery,
  type ListStatesQuery,
  type ResolveQuery,
  type SearchQuery,
} from './dto/geo.schemas.js';
import { GeoService } from './geo.service.js';

/** Public reads (docs/11 §4): the picker runs before there is an account. */
@Controller('geo')
export class GeoController {
  constructor(@Inject(GeoService) private readonly geo: GeoService) {}

  @Get('countries')
  countries(@Query(new ZodValidationPipe(listCountriesQuery)) query: ListCountriesQuery) {
    return this.geo.listCountries(query);
  }

  @Get('states')
  states(@Query(new ZodValidationPipe(listStatesQuery)) query: ListStatesQuery) {
    return this.geo.listStates(query);
  }

  @Get('cities')
  cities(@Query(new ZodValidationPipe(listCitiesQuery)) query: ListCitiesQuery) {
    return this.geo.listCities(query);
  }

  @Get('search')
  search(@Query(new ZodValidationPipe(searchQuery)) query: SearchQuery) {
    return this.geo.search(query);
  }

  @Get('resolve')
  resolve(@Query(new ZodValidationPipe(resolveQuery)) query: ResolveQuery) {
    return this.geo.resolve(query);
  }
}
