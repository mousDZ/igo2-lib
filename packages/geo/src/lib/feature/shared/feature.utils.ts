import * as olextent from 'ol/extent';
import * as olproj from 'ol/proj';
import * as olstyle from 'ol/style';
import OlFeature from 'ol/Feature';

import { IgoMap } from '../../map';
import { VectorLayer } from '../../layer';
import { FeatureDataSource } from '../../datasource';
import { FeatureMotion } from './feature.enums';
import { Feature } from './feature.interfaces';
import { FeatureStore } from './store';
import {
  FeatureStoreLoadingStrategy,
  FeatureStoreSelectionStrategy
} from './strategies';

export function setFeatureProjection(feature: Feature, projection: string, sourceProjection?: string): Feature {
  sourceProjection = sourceProjection || feature.meta.projection || 'EPSG:4326';
  feature.ol.getGeometry.transform(sourceProjection, projection);
  feature.meta.projection = projection;
  return feature;
}

/**
 * Set the layer's features and perform a motion to make them visible.
 * @param features Openlayers feature objects
 * @param motion Optional: The type of motion to perform
 */
export function computeOlFeaturesDiff(source: OlFeature[],target: OlFeature[]): {
  add: OlFeature[];
  remove: OlFeature;
} {
  const olFeaturesMap = new Map();
  target.forEach((olFeature: OlFeature) => {
    olFeaturesMap.set(olFeature.getId(), olFeature);
  });

  const olFeaturesToRemove = [];
  source.forEach((olFeature: OlFeature) => {
    const newOlFeature = olFeaturesMap.get(olFeature.getId());
    if (newOlFeature === undefined) {
      olFeaturesToRemove.push(olFeature);
    } else if (newOlFeature.get('_entityRevision') !== olFeature.get('_entityRevision')) {
      olFeaturesToRemove.push(olFeature);
    } else {
      olFeaturesMap.delete(newOlFeature.getId());
    }
  });

  const olFeaturesToAddIds = Array.from(olFeaturesMap.keys());
  const olFeaturesToAdd = target.filter((olFeature: OlFeature) => {
    return olFeaturesToAddIds.indexOf(olFeature.getId()) >= 0;
  });

  return {
    add: olFeaturesToAdd,
    remove: olFeaturesToRemove
  }
}

/**
 * Compute an OL feature extent in it's map projection
 * @param map Map
 * @param olFeature OL feature
 * @returns Extent in the map projection
 */
export function computeOlFeatureExtent(
  map: IgoMap,
  olFeature: OlFeature
): [number, number, number, number] {
  let olExtent = olextent.createEmpty();

  const olFeatureExtent = olFeature.get('_extent');
  const olFeatureProjection = olFeature.get('_projection');
  if (olFeatureExtent !== undefined && olFeatureProjection !== undefined) {
    olExtent = olproj.transformExtent(
      olFeatureExtent,
      olFeatureProjection,
      map.projection
    );
  } else {
    const olGeometry = olFeature.getGeometry();
    if (olGeometry !== null) {
      olExtent = olGeometry.getExtent();
    }
  }

  return olExtent;
}

/**
 * Compute a multiple OL features extent in their map projection
 * @param map Map
 * @param olFeatures OL features
 * @returns Extent in the map projection
 */
export function computeOlFeaturesExtent(
  map: IgoMap,
  olFeatures: OlFeature[]
): [number, number, number, number] {
  const extent = olextent.createEmpty();

  olFeatures.forEach((olFeature: OlFeature) => {
    const featureExtent = computeOlFeatureExtent(map, olFeature);
    olextent.extend(extent, featureExtent);
  });

  return extent;
}

/**
 * Scale an extent.
 * @param extent Extent
 * @param Scaling factors for top, right, bottom and left directions, in that order
 * @returns Scaled extent
 */
export function scaleExtent(
  extent: [number, number, number, number],
  scale: [number, number, number, number]
): [number, number, number, number] {
  const [width, height] = olextent.getSize(extent);
  return [
    scale[3] ? extent[0] - width * scale[3] : extent[0],
    scale[2] ? extent[1] - height * scale[2] : extent[1],
    scale[1] ? extent[2] + width * scale[1] : extent[2],
    scale[0] ? extent[3] + height * scale[0] : extent[3]
  ];
}

/**
 * Return true if features are out of view.
 * If features are too close to the edge, they are considered out of view.
 * We define the edge as 5% of the extent size.
 * @param map Map
 * @param featuresExtent The features's extent
 * @returns Return true if features are out of view
 */
export function featuresAreOutOfView(
  map: IgoMap,
  featuresExtent: [number, number, number, number]
) {
  const mapExtent = map.getExtent();
  const edgeRatio = 0.05;
  const scale = [-1, -1, -1, -1].map(x => x * edgeRatio);
  const viewExtent = scaleExtent(mapExtent, scale as [number, number, number, number]);

  return !olextent.containsExtent(viewExtent, featuresExtent);
}

