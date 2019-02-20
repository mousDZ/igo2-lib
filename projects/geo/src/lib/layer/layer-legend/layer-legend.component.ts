import { Component, Input, ChangeDetectionStrategy, OnInit } from '@angular/core';

import { Layer } from '../shared/layers';
import { WMSDataSourceOptions } from '@igo2/geo/lib/datasource/shared/datasources/wms-datasource.interface';

@Component({
  selector: 'igo-layer-legend',
  templateUrl: './layer-legend.component.html',
  styleUrls: ['./layer-legend.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LayerLegendComponent implements OnInit {
  @Input()
  get layer(): Layer {
    return this._layer;
  }
  set layer(value: Layer) {
    this._layer = value;
    this._legend = value.dataSource.getLegend();
  }
  private _layer: Layer;

  get legend() {
    if (this._legend && this._legend.display === false) {
      return [];
    }
    return this._legend;
  }
  private _legend;
  public currentWmsStyle = '';

  constructor() {}

  ngOnInit(): void {
    if ((this.layer.options.sourceOptions as any).styles) {
      this.currentWmsStyle = (this.layer.options.sourceOptions as any).styles[0].name;
    }
  }

  listStyles() {
    return (this.layer.options.sourceOptions as any).styles;
  }

  changeStyle() {
    console.log(this.currentWmsStyle);
    this._legend = this.layer.dataSource.getLegend(this.currentWmsStyle);
    this.layer.dataSource.ol.updateParams({STYLES: this.currentWmsStyle});
  }

}
