import { Injectable, Optional } from '@angular/core';
import { HttpClient } from '@angular/common/http';

import { BehaviorSubject, Observable } from 'rxjs';
import { map, tap, catchError, debounceTime } from 'rxjs/operators';

import olPoint from 'ol/geom/Point';

import { uuid } from '@igo2/utils';
import {
  ConfigService,
  RouteService,
  Message,
  LanguageService
} from '@igo2/core';

import { AuthService } from '@igo2/auth';
import { IgoMap } from '@igo2/geo';

import { TypePermission } from './context.enum';
import {
  ContextsList,
  ContextServiceOptions,
  Context,
  DetailedContext,
  ContextMapView,
  ContextPermission
} from './context.interface';

@Injectable({
  providedIn: 'root'
})
export class ContextService {

  private mapViewFromRoute: ContextMapView = {};
  private options: ContextServiceOptions;
  private baseUrl: string;

  constructor(
    private http: HttpClient,
    private authService: AuthService,
    private languageService: LanguageService,
    private config: ConfigService,
    @Optional() private route: RouteService
  ) {
    this.options = Object.assign({
      basePath: 'contexts',
      contextListFile: '_contexts.json',
      defaultContextUri: '_default'
    }, this.config.getConfig('context'));
    this.baseUrl = this.options.url;
    this.readParamsFromRoute();
  }

  get(): Observable<ContextsList> {
    const url = this.baseUrl + '/contexts';
    return this.http.get<ContextsList>(url);
  }

  getById(id: string): Observable<Context> {
    const url = this.baseUrl + '/contexts/' + id;
    return this.http.get<Context>(url);
  }

  getDetails(id: string): Observable<DetailedContext> {
    const url = this.baseUrl + '/contexts/' + id + '/details';
    return this.http
      .get<DetailedContext>(url)
      .pipe(catchError(res => this.handleError(res, id)));
  }

  getDefault(): Observable<DetailedContext> {
    const url = this.baseUrl + '/contexts/default';
    return this.http.get<DetailedContext>(url);
  }

  setDefault(id: string): Observable<any> {
    const url = this.baseUrl + '/contexts/default';
    return this.http.post(url, { defaultContextId: id });
  }

  delete(id: string): Observable<void> {
    const url = this.baseUrl + '/contexts/' + id;
    return this.http.delete<void>(url);
  }

  create(context: DetailedContext): Observable<Context> {
    const url = this.baseUrl + '/contexts';
    return this.http.post<Context>(url, JSON.stringify(context)).pipe(
      map(contextCreated => {
        if (this.authService.authenticated) {
          contextCreated.permission = TypePermission[TypePermission.write];
        } else {
          contextCreated.permission = TypePermission[TypePermission.read];
        }
        return contextCreated;
      })
    );
  }

  clone(id: string, properties = {}): Observable<Context> {
    const url = this.baseUrl + '/contexts/' + id + '/clone';
    return this.http.post<Context>(url, JSON.stringify(properties)).pipe(
      map(contextCloned => {
        contextCloned.permission = TypePermission[TypePermission.write];
        return contextCloned;
      })
    );
  }

  update(context: Context): Observable<Context> {
    const url = this.baseUrl + '/contexts/' + context.id;
    return this.http.patch<Context>(url, JSON.stringify(context));
  }

  // =================================================================

  addToolAssociation(contextId: string, toolId: string): Observable<void> {
    const url = `${this.baseUrl}/contexts/${contextId}/tools`;
    const association = {
      toolId
    };
    return this.http.post<void>(url, JSON.stringify(association));
  }

  deleteToolAssociation(contextId: string, toolId: string): Observable<any> {
    const url = `${this.baseUrl}/contexts/${contextId}/tools/${toolId}`;
    return this.http.delete(url);
  }

  getPermissions(id: string): Observable<ContextPermission[]> {
    const url = this.baseUrl + '/contexts/' + id + '/permissions';
    return this.http.get<ContextPermission[]>(url);
  }

  addPermissionAssociation(
    contextId: string,
    profil: string,
    type: TypePermission
  ): Observable<ContextPermission[]> {
    const url = `${this.baseUrl}/contexts/${contextId}/permissions`;
    const association = {
      profil,
      typePermission: type
    };
    return this.http.post<ContextPermission[]>(
      url,
      JSON.stringify(association)
    );
  }

  deletePermissionAssociation(
    contextId: string,
    permissionId: string
  ): Observable<void> {
    const url = `${
      this.baseUrl
    }/contexts/${contextId}/permissions/${permissionId}`;
    return this.http.delete<void>(url);
  }

  // ======================================================================

  loadContexts() {
    const request = this.baseUrl ? this.get() : this.getLocalContexts();
    request.pipe(
      map((contexts: ContextsList) => {
        return contexts;
        /*
        const publicsContexts = this.contexts$.value.public;

        if (publicsContexts) {
          const contextUri = publicsContexts.find(
            c => c.uri === this.options.defaultContextUri
          );
          if (contextUri) {
            if (!contexts.public) {
              contexts.public = [];
            }
            contexts.public.push(contextUri);
          }
        }
        */
      })
    );
  }

  loadContext(uri: string) {
    const context = this.context$.value;
    if (context && context.uri === uri) {
      return;
    }

    const contexts$$ = this.getContextByUri(uri).subscribe(
      (_context: DetailedContext) => {
        contexts$$.unsubscribe();
        this.addContextToList(_context);
        this.setContext(_context);
      },
      err => {
        contexts$$.unsubscribe();
      }
    );
  }

  private getLocalContexts(): Observable<ContextsList> {
    const url = this.getPath(this.options.contextListFile);
    return this.http.get<ContextsList>(url).pipe(
      map((res: any) => {
        return { ours: res };
      })
    );
  }

