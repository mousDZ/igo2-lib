import OlFeature from 'ol/Feature';
import OlVectorLayer from 'ol/layer/Vector';

import { EntityStore, EntityStoreOptions } from '@igo2/common';

import { VectorLayer } from '../../layer/shared/layers/vector-layer';
import { IgoMap } from '../../map/shared/map';

import { FeatureMotion } from './feature.enums';
import { Feature } from './feature.interfaces';
import { computeOlFeaturesDiff , moveToOlFeatures } from './feature.utils';

export interface FeatureStoreOptions extends EntityStoreOptions {
  map: IgoMap;
  layer?: VectorLayer;
}

/**
 * The class is a specialized version of an EntityStore that stores
 * features and the map layer to display them on. Synchronization
 * between the store and the layer is handled by strategies.
 */
export class FeatureStore<T extends Feature = Feature> extends EntityStore<T> {

  /**
   * The map the layer is bound to
   */
  readonly map: IgoMap;

  /**
   * Vector layer to display the features on
   */
  get layer(): VectorLayer { return this._layer; };
  private _layer: VectorLayer;

  constructor(entities: T[], options: FeatureStoreOptions) {
    super(entities, options);
    this.map = options.map;
    if (options.layer !== undefined) {
      this.bindLayer(options.layer);
    }
  }

  /**
   * Bind this store to a vector layer
   * @param layer Vector layer
   * @returns Feature store
   */
  bindLayer(layer: VectorLayer) {
    this._layer = layer;
  }

  /**
   * Set the layer's features and perform a motion to make them visible. Strategies
   * make extensive use of that method.
   * @param features Features
   * @param motion Optional: The type of motion to perform
   */
  setLayerFeatures(features: Feature[], motion: FeatureMotion = FeatureMotion.Default) {
    this.checkLayer();

    const olFeatures = features.map((feature: Feature) => feature.ol);
    this.setLayerOlFeatures(olFeatures, motion);
  }

  /**
   * Set the store's features from an array of OL features.
   * @param olFeatures Ol features
   */
  setStoreFeatures(features: Feature[]) {
    this.load(features as T[]);
  }

  /**
   * Remove all features from the layer
   */
  clearLayer() {
    this.checkLayer();
    this.layer.ol.getSource().clear();
  }

  /**
   * Check wether a layer is bound or not and throw an error if not.
   */
  private checkLayer() {
    if (this.layer === undefined) {
      throw new Error('This FeatureStore is not bound to a layer.');
    }
  }

  /**
   * Set the layer's features and perform a motion to make them visible.
   * @param features Openlayers feature objects
   * @param motion Optional: The type of motion to perform
   */
  private setLayerOlFeatures(olFeatures: OlFeature[], motion: FeatureMotion = FeatureMotion.Default) {
    const olSource = this.layer.ol.getSource();
    const diff = computeOlFeaturesDiff(olSource.getFeatures(), olFeatures);
  
    if (diff.remove.length > 0) {
      this.removeOlFeaturesFromLayer(diff.remove);
    }

    if (diff.add.length > 0) {
      this.addOlFeaturesToLayer(diff.add);
    }

    if (diff.add.length > 0) {
      // If features are added, do a motion toward the newly added features
      moveToOlFeatures(this.map, diff.add, motion);
    } else if (olFeatures.length > 0) {
      // Else, do a motion toward all the features
      moveToOlFeatures(this.map, olFeatures, motion);
    }
  }

  /**
   * Add features to the the layer
   * @param features Openlayers feature objects
   */
  private addOlFeaturesToLayer(olFeatures: OlFeature[]) {
    const olSource = this.layer.ol.getSource();
    olFeatures.forEach((olFeature: OlFeature) => {
      if (olFeature.get('_featureStore') === undefined) {
        olFeature.set('_featureStore', this, true);
      }
    });
    olSource.addFeatures(olFeatures);
  }

  /**
   * Remove features from the the layer
   * @param features Openlayers feature objects
   */
  private removeOlFeaturesFromLayer(olFeatures: OlFeature[]) {
    const olSource = this.layer.ol.getSource();
    olFeatures.forEach((olFeature: OlFeature) => {
      olSource.removeFeature(olFeature);
    });
  }

}