/**
 * Return true if features are too deep into the view. This results
 * in features being too small.
 * Features are considered too small if their extent occupies less than
 * 1% of the map extent.
 * @param map Map
 * @param featuresExtent The features's extent
 * @param areaRatio The features extent to view extent acceptable ratio
 * @returns Return true if features are too deep in the view
 */
export function featuresAreTooDeepInView(
  map: IgoMap,
  featuresExtent: [number, number, number, number],
  areaRatio?: number
) {
  // An area ratio of 0.004 means that the feature extent's width and height
  // should be about 1/16 of the map extent's width and height
  areaRatio = areaRatio ? areaRatio : 0.004;
  const mapExtent = map.getExtent();
  const mapExtentArea = olextent.getArea(mapExtent);
  const featuresExtentArea = olextent.getArea(featuresExtent);

  return featuresExtentArea / mapExtentArea < areaRatio;
}

/**
 * Fit view to include the features extent.
 * By default, this method will let the features occupy about 50% of the viewport.
 * @param map Map
 * @param olFeatures OL features
 * @param motion To motion to the new map view
 * @param scale If this is defined, the original view will be scaled
 *  by that factor before any logic is applied.
 */
export function moveToFeatures(
  map: IgoMap,
  features: Feature[],
  motion: FeatureMotion = FeatureMotion.Default,
  scale?: [number, number, number, number],
  areaRatio?: number
) {
  moveToOlFeatures(
    map,
    features.map((feature: Feature) => feature.ol),
    motion,
    scale,
    areaRatio
  );
}

/**
 * Fit view to include the features extent.
 * By default, this method will let the features occupy about 50% of the viewport.
 * @param map Map
 * @param olFeatures OL features
 * @param motion To motion to the new map view
 * @param scale If this is defined, the original view will be scaled
 *  by that factor before any logic is applied.
 */
export function moveToOlFeatures(
  map: IgoMap,
  olFeatures: OlFeature[],
  motion: FeatureMotion = FeatureMotion.Default,
  scale?: [number, number, number, number],
  areaRatio?: number
) {
  const featuresExtent = computeOlFeaturesExtent(map, olFeatures);
  let viewExtent = featuresExtent;
  if (scale !== undefined) {
    viewExtent = scaleExtent(viewExtent, scale);
  }

  if (motion === FeatureMotion.Zoom) {
    map.viewController.zoomToExtent(viewExtent);
  } else if (motion === FeatureMotion.Move) {
    map.viewController.moveToExtent(viewExtent);
  } else if (motion === FeatureMotion.Default) {
    if (
      featuresAreOutOfView(map, featuresExtent) ||
      featuresAreTooDeepInView(map, featuresExtent, areaRatio)
    ) {
      map.viewController.zoomToExtent(viewExtent);
    }
  }
}

/**
 * Hide an OL feature
 * @param olFeature OL feature
 */
export function hideOlFeature(olFeature: OlFeature) {
  olFeature.setStyle(new olstyle.Style({}));
}

/**
 * Try to bind a layer to a store if none is bound already.
 * The layer will also be added to the store's map.
 * If no layer is given to that function, a basic one will be created.
 * @param store The store to bind the layer
 * @param layer An optional VectorLayer
 */
export function tryBindStoreLayer(store: FeatureStore, layer?: VectorLayer) {
  if (store.layer !== undefined) {
    if (store.layer.map === undefined) {
      store.map.addLayer(store.layer);
    }
    return;
  }

  layer = layer ? layer : new VectorLayer({
    source: new FeatureDataSource()
  });
  store.bindLayer(layer);
  if (store.layer.map === undefined) {
    store.map.addLayer(store.layer);
  }
}

/**
 * Try to add a loading strategy to a store and activate it.
 * If no strategy is given to that function, a basic one will be created.
 * @param store The store to bind the loading strategy
 * @param strategy An optional loading strategy
 */
export function tryAddLoadingStrategy(store: FeatureStore, strategy?: FeatureStoreLoadingStrategy) {
  if (store.getStrategyOfType(FeatureStoreLoadingStrategy) !== undefined) {
    store.activateStrategyOfType(FeatureStoreLoadingStrategy);
    return;
  }

  strategy = strategy ? strategy : new FeatureStoreLoadingStrategy({});
  store.addStrategy(strategy, true);
}

/**
 * Try to add a selection strategy to a store and activate it.
 * If no strategy is given to that function, a basic one will be created.
 * @param store The store to bind the selection strategy
 * @param strategy An optional selection strategy
 */
export function tryAddSelectionStrategy(store: FeatureStore, strategy?: FeatureStoreSelectionStrategy) {
  if (store.getStrategyOfType(FeatureStoreSelectionStrategy) !== undefined) {
    store.activateStrategyOfType(FeatureStoreSelectionStrategy);
    return;
  }
  strategy = strategy ? strategy : new FeatureStoreSelectionStrategy({
    map: store.map
  });
  store.addStrategy(strategy, true);
}
