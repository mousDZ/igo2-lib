import { Subscription } from 'rxjs';

import { EntityStoreStrategy, EntityStoreStrategyOptions } from '@igo2/common';
import { FeatureMotion } from '../feature.enums';
import { Feature } from '../feature.interfaces';
import { FeatureStore } from '../store';

export interface FeatureStoreLoadingStrategyOptions extends EntityStoreStrategyOptions {
  motion?: FeatureMotion;
  // When the store moves features into view, the view extent, which is also the features extent,
  // is scaled by those factors, effectively resulting in a decentered view or a more zoomed in/out view.
  // These factors are applied to the top, right, bottom and left directions, in that order.
  // A factor of 1 means the distance from the center, in that direction, is doubled.
  viewScale?: [number, number, number, number];
  // Features extent to view extent ratio used to determine if the store should trigger
  // a map zoom when features are added to it.
  areaRatio?: number;
}

/**
 * This strategy loads a store's features into it's layer counterpart.
 * The store -> layer binding is a one-way binding. That means any entity
 * added to the store will be added to the layer but the opposite is false.
 *
 * Important: This strategy observes filtered entities, not raw entities. This
 * is not configurable yet.
 */
export class FeatureStoreLoadingStrategy extends EntityStoreStrategy {

  /**
   * Subscription to the store's features
   */
  private stores$$ = new Map<FeatureStore, Subscription>();

  constructor(protected options: FeatureStoreLoadingStrategyOptions) {
    super(options);
  }

  /**
   * Bind this strategy to a store and start watching for entities changes
   * @param store Feature store
   */
  bindStore(store: FeatureStore) {
    super.bindStore(store);
    if (this.active === true) {
      this.watchStore(store);
    }
  }

  /**
   * Unbind this strategy from a store and stop watching for entities changes
   * @param store Feature store
   */
  unbindStore(store: FeatureStore) {
    super.unbindStore(store);
    if (this.active === true) {
      this.unwatchStore(store);
    }
  }

  /**
   * Start watching all stores already bound to that strategy at once.
   * @internal
   */
  protected doActivate() {
    this.stores.forEach((store: FeatureStore) => this.watchStore(store));
  }

  /**
   * Stop watching all stores bound to that strategy
   * @internal
   */
  protected doDeactivate() {
    this.unwatchAll();
  }

  /**
   * Watch for entities changes in a store.
   * Important: Never observe a store's sorted entities. It makes no sense
   * to display sorted entities (instead of unsorted) on a layer and it
   * would potentially result in a lot of useless computation.
   * @param store Feature store
   */
  private watchStore(store: FeatureStore) {
    if (this.stores$$.has(store)) {
      return;
    }

    const subscription = store.dataView.all$()
      .subscribe((features: Feature[]) => this.onFeaturesChange(features, store));
    this.stores$$.set(store, subscription);
  }

  /**
   * Stop watching for entities changes in a store.
   * @param store Feature store
   */
  private unwatchStore(store: FeatureStore) {
    const subscription = this.stores$$.get(store);
    if (subscription !== undefined) {
      subscription.unsubscribe();
      this.stores$$.delete(store);
    }
  }

  /**
   * Stop watching for entities changes in all stores.
   */
  private unwatchAll() {
    Array.from(this.stores$$.entries()).forEach((entries: [FeatureStore, Subscription]) => {
      entries[1].unsubscribe();
    });
    this.stores$$.clear();
  }

  /**
   * Load features into a layer or clear the layer if the array of features is empty.
   * @param features Store filtered features
   * @param store Feature store
   */
  private onFeaturesChange(features: Feature[], store: FeatureStore) {
    if (features.length === 0) {
      store.clearLayer();
    } else {
      const motion = this.selectMotion(store);
      store.setLayerFeatures(
        features,
        motion,
        this.options.viewScale,
        this.options.areaRatio
      );
    }
  }

  /**
   * Selects the best motion
   * @param store A FeatureStore to apply the motion
   * @returns The motion selected
   */
  private selectMotion(store: FeatureStore) {
    if (this.options.motion !== undefined) { return this.options.motion; }

    if (store.pristine === true) {
      // If features have just been loaded into the store, move/zoom on them
      return FeatureMotion.Default;
    } else if (store.count > store.dataView.count) {
      // If features have been filtered, move/zoom on the remaining ones
      return FeatureMotion.Default;
    }
      
    // On insert, update or delete, do nothing
    return FeatureMotion.None;
  }
}
