import {
  Component,
  Input,
  Output,
  EventEmitter,
  ChangeDetectionStrategy,
  OnInit,
  OnDestroy
} from '@angular/core';

import { EntityStateManager, EntityStore } from '@igo2/common';

import {
  CatalogItem,
  CatalogItemGroup,
  CatalogItemLayer,
  CatalogItemState,
  CatalogItemType
} from '../shared';

/**
 * Catalog browser group item
 */
@Component({
  selector: 'igo-catalog-browser-group',
  templateUrl: './catalog-browser-group.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class CatalogBrowserGroupComponent implements OnInit, OnDestroy {

  /**
   * Group's items store
   * @internal
   */
  store = new EntityStore<CatalogItem, CatalogItemState>([]);

  /**
   * Catalog group
   */
  @Input() group: CatalogItemGroup;

  /**
   * Parent catalog's items store state. Groups share a unique
   * EntityState that tracks the group and it's layers state (whether they are added or not).
   * Sharing a unique state would also allow us to expand this component to allow
   * the selection of a layer while unselecting any layer already selected in another group.
   * This could be useful to display some layer info before adding it, for example.
   */
  @Input() state: EntityStateManager<CatalogItem, CatalogItemState>;

  /**
   * Whether the group is already added to the map
   */
  @Input() added: boolean;

  /**
   * Event emitted when the add/remove button of the group is clicked
   */
  @Output() addedChange = new EventEmitter<{
    added: boolean;
    group: CatalogItemGroup;
  }>();

  /**
   * Event emitted when the add/remove button of a layer is clicked
   */
  @Output() layerAddedChange = new EventEmitter<{
    added: boolean;
    layer: CatalogItemLayer;
  }>();

  /**
   * @internal
   */
  get title(): string { return this.group.title; }

  /**
   * @internal
   */
  ngOnInit() {
    this.store.load(this.group.items);
  }

  ngOnDestroy() {
    this.store.destroy();
  }

  /**
   * @internal
   */
  isGroup(item: CatalogItem): boolean {
    return item.type === CatalogItemType.Group;
  }

  /**
   * @internal
   */
  isLayer(item: CatalogItem): boolean {
    return item.type === CatalogItemType.Layer;
  }

  /**
   * On toggle button click, emit the added change event
   * @internal
   */
  onToggleClick() {
    this.added ? this.remove() : this.add();
  }

  /**
   * When a layer is added or removed, evaluate if all the layers of the group
   * are now added or removed. If so, consider that the group itself is added
   * or removed.
   * @internal
   * @param event Layer added change event
   */
  onLayerAddedChange(event: {added: boolean, layer: CatalogItemLayer}) {
    this.layerAddedChange.emit(event);
    this.tryToggleGroup(event);
  }

  /**
   * Emit added change event with added = true
   */
  private add() {
    this.added = true;
    this.addedChange.emit({
      added: true,
      group: this.group
    });
  }

  /**
   * Emit added change event with added = true
   */
  private remove() {
    this.added = false;
    this.addedChange.emit({
      added: false,
      group: this.group
    });
  }

  /**
   * If all the layers of the group added or removed, add or remove the group itself.
   * @param event The last layer added change event to occur
   */
  private tryToggleGroup(event: {added: boolean, layer: CatalogItemLayer}) {
    const added = event.added;
    const layer = event.layer;

    const layersAdded = this.store.dataView.all()
      .filter((item: CatalogItem) => item.id !== layer.id)
      .map((item: CatalogItem) => this.state.get(item).added || false);

    if (layersAdded.every((value) => value === added)) {
      added ? this.add() : this.remove();
    }
  }

}
