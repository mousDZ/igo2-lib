import {
  Directive,
  Self,
  OnInit,
  OnDestroy,
  HostListener
} from '@angular/core';
import { Subscription } from 'rxjs';

import { MapService } from '../../map/shared/map.service';
import { LayerService } from '../../layer/shared/layer.service';
import {
  LayerOptions,
  GroupLayers
} from '../../layer/shared/layers/layer.interface';
import { CapabilitiesService } from '../../datasource/shared/capabilities.service';
import { AnyDataSourceOptions } from '../../datasource/shared/datasources/any-datasource.interface';
import { DataSourceService } from '../../datasource/shared/datasource.service';

import { CatalogService } from '../shared/catalog.service';
import { Catalog } from '../shared/catalog.interface';
import { CatalogLayersListComponent } from './catalog-layers-list.component';
import { QueryFormat } from '../../query/shared/query.enum';

@Directive({
  selector: '[igoCatalogLayersListBinding]'
})
export class CatalogLayersListBindingDirective implements OnInit, OnDestroy {
  private component: CatalogLayersListComponent;
  private selectedCatalog$$: Subscription;
  private catalogsInfoFormats = [];

  @HostListener('select', ['$event'])
  onSelect(layer: LayerOptions) {
    const map = this.mapService.getMap();
    layer.visible = true;
    this.layerService.createAsyncLayer(layer).subscribe(layerCreated => {
      map.addLayer(layerCreated);
    });
  }

  constructor(
    @Self() component: CatalogLayersListComponent,
    private catalogService: CatalogService,
    private mapService: MapService,
    private dataSourceService: DataSourceService,
    private layerService: LayerService,
    private capabilitiesService: CapabilitiesService
  ) {
    this.component = component;
  }

  ngOnInit() {
    this.findCatalogInfoFormat();
    this.selectedCatalog$$ = this.catalogService.catalog$.subscribe(catalog =>
      this.handleCatalogChanged(catalog)
    );
  }

  ngOnDestroy() {
    this.selectedCatalog$$.unsubscribe();
  }

  /**
   * How to manage a layer declared in multiple formats?
   * The first occurence of the layer or * is used.
   * Next occurences are ignored.
   */
  findCatalogInfoFormat() {
    const catalogSources = this.catalogService.getCatalogSources();
    catalogSources.forEach(source => {
      const id = source.id !== undefined ? source.id : source.title;
      if (source.queryFormat) {
        const layersQueryFormat = [];
        Object.keys(source.queryFormat).forEach(infoF => {
          if (source.queryFormat[infoF] instanceof Array) {
            source.queryFormat[infoF].forEach(element => {
              if (layersQueryFormat.filter(specific => specific.layer === element).length === 0) {
                layersQueryFormat.push({layer: element, queryFormat: infoF});
              }
            });
          } else {
            if (layersQueryFormat.filter(specific => specific.layer === source.queryFormat[infoF]).length === 0) {
              layersQueryFormat.push({ layer: source.queryFormat[infoF], queryFormat: infoF });
            }
          }
        });
        this.catalogsInfoFormats.push({id: id, queryFormat: layersQueryFormat});
      }
    });
  }

  retriveLayerInfoFormat(catalog, layer) {
    const id = catalog.id !== undefined ? catalog.id : catalog.title;
    let baseInfoFormat;
    let currentLayerInfoFormat;
    const catalogInfoFormats = this.catalogsInfoFormats.find(f => f.id === id);
    if (!catalogInfoFormats) {
      return;
    }
    catalogInfoFormats.queryFormat.forEach(format => {
      if (format.layer === '*') {
        baseInfoFormat = format.queryFormat;
      }
      if (format.layer === layer.Name) {
        currentLayerInfoFormat = format.queryFormat;
      }
    });

    let queryFormat;

    if (baseInfoFormat && currentLayerInfoFormat) {
      queryFormat = currentLayerInfoFormat;
    } else if (!baseInfoFormat && currentLayerInfoFormat) {
      queryFormat = currentLayerInfoFormat;
    } else if (baseInfoFormat && !currentLayerInfoFormat) {
      queryFormat = baseInfoFormat;
    }

   let returnFormat;
    switch (queryFormat) {
      case QueryFormat.GML3:
        returnFormat = QueryFormat.GML3;
        break;
      case QueryFormat.JSON:
        returnFormat = QueryFormat.JSON;
        break;
      case QueryFormat.GEOJSON:
        returnFormat = QueryFormat.GEOJSON;
        break;
      case QueryFormat.ESRIJSON:
        returnFormat = QueryFormat.ESRIJSON;
        break;
      case QueryFormat.TEXT:
        returnFormat = QueryFormat.TEXT;
        break;
      case QueryFormat.HTML:
        returnFormat = QueryFormat.HTML;
        break;
      default:
        break;
    }
    return returnFormat;
  }

