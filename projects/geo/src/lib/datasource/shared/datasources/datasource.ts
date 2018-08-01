import SourceOL from 'ol/source/Source';

import {
  DataSourceOptions,
  DataSourceLegendOptions
} from './datasource.interface';

// import { DataService } from './data.service';

export abstract class DataSource {
  public id: string;
  public ol: SourceOL;

  constructor(
    public options: DataSourceOptions = {} // protected dataSourceService?: DataService
  ) {
    this.options = options;
    this.id = this.generateId();
    this.ol = this.createOlSource();
  }

  protected abstract createOlSource(): SourceOL;

  protected abstract generateId(): string;

  getLegend(): DataSourceLegendOptions[] {
    return this.options.legend ? [this.options.legend] : [];
  }
}
