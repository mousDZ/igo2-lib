import { EntityStore } from './store';

export interface EntityStoreStrategyOptions {}

/**
 * Strategies or responsible of synchronizing a feature store and a layer.
 * A strategy can be shared among multiple stores. Sharing a strategy
 * is a good idea when multiple strategies would have on cancelling effect
 * on each other.
 *
 * At creation, strategy is inactive and needs to be manually activated.
 */
export class EntityStoreStrategy {

  /**
   * Entity store
   * @internal
   */
  protected stores: EntityStore[] = [];

  /**
   * Whether this strategy is active
   * @internal
   */
  get active(): boolean { return this._active; }
  private _active: boolean = false;

  constructor(protected options: EntityStoreStrategyOptions = {}) {
    this.options = options;
  }

  /**
   * Activate the strategy. If it's already active, it'll be deactivated
   * and activated again.
   */
  activate() {
    if (this.active === true) {
      this.doDeactivate();
    }
    this._active = true;
    this.doActivate();
  }

  /**
   * Activate the strategy. If it's already active, it'll be deactivated
   * and activated again.
   */
  deactivate() {
    this._active = false;
    this.doDeactivate();
  }

  /**
   * Bind this strategy to a store
   * @param store Entity store
   */
  bindStore(store: EntityStore) {
    if (this.stores.indexOf(store) < 0) {
      this.stores.push(store);
    }
  }

  /**
   * Unbind this strategy from store
   * @param store Entity store
   */
  unbindStore(store: EntityStore) {
    const index = this.stores.indexOf(store);
    if (index >= 0) {
      this.stores.splice(index, 1);
    }
  }

  /**
   * Do the stataegy activation
   * @internal
   */
  protected doActivate() {}

  /**
   * Do the strategy deactivation
   * @internal
   */
  protected doDeactivate() {}

}
