import { Controller, Get, Inject, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';
import { ResponseMessage } from '../common/response/index.js';
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
@Public()
@Controller('geo')
export class GeoController {
  constructor(@Inject(GeoService) private readonly geo: GeoService) {}

  @Get('countries')
  @ResponseMessage('Countries retrieved successfully')
  countries(@Query(new ZodValidationPipe(listCountriesQuery)) query: ListCountriesQuery) {
    return this.geo.listCountries(query);
  }

  @Get('states')
  @ResponseMessage('States retrieved successfully')
  states(@Query(new ZodValidationPipe(listStatesQuery)) query: ListStatesQuery) {
    return this.geo.listStates(query);
  }

  @Get('cities')
  @ResponseMessage('Cities retrieved successfully')
  cities(@Query(new ZodValidationPipe(listCitiesQuery)) query: ListCitiesQuery) {
    return this.geo.listCities(query);
  }

  @Get('search')
  @ResponseMessage('Search results retrieved successfully')
  search(@Query(new ZodValidationPipe(searchQuery)) query: SearchQuery) {
    return this.geo.search(query);
  }

  @Get('resolve')
  @ResponseMessage('Location resolved successfully')
  resolve(@Query(new ZodValidationPipe(resolveQuery)) query: ResolveQuery) {
    return this.geo.resolve(query);
  }
}
