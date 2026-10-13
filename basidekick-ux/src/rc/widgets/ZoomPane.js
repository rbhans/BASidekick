/**
 * UxMedia renderer for basidekick:ZoomPane.
 *
 * Renders its single Content the way bajaui's UxTransformPane / UxResponsivePane do
 * (spandrelSrc: model.get('content')), inside a layer that the shared zoompane.js core
 * transforms. The Java BZoomPane is the Workbench renderer and BHxZoomPane the Hx one.
 */
define([
  'baja!',
  'baja!gx:Brush',
  'bajaux/spandrel',
  'nmodule/bajaui/rc/ux/NullWidget',
  'nmodule/bajaui/rc/mixin/LayoutHintsSupport',
  'nmodule/basidekick/rc/zoompane/zoompane'
], function (baja, types, spandrel, NullWidget, LayoutHintsSupport, zoompane) {
  'use strict';

  var VIEW_PROPERTIES = /^(startFitted|minZoom|maxZoom|panZoom|showMinimap|showControls|background)$/;

  function widgetDefaults() {
    var background;
    try { background = baja.$('gx:Brush').decodeFromString('#eef1f4'); } catch (e) { background = null; }
    return {
      moduleName: 'basidekick',
      keyName: 'ZoomPane',
      properties: {
        startFitted: true,
        minZoom: 0.1,
        maxZoom: 8,
        panZoom: true,
        background: background,
        showMinimap: true,
        showControls: true
      }
    };
  }

  function options(properties) {
    var get = function (name) { return properties.getValue(name); };
    return {
      startFitted: get('startFitted'), minZoom: get('minZoom'), maxZoom: get('maxZoom'),
      panZoom: get('panZoom'), showMinimap: get('showMinimap'), showControls: get('showControls')
    };
  }

  var Base = spandrel(function (model) {
    return spandrel.jsx('div', {
      spandrelKey: 'world',
      className: 'bask-zoompane-layer'
    }, spandrel.jsx('div', {
      className: 'bajaux-widget-container',
      spandrelKey: 'content',
      spandrelSrc: model.get('content')
    }));
  });

  /**
   * @class
   * @alias module:nmodule/basidekick/rc/widgets/ZoomPane
   * @extends module:bajaux/Widget
   */
  function ZoomPane(params) {
    // bajaux classes are compiled ES classes; construct through Reflect so the
    // instance is created with this subclass prototype (as in AutoGridPane.js).
    var self = Reflect.construct(Base, [{ params: params, defaults: widgetDefaults() }], ZoomPane);
    // The pane is its own scroll context; layout hints from the content stop here.
    LayoutHintsSupport(self);
    return self;
  }

  ZoomPane.prototype = Object.create(Base.prototype, {
    constructor: { value: ZoomPane, writable: true, configurable: true }
  });
  Object.setPrototypeOf(ZoomPane, Base);

  /** A new Zoom Pane starts with empty content, as UxTransformPane does. */
  ZoomPane.prototype.$uxModelDefaults = function () {
    return { kids: [{ name: 'content', type: NullWidget, metadata: { typeSpec: 'bajaui:Widget' } }] };
  };

  ZoomPane.prototype.applyLayoutHints = function () { return false; };

  ZoomPane.prototype.$world = function () {
    var world = this.queryWidget('world');
    return world ? world.jq()[0] : null;
  };

  ZoomPane.prototype.doLayout = function () {
    var root = this.jq()[0], world = this.$world();
    if (!root || !world) { return; }
    var background = this.properties().getValue('background');
    if (background && typeof background.applyBackgroundToElement === 'function') {
      background.applyBackgroundToElement(root);
    }
    if (this.$zoom && this.$zoom.world !== world) { this.$zoom.controller.destroy(); this.$zoom = null; }
    if (this.$zoom) {
      this.$zoom.controller.update(options(this.properties()));
    } else {
      this.$zoom = { world: world, controller: zoompane.attach(root, world, options(this.properties())) };
    }
  };

  ZoomPane.prototype.doChanged = function (name) {
    if (VIEW_PROPERTIES.test(name || '')) { return this.doLayout(); }
  };

  ZoomPane.prototype.doDestroy = function () {
    if (this.$zoom) { this.$zoom.controller.destroy(); this.$zoom = null; }
    return Base.prototype.doDestroy ? Base.prototype.doDestroy.apply(this, arguments) : undefined;
  };

  return ZoomPane;
});
