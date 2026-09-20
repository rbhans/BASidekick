/**
 * UxMedia renderer for the native basidekick navigation icon components.
 *
 * The Java BPicture remains the non-Ux renderer. This peer only supplies the
 * browser rendering path that BPicture does not provide when UxMedia is active.
 */
define([
  'require',
  'bajaux/Widget',
  'jquery'
], function (require, Widget, $) {
  'use strict';

  function enumText(value, fallback) {
    if (value === null || value === undefined) { return fallback; }
    try { if (value.getTag) { return String(value.getTag() || fallback); } } catch (e0) {}
    var text = String(value || fallback);
    var dot = text.lastIndexOf('.');
    return dot >= 0 ? text.substring(dot + 1) : text;
  }

  function layoutSize(value) {
    var numbers = String(value || '').match(/-?\d+(?:\.\d+)?/g) || [];
    var width = numbers.length >= 4 ? Number(numbers[numbers.length - 2]) : 40;
    var height = numbers.length >= 4 ? Number(numbers[numbers.length - 1]) : 40;
    return {
      width: isFinite(width) && width > 0 ? width : 40,
      height: isFinite(height) && height > 0 ? height : 40
    };
  }

  function withDefaults(params) {
    params = params || {};
    params.defaults = params.defaults || {};
    var defaults = {
      iconType: { value: 'home', type: 'basidekick:IconType' },
      style: { value: 'illustrated', type: 'basidekick:IconStyle' },
      mode: { value: 'light', type: 'basidekick:IconMode' },
      layout: { value: '0.0,0.0,40.0,40.0', type: 'bajaui:Layout' },
      scale: { value: 'fitRatio', type: 'bajaui:ScaleMode' }
    };
    Object.keys(defaults).forEach(function (name) {
      if (!Object.prototype.hasOwnProperty.call(params.defaults, name)) {
        params.defaults[name] = defaults[name];
      }
    });
    return params;
  }

  function iconFileName(iconType) {
    var names = {
      siteCampus: 'SiteCampus',
      alarm: 'Alarm',
      schedules: 'Schedules',
      trends: 'Trends',
      users: 'Users',
      dashboard: 'Dashboard',
      weather: 'Weather',
      airSystems: 'AirSystems',
      waterSystems: 'WaterSystems',
      floorPlans: 'FloorPlans',
      reports: 'Reports',
      miscellaneous: 'Miscellaneous'
    };
    return names[iconType] || 'Home';
  }

  function styleFileName(style) {
    var names = {
      duotone: 'Duotone',
      softLine: 'SoftLine',
      solidGlyph: 'SolidGlyph',
      schematic: 'Schematic'
    };
    return names[style] || 'Illustrated';
  }

  var NavIcon = function (params) {
    Widget.call(this, withDefaults(params));
    this.$dom = null;
  };

  NavIcon.prototype = Object.create(Widget.prototype);
  NavIcon.prototype.constructor = NavIcon;

  NavIcon.prototype.doInitialize = function (dom) {
    this.$dom = dom;
    this._render();
    return this;
  };

  NavIcon.prototype.doLoad = function () {
    return this._render();
  };

  NavIcon.prototype.doChanged = function (name) {
    if (/^(iconType|style|mode|layout|scale)$/.test(name || '')) {
      return this._render();
    }
  };

  NavIcon.prototype.doDestroy = function () {
    this.$dom = null;
    return this;
  };

  NavIcon.prototype._render = function () {
    if (!this.$dom) { return this; }

    var properties = this.properties();
    var size = layoutSize(properties.getValue('layout'));
    var iconType = enumText(properties.getValue('iconType'), 'home');
    var style = enumText(properties.getValue('style'), 'illustrated');
    var mode = enumText(properties.getValue('mode'), 'light');
    var scale = enumText(properties.getValue('scale'), 'fitRatio');
    var icon = iconFileName(iconType);
    var styleName = styleFileName(style);
    var modeName = style !== 'illustrated' && style !== 'duotone' && mode === 'dark' ?
      '-Dark' : '';
    var relativePath = '../icons/' + icon + '/' +
      icon + '-' + styleName + modeName + '.svg';
    var url = require.toUrl(relativePath);
    var objectFit = scale === 'stretch' ? 'fill' :
      (scale === 'fillRatio' ? 'cover' : 'contain');

    this.$dom.css({
      width: size.width + 'px',
      height: size.height + 'px',
      maxWidth: size.width + 'px',
      maxHeight: size.height + 'px',
      overflow: 'hidden',
      background: 'transparent'
    });

    this.$dom.empty().append($('<img>').attr({
      src: url,
      alt: ''
    }).css({
      display: 'block',
      width: size.width + 'px',
      height: size.height + 'px',
      maxWidth: '100%',
      maxHeight: '100%',
      objectFit: objectFit
    }));
    return this;
  };

  return NavIcon;
});
