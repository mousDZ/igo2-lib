import { SearchSource } from './sources/source';
import { SearchSourceService } from './search-source.service';

/**
 * Search source factory
 * @ignore
 */
export function searchSourceServiceFactory(sources: SearchSource[]) {
  return new SearchSourceService(sources);
}

/**
 * Function that returns a provider for the SearchSource service
 */
export function provideSearchSourceService() {
  return {
    provide: SearchSourceService,
    useFactory: searchSourceServiceFactory,
    deps: [SearchSource]
  };
}
