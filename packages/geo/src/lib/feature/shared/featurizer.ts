import OlGeoJson from 'ol/format/GeoJSON';
import OlFeature from 'ol/Feature';

import { EntityKey } from '@igo2/common';

import {
  Feature,
  GeoJsonFeature,
  GeoJsonGeometry,
  GeoJsonProperties
} from './feature.interfaces';

export interface FeatureBuilderOptions {
  idProperty?: string;
  projectionIn?: string;
  projectionOut?: string;
}

export class Featurizer<
  P extends GeoJsonProperties = GeoJsonProperties,
  G extends GeoJsonGeometry = GeoJsonGeometry
> {

  static ignoredProperties = ['ol', 'id'];

  get idProperty(): string { return this.options.idProperty; }

  get projectionIn(): string { return this.options.projectionIn; }

  get projectionOut(): string { return this.options.projectionIn; }

  constructor(private options?: FeatureBuilderOptions) {
    this.options = options || {};
  }

  fromGeoJson(geojson: GeoJsonFeature<P, G>): Feature & P {
    const olGeoJSON = new OlGeoJson();
    const olFeature = olGeoJSON.readFeature(geojson, {
      dataProjection: this.projectionIn,
      featureProjection: this.projectionOut
    });

    const feature = this.fromOl(olFeature) as Feature & P;
    const geojsonMeta = geojson.meta || {};
    Object.assign(
      feature.meta,
      geojsonMeta,
      {projection: this.projectionOut ? this.projectionOut : geojsonMeta}
    )

    return feature;
  }

  fromOl(olFeature: OlFeature): Feature {
    const feature: Partial<Feature> = {
      ol: olFeature
    };

    Object.defineProperty(feature, 'id', {
      set: function(value: EntityKey) { feature.ol.setId(value); },
      get: function(): EntityKey { return feature.ol.getId(); },
      enumerable: true
    });

    Object.keys(olFeature.getProperties())
      .filter((property: string) => Featurizer.ignoredProperties.indexOf(property) === -1)
      .forEach((property: string) => {
        Object.defineProperty(feature, property, {
          get: function () { return this.ol.get(property); },
          set: function (value) { this.ol.set(property, value); },
          enumerable: true
        });
      });

    if (this.idProperty !== undefined) {
      feature.id = olFeature.get(this.idProperty);
    }

    const meta = {
      projection: this.projectionOut
    }
    feature.meta = meta;

    return feature as Feature & P;
  }
}