  private getLocalContext(uri): Observable<DetailedContext> {
    const url = this.getPath(`${uri}.json`);
    return this.http.get<DetailedContext>(url).pipe(
      catchError(res => {
        return this.handleError(res, uri);
      })
    );
  }

  setContext(context: DetailedContext) {
    const currentContext = this.context$.value;
    if (currentContext && context && context.id === currentContext.id) {
      context.map.view.keepCurrentView = true;
      this.context$.next(context);
      return;
    }

    // Update the tools options with those found in the context
    // TODO
    // if (context.tools !== undefined) {
    //   this.toolService.setTools(context.tools);
    // }

    if (!context.map) {
      context.map = { view: {} };
    }

    Object.assign(context.map.view, this.mapViewFromRoute);

    this.context$.next(context);
  }

  loadEditedContext(uri: string) {
    this.getContextByUri(uri).subscribe((_context: DetailedContext) => {
      this.setEditedContext(_context);
    });
  }

  setEditedContext(context: DetailedContext) {
    this.editedContext$.next(context);
  }

  getContextFromMap(igoMap: IgoMap): DetailedContext {
    const view = igoMap.ol.getView();
    const proj = view.getProjection().getCode();
    const center: any = new olPoint(view.getCenter()).transform(
      proj,
      'EPSG:4326'
    );

    const context = {
      uri: uuid(),
      title: '',
      scope: 'private',
      map: {
        view: {
          center: center.getCoordinates(),
          zoom: view.getZoom(),
          projection: proj
        }
      },
      layers: [],
      tools: []
    };

    const layers = igoMap.layers$.getValue();

    for (const l of layers) {
      const layer: any = l;
      const opts = {
        id: layer.options.id ? String(layer.options.id) : undefined,
        title: layer.options.title,
        zIndex: layer.zIndex,
        visible: layer.visible,
        sourceOptions: {
          type: layer.dataSource.options.type,
          params: layer.dataSource.options.params,
          url: layer.dataSource.options.url
        }
      };
      context.layers.push(opts);
    }

    // TODO
    // const tools = this.toolService.tools$.value;
    // for (const key in tools) {
    //   if (tools.hasOwnProperty(key)) {
    //     context.tools.push({
    //       id: String(tools[key].id)
    //     });
    //   }
    // }

    return context;
  }

  getContextByUri(uri: string): Observable<DetailedContext> {
    if (this.baseUrl) {
      let contextToLoad;
      for (const key of Object.keys(this.contexts$.value)) {
        contextToLoad = this.contexts$.value[key].find(c => {
          return c.uri === uri;
        });
        if (contextToLoad) {
          break;
        }
      }

      // TODO : use always id or uri
      const id = contextToLoad ? contextToLoad.id : uri;
      const context = this.getDetails(id);
    }

    return this.getLocalContext(uri);
  }

  private readParamsFromRoute() {
    if (!this.route) {
      return;
    }

    this.route.queryParams.subscribe(params => {
      const centerKey = this.route.options.centerKey;
      if (centerKey && params[centerKey as string]) {
        const centerParams = params[centerKey as string];
        this.mapViewFromRoute.center = centerParams.split(',').map(Number);
        this.mapViewFromRoute.geolocate = false;
      }

      const projectionKey = this.route.options.projectionKey;
      if (projectionKey && params[projectionKey as string]) {
        const projectionParam = params[projectionKey as string];
        this.mapViewFromRoute.projection = projectionParam;
      }

      const zoomKey = this.route.options.zoomKey;
      if (zoomKey && params[zoomKey as string]) {
        const zoomParam = params[zoomKey as string];
        this.mapViewFromRoute.zoom = Number(zoomParam);
      }
    });
  }

  private getPath(file: string) {
    const basePath = this.options.basePath.replace(/\/$/, '');

    return `${basePath}/${file}`;
  }

  private handleError(res: Response, uri: string): Message[] {
    const context = this.contexts$.value.ours.find(obj => obj.uri === uri);
    const titleContext = context ? context.title : uri;
    const titleError = this.languageService.translate.instant(
      'igo.context.contextManager.invalid.title'
    );

    const textError = this.languageService.translate.instant(
      'igo.context.contextManager.invalid.text',
      { value: titleContext }
    );

    throw [{ title: titleError, text: textError }];
  }

  private handleContextsChange(
    contexts: ContextsList,
    keepCurrentContext = false
  ) {
    const context = this.context$.value;
    const editedContext = this.editedContext$.value;

    if (!keepCurrentContext || !this.findContext(context)) {
      this.loadDefaultContext();
    } else {
      context.map.view.keepCurrentView = true;
      this.context$.next(context);
      this.getDefault().subscribe(() => {});
    }
    const editedFound = this.findContext(editedContext);
    if (!editedFound || editedFound.permission !== 'write') {
      this.setEditedContext(undefined);
    }
  }

  private addContextToList(context: Context) {
    const contextFound = this.findContext(context);
    if (!contextFound) {
      const contextSimplifie = {
        id: context.id,
        uri: context.uri,
        title: context.title,
        scope: context.scope,
        permission: TypePermission[TypePermission.read]
      };
      if (this.contexts$.value && this.contexts$.value.public) {
        this.contexts$.value.public.push(contextSimplifie);
        this.contexts$.next(this.contexts$.value);
      }
    }
  }

  private findContext(context: Context) {
    if (!context || !context.id) {
      return false;
    }

    const contexts = this.contexts$.value;
    let found;
    for (const key of Object.keys(contexts)) {
      const value = contexts[key];
      found = value.find(c => c.id === context.id);
      if (found) {
        break;
      }
    }

    return found;
  }
}
