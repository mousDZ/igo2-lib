import { Component, Input, Output, EventEmitter } from '@angular/core';

import { Context } from '../shared/context.interface';
import { ContextService } from '../shared/context.service';

@Component({
  selector: 'igo-context-editor',
  templateUrl: './context-editor.component.html'
})
export class ContextEditorComponent {

  @Input() context: Context;

  @Output() complete: EventEmitter<Context> = new EventEmitter();

  constructor(
    private contextService: ContextService
  ) {}

  onSubmit(data: Context) {
    const context = Object.assign({}, this.context, data);
    this.contextService.update(context).subscribe(() => {
      this.complete.emit(context);
    });
  }
}
