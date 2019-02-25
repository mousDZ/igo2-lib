import { Component } from '@angular/core';

import { BehaviorSubject } from 'rxjs';

import { ToolComponent } from '@igo2/common';
import { MessageService, LanguageService } from '@igo2/core';
import { Context, DetailedContext } from '@igo2/context';
import { ContextState } from '../context.state';

@ToolComponent({
  name: 'contextEditor',
  title: 'igo.integration.tools.contexts',
  icon: 'settings'
})
@Component({
  selector: 'igo-context-editor-tool',
  templateUrl: './context-editor-tool.component.html'
})
export class ContextEditorToolComponent {

  get context$(): BehaviorSubject<DetailedContext> { return this.contextState.contextInEdition$ }

  constructor(
    private messageService: MessageService,
    private languageService: LanguageService,
    private contextState: ContextState
  ) {}

  onComplete(context: Context) {
    const translate = this.languageService.translate;
    const message = translate.instant('igo.context.contextManager.dialog.saveMsg', {
      value: context.title
    });
    const title = translate.instant('igo.context.contextManager.dialog.saveTitle');
    this.messageService.success(message, title);
  }
}
