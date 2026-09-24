import { Body, Controller, Get, Inject, Post, Query } from '@nestjs/common';
import { Public } from '../auth/decorators/public.decorator.js';
import { ResponseMessage } from '../common/response/index.js';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import {
  listCitiesQuery,
  listCountriesQuery,
  listStatesQuery,
  resolveQuery,
  resolveSignalsBody,
  searchQuery,
  type ListCitiesQuery,
  type ListCountriesQuery,
  type ListStatesQuery,
  type ResolveQuery,
  type ResolveSignalsBody,
  type SearchQuery,
} from './dto/geo.schemas.js';
import { GeoService } from './geo.service.js';

@Controller('geo')
export class GeoController {
  constructor(@Inject(GeoService) private readonly geo: GeoService) {}

  /** Public reads (docs/11 §4): the picker runs before there is an account. */
  @Public()
  @Get('countries')
  @ResponseMessage('Countries retrieved successfully')
  countries(@Query(new ZodValidationPipe(listCountriesQuery)) query: ListCountriesQuery) {
    return this.geo.listCountries(query);
  }

  @Public()
  @Get('states')
  @ResponseMessage('States retrieved successfully')
  states(@Query(new ZodValidationPipe(listStatesQuery)) query: ListStatesQuery) {
    return this.geo.listStates(query);
  }

  @Public()
  @Get('cities')
  @ResponseMessage('Cities retrieved successfully')
  cities(@Query(new ZodValidationPipe(listCitiesQuery)) query: ListCitiesQuery) {
    return this.geo.listCities(query);
  }

  @Public()
  @Get('search')
  @ResponseMessage('Search results retrieved successfully')
  search(@Query(new ZodValidationPipe(searchQuery)) query: SearchQuery) {
    return this.geo.search(query);
  }

  @Public()
  @Get('resolve')
  @ResponseMessage('Location resolved successfully')
  resolve(@Query(new ZodValidationPipe(resolveQuery)) query: ResolveQuery) {
    return this.geo.resolve(query);
  }

  /** Authenticated, unlike the rest of this controller: a screenshot's signals (docs/11 §4). */
  @Post('resolve')
  @ResponseMessage('Location resolved successfully')
  resolveSignals(@Body(new ZodValidationPipe(resolveSignalsBody)) body: ResolveSignalsBody) {
    return this.geo.resolveSignals(body);
  }
}