  /**
   * Dig in the layerList for each layer definition
   @param catalog: object of config.json parameter
   @param layerList: object of current level of layers
   @param groupsLayers: object of group of layers to show in the app
  */
  includeRecursiveLayer(catalog, layerList, groupsLayers) {
    let currentRegFilter;
    let boolRegFilter = true;
    let objGroupLayers;
    let timeFilter;
    // Dig all levels until last level (layer object are not defined on last level)
    for (const group of layerList.Layer) {
      if (typeof group.Layer !== 'undefined') {
        // recursive, check next level
        this.includeRecursiveLayer(catalog, group, groupsLayers);
      } else {
        // Define object of group layer
        objGroupLayers = {
          title: layerList.Title,
          // Add only layers with regFilter condition respected
          layers: layerList.Layer.reduce((arrLayer, layer) => {
            boolRegFilter = true;
            // Check for regex validation on layer's name
            if (typeof catalog.regFilters !== 'undefined') {
              // Test layer.Name for each regex define in config.json
              for (const regFilter of catalog.regFilters) {
                boolRegFilter = false;
                currentRegFilter = new RegExp(regFilter);
                boolRegFilter = currentRegFilter.test(layer.Name);
                // If regex is respected, stop the for loop
                if (boolRegFilter === true) {
                  break;
                }
              }
            }
            // If layer regex is okay (or not define), add the layer to the group
            if (boolRegFilter === true) {
              timeFilter = this.capabilitiesService.getTimeFilter(layer);
              const metadata = layer.DataURL ? layer.DataURL[0] : undefined;
              const abstract = layer.Abstract ? layer.Abstract : undefined;
              const keywordList = layer.KeywordList ? layer.KeywordList : undefined;
              const timeFilterable = timeFilter && Object.keys(timeFilter).length > 0 ? true : false;
              const count = catalog.count ? catalog.count : 5;
              const queryHtmlTarget = catalog.queryHtmlTarget ? catalog.queryHtmlTarget : 'iframe' ;
              arrLayer.push({
                title: layer.Title,
                maxResolution: this.getResolutionFromScale(layer.MaxScaleDenominator) || Infinity,
                minResolution: this.getResolutionFromScale(layer.MinScaleDenominator) || 0,
                metadata: {
                  url: metadata ? metadata.OnlineResource : undefined,
                  extern: metadata ? true : undefined,
                  abstract: abstract,
                  keywordList: keywordList
                },
                sourceOptions: {
                  type: 'wms',
                  url: catalog.url,
                  queryable: layer.queryable,
                  queryFormat: this.retriveLayerInfoFormat(catalog, layer),
                  queryHtmlTarget: queryHtmlTarget,
                  crossOrigin: catalog.crossOrigin ? 'Anonymous' : undefined,
                  params: {
                    layers: layer.Name,
                    feature_count: count
                  },
                  // Merge catalog time filter in layer timeFilter
                  timeFilter: { ...timeFilter, ...catalog.timeFilter },
                  timeFilterable: timeFilterable ? true : false
                }
              });
            }
            return arrLayer;
          }, [])
        };
        /* If object contain layers (when regFilters is define, the condition
        in Layer.map can define group with no layer) */
        if (objGroupLayers.layers.length !== 0) {
          groupsLayers.push(objGroupLayers);
        }
        // Break the group (don't add a group of layer for each of their layer!)
        break;
      }
    }
  }

  private getResolutionFromScale(scale: number): number {
    const dpi = 25.4 / 0.28;
    return scale / (39.37 * dpi);
  }

  handleCatalogChanged(catalog: Catalog) {
    if (!catalog || !catalog.url) {
      return;
    }

    if (catalog.type === 'layers') {
      this.catalogService.getBaseLayers(catalog.url).subscribe(baselayers => {
        this.component.groupsLayers = [
          {
            title: catalog.title,
            layers: baselayers,
            collapsed: false
          }
        ];
      });
      return;
    }

    const groupsLayers: GroupLayers[] = [];
    this.capabilitiesService
      .getCapabilities('wms', catalog.url)
      .subscribe(capabilities => {
        this.includeRecursiveLayer(
          catalog,
          capabilities.Capability.Layer,
          groupsLayers
        );
        this.component.groupsLayers = groupsLayers;
      });
  }
}
