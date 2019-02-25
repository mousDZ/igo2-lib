import { Injectable } from '@angular/core';

import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { AuthService } from '@igo2/auth';
import { Tool } from '@igo2/common';
import { Context, ContextsList, ContextService, DetailedContext, TypePermission } from '@igo2/context';

import { ToolState } from '../tool/tool.state';

/**
 * Service that holds the state of the search module
 */
@Injectable({
  providedIn: 'root'
})
export class ContextState {

  /**
   * Current context
   */
  public context$: BehaviorSubject<DetailedContext> = new BehaviorSubject(undefined);

  /**
   * Observable of available contexts
   */
  public contexts$ = new BehaviorSubject<ContextsList>({ ours: [] });

  /**
   * Observable of available contexts
   */
  public contextInEdition$ = new BehaviorSubject<DetailedContext>(undefined);

  /**
   * Observable of available contexts
   */
  public defaultContextId$ = new BehaviorSubject<string>(undefined);

  constructor(
    private authService: AuthService,
    private contextService: ContextService,
    private toolState: ToolState
  ) {
    this.authService.authenticate$.subscribe(authenticated => {
      if (authenticated === null) {
        this.loadDefaultContext();
        return;
      }

      this.contexts$.subscribe((contexts: ContextsList) => {
        this.onContextsChange(contexts);
      });
      this.loadContexts();
    });
  }

  setContext(context: DetailedContext) {
    const currentContext = this.context$.value;
    if (currentContext && context && context.id === currentContext.id) {
      context.map.view.keepCurrentView = true;
      this.context$.next(context);
      return;
    }

    this.updateTools(context);
    this.context$.next(context);
  }

  loadContextByUri(uri: string) {
    const currentContext = this.context$.value;
    if (currentContext && currentContext.uri === uri) {
      return;
    }

    this.contextService.getContextByUri(uri)
      .subscribe((context: DetailedContext) => {
        this.addContextToList(context);
        this.setContext(context);
      });
  }

  loadDefaultContext() {
    return this.loadContextByUri('default');
  }

  loadContexts() {
    this.contextService.loadContexts()
      .subscribe((contexts: ContextsList) => {
        this.contexts$.next(contexts);
      });
  }

  create(context: DetailedContext): Observable<DetailedContext> {
    return this.contextService.create(context).pipe(
      tap((_context: DetailedContext) => {
        this.updateContextList([_context], [], []);
      })
    );
  }

  update(context: DetailedContext): Observable<DetailedContext> {
    return this.contextService.update(context);
  }

  clone(id: string, properties = {}): Observable<DetailedContext> {
    return this.contextService.clone(id, properties).pipe(
      tap((_context: DetailedContext) => {
        this.updateContextList([_context], [], []);
      })
    );
  }

  delete(id: string): Observable<void> {
    return this.contextService.delete(id).pipe(
      tap(() => {
        const contexts: ContextsList = { ours: [] };
        Object.keys(this.contexts$.value).forEach((key: string) => {
          contexts[key] = this.contexts$.value[key].filter(c => c.id !== id);
        });
        this.contexts$.next(contexts);
      })
    );
  }
  
  private onContextsChange(
    contexts: ContextsList,
    keepCurrentContext = false
  ) {
    const context = this.context$.value;
    let contextInEdition = this.contextInEdition$.value;

    if (!keepCurrentContext || !this.findContextInList(context.id)) {
      this.loadDefaultContext();
    } else {
      context.map.view.keepCurrentView = true;
      this.context$.next(context);
      this.contextService.getDefault()
        .subscribe((context: DetailedContext) => {
          this.defaultContextId$.next(context.id);
        })
    }

    contextInEdition = this.findContextInList(contextInEdition.id);
    if (!contextInEdition || contextInEdition.permission !== 'write') {
      this.contextInEdition$.next(undefined);
    }
  }

  private updateTools(context: DetailedContext) {
    const toolbox = this.toolState.toolbox;

    const tools = [];
    const contextTools = context.tools || [];
    contextTools.forEach((contextTool: Tool) => {
      const baseTool = toolbox.getTool(contextTool.name);
      if (baseTool === undefined) { return; }

      const options = Object.assign(
        {},
        baseTool.options || {},
        contextTool.options || {}
      );
      const tool = Object.assign({}, baseTool, contextTool, {options});
      tools.push(tool);
    });

    toolbox.setTools(tools);
    toolbox.setToolbar(context.toolbar || []);
  }

  private addContextToList(context: Context) {
    const existingContext = this.findContextInList(context.id);
    if (existingContext !== undefined) {
      return;
    }

    const simpleContext = {
      id: context.id,
      uri: context.uri,
      title: context.title,
      scope: context.scope,
      permission: TypePermission[TypePermission.read]
    };

    this.updateContextList([], [simpleContext], []);
  }

  private updateContextList(ours: Context[], publics: Context[], shared: Context[]) {
    const contexts = this.contexts$.value || {
      ours: [],
      public: [],
      shared: []
    };
    const _ours = []
      .concat(contexts.ours || [])
      .concat(ours);
    const _publics = []
      .concat(contexts.public || [])
      .concat(publics);
    const _shared = []
      .concat(contexts.shared || [])
      .concat(shared);
    this.contexts$.next({ours: _ours, public: _publics, shared: _shared})

  }

  private findContextInList(id: string) {
    const contexts = this.contexts$.value;
    for (const key of Object.keys(contexts)) {
      const value = contexts[key];
      const context = value.find(c => c.id === context.id);
      if (context !== undefined) {
        return context;
      }
    }
    return undefined;
  }
}
