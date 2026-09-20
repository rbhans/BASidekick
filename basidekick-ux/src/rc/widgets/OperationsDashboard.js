define([
  'baja!',
  'bajaux/Widget',
  'jquery',
  'Promise',
  'nmodule/basidekick/rc/widgets/SavedCharts',
  'nmodule/basidekick/rc/widgets/TrendAnalysis',
  'nmodule/basidekick/rc/widgets/RecentChanges',
  'nmodule/basidekick/rc/widgets/OperationsOverview'
], function (baja, Widget, $, Promise, SavedCharts, TrendAnalysis, RecentChanges, OperationsOverview) {
  'use strict';

  var HISTORY_RPC_TYPE = 'basidekick:OperationsDashboardRpc';
  var MAX_CHART_SERIES = 12;
  var SERIES_COLORS = [
    '#2563eb', '#dc2626', '#059669', '#d97706',
    '#7c3aed', '#0891b2', '#db2777', '#4f46e5',
    '#65a30d', '#ea580c', '#0f766e', '#9333ea'
  ];
  var THEMES = {
    light: {
      background: '#f3f3f3',
      surface: '#ffffff',
      text: '#2f2f2f',
      muted: '#6b6b6b',
      border: '#d9d9d9',
      accent: '#4a4a4a'
    },
    dark: {
      background: '#1f1f1f',
      surface: '#2a2a2a',
      text: '#e5e5e5',
      muted: '#a3a3a3',
      border: '#444444',
      accent: '#e5e5e5'
    }
  };
  var STATUS_GROUPS = [
    { key: 'alarm', label: 'Open Alarms', method: 'isAlarm', color: '#cf1624' },
    { key: 'unackedAlarm', label: 'Unacked Alarm', method: 'isUnackedAlarm', color: '#cf1624' },
    { key: 'fault', label: 'Fault', method: 'isFault', color: '#fc7734' },
    { key: 'down', label: 'Down', method: 'isDown', color: '#fac600' },
    { key: 'stale', label: 'Stale', method: 'isStale', color: '#d9c09d' },
    { key: 'overridden', label: 'Overridden', method: 'isOverridden', color: '#bfaddd' },
    { key: 'disabled', label: 'Disabled', method: 'isDisabled', color: '#d6d6d6' },
    { key: 'null', label: 'Null', method: 'isNull', color: '#9ca3af' }
  ];
  var instanceSequence = 0;

  function normalizeWidgetParams(args) {
    var params = args[0];
    if (!params || typeof params !== 'object') {
      params = {
        moduleName: args[0],
        keyName: args[1],
        formFactor: args[2]
      };
    }
    return params;
  }

  function OperationsDashboard() {
    Widget.call(this, {
      params: normalizeWidgetParams(arguments),
      defaults: {
        moduleName: 'basidekick',
        keyName: 'OperationsDashboard',
        properties: {
          title: { value: 'Operations Dashboard', typeSpec: 'baja:String' },
          chartLibrary: { value: 'station:|slot:/BasidekickCharts', typeSpec: 'baja:Ord' },
          overviewScopeOrd: { value: 'station:|slot:/', typeSpec: 'baja:Ord' },
          showTrendEvents: { value: true, typeSpec: 'baja:Boolean' },
          historyParentName: { value: '', typeSpec: 'baja:String' },
          healthRefreshSeconds: { value: 30, typeSpec: 'baja:Integer' },
          mode: { value: 'light', typeSpec: 'basidekick:ThemeMode' }
        }
      }
    });

    this.$instanceId = ++instanceSequence;
    this.$eventNamespace = '.baskOperationsDashboard' + this.$instanceId;
    this.$dom = null;
    this.$root = null;
    this.$header = null;
    this.$main = null;
    this.$title = null;
    this.$panels = {};
    this.$tabButtons = {};
    this.$activeTab = 'overview';

    this.$historySearch = null;
    this.$historyStatus = null;
    this.$historyList = null;
    this.$historyRefresh = null;
    this.$chartCanvas = null;
    this.$chartEmpty = null;
    this.$chartLegend = null;
    this.$chartStatus = null;
    this.$periodSelect = null;
    this.$chartTooltip = null;
    this.$chartScale = null;

    this.$healthStatus = null;
    this.$healthTabs = null;
    this.$healthContent = null;
    this.$healthRefresh = null;
    this.$healthActiveGroup = '';
    this.$alarmSortSelect = null;
    this.$alarmSort = 'class';
    this.$openNoteUuid = '';

    this.$scheduleSearch = null;
    this.$scheduleStatus = null;
    this.$scheduleList = null;
    this.$scheduleCalendar = null;
    this.$scheduleRefresh = null;
    this.$selectedScheduleOrd = '';

    this.$histories = [];
    this.$historySearchText = '';
    this.$series = [];
    this.$trendEvents = [];
    this.$trendEventSequence = 0;
    this.$period = 'last24Hours';
    this.$healthRows = [];
    this.$healthCounts = {};
    this.$healthTotalCount = 0;
    this.$alarmRows = [];
    this.$alarmDataAvailable = false;
    this.$schedules = [];
    this.$scheduleSearchText = '';

    this.$historyLoaded = false;
    this.$healthLoaded = false;
    this.$schedulesLoaded = false;
    this.$historyLoading = false;
    this.$healthLoading = false;
    this.$schedulesLoading = false;
    this.$historyLoadSequence = 0;
    this.$healthLoadSequence = 0;
    this.$scheduleLoadSequence = 0;
    this.$healthTimer = 0;
    this.$resizeObserver = null;
    this.$hostLayoutFrame = 0;
    this.$destroyed = false;
  }

  OperationsDashboard.prototype = Object.create(Widget.prototype);
  OperationsDashboard.prototype.constructor = OperationsDashboard;

  function injectStyles() {
    if (typeof document === 'undefined' || document.getElementById('bask-operations-dashboard-styles')) {
      return;
    }

    var css = [
      '.bask-operations-dashboard{width:100%;height:100%;min-width:0;min-height:0;overflow:hidden;',
        'display:flex;flex-direction:column;box-sizing:border-box;background:transparent!important;',
        'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Tahoma,Arial,sans-serif;}',
      '.bask-operations-dashboard *{box-sizing:border-box;}',
      '.bask-od-presets{flex:0 0 auto;}.bask-od-preset-row{flex-wrap:wrap;}.bask-od-preset-row select{flex:1;}',
      '.bask-operations-dashboard button:focus-visible{outline:2px solid #2563eb;outline-offset:2px;}',
      '.bask-operations-dashboard .bask-od-shell{--od-bg:#f3f3f3;--od-surface:#fff;--od-text:#2f2f2f;',
        '--od-muted:#6b6b6b;--od-border:#d9d9d9;--od-accent:#4a4a4a;flex:1 1 auto;width:100%;height:100%;',
        'min-width:0;min-height:0;display:flex;flex-direction:column;overflow:hidden;background:var(--od-bg);',
        'color:var(--od-text);border:1px solid var(--od-border);border-radius:0;box-shadow:none;}',
      '.bask-operations-dashboard .bask-od-header{flex:0 0 auto;display:flex;align-items:center;gap:18px;',
        'min-height:58px;padding:10px 16px;background:var(--od-surface);border-bottom:1px solid var(--od-border);}',
      '.bask-operations-dashboard .bask-od-title{margin:0;min-width:0;overflow:hidden;text-overflow:ellipsis;',
        'white-space:nowrap;font-size:18px;font-weight:700;letter-spacing:-.01em;}',
      '.bask-operations-dashboard .bask-od-tabs{margin-left:auto;display:flex;align-items:center;gap:4px;',
        'padding:4px;background:var(--od-bg);border:1px solid var(--od-border);border-radius:8px;}',
      '.bask-operations-dashboard .bask-od-tab{border:0;border-radius:6px;padding:7px 12px;background:transparent;',
        'color:var(--od-muted);font:inherit;font-size:12px;font-weight:600;cursor:pointer;white-space:nowrap;}',
      '.bask-operations-dashboard .bask-od-tab:hover{color:var(--od-text);}',
      '.bask-operations-dashboard .bask-od-tab.is-active{background:var(--od-surface);color:var(--od-accent);',
        'box-shadow:0 1px 2px rgba(16,24,40,.08);}',
      '.bask-operations-dashboard .bask-od-main{flex:1 1 0;min-height:0;min-width:0;position:relative;}',
      '.bask-operations-dashboard .bask-od-panel{display:none;width:100%;height:100%;min-height:0;min-width:0;}',
      '.bask-operations-dashboard .bask-od-panel.is-active{display:flex;}',
      '.bask-operations-dashboard .bask-od-trends{padding:12px;gap:12px;}',
      '.bask-operations-dashboard .bask-od-browser{flex:0 0 250px;min-width:0;max-width:250px;',
        'display:flex;flex-direction:column;min-height:0;overflow:hidden;background:var(--od-surface);',
        'border:1px solid var(--od-border);border-radius:9px;}',
      '.bask-operations-dashboard .bask-od-chart-card{flex:1 1 0;min-width:0;display:flex;flex-direction:column;',
        'min-height:0;overflow:auto;background:var(--od-surface);border:1px solid var(--od-border);',
        'border-radius:9px;}',
      '.bask-operations-dashboard .bask-od-toolbar{flex:0 0 auto;display:flex;align-items:center;gap:8px;',
        'padding:9px 10px;border-bottom:1px solid var(--od-border);}',
      '.bask-operations-dashboard .bask-od-toolbar-title{font-size:13px;font-weight:700;white-space:nowrap;}',
      '.bask-operations-dashboard .bask-od-input,.bask-operations-dashboard .bask-od-select{min-width:0;',
        'border:1px solid var(--od-border);border-radius:6px;background:var(--od-surface);color:var(--od-text);',
        'font:inherit;font-size:12px;padding:6px 8px;outline:none;}',
      '.bask-operations-dashboard .bask-od-input{flex:1 1 auto;}',
      '.bask-operations-dashboard .bask-od-input:focus,.bask-operations-dashboard .bask-od-select:focus{',
        'border-color:var(--od-accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--od-accent) 14%,transparent);}',
      '.bask-operations-dashboard .bask-od-button{flex:0 0 auto;border:1px solid var(--od-border);border-radius:6px;',
        'background:var(--od-surface);color:var(--od-text);font:inherit;font-size:12px;font-weight:600;',
        'padding:6px 9px;cursor:pointer;text-decoration:none;}',
      '.bask-operations-dashboard .bask-od-button:hover{border-color:var(--od-accent);color:var(--od-accent);}',
      '.bask-operations-dashboard .bask-od-button:disabled{opacity:.55;cursor:default;}',
      '.bask-operations-dashboard .bask-od-status{flex:0 0 auto;min-height:31px;padding:7px 10px;',
        'border-bottom:1px solid var(--od-border);color:var(--od-muted);font-size:11px;line-height:16px;}',
      '.bask-operations-dashboard .bask-od-list{flex:1 1 0;min-height:0;overflow:auto;}',
      '.bask-operations-dashboard .bask-od-history-row{display:flex;align-items:center;gap:8px;padding:9px 10px;',
        'border-bottom:1px solid var(--od-border);cursor:grab;}',
      '.bask-operations-dashboard .bask-od-history-row:hover{background:color-mix(in srgb,var(--od-accent) 7%,transparent);}',
      '.bask-operations-dashboard .bask-od-row-main{display:block;flex:1 1 auto;min-width:0;}',
      '.bask-operations-dashboard .bask-od-row-name{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;',
        'font-size:12px;font-weight:600;color:var(--od-text);}',
      '.bask-operations-dashboard .bask-od-row-meta{display:block;margin-top:2px;overflow:hidden;text-overflow:ellipsis;',
        'white-space:nowrap;font-size:10px;color:var(--od-muted);}',
      '.bask-operations-dashboard .bask-od-add{width:26px;height:26px;padding:0;border:1px solid var(--od-border);',
        'border-radius:6px;background:var(--od-surface);color:var(--od-accent);font-size:17px;line-height:22px;',
        'cursor:pointer;}',
      '.bask-operations-dashboard .bask-od-chart-tools{justify-content:flex-end;}',
      '.bask-operations-dashboard .bask-od-chart-tools .bask-od-toolbar-title{margin-right:auto;}',
      '.bask-operations-dashboard .bask-od-legend{flex:0 0 auto;display:flex;align-items:center;gap:6px;',
        'min-height:34px;padding:6px 10px;overflow-x:auto;border-bottom:1px solid var(--od-border);}',
      '.bask-operations-dashboard .bask-od-legend-item{display:flex;align-items:center;gap:5px;max-width:210px;',
        'padding:3px 6px;border:1px solid var(--od-border);border-radius:5px;font-size:10px;white-space:nowrap;}',
      '.bask-operations-dashboard .bask-od-legend-swatch{width:9px;height:9px;border-radius:50%;flex:0 0 auto;}',
      '.bask-operations-dashboard .bask-od-legend-name{overflow:hidden;text-overflow:ellipsis;}',
      '.bask-operations-dashboard .bask-od-legend-remove{border:0;background:transparent;color:var(--od-muted);',
        'font-size:14px;line-height:12px;padding:0 0 0 3px;cursor:pointer;}',
      '.bask-operations-dashboard .bask-od-chart-wrap{flex:1 0 180px;min-width:0;min-height:180px;position:relative;',
        'overflow:hidden;background:var(--od-surface);}',
      '.bask-operations-dashboard .bask-od-chart{display:block;width:100%;height:100%;cursor:crosshair;}',
      '.bask-operations-dashboard .bask-od-chart-tooltip{position:absolute;z-index:2;display:none;',
        'min-width:160px;max-width:260px;padding:8px 9px;pointer-events:none;',
        'border:1px solid var(--od-border);border-radius:7px;background:var(--od-surface);',
        'color:var(--od-text);box-shadow:0 5px 16px rgba(16,24,40,.18);font-size:10px;}',
      '.bask-operations-dashboard .bask-od-chart-tooltip-title{margin-bottom:5px;color:var(--od-muted);',
        'font-weight:600;white-space:nowrap;}',
      '.bask-operations-dashboard .bask-od-chart-tooltip-row{display:grid;',
        'grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:6px;padding:2px 0;}',
      '.bask-operations-dashboard .bask-od-chart-tooltip-swatch{width:8px;height:8px;',
        'border-radius:50%;}',
      '.bask-operations-dashboard .bask-od-chart-tooltip-name{overflow:hidden;',
        'text-overflow:ellipsis;white-space:nowrap;}',
      '.bask-operations-dashboard .bask-od-chart-tooltip-value{font-weight:700;white-space:nowrap;}',
      '.bask-operations-dashboard .bask-od-empty{padding:28px 18px;text-align:center;color:var(--od-muted);',
        'font-size:12px;line-height:1.5;}',
      '.bask-operations-dashboard .bask-od-chart-empty{position:absolute;inset:0;display:flex;align-items:center;',
        'justify-content:center;padding:24px;pointer-events:none;}',
      '.bask-operations-dashboard .bask-od-chart-empty>div{max-width:360px;text-align:center;color:var(--od-muted);',
        'font-size:12px;line-height:1.5;}',
      '.bask-operations-dashboard .bask-od-health,.bask-operations-dashboard .bask-od-schedules{',
        'flex-direction:column;padding:12px;gap:0;}',
      '.bask-operations-dashboard .bask-od-section-card{flex:1 1 0;min-height:0;display:flex;flex-direction:column;',
        'overflow:hidden;background:var(--od-surface);border:1px solid var(--od-border);border-radius:9px;}',
      '.bask-operations-dashboard .bask-od-health-tabs{flex:0 0 auto;display:flex;align-items:center;gap:6px;',
        'padding:8px 10px;overflow-x:auto;border-bottom:1px solid var(--od-border);background:var(--od-surface);}',
      '.bask-operations-dashboard .bask-od-health-filter{display:inline-flex;align-items:center;gap:7px;',
        'flex:0 0 auto;padding:7px 10px;border:1px solid var(--od-border);border-radius:999px;',
        'background:var(--od-surface);color:var(--od-muted);font:inherit;font-size:11px;font-weight:700;',
        'cursor:pointer;white-space:nowrap;}',
      '.bask-operations-dashboard .bask-od-health-filter.is-active{border-color:var(--od-accent);',
        'color:var(--od-accent);box-shadow:0 0 0 2px color-mix(in srgb,var(--od-accent) 12%,transparent);}',
      '.bask-operations-dashboard .bask-od-health-filter-count{display:inline-flex;align-items:center;',
        'justify-content:center;min-width:22px;height:18px;padding:0 6px;border-radius:999px;',
        'background:var(--od-bg);color:var(--od-text);font-size:10px;}',
      '.bask-operations-dashboard .bask-od-health-list{flex:1 1 0;min-height:0;overflow:auto;}',
      '.bask-operations-dashboard .bask-od-dot{width:10px;height:10px;border-radius:3px;flex:0 0 auto;',
        'border:1px solid rgba(0,0,0,.18);}',
      '.bask-operations-dashboard .bask-od-count{margin-left:auto;color:var(--od-muted);font-size:11px;}',
      '.bask-operations-dashboard .bask-od-health-row{display:grid;grid-template-columns:auto minmax(0,1fr) auto;',
        'align-items:center;gap:10px;min-height:52px;padding:8px 12px;border-bottom:1px solid var(--od-border);',
        'color:var(--od-text);text-decoration:none;}',
      '.bask-operations-dashboard .bask-od-health-row:last-child{border-bottom:0;}',
      '.bask-operations-dashboard .bask-od-health-row:hover{',
        'background:color-mix(in srgb,var(--od-accent) 7%,transparent);}',
      '.bask-operations-dashboard .bask-od-row-value{min-width:max-content;overflow:visible;',
        'white-space:nowrap;text-align:right;font-size:11px;font-weight:600;}',
      '.bask-operations-dashboard .bask-od-alarm-row{grid-template-columns:auto minmax(0,1fr) auto auto;}',
      '.bask-operations-dashboard .bask-od-alarm-message{display:block;margin-top:3px;overflow:hidden;',
        'text-overflow:ellipsis;white-space:nowrap;font-size:11px;color:var(--od-text);}',
      '.bask-operations-dashboard .bask-od-alarm-actions{display:flex;align-items:center;gap:6px;}',
      '.bask-operations-dashboard .bask-od-health-tools{display:flex;align-items:center;gap:6px;flex:0 0 auto;}',
      '.bask-operations-dashboard .bask-od-alarm-sort{min-width:148px;}',
      '.bask-operations-dashboard .bask-od-note-editor{grid-column:1/-1;display:flex;flex-direction:column;',
        'gap:6px;padding:4px 0 2px;}',
      '.bask-operations-dashboard .bask-od-note-existing{white-space:pre-wrap;max-height:72px;overflow:auto;',
        'font-size:11px;color:var(--od-muted);line-height:1.4;}',
      '.bask-operations-dashboard .bask-od-note-input{width:100%;min-height:56px;resize:vertical;',
        'border:1px solid var(--od-border);border-radius:6px;background:var(--od-bg);color:var(--od-text);',
        'font:inherit;font-size:12px;padding:7px 8px;}',
      '.bask-operations-dashboard .bask-od-note-actions{display:flex;justify-content:flex-end;gap:6px;}',
      '.bask-operations-dashboard .bask-od-inline-action{border:1px solid var(--od-border);border-radius:6px;',
        'background:var(--od-surface);color:var(--od-text);font:inherit;font-size:11px;font-weight:700;',
        'padding:5px 8px;cursor:pointer;white-space:nowrap;}',
      '.bask-operations-dashboard .bask-od-inline-action:hover{border-color:var(--od-accent);',
        'color:var(--od-accent);}',
      '.bask-operations-dashboard .bask-od-inline-action:disabled{opacity:.55;cursor:default;}',
      '.bask-operations-dashboard .bask-od-schedule-workspace{flex:1 1 0;min-width:0;min-height:0;',
        'display:flex;overflow:hidden;}',
      '.bask-operations-dashboard .bask-od-schedule-list{flex:0 0 260px;min-width:0;min-height:0;',
        'overflow:auto;border-right:1px solid var(--od-border);background:var(--od-surface);}',
      '.bask-operations-dashboard .bask-od-schedule-item{display:block;width:100%;padding:10px 12px;',
        'border:0;border-bottom:1px solid var(--od-border);background:transparent;color:var(--od-text);',
        'font:inherit;text-align:left;cursor:pointer;}',
      '.bask-operations-dashboard .bask-od-schedule-item:hover{background:color-mix(in srgb,var(--od-accent) 7%,transparent);}',
      '.bask-operations-dashboard .bask-od-schedule-item.is-active{background:color-mix(in srgb,var(--od-accent) 11%,transparent);',
        'box-shadow:inset 3px 0 0 var(--od-accent);}',
      '.bask-operations-dashboard .bask-od-schedule-item-name{display:block;overflow:hidden;',
        'text-overflow:ellipsis;white-space:nowrap;font-size:12px;font-weight:700;}',
      '.bask-operations-dashboard .bask-od-schedule-item-meta{display:flex;align-items:center;gap:8px;',
        'margin-top:4px;color:var(--od-muted);font-size:10px;}',
      '.bask-operations-dashboard .bask-od-schedule-calendar{flex:1 1 0;min-width:0;min-height:0;',
        'display:flex;flex-direction:column;overflow:hidden;background:var(--od-surface);}',
      '.bask-operations-dashboard .bask-od-calendar-header{flex:0 0 auto;display:grid;align-items:center;',
        'grid-template-columns:minmax(0,1fr) auto;gap:6px 12px;padding:10px 12px;border-bottom:1px solid var(--od-border);}',
      '.bask-operations-dashboard .bask-od-calendar-title{min-width:0;overflow:hidden;text-overflow:ellipsis;',
        'white-space:nowrap;font-size:14px;font-weight:700;}',
      '.bask-operations-dashboard .bask-od-calendar-meta,.bask-operations-dashboard .bask-od-calendar-note{grid-column:1 / -1;',
        'color:var(--od-muted);font-size:11px;line-height:1.5;white-space:normal;}',
      '.bask-operations-dashboard .bask-od-calendar-link{grid-column:2;grid-row:1;color:var(--od-accent);font-size:11px;',
        'font-weight:700;text-decoration:none;white-space:nowrap;}',
      '.bask-operations-dashboard .bask-od-calendar-scroll{flex:1 1 0;min-height:0;overflow:auto;padding:10px;}',
      '.bask-operations-dashboard .bask-od-week-grid{display:grid;grid-template-columns:repeat(7,minmax(120px,1fr));',
        'min-width:840px;min-height:100%;gap:8px;}',
      '.bask-operations-dashboard .bask-od-day{min-width:0;border:1px solid var(--od-border);',
        'border-radius:8px;overflow:hidden;background:var(--od-bg);}',
      '.bask-operations-dashboard .bask-od-day-title{padding:7px 8px;border-bottom:1px solid var(--od-border);',
        'background:var(--od-surface);font-size:11px;font-weight:700;text-align:center;}',
      '.bask-operations-dashboard .bask-od-day-events{display:flex;flex-direction:column;gap:6px;padding:7px;}',
      '.bask-operations-dashboard .bask-od-calendar-event{padding:7px;border-left:3px solid var(--od-accent);',
        'border-radius:5px;background:var(--od-surface);box-shadow:0 1px 2px rgba(16,24,40,.06);}',
      '.bask-operations-dashboard .bask-od-event-time{font-size:10px;font-weight:700;color:var(--od-text);}',
      '.bask-operations-dashboard .bask-od-event-value{margin-top:3px;overflow:hidden;text-overflow:ellipsis;',
        'white-space:nowrap;font-size:10px;color:var(--od-muted);}',
      '.bask-operations-dashboard .bask-od-day-empty{padding:10px 4px;text-align:center;',
        'font-size:10px;color:var(--od-muted);}',
      '.bask-operations-dashboard.bask-od-narrow .bask-od-header{align-items:flex-start;flex-direction:column;gap:8px;}',
      '.bask-operations-dashboard.bask-od-narrow .bask-od-tabs{margin-left:0;width:100%;overflow-x:auto;}',
      '.bask-operations-dashboard.bask-od-narrow .bask-od-tab{flex:1 0 auto;}',
      '.bask-operations-dashboard.bask-od-narrow .bask-od-trends{flex-direction:column;overflow-y:auto;}',
      '.bask-operations-dashboard.bask-od-narrow .bask-od-browser{flex:0 0 auto;max-width:none;width:100%;max-height:340px;overflow-y:auto;}',
      '.bask-operations-dashboard.bask-od-narrow .bask-od-histories{flex:0 0 auto;}',
      '.bask-operations-dashboard.bask-od-narrow .bask-od-history-body{flex:0 0 180px;}',
      '.bask-operations-dashboard.bask-od-browser-collapsed .bask-od-browser{display:none;}',
      '.bask-operations-dashboard.bask-od-narrow .bask-od-chart-card{flex:1 0 360px;min-height:360px;width:100%;}',
      '.bask-od-section-toggle{display:block;width:100%;padding:10px;text-align:left;border:0;border-bottom:1px solid var(--od-border);background:var(--od-bg);color:var(--od-text);font:inherit;font-size:12px;font-weight:700;cursor:pointer;}',
      '.bask-od-histories{display:flex;flex-direction:column;flex:1 1 auto;min-height:0;overflow:hidden;}',
      '.bask-od-histories.is-collapsed{flex:0 0 auto;}.bask-od-histories.is-collapsed .bask-od-history-body{display:none;}',
      '.bask-od-history-body{display:flex;flex-direction:column;flex:1 1 auto;min-height:80px;overflow:hidden;}',
      '.bask-od-saved-list{max-height:180px;overflow:auto;}.bask-od-saved-row{display:flex;border-bottom:1px solid var(--od-border);}',
      '.bask-od-presets .bask-od-status:empty{display:none;}',
      '.bask-od-saved-row.is-active{background:var(--od-bg);box-shadow:inset 3px 0 var(--od-accent);}',
      '.bask-od-saved-row button{background:transparent;color:var(--od-text);border:0;padding:9px 10px;font:inherit;font-size:12px;text-align:left;cursor:pointer;}',
      '.bask-od-saved-row .bask-od-saved-open{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}',
      '.bask-od-analysis-details{flex:0 0 auto;max-height:260px;overflow:auto;border-top:1px solid var(--od-border);}.bask-od-analysis-details>summary{padding:8px 10px;cursor:pointer;font-size:11px;color:var(--od-muted);}',
      '.bask-operations-dashboard.bask-od-narrow .bask-od-toolbar{flex-wrap:wrap;}',
      '.bask-operations-dashboard.bask-od-narrow .bask-od-schedule-workspace{flex-direction:column;}',
      '.bask-operations-dashboard.bask-od-narrow .bask-od-schedule-list{flex:0 0 auto;display:flex;',
        'max-height:112px;overflow:auto;border-right:0;border-bottom:1px solid var(--od-border);}',
      '.bask-operations-dashboard.bask-od-narrow .bask-od-schedule-item{flex:0 0 220px;',
        'border-bottom:0;border-right:1px solid var(--od-border);}',
      '.bask-operations-dashboard.bask-od-narrow .bask-od-schedule-item.is-active{',
        'box-shadow:inset 0 -3px 0 var(--od-accent);}',
      '.bask-operations-dashboard.bask-od-compact .bask-od-header{padding:8px 10px;}',
      '.bask-operations-dashboard.bask-od-compact .bask-od-title{font-size:15px;}',
      '.bask-operations-dashboard.bask-od-compact .bask-od-health,',
        '.bask-operations-dashboard.bask-od-compact .bask-od-schedules{padding:6px;}',
      '.bask-operations-dashboard.bask-od-compact .bask-od-trends{padding:6px;gap:6px;}',
      '.bask-operations-dashboard.bask-od-compact:not(.bask-od-narrow) .bask-od-browser{flex-basis:220px;min-width:0;}',
      '.bask-operations-dashboard.bask-od-compact .bask-od-calendar-header{grid-template-columns:minmax(0,1fr);}',
      '.bask-operations-dashboard.bask-od-compact .bask-od-calendar-link{grid-column:1;grid-row:auto;white-space:normal;}',
      '.bask-operations-dashboard.bask-od-compact .bask-od-calendar-meta{margin-left:0;}',
      '.bask-operations-dashboard.bask-od-compact .bask-od-alarm-row{',
        'grid-template-columns:auto minmax(0,1fr);align-items:start;}',
      '.bask-operations-dashboard.bask-od-compact .bask-od-alarm-row .bask-od-row-value,',
        '.bask-operations-dashboard.bask-od-compact .bask-od-alarm-actions{grid-column:2;}'
    ].join('');

    $('<style id="bask-operations-dashboard-styles" type="text/css"></style>')
      .text(css)
      .appendTo(document.head || document.documentElement);
  }

  function asString(value) {
    if (value === null || value === undefined) {
      return '';
    }
    try {
      if (typeof value.getTag === 'function') {
        return String(value.getTag());
      }
    } catch (ignored0) {}
    try {
      if (typeof value.valueOf === 'function') {
        var unwrapped = value.valueOf();
        if (unwrapped !== value && (typeof unwrapped === 'string' || typeof unwrapped === 'number')) {
          return String(unwrapped);
        }
      }
    } catch (ignored1) {}
    return String(value);
  }

  function themeMode(value) {
    try {
      if (value && typeof value.getTag === 'function') {
        value = value.getTag();
      }
    } catch (ignored0) {}
    try {
      if (value && typeof value.encodeToString === 'function') {
        value = value.encodeToString();
      }
    } catch (ignored1) {}
    return asString(value).trim().toLowerCase() === 'dark' ? 'dark' : 'light';
  }

  function normalizeHistoryParentName(value) {
    var parent = asString(value).trim();
    if (parent.indexOf('station:|history:/') === 0) {
      parent = parent.substring('station:|history:/'.length);
    }
    else if (parent.indexOf('history:/') === 0) {
      parent = parent.substring('history:/'.length);
    }
    return parent.replace(/^\/+/, '').replace(/\/+$/, '');
  }

  function formatMinutes(minutes) {
    var total = Math.max(0, Math.min(1440, Number(minutes) || 0));
    if (total === 1440) {
      return '12:00 AM';
    }
    var hours = Math.floor(total / 60);
    var mins = total % 60;
    var suffix = hours >= 12 ? 'PM' : 'AM';
    var displayHour = hours % 12 || 12;
    return displayHour + ':' + (mins < 10 ? '0' : '') + mins + ' ' + suffix;
  }

  function formatError(err, fallback) {
    if (err && err.message) {
      return err.message;
    }
    var text = asString(err).trim();
    return text || fallback;
  }

  function parseRpcJson(result) {
    try {
      var text = '';
      if (typeof result === 'string') {
        text = result;
      }
      else if (result && typeof result.getValue === 'function') {
        text = asString(result.getValue());
      }
      else if (result && typeof result.encodeToString === 'function') {
        text = asString(result.encodeToString());
      }
      else if (result && typeof result.getString === 'function') {
        text = asString(result.getString());
      }
      else if (result && typeof result === 'object') {
        if (Array.isArray(result.points) || Array.isArray(result.alarms) ||
            Array.isArray(result.histories) || Array.isArray(result.schedules)) {
          return result;
        }
        text = asString(result);
      }
      text = asString(text).trim();
      if (!text) {
        return {};
      }
      var parsed = JSON.parse(text);
      if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }
      return parsed && typeof parsed === 'object' ? parsed : {};
    }
    catch (err) {
      console.error('[OperationsDashboard] RPC JSON parse failed:', err);
      return {};
    }
  }

  function callRpc(method, args) {
    return baja.rpc({
      typeSpec: HISTORY_RPC_TYPE,
      method: method,
      args: args || []
    });
  }

  function getRowValue(row, names) {
    var i;
    for (i = 0; i < names.length; i++) {
      try {
        var value = row.get(names[i]);
        if (value !== null && value !== undefined) {
          return value;
        }
      } catch (ignored) {}
    }
    return null;
  }

  function ordToUrl(ord) {
    var ordString = normalizeNavigationOrd(ord);
    try {
      return baja.Ord.make(ordString).toUri();
    }
    catch (ignored) {
      return '/ord/' + ordString
        .replace(/\^/g, '%5E')
        .replace(/\|/g, '%7C')
        .replace(/ /g, '%20');
    }
  }

  function normalizeNavigationOrd(ord) {
    var normalized = asString(ord).trim();
    while (normalized.indexOf('local:|') === 0) {
      normalized = normalized.substring('local:|'.length);
    }
    if (normalized.indexOf('station:|') === 0) {
      normalized = normalized.substring('station:|'.length);
    }
    return normalized;
  }

  function navigationOrdWithView(ord, viewType) {
    var normalized = normalizeNavigationOrd(ord);
    if (!normalized || normalized.indexOf('|view:') >= 0) {
      return normalized;
    }
    return normalized + '|view:' + viewType;
  }

  function navigateToOrd(ord) {
    var ordString = normalizeNavigationOrd(ord);
    if (!ordString) {
      return Promise.reject(new Error('No navigation ORD was provided.'));
    }
    var href = ordToUrl(ordString);

    var env = typeof window !== 'undefined' && window.niagara && window.niagara.env;
    if (env && typeof env.hyperlink === 'function') {
      try {
        return Promise.resolve(env.hyperlink(ordString));
      }
      catch (hyperlinkError) {
        return Promise.reject(hyperlinkError);
      }
    }
    if (env && typeof env.toHyperlink === 'function') {
      return Promise.resolve(env.toHyperlink(ordString)).then(function (normalizedHref) {
        window.location.assign(normalizedHref);
      });
    }

    if (typeof window !== 'undefined') {
      window.location.assign(href);
      return Promise.resolve();
    }
    return Promise.reject(new Error('Niagara navigation is unavailable.'));
  }

  function bindOrdNavigation($element, ord) {
    var ordString = normalizeNavigationOrd(ord);
    return $element
      .attr('href', ordToUrl(ordString))
      .attr('title', ordString)
      .on('click', function (event) {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        navigateToOrd(ordString).catch(function (error) {
          $element.attr('title', formatError(error, 'Unable to open this destination.'));
          console.error('[OperationsDashboard] Navigation failed:', error);
        });
      });
  }

  function extractNumericValue(value) {
    if (value === null || value === undefined) {
      return null;
    }
    if (typeof value === 'number') {
      return isFinite(value) ? value : null;
    }
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }
    try {
      if (typeof value.getOrdinal === 'function') {
        var ordinal = Number(value.getOrdinal());
        return isFinite(ordinal) ? ordinal : null;
      }
    } catch (ignored0) {}
    try {
      if (typeof value.getValue === 'function') {
        return extractNumericValue(value.getValue());
      }
    } catch (ignored1) {}
    try {
      if (typeof value.get === 'function') {
        return extractNumericValue(value.get('value'));
      }
    } catch (ignored2) {}

    var text = asString(value).trim();
    if (/^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) {
      var parsed = Number(text);
      return isFinite(parsed) ? parsed : null;
    }
    return null;
  }

  function timestampMillis(value) {
    if (!value) {
      return NaN;
    }
    try {
      if (typeof value.getMillis === 'function') {
        return Number(value.getMillis());
      }
    } catch (ignored0) {}
    if (value instanceof Date) {
      return value.getTime();
    }
    if (typeof value === 'number') {
      return value;
    }
    return new Date(asString(value)).getTime();
  }

  function shortNumber(value) {
    var abs = Math.abs(value);
    if (abs >= 1000000) {
      return (value / 1000000).toFixed(1) + 'm';
    }
    if (abs >= 1000) {
      return (value / 1000).toFixed(1) + 'k';
    }
    if (abs >= 100) {
      return value.toFixed(0);
    }
    if (abs >= 10) {
      return value.toFixed(1);
    }
    return value.toFixed(2).replace(/\.?0+$/, '');
  }

  function nearestSample(points, targetTime) {
    var low = 0;
    var high = points.length - 1;
    while (low < high) {
      var middle = Math.floor((low + high) / 2);
      if (points[middle].time < targetTime) {
        low = middle + 1;
      }
      else {
        high = middle;
      }
    }

    if (low > 0 &&
        Math.abs(points[low - 1].time - targetTime) <=
        Math.abs(points[low].time - targetTime)) {
      return points[low - 1];
    }
    return points[low];
  }

  OperationsDashboard.prototype._ui = function () {
    return THEMES[themeMode(this.properties().getValue('mode'))];
  };

  OperationsDashboard.prototype._applyProperties = function () {
    if (!this.$root) {
      return;
    }
    var ui = this._ui();
    var rootStyle = this.$root[0].style;
    rootStyle.setProperty('--od-bg', ui.background);
    rootStyle.setProperty('--od-surface', ui.surface);
    rootStyle.setProperty('--od-text', ui.text);
    rootStyle.setProperty('--od-muted', ui.muted);
    rootStyle.setProperty('--od-border', ui.border);
    rootStyle.setProperty('--od-accent', ui.accent);

    this.$root.css({
      backgroundColor: ui.background,
      borderColor: ui.border,
      color: ui.text
    });
    if (this.$header) {
      this.$header.css({
        backgroundColor: ui.surface,
        borderBottomColor: ui.border
      });
    }
    if (this.$main) {
      this.$main.css('backgroundColor', ui.background);
    }
    this.$root.find(
      '.bask-od-browser,.bask-od-chart-card,.bask-od-section-card,' +
      '.bask-od-schedule-calendar,.bask-od-health-tabs'
    ).css('backgroundColor', ui.surface);
    this.$title.text(asString(this.properties().getValue('title')).trim() || 'Operations Dashboard');
    this._scheduleChartDraw();
  };

  OperationsDashboard.prototype._applyHostPresentation = function (attempt) {
    var that = this;
    if (!this.$dom || this.$destroyed) {
      return;
    }

    this.$dom.css({
      width: '100%',
      height: '100%',
      minWidth: 0,
      minHeight: 0,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
      background: 'transparent'
    });

    var $host = this.$dom.closest(
      '.ux-WebWidget, .bajaux-container, .bajaux-widget-container'
    );
    if ($host.length) {
      $host.css({
        background: 'transparent',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden'
      });
      $host.children('.bajaux-widget-container, .bajaux-widget').css({
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden'
      });
      this._handleResize();
      return;
    }

    if ((attempt || 0) >= 10 || typeof window === 'undefined' || !window.requestAnimationFrame) {
      return;
    }
    if (this.$hostLayoutFrame && window.cancelAnimationFrame) {
      window.cancelAnimationFrame(this.$hostLayoutFrame);
    }
    this.$hostLayoutFrame = window.requestAnimationFrame(function () {
      that.$hostLayoutFrame = 0;
      that._applyHostPresentation((attempt || 0) + 1);
    });
  };

  OperationsDashboard.prototype._makeButton = function (label) {
    return $('<button type="button" class="bask-od-button"></button>').text(label);
  };

  OperationsDashboard.prototype._buildTabs = function () {
    var that = this;
    var $tabs = $('<div class="bask-od-tabs"></div>');
    [
      { key: 'overview', label: 'Overview' },
      { key: 'trends', label: 'Histories & Trends' },
      { key: 'health', label: 'Health' },
      { key: 'schedules', label: 'Schedules' },
      { key: 'changes', label: 'Recent Changes' }
    ].forEach(function (tab) {
      var $button = $('<button type="button" class="bask-od-tab"></button>')
        .attr('data-tab', tab.key)
        .text(tab.label)
        .on('click', function () {
          that._activateTab(tab.key);
        });
      that.$tabButtons[tab.key] = $button;
      $tabs.append($button);
    });
    return $tabs;
  };

  OperationsDashboard.prototype._buildTrendsPanel = function () {
    var that = this;
    var $panel = $('<div class="bask-od-panel bask-od-trends"></div>');
    var $browser = $('<div class="bask-od-browser"></div>');
    var $browserToolbar = $('<div class="bask-od-toolbar"></div>');

    this.$historySearch = $('<input class="bask-od-input" type="search" placeholder="Search histories">')
      .on('input', function () {
        that.$historySearchText = asString($(this).val()).trim().toLowerCase();
        that._renderHistoryList();
      });
    this.$historyRefresh = this._makeButton('Refresh').on('click', function () {
      that._loadHistories();
    });
    $browserToolbar.append(this.$historySearch, this.$historyRefresh);

    this.$historyStatus = $('<div class="bask-od-status"></div>');
    this.$historyList = $('<div class="bask-od-list"></div>');
    var $historySection = $('<div class="bask-od-histories"></div>');
    var $historyToggle = $('<button type="button" class="bask-od-section-toggle" aria-expanded="true">▾ Histories</button>').on('click', function () {
      var closed = $historySection.toggleClass('is-collapsed').hasClass('is-collapsed');
      $historyToggle.attr('aria-expanded', String(!closed)).text((closed ? '▸' : '▾') + ' Histories');
    });
    $historySection.append($historyToggle, $('<div class="bask-od-history-body"></div>').append($browserToolbar, this.$historyStatus, this.$historyList));

    var $chartCard = $('<div class="bask-od-chart-card"></div>');
    var $chartToolbar = $('<div class="bask-od-toolbar bask-od-chart-tools"></div>');
    var $chartTitle = $('<div class="bask-od-toolbar-title">Trend Chart</div>');
    this.$browseToggle = this._makeButton('Sidebar').attr('aria-expanded','true').on('click',function(){
      var closed=that.$dom.toggleClass('bask-od-browser-collapsed').hasClass('bask-od-browser-collapsed');
      that.$browseToggle.attr('aria-expanded',String(!closed));that._drawChart();
    });
    this.$periodSelect = $([
      '<select class="bask-od-select" aria-label="Chart time range">',
      '<option value="last24Hours">Last 24 hours</option>',
      '<option value="last7Days">Last 7 days</option>',
      '<option value="monthToDate">Month to date</option>',
      '<option value="yearToDate">Year to date</option>',
      '</select>'
    ].join('')).val(this.$period).on('change', function () {
      that.$period = asString($(this).val()) || 'last24Hours';
      that._reloadSeries();
    });
    var $clear = this._makeButton('Clear chart').on('click', function () {
      that.$series.forEach(function (series) {
        series.loadSequence++;
      });
      that.$series = [];
      that._renderLegend();
      that._drawChart();
    });
    var $reload = this._makeButton('Reload samples').on('click', function () { that._reloadSeries(); });
    $chartToolbar.append($chartTitle, this.$browseToggle, this.$periodSelect, $reload, $clear);

    this.$chartLegend = $('<div class="bask-od-legend"></div>');
    this.$chartStatus = $('<div class="bask-od-status"></div>');
    var $chartWrap = $('<div class="bask-od-chart-wrap"></div>')
      .on('dragover', function (event) {
        event.preventDefault();
        var transfer = event.originalEvent && event.originalEvent.dataTransfer;
        if (transfer) {
          transfer.dropEffect = 'copy';
        }
      })
      .on('drop', function (event) {
        event.preventDefault();
        event.stopPropagation();
        that._handleHistoryDrop(event.originalEvent && event.originalEvent.dataTransfer);
      });
    this.$chartCanvas = $('<canvas class="bask-od-chart"></canvas>')
      .on('mousemove', function (event) {
        that._showChartTooltip(event);
      })
      .on('mouseleave', function () {
        that._hideChartTooltip();
      });
    this.$chartEmpty = $('<div class="bask-od-chart-empty"><div></div></div>');
    this.$chartTooltip = $(
      '<div class="bask-od-chart-tooltip" role="tooltip" aria-hidden="true"></div>'
    );
    $chartWrap.append(this.$chartCanvas, this.$chartEmpty, this.$chartTooltip);
    this.$savedCharts = new SavedCharts(this);
    this.$analysis = new TrendAnalysis(this);
    $browser.append(this.$savedCharts.$root, $historySection);
    var $details = $('<details class="bask-od-analysis-details"><summary>Analysis &amp; export</summary></details>').append(this.$analysis.$root);
    $details.on('toggle',function(){that._drawChart();});
    $chartCard.append($chartToolbar, this.$chartLegend, this.$chartStatus, $chartWrap, $details);

    $panel.append($browser, $chartCard);
    return $panel;
  };

  OperationsDashboard.prototype._buildHealthPanel = function () {
    var that = this;
    var $panel = $('<div class="bask-od-panel bask-od-health"></div>');
    var $card = $('<div class="bask-od-section-card"></div>');
    var $toolbar = $('<div class="bask-od-toolbar"></div>');
    $toolbar.append(
      $('<div class="bask-od-toolbar-title">Non-normal Point Statuses</div>'),
      $('<div style="flex:1 1 auto"></div>')
    );
    this.$healthRefresh = this._makeButton('Refresh').on('click', function () {
      try {
        that._loadHealth();
      }
      catch (err) {
        console.error('[OperationsDashboard] Health refresh failed:', err);
        that.$healthLoading = false;
        if (that.$healthRefresh) {
          that.$healthRefresh.prop('disabled', false).text('Refresh');
        }
      }
    });
    this.$alarmSortSelect = $([
      '<select class="bask-od-select bask-od-alarm-sort" aria-label="Sort alarms">',
      '<option value="class">Sort by alarm class</option>',
      '<option value="priority">Sort by priority</option>',
      '<option value="time">Sort by newest</option>',
      '</select>'
    ].join('')).val(this.$alarmSort).on('change', function () {
      that.$alarmSort = asString($(this).val()) || 'class';
      that._renderHealth();
    }).hide();
    $toolbar.append(
      bindOrdNavigation(
        $('<a class="bask-od-button">Alarm Console</a>'),
        'alarm:'
      ),
      $('<div class="bask-od-health-tools"></div>').append(
        this.$alarmSortSelect,
        this.$healthRefresh
      )
    );
    this.$healthStatus = $('<div class="bask-od-status"></div>');
    this.$healthTabs = $('<div class="bask-od-health-tabs"></div>');
    this.$healthContent = $('<div class="bask-od-health-list"></div>');
    $card.append($toolbar, this.$healthStatus, this.$healthTabs, this.$healthContent);
    $panel.append($card);
    return $panel;
  };

  OperationsDashboard.prototype._buildSchedulesPanel = function () {
    var that = this;
    var $panel = $('<div class="bask-od-panel bask-od-schedules"></div>');
    var $card = $('<div class="bask-od-section-card"></div>');
    var $toolbar = $('<div class="bask-od-toolbar"></div>');
    this.$scheduleSearch = $('<input class="bask-od-input" type="search" placeholder="Search schedules">')
      .on('input', function () {
        that.$scheduleSearchText = asString($(this).val()).trim().toLowerCase();
        that._renderSchedules();
      });
    this.$scheduleRefresh = this._makeButton('Refresh').on('click', function () {
      that._loadSchedules();
    });
    $toolbar.append(this.$scheduleSearch, this.$scheduleRefresh);
    this.$scheduleStatus = $('<div class="bask-od-status"></div>');
    this.$scheduleList = $('<div class="bask-od-schedule-list"></div>');
    this.$scheduleCalendar = $('<div class="bask-od-schedule-calendar"></div>');
    var $workspace = $('<div class="bask-od-schedule-workspace"></div>')
      .append(this.$scheduleList, this.$scheduleCalendar);
    $card.append($toolbar, this.$scheduleStatus, $workspace);
    $panel.append($card);
    return $panel;
  };

  OperationsDashboard.prototype.doInitialize = function (dom) {
    var that = this;
    injectStyles();

    this.$dom = dom;
    dom.empty().addClass('bask-operations-dashboard').css('background', 'transparent');
    this.$root = $('<div class="bask-od-shell"></div>');
    this.$title = $('<h2 class="bask-od-title"></h2>');
    this.$header = $('<div class="bask-od-header"></div>').append(this.$title, this._buildTabs());
    this.$main = $('<div class="bask-od-main"></div>');

    this.$overview = new OperationsOverview(this);
    this.$panels.overview = this.$overview.$root;
    this.$panels.trends = this._buildTrendsPanel();
    this.$panels.health = this._buildHealthPanel();
    this.$panels.schedules = this._buildSchedulesPanel();
    this.$recentChanges = new RecentChanges(this);
    this.$panels.changes = this.$recentChanges.$root;
    this.$main.append(this.$panels.overview, this.$panels.trends, this.$panels.health, this.$panels.schedules, this.$panels.changes);
    this.$root.append(this.$header, this.$main);
    dom.append(this.$root);

    this._applyHostPresentation(0);
    this._applyProperties();
    this.$savedCharts.refresh();
    this._activateTab('overview');
    this._renderLegend();
    this._renderHistoryList();

    $(window).on('resize' + this.$eventNamespace, function () {
      that._handleResize();
    });
    if (typeof ResizeObserver !== 'undefined') {
      this.$resizeObserver = new ResizeObserver(function () {
        that._handleResize();
      });
      this.$resizeObserver.observe(dom[0]);
    }
    this._handleResize();
    return this;
  };

  OperationsDashboard.prototype._activateTab = function (tab) {
    var that = this;
    this.$activeTab = tab;
    if (tab !== 'health') {
      clearTimeout(this.$healthTimer);
    }
    Object.keys(this.$panels).forEach(function (key) {
      that.$panels[key].toggleClass('is-active', key === tab);
      that.$tabButtons[key].toggleClass('is-active', key === tab);
    });

    if (tab === 'overview') {
      if (!this.$overview.loaded) this.$overview.load();
    }
    else if (tab === 'trends') {
      if (!this.$historyLoaded && !this.$historyLoading) {
        this._loadHistories();
      }
      this._scheduleChartDraw();
    }
    else if (tab === 'health') {
      if (!this.$healthLoaded && !this.$healthLoading) {
        this._loadHealth();
      }
      else {
        this._scheduleHealthRefresh();
      }
    }
    else if (tab === 'schedules' && !this.$schedulesLoaded && !this.$schedulesLoading) {
      this._loadSchedules();
    }
  };

  OperationsDashboard.prototype._handleResize = function () {
    if (!this.$dom) {
      return;
    }
    var width = this.$dom.width();
    this.$dom.toggleClass('bask-od-narrow', width > 0 && width < 840);
    this.$dom.toggleClass('bask-od-compact', width > 0 && width < 520);
    this._scheduleChartDraw();
  };

  OperationsDashboard.prototype.doLayout = function () {
    this._applyHostPresentation(0);
    this._handleResize();
    return this;
  };

  OperationsDashboard.prototype._scheduleChartDraw = function () {
    var that = this;
    var draw = function () {
      if (!that.$destroyed && that.$activeTab === 'trends') {
        that._drawChart();
      }
    };
    if (typeof window !== 'undefined' && window.requestAnimationFrame) {
      window.requestAnimationFrame(draw);
    }
    else {
      setTimeout(draw, 0);
    }
  };

  OperationsDashboard.prototype._loadHistories = function () {
    var that = this;
    if (this.$historyLoading) {
      return;
    }
    var sequence = ++this.$historyLoadSequence;
    var historyParentName = normalizeHistoryParentName(
      this.properties().getValue('historyParentName')
    );
    this.$historyLoading = true;
    this.$historyRefresh.prop('disabled', true).text('Loading...');
    this.$historyStatus.text(
      historyParentName ?
        'Loading histories from "' + historyParentName + '"...' :
        'Loading histories from station History Space...'
    );
    this.$historyList.empty().append(
      $('<div class="bask-od-empty"></div>').text('Loading histories...')
    );

    baja.rpc({
      typeSpec: HISTORY_RPC_TYPE,
      method: 'listHistories',
      args: [historyParentName]
    }).then(function (result) {
      if (that.$destroyed || sequence !== that.$historyLoadSequence) {
        return;
      }
      var payload = parseRpcJson(result);
      that.$histories = payload && Array.isArray(payload.histories) ? payload.histories : [];
      that.$historyLoaded = true;
      that.$historyLoading = false;
      that.$historyRefresh.prop('disabled', false).text('Refresh');
      that._renderHistoryList();
    }).catch(function (err) {
      if (that.$destroyed || sequence !== that.$historyLoadSequence) {
        return;
      }
      that.$histories = [];
      that.$historyLoaded = false;
      that.$historyLoading = false;
      that.$historyRefresh.prop('disabled', false).text('Refresh');
      that.$historyStatus.text(
        historyParentName ?
          'Unable to load histories from "' + historyParentName + '".' :
          'Unable to load station histories.'
      );
      that.$historyList.empty().append(
        $('<div class="bask-od-empty"></div>').text(formatError(err, 'History Space is unavailable.'))
      );
      console.error('[OperationsDashboard] History discovery failed:', err);
    });
  };

  OperationsDashboard.prototype._visibleHistories = function () {
    var query = this.$historySearchText;
    if (!query) {
      return this.$histories;
    }
    return this.$histories.filter(function (history) {
      return [
        history.displayName,
        history.device,
        history.historyName,
        history.ord,
        history.recordType
      ].join(' ').toLowerCase().indexOf(query) !== -1;
    });
  };

  OperationsDashboard.prototype._renderHistoryList = function () {
    var that = this;
    if (!this.$historyList || !this.$historyStatus) {
      return;
    }

    var visible = this._visibleHistories();
    var historyParentName = normalizeHistoryParentName(
      this.properties().getValue('historyParentName')
    );
    this.$historyStatus.text(
      visible.length + ' of ' + this.$histories.length +
      ' histories' + (historyParentName ? ' from "' + historyParentName + '"' : '') +
      '. Drag one to the chart or use +.'
    );
    this.$historyList.empty();

    if (!visible.length) {
      this.$historyList.append(
        $('<div class="bask-od-empty"></div>').text(
          this.$historySearchText ? 'No histories match this search.' : 'No readable histories were found.'
        )
      );
      return;
    }

    visible.forEach(function (history) {
      var $row = $('<div class="bask-od-history-row" draggable="true"></div>');
      var $main = $('<div class="bask-od-row-main"></div>').append(
        $('<div class="bask-od-row-name"></div>').text(history.displayName || history.historyName),
        $('<div class="bask-od-row-meta"></div>').text(
          (history.device ? history.device + ' / ' : '') + history.historyName
        )
      );
      var $add = $('<button type="button" class="bask-od-add" title="Add to chart" aria-label="Add to chart">+</button>')
        .on('click', function (event) {
          event.stopPropagation();
          that._addHistory(history);
        });

      $row.on('dblclick', function () {
        that._addHistory(history);
      });
      $row.on('dragstart', function (event) {
        var transfer = event.originalEvent && event.originalEvent.dataTransfer;
        if (!transfer) {
          return;
        }
        transfer.effectAllowed = 'copy';
        transfer.setData('application/x-basidekick-history', JSON.stringify(history));
        transfer.setData('text/plain', history.ord);
      });
      $row.append($main, $add);
      that.$historyList.append($row);
    });
  };

  OperationsDashboard.prototype._handleHistoryDrop = function (dataTransfer) {
    if (!dataTransfer) {
      return;
    }
    var raw = '';
    try {
      raw = dataTransfer.getData('application/x-basidekick-history');
    } catch (ignored0) {}
    if (raw) {
      try {
        this._addHistory(JSON.parse(raw));
        return;
      } catch (ignored1) {}
    }

    try {
      raw = dataTransfer.getData('text/plain');
    } catch (ignored2) {
      raw = '';
    }
    raw = asString(raw).trim();
    if (!raw) {
      return;
    }
    var match = this.$histories.filter(function (history) {
      return history.ord === raw;
    })[0];
    if (match) {
      this._addHistory(match);
    }
  };

  OperationsDashboard.prototype._addHistory = function (history) {
    var existing = this.$series.some(function (series) {
      return series.ord === history.ord;
    });
    if (existing) {
      this.$chartStatus.text((history.displayName || history.historyName) + ' is already charted.');
      return;
    }
    if (this.$series.length >= MAX_CHART_SERIES) {
      this.$chartStatus.text('The chart supports up to ' + MAX_CHART_SERIES + ' histories at once.');
      return;
    }

    if (!this.$series.length) { this.$analysisRange = TrendAnalysis.range(this.$period); this._loadTrendEvents(); }
    var series = {
      ord: history.ord,
      name: history.displayName || history.historyName || history.ord,
      device: history.device || '',
      color: SERIES_COLORS[this.$series.length % SERIES_COLORS.length],
      data: [],
      loading: true,
      error: '',
      loadSequence: 0
    };
    this.$series.push(series);
    if (this.$dom && this.$dom.hasClass('bask-od-narrow')) {
      this.$dom.addClass('bask-od-browser-collapsed');this.$browseToggle.attr('aria-expanded','false');
    }
    this._renderLegend();
    this._loadSeries(series);
  };

  OperationsDashboard.prototype._restoreChart = function (period, definitions, analysis) {
    if (this.$analysis) this.$analysis.set(analysis);
    this.$series.forEach(function (series) { series.loadSequence++; });
    this.$period = period;
    this.$periodSelect.val(period);
    this.$series = definitions.map(function (item) {
      return { ord: item.ord, name: item.name, color: item.color, device: '', data: [], loading: true, error: '', loadSequence: 0 };
    });
    this._renderLegend();
    this._reloadSeries();
  };

  OperationsDashboard.prototype._reloadSeries = function () {
    var that = this;
    this.$analysisRange = TrendAnalysis.range(this.$period);
    this._loadTrendEvents();
    this.$series.forEach(function (series) {
      that._loadSeries(series);
    });
    if (!this.$series.length) {
      this._drawChart();
    }
  };

  OperationsDashboard.prototype._loadTrendEvents = function () {
    var that=this,sequence=++this.$trendEventSequence,range=this.$analysisRange||TrendAnalysis.range(this.$period),scope=asString(this.properties().getValue('overviewScopeOrd'))||'station:|slot:/';
    if (this.properties().getValue('showTrendEvents') === false) { this.$trendEvents=[]; return; }
    Promise.all([
      baja.rpc({typeSpec:'basidekick:DiagnosticsRpc',method:'recentChanges',args:[scope,String(range.start),String(range.end)]}).then(parseRpcJson).catch(function(){return{rows:[]};}),
      baja.rpc({typeSpec:'basidekick:OperationsDashboardRpc',method:'listOpenAlarms',args:[]}).then(parseRpcJson).catch(function(){return{alarms:[]};}),
      baja.rpc({typeSpec:'basidekick:OperationsDashboardRpc',method:'listSchedules',args:[]}).then(parseRpcJson).catch(function(){return{schedules:[]};})
    ]).then(function(all){if(that.$destroyed||sequence!==that.$trendEventSequence)return;var events=[];(all[0].rows||[]).forEach(function(x){events.push({time:Number(x.time),type:'operator',label:(x.user||'Operator')+' · '+x.operation});});(all[1].alarms||[]).forEach(function(x){var t=new Date(x.timestamp).getTime();if(Number.isFinite(t))events.push({time:t,type:'alarm',label:x.displayName||'Alarm'});});(all[2].schedules||[]).forEach(function(x){if(x.nextEventMillis)events.push({time:Number(x.nextEventMillis),type:'schedule',label:x.displayName||'Schedule'});});that.$trendEvents=events.filter(function(x){return x.time>=range.start&&x.time<range.end;});that._drawChart();});
  };

  OperationsDashboard.prototype._queueHistoryRead = function (read) {
    var that = this;
    this.$historyQueue = this.$historyQueue || [];
    this.$historyInFlight = this.$historyInFlight || 0;
    return new Promise(function (resolve,reject) {
      that.$historyQueue.push({read:read,resolve:resolve,reject:reject});
      that._drainHistoryReads();
    });
  };
  OperationsDashboard.prototype._drainHistoryReads = function () {
    var that = this;
    while (this.$historyInFlight < 2 && this.$historyQueue.length) {
      var request = this.$historyQueue.shift();
      if (this.$destroyed) { request.reject(new Error('Widget closed')); continue; }
      this.$historyInFlight++;
      (function (item) {
        Promise.resolve().then(item.read).then(item.resolve,item.reject).then(function () {
          that.$historyInFlight--; that._drainHistoryReads();
        });
      }(request));
    }
  };

  OperationsDashboard.prototype._loadSeries = function (series) {
    var that = this, sequence = ++series.loadSequence;
    var range = this.$analysisRange || TrendAnalysis.range(this.$period);
    this.$analysisRange = range;
    var compare = this.$analysis.value.compare;
    series.loading = true; series.error = ''; series.data = []; series.samples = [];
    series.previous = null; series.comparisonError = ''; series.range = range;
    this._renderLegend(); this._drawChart();
    function query(start,end) {
      return that._queueHistoryRead(function () {
        if (that.$destroyed || sequence !== series.loadSequence) return Promise.reject(new Error("Superseded history request"));
        return baja.rpc({typeSpec:'basidekick:DiagnosticsRpc',method:'historySamples',args:[series.ord,String(start),String(end)]}).then(parseRpcJson);
      });
    }
    return query(range.start,range.end).then(function (data) {
      if (that.$destroyed || sequence !== series.loadSequence) return;
      series.samples = data.rows; series.units = TrendAnalysis.unitLabel(data.units); series.truncated = data.truncated;
      var breakBefore = true;
      series.data = [];
      data.rows.forEach(function (r) {
        if (!r[2] || r[1] === null || !Number.isFinite(r[1])) { breakBefore = true; return; }
        series.data.push({time:r[0],value:r[1],displayValue:shortNumber(r[1])+(series.units?' '+series.units:''),breakBefore:breakBefore});
        breakBefore = false;
      });
      if (!compare) return;
      var duration = range.end-range.start;
      return query(range.start-duration,range.start).then(function (previous) {
        previous.units = TrendAnalysis.unitLabel(previous.units);
        if (!that.$destroyed && sequence === series.loadSequence) series.previous = previous;
      }).catch(function (e) { if (sequence === series.loadSequence) series.comparisonError = formatError(e,'Previous period unavailable'); });
    }).then(function () {
      if (that.$destroyed || sequence !== series.loadSequence) return;
      series.loading = false;
      that._renderLegend(); that._drawChart();
    }).catch(function (e) {
      if (that.$destroyed || sequence !== series.loadSequence) return;
      series.loading = false; series.data = []; series.samples = []; series.error = formatError(e,'History unavailable');
      that._renderLegend(); that._drawChart();
    });
  };

  OperationsDashboard.prototype._removeSeries = function (series) {
    var index = this.$series.indexOf(series);
    if (index >= 0) {
      series.loadSequence++;
      this.$series.splice(index, 1);
      this._renderLegend();
      this._drawChart();
    }
  };

  OperationsDashboard.prototype._renderLegend = function () {
    var that = this;
    if (!this.$chartLegend) {
      return;
    }
    this.$chartLegend.empty();
    if (!this.$series.length) {
      this.$chartLegend.append(
        $('<span style="font-size:11px;color:var(--od-muted)">No histories selected</span>')
      );
      return;
    }

    this.$series.forEach(function (series) {
      var label = series.name;
      if (series.loading) {
        label += ' (loading)';
      }
      else if (series.error) {
        label += ' (' + series.error + ')';
      }
      var $item = $('<div class="bask-od-legend-item"></div>').append(
        $('<span class="bask-od-legend-swatch"></span>').css('backgroundColor', series.color),
        $('<span class="bask-od-legend-name"></span>').text(label),
        $('<button type="button" class="bask-od-legend-remove" title="Remove series">×</button>')
          .on('click', function () {
            that._removeSeries(series);
          })
      );
      that.$chartLegend.append($item);
    });
  };

  OperationsDashboard.prototype._hideChartTooltip = function () {
    if (this.$chartTooltip) {
      this.$chartTooltip.hide().attr('aria-hidden', 'true');
    }
  };

  OperationsDashboard.prototype._showChartTooltip = function (event) {
    if (!this.$chartTooltip || !this.$chartScale ||
        !this.$chartCanvas || !this.$chartCanvas[0]) {
      this._hideChartTooltip();
      return;
    }

    var sourceEvent = event.originalEvent || event;
    var rect = this.$chartCanvas[0].getBoundingClientRect();
    var mouseX = sourceEvent.clientX - rect.left;
    var mouseY = sourceEvent.clientY - rect.top;
    var scale = this.$chartScale;
    if (mouseX < scale.plot.left || mouseX > scale.plot.right ||
        mouseY < scale.plot.top || mouseY > scale.plot.bottom) {
      this._hideChartTooltip();
      return;
    }

    var hoverTime = scale.timeMin +
      ((mouseX - scale.plot.left) / (scale.plot.right - scale.plot.left)) *
      (scale.timeMax - scale.timeMin);
    var entries = [];
    this.$series.forEach(function (series) {
      if (!series.loading && !series.error && series.data.length) {
        entries.push({
          series: series,
          point: nearestSample(series.data, hoverTime)
        });
      }
    });
    if (!entries.length) {
      this._hideChartTooltip();
      return;
    }

    this.$chartTooltip.empty().append(
      $('<div class="bask-od-chart-tooltip-title"></div>').text(
        new Date(hoverTime).toLocaleString()
      )
    );
    entries.forEach(function (entry) {
      this.$chartTooltip.append(
        $('<div class="bask-od-chart-tooltip-row"></div>').append(
          $('<span class="bask-od-chart-tooltip-swatch"></span>')
            .css('backgroundColor', entry.series.color),
          $('<span class="bask-od-chart-tooltip-name"></span>').text(entry.series.name),
          $('<span class="bask-od-chart-tooltip-value"></span>').text(
            entry.point.displayValue || shortNumber(entry.point.value)
          )
        )
      );
    }, this);

    this.$chartTooltip.show().attr('aria-hidden', 'false');
    var tooltipWidth = this.$chartTooltip.outerWidth();
    var tooltipHeight = this.$chartTooltip.outerHeight();
    var left = mouseX + 12;
    var top = mouseY + 12;
    if (left + tooltipWidth > scale.width - 4) {
      left = mouseX - tooltipWidth - 12;
    }
    if (top + tooltipHeight > scale.height - 4) {
      top = mouseY - tooltipHeight - 12;
    }
    this.$chartTooltip.css({
      left: Math.max(4, Math.min(left, scale.width - tooltipWidth - 4)),
      top: Math.max(4, Math.min(top, scale.height - tooltipHeight - 4))
    });
  };

  OperationsDashboard.prototype._drawChart = function () {
    if (this.$analysis) this.$analysis.render();
    if (!this.$chartCanvas || !this.$chartCanvas[0]) {
      return;
    }
    this.$chartScale = null;
    this._hideChartTooltip();
    var canvas = this.$chartCanvas[0];
    var width = Math.floor(this.$chartCanvas.width());
    var height = Math.floor(this.$chartCanvas.height());
    if (width < 60 || height < 60) {
      return;
    }

    var ratio = window.devicePixelRatio || 1;
    canvas.width = Math.max(1, Math.floor(width * ratio));
    canvas.height = Math.max(1, Math.floor(height * ratio));
    var context = canvas.getContext('2d');
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);

    var allPoints = [];
    this.$series.forEach(function (series) {
      if (!series.loading && !series.error) {
        allPoints = allPoints.concat(series.data);
      }
    });

    var loadingCount = this.$series.filter(function (series) { return series.loading; }).length;
    var errorCount = this.$series.filter(function (series) { return !!series.error; }).length;
    if (!this.$series.length) {
      this.$chartEmpty.show().children().first().text(
        'Drag a history here, double-click it, or use the + button to begin charting.'
      );
      this.$chartStatus.text('No histories selected.');
      return;
    }
    if (!allPoints.length) {
      this.$chartEmpty.show().children().first().text(
        loadingCount ? 'Loading history samples...' :
          'No chartable samples were returned. Numeric, boolean, and enum histories are supported.'
      );
      this.$chartStatus.text(
        loadingCount ? 'Loading ' + loadingCount + ' histor' + (loadingCount === 1 ? 'y.' : 'ies.') :
          errorCount + ' histor' + (errorCount === 1 ? 'y needs' : 'ies need') + ' attention.'
      );
      return;
    }
    this.$chartEmpty.hide();

    var timeMin = allPoints[0].time;
    var timeMax = allPoints[0].time;
    var valueMin = allPoints[0].value;
    var valueMax = allPoints[0].value;
    allPoints.forEach(function (point) {
      timeMin = Math.min(timeMin, point.time);
      timeMax = Math.max(timeMax, point.time);
      valueMin = Math.min(valueMin, point.value);
      valueMax = Math.max(valueMax, point.value);
    });
    if (timeMin === timeMax) {
      timeMin -= 60000;
      timeMax += 60000;
    }
    if (valueMin === valueMax) {
      var valuePad = Math.abs(valueMin) * 0.1 || 1;
      valueMin -= valuePad;
      valueMax += valuePad;
    }
    else {
      var rangePad = (valueMax - valueMin) * 0.08;
      valueMin -= rangePad;
      valueMax += rangePad;
    }

    var unitGroups = {};
    this.$series.forEach(function(series){if(series.loading||series.error||!series.data.length)return;var key=series.units||'No units';if(!unitGroups[key])unitGroups[key]={key:key,min:series.data[0].value,max:series.data[0].value,index:Object.keys(unitGroups).length};series.data.forEach(function(point){unitGroups[key].min=Math.min(unitGroups[key].min,point.value);unitGroups[key].max=Math.max(unitGroups[key].max,point.value);});});
    var groupList=Object.keys(unitGroups).map(function(key){var g=unitGroups[key];if(g.min===g.max){var p=Math.abs(g.min)*.1||1;g.min-=p;g.max+=p;}else{var p2=(g.max-g.min)*.08;g.min-=p2;g.max+=p2;}return g;});
    var ui = this._ui();
    var plot = { left: 54, top: 16, right: width - 16, bottom: height - 34 };
    var plotWidth = Math.max(1, plot.right - plot.left);
    var plotHeight = Math.max(1, plot.bottom - plot.top);
    var x = function (time) {
      return plot.left + ((time - timeMin) / (timeMax - timeMin)) * plotWidth;
    };
    var laneGap=groupList.length>1?14:0,laneHeight=(plotHeight-laneGap*Math.max(0,groupList.length-1))/Math.max(1,groupList.length);
    var y = function (series,value) {
      var g=unitGroups[series.units||'No units'];var bottom=plot.top+(g.index+1)*laneHeight+g.index*laneGap;
      return bottom-((value-g.min)/(g.max-g.min))*laneHeight;
    };
    this.$chartScale = {
      plot: plot,
      timeMin: timeMin,
      timeMax: timeMax,
      width: width,
      height: height
    };

    context.font = '10px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif';
    context.lineWidth = 1;
    context.strokeStyle = ui.border;
    context.fillStyle = ui.muted;
    context.textBaseline = 'middle';
    context.textAlign = 'right';
    var gridIndex;
    groupList.forEach(function(group){var top=plot.top+group.index*(laneHeight+laneGap);context.textAlign='left';context.fillText(group.key,plot.left+4,top+7);context.textAlign='right';[0,1,2].forEach(function(i){var gridY=top+laneHeight*i/2,gridValue=group.max-(group.max-group.min)*i/2;context.beginPath();context.moveTo(plot.left,gridY);context.lineTo(plot.right,gridY);context.stroke();context.fillText(shortNumber(gridValue),plot.left-8,gridY);});});

    context.textAlign = 'center';
    context.textBaseline = 'top';
    for (gridIndex = 0; gridIndex <= 4; gridIndex++) {
      var gridX = plot.left + (plotWidth * gridIndex / 4);
      var tickTime = new Date(timeMin + ((timeMax - timeMin) * gridIndex / 4));
      context.beginPath();
      context.moveTo(gridX, plot.top);
      context.lineTo(gridX, plot.bottom);
      context.stroke();
      context.fillText(
        this.$period === 'last24Hours' ?
          tickTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) :
          tickTime.toLocaleDateString([], { month: 'short', day: 'numeric' }),
        gridX,
        plot.bottom + 8
      );
    }

    var maxGap = this.$analysis.value.gapMinutes * 60000;
    (this.$trendEvents||[]).forEach(function(event){var colors={alarm:'#cf1624',schedule:'#7c3aed',operator:'#0f766e'};context.strokeStyle=colors[event.type]||ui.muted;context.lineWidth=1;context.setLineDash([3,3]);context.beginPath();context.moveTo(x(event.time),plot.top);context.lineTo(x(event.time),plot.bottom);context.stroke();context.setLineDash([]);});
    context.fillStyle='rgba(148,163,184,.13)';
    this.$series.forEach(function(series){if(series.loading||series.error)return;series.data.forEach(function(point,index){if(index===0)return;var previous=series.data[index-1];if(point.breakBefore||point.time-previous.time>maxGap){context.fillRect(x(previous.time),plot.top,Math.max(2,x(point.time)-x(previous.time)),plotHeight);}});});
    this.$series.forEach(function (series) {
      if (series.loading || series.error || !series.data.length) {
        return;
      }
      context.beginPath();
      context.strokeStyle = series.color;
      context.lineWidth = 2;
      context.lineJoin = 'round';
      context.lineCap = 'round';
      series.data.forEach(function (point, index) {
        if (index === 0 || point.breakBefore || point.time - series.data[index - 1].time > maxGap) {
          context.moveTo(x(point.time), y(series,point.value));
        }
        else {
          context.lineTo(x(point.time), y(series,point.value));
        }
      });
      context.stroke();

      {
        context.fillStyle = series.color;
        series.data.forEach(function (point, index) {
          if (series.data.length > 60 && index > 0 && !point.breakBefore && point.time - series.data[index-1].time <= maxGap) return;
          context.beginPath();
          context.arc(x(point.time), y(series,point.value), 2.2, 0, Math.PI * 2);
          context.fill();
        });
      }
      if (this.$analysis.value.showExtrema) {
        var low=series.data[0],high=series.data[0];series.data.forEach(function(point){if(point.value<low.value)low=point;if(point.value>high.value)high=point;});context.fillStyle=series.color;[low,high].forEach(function(point){context.beginPath();context.arc(x(point.time),y(series,point.value),4,0,Math.PI*2);context.fill();context.strokeStyle=ui.surface;context.lineWidth=1.5;context.stroke();});
      }
    }, this);

    var readyCount = this.$series.length - loadingCount - errorCount;
    this.$chartStatus.text(
      readyCount + ' active series' +
      (loadingCount ? ', ' + loadingCount + ' loading' : '') +
      (errorCount ? ', ' + errorCount + ' with no data or errors' : '') + '.'
    );
  };

  OperationsDashboard.prototype._mapAlarmRow = function (alarm) {
    alarm = alarm || {};
    var groups = [STATUS_GROUPS[0]];
    var acknowledged = alarm.acknowledged === true || asString(alarm.acknowledged) === 'true';
    var ackPending = alarm.ackPending === true || asString(alarm.ackPending) === 'true';
    if (!acknowledged && !ackPending) {
      groups.push(STATUS_GROUPS[1]);
    }
    return {
      rowType: 'alarm',
      uuid: asString(alarm.uuid),
      displayName: asString(alarm.displayName) || asString(alarm.sourceOrd),
      slotPath: asString(alarm.sourceOrd),
      ord: asString(alarm.sourceOrd),
      value: asString(alarm.value),
      priority: Number(alarm.priority),
      alarmClass: asString(alarm.alarmClassDisplayName) || asString(alarm.alarmClass),
      alarmClassKey: asString(alarm.alarmClass),
      sourceState: asString(alarm.sourceState),
      ackState: asString(alarm.ackState),
      acknowledged: acknowledged,
      ackPending: ackPending,
      timestamp: asString(alarm.timestamp),
      message: asString(alarm.message),
      instructions: asString(alarm.instructions),
      notes: asString(alarm.notes),
      canAddNote: !!alarm.canAddNote,
      groups: groups
    };
  };

  OperationsDashboard.prototype._loadHealth = function () {
    var that = this;
    var sequence = ++this.$healthLoadSequence;
    this.$healthLoading = true;
    this.$openNoteUuid = '';
    clearTimeout(this.$healthTimer);
    if (this.$healthRefresh) {
      this.$healthRefresh.prop('disabled', true).text('Loading...');
    }
    if (this.$healthStatus) {
      this.$healthStatus.text(
        this.$healthRows.length || this.$alarmRows.length ?
          'Refreshing point health...' :
          'Scanning station points for non-normal statuses...'
      );
    }
    if (this.$healthContent && !this.$healthRows.length && !this.$alarmRows.length) {
      this.$healthContent.empty().append(
        $('<div class="bask-od-empty"></div>').text('Loading point health...')
      );
    }

    var finish = function () {
      if (that.$destroyed || sequence !== that.$healthLoadSequence) {
        return false;
      }
      that.$healthLoading = false;
      if (that.$healthRefresh) {
        that.$healthRefresh.prop('disabled', false).text('Refresh');
      }
      that._scheduleHealthRefresh();
      return true;
    };

    callRpc('listPointHealth', []).then(function (result) {
      if (that.$destroyed || sequence !== that.$healthLoadSequence) {
        return;
      }
      var payload = parseRpcJson(result);
      var points = payload && Array.isArray(payload.points) ? payload.points : [];
      var rows = points.map(function (point) {
        var keys = Array.isArray(point.groups) ? point.groups : [];
        return {
          displayName: asString(point.displayName),
          slotPath: asString(point.slotPath),
          ord: asString(point.ord),
          value: asString(point.value),
          canRelease: !!point.canRelease,
          groups: STATUS_GROUPS.filter(function (group) {
            return keys.indexOf(group.key) !== -1;
          })
        };
      }).filter(function (point) {
        return point.groups.length > 0;
      });
      rows.sort(function (left, right) {
        return left.displayName.localeCompare(right.displayName);
      });
      that.$healthRows = rows;
      that.$healthCounts = payload && payload.counts && typeof payload.counts === 'object' ?
        payload.counts :
        {};
      that.$healthTotalCount = Number(payload && payload.total);
      if (!isFinite(that.$healthTotalCount) || that.$healthTotalCount < rows.length) {
        that.$healthTotalCount = rows.length;
      }
      that.$healthLoaded = true;
      finish();
      try {
        that._renderHealth();
      }
      catch (err) {
        console.error('[OperationsDashboard] Health render failed:', err);
      }
      that._loadOpenAlarms(sequence);
    }, function (err) {
      if (!finish()) {
        return;
      }
      that.$healthLoaded = false;
      that.$healthRows = [];
      that.$healthCounts = {};
      that.$healthTotalCount = 0;
      that.$alarmRows = [];
      that.$alarmDataAvailable = false;
      if (that.$healthStatus) {
        that.$healthStatus.text('Unable to query point health.');
      }
      if (that.$healthContent) {
        that.$healthContent.empty().append(
          $('<div class="bask-od-empty"></div>').text(formatError(err, 'Point health query failed.'))
        );
      }
      console.error('[OperationsDashboard] Point health query failed:', err);
    });
  };

  OperationsDashboard.prototype._loadOpenAlarms = function (sequence) {
    var that = this;
    callRpc('listOpenAlarms', []).then(function (result) {
      if (that.$destroyed || sequence !== that.$healthLoadSequence) {
        return;
      }
      var payload = parseRpcJson(result);
      var alarms = payload && Array.isArray(payload.alarms) ? payload.alarms : [];
      var mapped = [];
      alarms.forEach(function (alarm) {
        try {
          mapped.push(that._mapAlarmRow(alarm));
        }
        catch (err) {
          console.error('[OperationsDashboard] Alarm row mapping failed:', err);
        }
      });
      that.$alarmRows = mapped;
      that.$alarmDataAvailable = mapped.length > 0;
      try {
        that._renderHealth();
      }
      catch (err) {
        console.error('[OperationsDashboard] Health alarm render failed:', err);
      }
      if (payload && payload.error) {
        that._showAlarmQueryError(payload.error);
      }
    }, function (err) {
      if (that.$destroyed || sequence !== that.$healthLoadSequence) {
        return;
      }
      that.$alarmRows = [];
      that.$alarmDataAvailable = false;
      that._showAlarmQueryError(err);
    });
  };

  OperationsDashboard.prototype._showAlarmQueryError = function (err) {
    var message = 'Open alarms unavailable: ' + formatError(err, 'query failed') + '.';
    console.error('[OperationsDashboard] Open alarm query failed:', err);
    if (!this.$healthStatus) {
      return;
    }
    var current = asString(this.$healthStatus.text()).trim();
    if (current.indexOf('Open alarms unavailable') !== -1) {
      return;
    }
    this.$healthStatus.text(current ? current + ' ' + message : message);
  };

  OperationsDashboard.prototype._scheduleHealthRefresh = function () {
    var that = this;
    clearTimeout(this.$healthTimer);
    if (this.$activeTab !== 'health' || this.$destroyed || this.$openNoteUuid) {
      return;
    }
    var seconds = Number(this.properties().getValue('healthRefreshSeconds'));
    if (!isFinite(seconds) || seconds < 10) {
      seconds = 30;
    }
    this.$healthTimer = setTimeout(function () {
      that._loadHealth();
    }, seconds * 1000);
  };

  OperationsDashboard.prototype._healthRowsForGroup = function (group) {
    var useAlarmRecords =
      (group.key === 'alarm' || group.key === 'unackedAlarm') &&
      this.$alarmDataAvailable &&
      this.$alarmRows.length > 0;
    var sourceRows = useAlarmRecords ?
      this._sortAlarmRows(this.$alarmRows) :
      this.$healthRows;
    return sourceRows.filter(function (row) {
      return row.groups && row.groups.some(function (rowGroup) {
        return rowGroup.key === group.key;
      });
    });
  };

  OperationsDashboard.prototype._healthCountForGroup = function (group, rows) {
    if ((group.key === 'alarm' || group.key === 'unackedAlarm') &&
      this.$alarmDataAvailable) {
      return rows.length;
    }
    var counted = this.$healthCounts ? Number(this.$healthCounts[group.key]) : 0;
    if (isFinite(counted) && counted > rows.length) {
      return counted;
    }
    return rows.length;
  };

  OperationsDashboard.prototype._sortAlarmRows = function (rows) {
    var sort = this.$alarmSort || 'class';
    return rows.slice().sort(function (left, right) {
      if (sort === 'priority') {
        var priorityResult = (left.priority || 0) - (right.priority || 0);
        if (priorityResult !== 0) {
          return priorityResult;
        }
        return asString(right.timestamp).localeCompare(asString(left.timestamp));
      }
      if (sort === 'time') {
        return asString(right.timestamp).localeCompare(asString(left.timestamp));
      }
      var classResult = asString(left.alarmClass).localeCompare(asString(right.alarmClass));
      if (classResult !== 0) {
        return classResult;
      }
      var classPriority = (left.priority || 0) - (right.priority || 0);
      if (classPriority !== 0) {
        return classPriority;
      }
      return asString(right.timestamp).localeCompare(asString(left.timestamp));
    });
  };

  OperationsDashboard.prototype._acknowledgeAlarm = function (row, $button) {
    var that = this;
    $button.prop('disabled', true).text('Acknowledging...');
    callRpc('acknowledgeAlarm', [row.uuid]).then(function () {
      if (that.$destroyed) {
        return;
      }
      that.$healthStatus.text('Alarm acknowledgement submitted.');
      that._loadHealth();
    }).catch(function (err) {
      if (that.$destroyed) {
        return;
      }
      $button.prop('disabled', false).text('Acknowledge');
      that.$healthStatus.text(
        'Unable to acknowledge alarm: ' + formatError(err, 'permission denied or alarm unavailable')
      );
      console.error('[OperationsDashboard] Alarm acknowledgement failed:', row.uuid, err);
    });
  };

  OperationsDashboard.prototype._addAlarmNote = function (row, note, $save) {
    var that = this;
    $save.prop('disabled', true).text('Saving...');
    callRpc('addAlarmNote', [row.uuid, note]).then(function () {
      if (that.$destroyed) {
        return;
      }
      that.$openNoteUuid = '';
      that.$healthStatus.text('Alarm note saved.');
      that._loadHealth();
    }).catch(function (err) {
      if (that.$destroyed) {
        return;
      }
      $save.prop('disabled', false).text('Save note');
      that.$healthStatus.text(
        'Unable to add alarm note: ' + formatError(err, 'permission denied or alarm unavailable')
      );
      console.error('[OperationsDashboard] Alarm note failed:', row.uuid, err);
    });
  };

  OperationsDashboard.prototype._releaseOverride = function (row, $button) {
    var that = this;
    $button.prop('disabled', true).text('Releasing...');
    callRpc('releaseOverride', [row.ord]).then(function () {
      if (that.$destroyed) {
        return;
      }
      that.$healthStatus.text('Override release requested.');
      setTimeout(function () {
        if (!that.$destroyed) {
          that._loadHealth();
        }
      }, 500);
    }).catch(function (err) {
      if (that.$destroyed) {
        return;
      }
      $button.prop('disabled', false).text('Release override');
      that.$healthStatus.text(
        'Unable to release override: ' + formatError(err, 'permission denied or point unavailable')
      );
      console.error('[OperationsDashboard] Override release failed:', row.ord, err);
    });
  };

  OperationsDashboard.prototype._renderAlarmRow = function (row, group) {
    var that = this;
    var meta = [
      isFinite(row.priority) ? 'Priority ' + row.priority : '',
      row.alarmClass,
      row.sourceState,
      row.ackPending ? 'ack pending' : row.ackState,
      row.timestamp
    ].filter(function (item) {
      return !!item;
    }).join(' · ');

    var $main = $('<span class="bask-od-row-main"></span>').append(
      $('<span class="bask-od-row-name"></span>').text(row.displayName),
      $('<span class="bask-od-row-meta"></span>').text(meta || row.slotPath)
    );
    if (row.message) {
      $main.append(
        $('<span class="bask-od-alarm-message"></span>')
          .text(row.message)
          .attr('title', [
            row.message,
            row.instructions ? 'Instructions: ' + row.instructions : '',
            row.notes ? 'Notes: ' + row.notes : ''
          ].filter(function (item) {
            return !!item;
          }).join('\n'))
      );
    }
    if (row.notes) {
      $main.append(
        $('<span class="bask-od-alarm-message"></span>').text(row.notes.split('\n')[0])
      );
    }

    var $actions = $('<span class="bask-od-alarm-actions"></span>');
    if (row.ord) {
      var $open = $('<button type="button" class="bask-od-inline-action">Open source</button>')
        .on('click', function (event) {
          event.preventDefault();
          event.stopPropagation();
          navigateToOrd(
            navigationOrdWithView(row.ord, 'webEditors:MultiSheet')
          ).catch(function (err) {
            console.error('[OperationsDashboard] Alarm source navigation failed:', row.ord, err);
          });
        });
      $actions.append($open);
    }
    if (!row.acknowledged && !row.ackPending) {
      var $ack = $('<button type="button" class="bask-od-inline-action">Acknowledge</button>')
        .on('click', function (event) {
          event.preventDefault();
          event.stopPropagation();
          that._acknowledgeAlarm(row, $ack);
        });
      $actions.append($ack);
    }
    if (row.canAddNote) {
      var $note = $('<button type="button" class="bask-od-inline-action">Add note</button>')
        .on('click', function (event) {
          event.preventDefault();
          event.stopPropagation();
          var opening = that.$openNoteUuid !== row.uuid;
          that.$openNoteUuid = opening ? row.uuid : '';
          that.$healthContent.find('.bask-od-note-editor').remove();
          if (opening) {
            $row.append(that._noteEditor(row, $row));
            that._focusOpenNote();
          }
        });
      $actions.append($note);
    }

    var $row = $('<div class="bask-od-health-row bask-od-alarm-row"></div>')
      .attr('title', row.slotPath)
      .append(
        $('<span class="bask-od-dot"></span>').css('backgroundColor', group.color),
        $main,
        $('<span class="bask-od-row-value"></span>').text(row.value),
        $actions
      );

    if (this.$openNoteUuid === row.uuid) {
      $row.append(this._noteEditor(row, $row));
    }

    return $row;
  };

  OperationsDashboard.prototype._noteEditor = function (row, $row) {
    var that = this;
    var $input = $('<textarea class="bask-od-note-input" maxlength="2000" placeholder="Add an operator note"></textarea>');
    var $save = $('<button type="button" class="bask-od-inline-action">Save note</button>')
      .on('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        that._addAlarmNote(row, asString($input.val()).trim(), $save);
      });
    var $cancel = $('<button type="button" class="bask-od-inline-action">Cancel</button>')
      .on('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        that.$openNoteUuid = '';
        if ($row && $row.length) {
          $row.find('.bask-od-note-editor').remove();
        }
      });
    var $editor = $('<div class="bask-od-note-editor"></div>');
    if (row.notes) {
      $editor.append(
        $('<div class="bask-od-note-existing"></div>').text(row.notes)
      );
    }
    $editor.append(
      $input,
      $('<div class="bask-od-note-actions"></div>').append($cancel, $save)
    );
    return $editor;
  };

  OperationsDashboard.prototype._focusOpenNote = function () {
    var that = this;
    if (!this.$healthContent) {
      return;
    }
    setTimeout(function () {
      if (that.$destroyed || !that.$healthContent) {
        return;
      }
      var input = that.$healthContent.find('.bask-od-note-input')[0];
      if (input && typeof input.focus === 'function') {
        input.focus();
      }
    }, 0);
  };

  OperationsDashboard.prototype._renderOverrideRow = function (row, group) {
    var that = this;
    var $open = $('<button type="button" class="bask-od-inline-action">Open point</button>')
      .on('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        navigateToOrd(
          navigationOrdWithView(row.ord, 'webEditors:MultiSheet')
        ).catch(function (err) {
          console.error('[OperationsDashboard] Override source navigation failed:', row.ord, err);
        });
      });
    var $release = $('<button type="button" class="bask-od-inline-action">Release override</button>')
      .on('click', function (event) {
        event.preventDefault();
        event.stopPropagation();
        that._releaseOverride(row, $release);
      });
    return $('<div class="bask-od-health-row bask-od-alarm-row"></div>')
      .attr('title', row.slotPath)
      .append(
        $('<span class="bask-od-dot"></span>').css('backgroundColor', group.color),
        $('<span class="bask-od-row-main"></span>').append(
          $('<span class="bask-od-row-name"></span>').text(row.displayName),
          $('<span class="bask-od-row-meta"></span>').text(row.slotPath)
        ),
        $('<span class="bask-od-row-value"></span>').text(row.value),
        $('<span class="bask-od-alarm-actions"></span>').append($open, $release)
      );
  };

  OperationsDashboard.prototype._renderHealth = function () {
    if (!this.$healthContent || !this.$healthTabs) {
      return;
    }
    try {
      this._renderHealthBody();
    }
    catch (err) {
      console.error('[OperationsDashboard] Health render failed:', err);
      if (this.$healthStatus) {
        this.$healthStatus.text(
          'Unable to render Health tab: ' + formatError(err, 'render failed')
        );
      }
    }
  };

  OperationsDashboard.prototype._renderHealthBody = function () {
    var that = this;
    if (!this.$healthContent || !this.$healthTabs) {
      return;
    }
    this.$healthTabs.empty();
    this.$healthContent.empty();
    if (!this.$healthRows.length && !this.$alarmRows.length) {
      this.$healthStatus.text('No non-normal control point statuses were found.');
      this.$healthTabs.hide();
      if (this.$alarmSortSelect) {
        this.$alarmSortSelect.hide();
      }
      this.$healthContent.append(
        $('<div class="bask-od-empty"></div>').text('All readable control points are reporting normal status.')
      );
      return;
    }

    this.$healthTabs.show();
    var membershipCount = 0;
    var availableGroups = STATUS_GROUPS.map(function (group) {
      var groupRows = that._healthRowsForGroup(group);
      var count = that._healthCountForGroup(group, groupRows);
      membershipCount += count;
      return {
        group: group,
        rows: groupRows,
        count: count
      };
    }).filter(function (entry) {
      return entry.count > 0;
    });

    var activeEntry = availableGroups.filter(function (entry) {
      return entry.group.key === that.$healthActiveGroup;
    })[0] || availableGroups[0];
    if (!activeEntry) {
      this.$healthStatus.text('No non-normal control point statuses were found.');
      this.$healthTabs.hide();
      if (this.$alarmSortSelect) {
        this.$alarmSortSelect.hide();
      }
      return;
    }
    this.$healthActiveGroup = activeEntry.group.key;
    if (this.$alarmSortSelect) {
      if (this.$alarmDataAvailable &&
        (this.$healthActiveGroup === 'alarm' || this.$healthActiveGroup === 'unackedAlarm')) {
        this.$alarmSortSelect.show();
      }
      else {
        this.$alarmSortSelect.hide();
      }
    }

    availableGroups.forEach(function (entry) {
      var group = entry.group;
      var $button = $('<button type="button" class="bask-od-health-filter"></button>')
        .toggleClass('is-active', group.key === that.$healthActiveGroup)
        .attr('aria-pressed', group.key === that.$healthActiveGroup ? 'true' : 'false')
        .append(
          $('<span class="bask-od-dot"></span>').css('backgroundColor', group.color),
          $('<span></span>').text(group.label),
          $('<span class="bask-od-health-filter-count"></span>').text(entry.count)
        )
        .on('click', function () {
          that.$healthActiveGroup = group.key;
          that._renderHealth();
        });
      that.$healthTabs.append($button);
    });

    activeEntry.rows.forEach(function (row) {
      if (row.rowType === 'alarm') {
        that.$healthContent.append(that._renderAlarmRow(row, activeEntry.group));
        return;
      }
      if (activeEntry.group.key === 'overridden' && row.canRelease) {
        that.$healthContent.append(that._renderOverrideRow(row, activeEntry.group));
        return;
      }
      var $row = $('<a class="bask-od-health-row"></a>').append(
        $('<span class="bask-od-dot"></span>').css(
          'backgroundColor',
          activeEntry.group.color
        ),
        $('<span class="bask-od-row-main"></span>').append(
          $('<span class="bask-od-row-name"></span>').text(row.displayName),
          $('<span class="bask-od-row-meta"></span>').text(row.slotPath)
        ),
        $('<span class="bask-od-row-value"></span>').text(row.value)
      );
      bindOrdNavigation(
        $row,
        navigationOrdWithView(row.ord, 'webEditors:MultiSheet')
      );
      that.$healthContent.append($row);
    });

    var alarmGroup = activeEntry.group.key === 'alarm' ||
      activeEntry.group.key === 'unackedAlarm';
    var summaryLabel;
    if (alarmGroup && this.$alarmDataAvailable) {
      summaryLabel = activeEntry.group.key === 'unackedAlarm' ?
        'unacknowledged alarm record' :
        'open alarm record';
    }
    else {
      summaryLabel = activeEntry.group.label.toLowerCase() + ' point';
    }
    var shown = activeEntry.rows.length;
    var counted = activeEntry.count || shown;
    var uniqueCount = isFinite(this.$healthTotalCount) &&
      this.$healthTotalCount > this.$healthRows.length ?
      this.$healthTotalCount :
      this.$healthRows.length;
    var summary = counted + ' ' + summaryLabel + (counted === 1 ? '' : 's');
    if (shown < counted) {
      summary += ' (showing ' + shown + ')';
    }
    this.$healthStatus.text(
      summary + '. ' + uniqueCount + ' unique non-normal point' +
      (uniqueCount === 1 ? '' : 's') + ' across ' + membershipCount +
      ' status group entr' + (membershipCount === 1 ? 'y.' : 'ies.')
    );
  };

  OperationsDashboard.prototype._loadSchedules = function () {
    var that = this;
    if (this.$schedulesLoading) {
      return;
    }
    var sequence = ++this.$scheduleLoadSequence;
    this.$schedulesLoading = true;
    this.$scheduleRefresh.prop('disabled', true).text('Loading...');
    this.$scheduleStatus.text('Loading station schedules...');
    this.$scheduleList.empty().append(
      $('<div class="bask-od-empty"></div>').text('Loading schedules...')
    );
    this.$scheduleCalendar.empty();

    callRpc('listSchedules', []).then(function (result) {
      var payload = parseRpcJson(result);
      return {
        rows: payload && Array.isArray(payload.schedules) ? payload.schedules : [],
        fallback: false
      };
    }).then(function (result) {
      if (that.$destroyed || sequence !== that.$scheduleLoadSequence) {
        return;
      }
      var rows = result.rows;
      rows.sort(function (left, right) {
        return left.displayName.localeCompare(right.displayName);
      });
      rows.forEach(function (schedule) {
        schedule.days = Array.isArray(schedule.days) ? schedule.days : [];
        schedule.specialEventCount = Number(schedule.specialEventCount) || 0;
        schedule.editable = !!schedule.editable;
        schedule.calendarFallback = result.fallback;
        schedule.detailsLoaded = false;
        schedule.detailsLoading = false;
        schedule.detailsError = '';
      });
      that.$schedules = rows;
      that.$schedulesLoaded = true;
      that.$schedulesLoading = false;
      that.$scheduleRefresh.prop('disabled', false).text('Refresh');
      that._renderSchedules();
    }).catch(function (err) {
      if (that.$destroyed || sequence !== that.$scheduleLoadSequence) {
        return;
      }
      that.$schedules = [];
      that.$schedulesLoaded = false;
      that.$schedulesLoading = false;
      that.$scheduleRefresh.prop('disabled', false).text('Refresh');
      that.$scheduleStatus.text('Unable to query station schedules.');
      that.$scheduleList.empty().append(
        $('<div class="bask-od-empty"></div>').text(formatError(err, 'Schedule query failed.'))
      );
      that.$scheduleCalendar.empty();
      console.error('[OperationsDashboard] Schedule query failed:', err);
    });
  };

  OperationsDashboard.prototype._loadScheduleDetails = function (schedule) {
    var that = this;
    if (!schedule || schedule.detailsLoaded || schedule.detailsLoading) {
      return;
    }

    var sequence = this.$scheduleLoadSequence;
    schedule.detailsLoading = true;
    schedule.detailsError = '';
    this._renderScheduleCalendar(schedule);

    callRpc('getScheduleDetails', [schedule.ord]).then(function (result) {
      if (that.$destroyed || sequence !== that.$scheduleLoadSequence) {
        return;
      }

      var payload = parseRpcJson(result);
      var detail = payload && payload.schedule;
      if (!detail) {
        throw new Error('Schedule calendar response was empty.');
      }

      schedule.days = Array.isArray(detail.days) ? detail.days : [];
      schedule.specialEventCount = Number(detail.specialEventCount) || 0;
      schedule.value = asString(detail.value);
      schedule.outputSource = asString(detail.outputSource);
      schedule.editable = !!detail.editable;
      schedule.detailsLoaded = true;
      schedule.detailsLoading = false;
      schedule.detailsError = '';
      if (that.$selectedScheduleOrd === schedule.ord) {
        that._renderScheduleCalendar(schedule);
      }
    }).catch(function (err) {
      if (that.$destroyed || sequence !== that.$scheduleLoadSequence) {
        return;
      }

      schedule.detailsLoading = false;
      schedule.detailsError = formatError(err, 'Unable to load schedule calendar.');
      if (that.$selectedScheduleOrd === schedule.ord) {
        that._renderScheduleCalendar(schedule);
      }
      console.error('[OperationsDashboard] Schedule calendar failed:', schedule.ord, err);
    });
  };

  OperationsDashboard.prototype._renderSchedules = function () {
    var that = this;
    if (!this.$scheduleList || !this.$scheduleCalendar) {
      return;
    }
    var query = this.$scheduleSearchText;
    var visible = this.$schedules.filter(function (schedule) {
      if (!query) {
        return true;
      }
      return [
        schedule.displayName,
        schedule.slotPath,
        schedule.value
      ].join(' ').toLowerCase().indexOf(query) !== -1;
    });

    this.$scheduleList.empty();
    this.$scheduleCalendar.empty();
    if (!visible.length) {
      this.$scheduleStatus.text(
        this.$scheduleSearchText ?
          'No schedules match this search.' :
          'No readable schedules were found.'
      );
      this.$scheduleList.append(
        $('<div class="bask-od-empty"></div>').text(
          query ? 'No schedules match this search.' : 'No readable schedules were found.'
        )
      );
      return;
    }

    var selected = visible.filter(function (schedule) {
      return schedule.ord === that.$selectedScheduleOrd;
    })[0] || visible[0];
    this.$selectedScheduleOrd = selected.ord;

    visible.forEach(function (schedule) {
      var eventCount = schedule.days.reduce(function (count, day) {
        return count + (Array.isArray(day.events) ? day.events.length : 0);
      }, 0);
      var meta = schedule.value || 'No current value';
      if (eventCount) {
        meta += ' · ' + eventCount + ' weekly event' + (eventCount === 1 ? '' : 's');
      }
      var $row = $('<button type="button" class="bask-od-schedule-item"></button>')
        .attr('title', schedule.ord)
        .toggleClass('is-active', schedule.ord === selected.ord)
        .append(
          $('<span class="bask-od-schedule-item-name"></span>').text(schedule.displayName),
          $('<span class="bask-od-schedule-item-meta"></span>').text(meta)
        )
        .on('click', function () {
          that.$selectedScheduleOrd = schedule.ord;
          that._renderSchedules();
        });
      this.$scheduleList.append($row);
    }, this);

    this.$scheduleStatus.text(
      visible.length + ' of ' + this.$schedules.length +
      ' schedule' + (this.$schedules.length === 1 ? '.' : 's.')
    );
    this._renderScheduleCalendar(selected);
    this._loadScheduleDetails(selected);
  };

  OperationsDashboard.prototype._renderScheduleCalendar = function (schedule) {
    if (!this.$scheduleCalendar || !schedule) {
      return;
    }
    this.$scheduleCalendar.empty();

    var $header = $('<div class="bask-od-calendar-header"></div>').append(
      $('<div class="bask-od-calendar-title"></div>').text(schedule.displayName + ' · Regular week'),
      $('<div class="bask-od-calendar-meta"></div>').text(
        (schedule.value ? 'Current: ' + schedule.value : 'Current value unavailable') +
        (schedule.outputSource ? ' · Source: ' + schedule.outputSource : '') +
        (schedule.editable ? ' · Editable' : ' · Read only') +
        (schedule.specialEventCount ?
          ' · ' + schedule.specialEventCount + ' special event' +
            (schedule.specialEventCount === 1 ? '' : 's') :
          '')
      ),
      bindOrdNavigation(
        $('<a class="bask-od-calendar-link"></a>').text(
          schedule.editable ? 'Edit full schedule & exceptions' : 'Open full schedule & exceptions'
        ),
        navigationOrdWithView(schedule.ord, 'schedule:WebScheduler')
      )
    );
    $header.append($('<div class="bask-od-calendar-note"></div>').text('Recurring weekly events only. Special events, holidays and effective dates can change the actual output. Open the full schedule for those details.'));
    var $scroll = $('<div class="bask-od-calendar-scroll"></div>');

    if (schedule.detailsLoading) {
      $scroll.append(
        $('<div class="bask-od-empty"></div>').text('Loading schedule calendar...')
      );
      this.$scheduleCalendar.append($header, $scroll);
      return;
    }

    if (schedule.detailsError) {
      $scroll.append(
        $('<div class="bask-od-empty"></div>').text(schedule.detailsError)
      );
      this.$scheduleCalendar.append($header, $scroll);
      return;
    }

    if (!schedule.days.length) {
      $scroll.append(
        $('<div class="bask-od-empty"></div>').text(
          schedule.calendarFallback ?
            'The schedule list loaded, but detailed weekly events were unavailable.' :
            'This schedule does not expose a regular weekly calendar.'
        )
      );
      this.$scheduleCalendar.append($header, $scroll);
      return;
    }

    var $week = $('<div class="bask-od-week-grid"></div>');
    schedule.days.forEach(function (day) {
      var events = Array.isArray(day.events) ? day.events : [];
      var $events = $('<div class="bask-od-day-events"></div>');
      if (!events.length) {
        $events.append($('<div class="bask-od-day-empty">No events</div>'));
      }
      else {
        events.forEach(function (event) {
          $events.append(
            $('<div class="bask-od-calendar-event"></div>').append(
              $('<div class="bask-od-event-time"></div>').text(
                formatMinutes(event.startMinutes) + '–' + formatMinutes(event.finishMinutes)
              ),
              $('<div class="bask-od-event-value"></div>').text(
                event.value || 'Scheduled output'
              )
            )
          );
        });
      }
      $week.append(
        $('<section class="bask-od-day"></section>').append(
          $('<div class="bask-od-day-title"></div>').text(day.label || day.key),
          $events
        )
      );
    });
    $scroll.append($week);
    this.$scheduleCalendar.append($header, $scroll);
  };

  OperationsDashboard.prototype.doLoad = function () {
    this._applyHostPresentation(0);
    this._applyProperties();
    if (this.$activeTab === 'overview' && this.$overview && !this.$overview.loaded) this.$overview.load();
    if (this.$activeTab === 'trends' && !this.$historyLoaded && !this.$historyLoading) {
      this._loadHistories();
    }
    this._scheduleChartDraw();
  };

  OperationsDashboard.prototype.doChanged = function (name) {
    var propertyName = typeof name === 'string' ? name :
      (name && typeof name.getName === 'function' ? name.getName() : '');
    this._applyProperties();
    if (propertyName === 'chartLibrary' && this.$savedCharts) { this.$savedCharts.refresh(); }
    if (propertyName === 'healthRefreshSeconds') {
      this._scheduleHealthRefresh();
    }
    else if (propertyName === 'historyParentName') {
      this.$historyLoadSequence++;
      this.$historyLoaded = false;
      this.$historyLoading = false;
      this.$histories = [];
      this._renderHistoryList();
      if (this.$activeTab === 'trends') {
        this._loadHistories();
      }
    }
  };

  OperationsDashboard.prototype.doDestroy = function () {
    this.$destroyed = true;
    if (this.$savedCharts) this.$savedCharts.destroy();
    if (this.$overview) this.$overview.destroy();
    if (this.$recentChanges) this.$recentChanges.destroy();
    this.$historyLoadSequence++;
    this.$healthLoadSequence++;
    this.$scheduleLoadSequence++;
    this.$series.forEach(function (series) {
      series.loadSequence++;
    });
    clearTimeout(this.$healthTimer);
    if (this.$hostLayoutFrame && typeof window !== 'undefined' && window.cancelAnimationFrame) {
      window.cancelAnimationFrame(this.$hostLayoutFrame);
    }
    $(window).off(this.$eventNamespace);
    if (this.$resizeObserver) {
      this.$resizeObserver.disconnect();
    }
    if (this.$dom) {
      this.$dom.empty().removeClass(
        'bask-operations-dashboard bask-od-narrow bask-od-compact'
      );
    }
    this.$hostLayoutFrame = 0;
    this.$resizeObserver = null;
    this.$dom = null;
    this.$root = null;
    this.$header = null;
    this.$main = null;
    this.$chartTooltip = null;
    this.$chartScale = null;
    this.$histories = [];
    this.$series = [];
    this.$healthRows = [];
    this.$healthCounts = {};
    this.$healthTotalCount = 0;
    this.$alarmRows = [];
    this.$alarmDataAvailable = false;
    this.$openNoteUuid = '';
    this.$schedules = [];
    this.$historyLoading = false;
    this.$healthLoading = false;
    this.$schedulesLoading = false;
  };

  return OperationsDashboard;
});
