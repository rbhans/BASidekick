/**
 * UxMedia renderer for basidekick:AutoGridPane.
 *
 * The Java BAutoGridPane layout remains the Workbench and Hx renderer. This
 * peer draws the same auto-fit card grid with CSS grid:
 * repeat(auto-fit, minmax(min(100%, <min column>), 1fr)).
 * Structure follows bajaui's own UxFlowPane (spandrel + layout hints).
 */
define([
  'baja!',
  'baja!gx:Brush,gx:Color,gx:Insets',
  'bajaux/events',
  'bajaux/spandrel',
  'nmodule/bajaui/rc/mixin/LayoutHintsSupport'
], function (baja, types, events, spandrel, LayoutHintsSupport) {
  'use strict';

  var PROPERTY_CHANGED = events.PROPERTY_CHANGED;
  var LAYOUT_HINTS = {};
  // Like FlowPane: a containing ScrollPane must not scroll sideways, otherwise
  // the grid widens instead of dropping columns.
  LAYOUT_HINTS[LayoutHintsSupport.SCROLL] = LayoutHintsSupport.RESTRICT_HORIZONTAL;

  var SHADOW = '0 1px 2px rgba(15,23,42,0.06), 0 2px 6px rgba(15,23,42,0.06)';

  function decoded(typeSpec, text) {
    try { return baja.$(typeSpec).decodeFromString(text); } catch (e) { return text; }
  }

  function widgetDefaults() {
    return {
      moduleName: 'basidekick',
      keyName: 'AutoGridPane',
      properties: {
        minColumnWidth: 240,
        maxColumns: { value: 0, typeSpec: 'baja:Integer' },
        fillRow: true,
        gap: 16,
        padding: decoded('gx:Insets', '16,16,16,16'),
        rowHeight: 0,
        background: decoded('gx:Brush', 'null'),
        cardStyle: true,
        cardBackground: decoded('gx:Color', '#ffffff'),
        cardBorderColor: decoded('gx:Color', '#e2e8f0'),
        cardRadius: 12,
        cardPadding: decoded('gx:Insets', '16,16,16,16'),
        cardShadow: true
      }
    };
  }

  function number(value, fallback) {
    var n = Number(value);
    return isFinite(n) ? n : fallback;
  }

  function color(value) {
    if (!value) { return 'transparent'; }
    if (typeof value.isNull === 'function' && value.isNull()) { return 'transparent'; }
    if (typeof value.toCssString === 'function') { return value.toCssString(); }
    return String(value);
  }

  function padding(value) {
    if (value && typeof value.getTop === 'function') {
      return value.getTop() + 'px ' + value.getRight() + 'px ' +
        value.getBottom() + 'px ' + value.getLeft() + 'px';
    }
    var parts = String(value || '').split(',').map(Number);
    return parts.length === 4 && parts.every(isFinite) ?
      parts.join('px ') + 'px' : '0px';
  }

  function gridStyle(p) {
    var gap = Math.max(0, number(p.gap, 16));
    var min = Math.max(1, number(p.minColumnWidth, 240));
    var maxColumns = Math.max(0, Math.floor(number(p.maxColumns, 0)));
    var rowHeight = Math.max(0, number(p.rowHeight, 0));
    // A column can never be narrower than 1/maxColumns of the row, which caps
    // the column count without breakpoints.
    var track = maxColumns > 0 ?
      'max(' + min + 'px, calc((100% - ' + (maxColumns - 1) * gap + 'px) / ' + maxColumns + '))' :
      min + 'px';
    return {
      display: 'grid',
      gridTemplateColumns: 'repeat(' + (p.fillRow === false ? 'auto-fill' : 'auto-fit') +
        ', minmax(min(100%, ' + track + '), 1fr))',
      gridAutoRows: rowHeight > 0 ? rowHeight + 'px' : 'auto',
      alignItems: 'stretch',
      gap: gap + 'px',
      padding: padding(p.padding),
      boxSizing: 'border-box',
      width: '100%',
      minHeight: '100%'
    };
  }

  function cellStyle(p, visible) {
    var style = {
      display: visible === false ? 'none' : 'flex',
      minWidth: '0',
      minHeight: '0',
      boxSizing: 'border-box'
    };
    if (p.cardStyle !== false) {
      style.padding = padding(p.cardPadding);
      style.background = color(p.cardBackground);
      style.borderRadius = Math.max(0, number(p.cardRadius, 12)) + 'px';
      style.border = color(p.cardBorderColor) === 'transparent' ? 'none' :
        '1px solid ' + color(p.cardBorderColor);
      style.boxShadow = p.cardShadow === false ? 'none' : SHADOW;
      style.overflow = 'hidden';
    }
    return style;
  }

  var Base = spandrel(function (model, state) {
    var p = state.properties;
    var cells = model.getKids().map(function (kid) {
      return spandrel.jsx('div', {
        className: 'bask-AutoGrid-cell',
        style: cellStyle(p, kid.getProperties().visible)
      }, spandrel.jsx('div', {
        className: 'bask-AutoGrid-content ux-preferred-size-support ux-use-preferred-min-height',
        style: { display: 'flex', flex: '1 1 auto', minWidth: '0', minHeight: '0' }
      }, spandrel.jsx('div', {
        spandrelSrc: kid,
        style: { flex: '1 1 100%', minWidth: '0', minHeight: '0' }
      })));
    });
    return spandrel.jsx('div', {
      spandrelKey: 'wrapper',
      className: 'bask-AutoGrid',
      style: gridStyle(p),
      $init: function (el) { applyBackground(p.background, el); }
    }, cells);
  });

  function applyBackground(brush, el) {
    if (brush && typeof brush.applyBackgroundToElement === 'function') {
      brush.applyBackgroundToElement(el);
    }
  }

  /**
   * @class
   * @alias module:nmodule/basidekick/rc/widgets/AutoGridPane
   * @extends module:bajaux/Widget
   */
  function AutoGridPane(params) {
    // bajaux classes are compiled ES classes; construct through Reflect so the
    // instance is created with this subclass prototype.
    var self = Reflect.construct(Base, [{ params: params, defaults: widgetDefaults() }], AutoGridPane);
    LayoutHintsSupport(self, LAYOUT_HINTS);
    return self;
  }

  AutoGridPane.prototype = Object.create(Base.prototype, {
    constructor: { value: AutoGridPane, writable: true, configurable: true }
  });
  Object.setPrototypeOf(AutoGridPane, Base);

  AutoGridPane.prototype.doInitialize = function (dom) {
    // Child visibility is a child property, so toggle it here as FlowPane does.
    dom.on(PROPERTY_CHANGED, '.bask-AutoGrid-cell', function (e, ed, name, value) {
      if (name === 'visible' && e.target.parentElement &&
          e.target.parentElement.parentElement === this) {
        this.style.display = value === false ? 'none' : 'flex';
      }
    });
    return Base.prototype.doInitialize.apply(this, arguments);
  };

  AutoGridPane.prototype.doLayout = function () {
    var wrapper = this.queryWidget('wrapper');
    if (wrapper) {
      applyBackground(this.properties().getValue('background'), wrapper.jq()[0]);
    }
  };

  return AutoGridPane;
});
