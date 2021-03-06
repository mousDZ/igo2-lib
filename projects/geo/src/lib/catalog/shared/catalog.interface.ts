export interface Catalog {
  id?: string;
  title?: string;
  url?: string;
  type?: string;
  regFilters?: Array<string>;
  queryFormat?: any;
  queryHtmlTarget?: string;
  count?: number;
  crossOrigin?: boolean;
}

export interface CatalogServiceOptions {
  baseLayers?: boolean;
  sources?: Catalog[];
}
