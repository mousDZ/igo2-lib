import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnInit,
  ChangeDetectionStrategy
} from '@angular/core';

import { SEARCH_TYPES } from '../shared/search.enums';
import { SearchSourceService } from '../shared/search-source.service';

export enum SearchTypeChangeAction {
  Add, Remove, Replace
}
/**
 * This component allows a user to select search types to enable.
 */
@Component({
  selector: 'igo-search-selector',
  templateUrl: './search-selector.component.html',
  styleUrls: ['./search-selector.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SearchSelectorComponent implements OnInit {

  /**
   * List of available search types
   */
  @Input() searchTypes: string[] = SEARCH_TYPES;

  /**
   * The search type enabled
   */
  @Input() enabled: string;

  /**
   * If multiple is false, only one search type can be selected at once (radio).
   * If multiple is true, the user can select more than one search source to enable (checkbox).
   */
  @Input() multiple = true;

  /**
   * Event emitted when the enabled search type changes
   */
  @Output() change = new EventEmitter<string>();

  searchTypeChangeAction = SearchTypeChangeAction;

  constructor(private searchSourceService: SearchSourceService) {}

  /**
   * Enable the first search type if the enabled input is not defined
   * @internal
   */
  ngOnInit() {
    const initial = this.enabled || this.searchTypes[0];
    this.enableSearchType(initial);
  }

  /**
   * Enable the selected search type
   * @param searchType Search type
   * @internal
   */
  onSearchTypeChange(searchType: string, searchTypeChangeAction: SearchTypeChangeAction) {
    // console.log(searchTypeChangeAction);
    this.enableSearchType(searchType);
  }

  /**
   * Get a search type's title. The title
   * for all availables search typers needs to be defined in the locale
   * files or an error will be thrown.
   * @param searchType Search type
   * @internal
   */
  getSearchTypeTitle(searchType: string) {
    return `search.${searchType.toLowerCase()}.title`;
  }

  /**
   * Emit an event and enable the search sources of the given type.
   * @param searchType Search type
   */
  private enableSearchType(searchType: string) {
    this.enabled = searchType;
    this.searchSourceService.enableSourcesByType(searchType);
    // this.searchSourceService.enableSourcesByTypes(searchType);
    this.change.emit(searchType);
  }

}
