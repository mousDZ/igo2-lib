import { FormGroup } from '@angular/forms';

import OlFeature from 'ol/Feature';

import { EntityKey } from '@igo2/common';


export interface Feature {
  id: EntityKey;
  ol: OlFeature;
  meta: FeatureMeta;
}

export interface FeatureMeta {
  title?: string;
  mapTitle?: string;
  order?: number;
  alias?: {[key: string]: string};
  projection?: string;
  extent?: [number, number, number, number];
}

export interface GeoJsonFeature<P, G extends GeoJsonGeometry = GeoJsonGeometry> {
  type: string;
  geometry: G;
  properties: P;
  id?: EntityKey;
  meta?: FeatureMeta;
}

export type GeoJsonGeometry = {
  type: string;
  coordinates: number[] | number[][] | number[][][];
}

export type GeoJsonProperties = {[key: string]: any;} | null;

export interface FeatureFormSubmitEvent {
  form: FormGroup;
  feature: Feature | undefined;
  data: Feature;
}
