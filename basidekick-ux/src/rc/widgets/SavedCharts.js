define(['baja!', 'jquery'], function (baja, $) {
  'use strict';

  function parse(result) {
    if (typeof result === 'string') result = JSON.parse(result);
    else if (result && typeof result.getValue === 'function') result = JSON.parse(result.getValue());
    if (typeof result === 'string') result = JSON.parse(result);
    if (!result || typeof result !== 'object') throw new Error('Invalid chart library response.');
    return result;
  }

  function encodeSeries(series) {
    if (!series.length) throw new Error('Add a history before saving.');
    return series.map(function (item) {
      return [item.ord, item.color, String(item.name).replace(/[\t\r\n]/g, ' ').slice(0, 200)].join('\t');
    }).join('\n');
  }

  function decodeSeries(text) {
    var rows = String(text).split('\n');
    if (!text || rows.length > 12) throw new Error('This saved chart has an invalid history list.');
    var seen = {};
    return rows.map(function (row) {
      var fields = row.split('\t');
      if (fields.length !== 3 || !/^history:\/[^|?\s]+$/.test(fields[0]) ||
          !/^#[0-9a-f]{6}$/i.test(fields[1]) || seen[fields[0]]) throw new Error('This saved chart contains an invalid history.');
      seen[fields[0]] = true;
      return { ord: fields[0], color: fields[1], name: fields[2] };
    });
  }

  function SavedCharts(widget) {
    var that = this;
    this.widget = widget;
    this.charts = [];
    this.active = null;
    this.editable = false;
    this.sequence = 0;
    this.busy = false;
    this.destroyed = false;
    this.$root = $('<div class="bask-od-presets"></div>');
    this.$list = $('<div class="bask-od-saved-list" aria-label="Saved charts"></div>');
    this.$name = $('<input class="bask-od-input" maxlength="80" aria-label="Chart name" placeholder="Chart name">');
    this.$message = $('<div class="bask-od-status" role="status" aria-live="polite"></div>');
    function button(label, action) { return widget._makeButton(label).on('click', action); }
    this.$retry = button('Reload charts', function () { that.refresh(); }).hide();
    this.$save = button('Save', function () { that.save(false); });
    this.$new = button('+', function () {
      that.active = null; that.$name.val('').trigger('focus'); that.$message.empty();
      that.$confirmation.hide();that.render();that.controls();
    }).attr({'aria-label':'Name a new chart',title:'Name a new chart'});
    this.$toggle = $('<button type="button" class="bask-od-section-toggle" aria-expanded="true">▾ Saved charts</button>').on('click',function(){
      var open=that.$toggle.attr('aria-expanded')!=='true';
      that.$toggle.attr('aria-expanded',String(open)).text((open?'▾':'▸')+' Saved charts');that.$body.toggle(open);
    });
    this.$confirm = button('Delete saved chart', function () { that.remove(); });
    this.$confirmation = $('<div class="bask-od-toolbar"></div>').append(
      $('<span></span>').text('Delete this saved setup?'), this.$confirm,
      button('Cancel', function () { that.$confirmation.hide(); })
    ).hide();
    this.$body = $('<div></div>').append(this.$list,
      $('<div class="bask-od-toolbar"></div>').append(this.$name, this.$save, this.$new),
      this.$confirmation, this.$message, this.$retry);
    this.$name.on('keydown',function(e){if(e.key==='Enter'&&!that.busy&&that.editable)that.save(false);});
    this.$root.append(this.$toggle, this.$body);
    this.controls();
  }

  SavedCharts.prototype.ord = function () {
    return String(this.widget.properties().getValue('chartLibrary') || '').trim();
  };
  SavedCharts.prototype.rpc = function (method, args) {
    return baja.rpc({ typeSpec: 'basidekick:ChartLibraryRpc', method: method, args: [this.ord()].concat(args || []) });
  };
  SavedCharts.prototype.controls = function () {
    this.$body.find('button,input').prop('disabled', this.busy);
    this.$save.prop('disabled', this.busy || !this.editable);
    this.$new.prop('disabled', this.busy || !this.editable);
    this.$list.find('.bask-od-saved-delete').prop('disabled', this.busy || !this.editable);
    this.$name.prop('disabled', this.busy || !this.editable);
  };
  SavedCharts.prototype.render = function () {
    var that=this;this.$list.empty();
    this.charts.forEach(function(chart){
      var $row=$('<div class="bask-od-saved-row"></div>').toggleClass('is-active',!!that.active&&that.active.id===chart.id);
      var $open=$('<button type="button" class="bask-od-saved-open"></button>').text(chart.title).attr('title',chart.title).on('click',function(){that.open(chart.id);});
      var $delete=$('<button type="button" class="bask-od-saved-delete">×</button>').attr('aria-label','Delete '+chart.title).on('click',function(){
        that.pendingDelete=chart;that.$confirmation.show();that.$confirm.trigger('focus');
      });
      that.$list.append($row.append($open,$delete));
    });
    if(!this.charts.length)this.$list.append($('<div class="bask-od-status">No saved charts yet.</div>'));
  };
  SavedCharts.prototype.fail = function (error) {
    if (this.destroyed) return;
    this.busy = false;
    this.$message.text(error && error.message ? error.message : String(error));
    this.$retry.show();
    this.controls();
  };
  SavedCharts.prototype.refresh = function () {
    var that = this, seq = ++this.sequence;
    this.active = null;
    this.editable = false;
    this.$confirmation.hide();
    this.$retry.hide();
    this.busy = true;
    this.controls();
    this.$message.text('Loading...');
    return this.rpc('listCharts').then(function (response) {
      if (that.destroyed || seq !== that.sequence) return;
      var data = parse(response);
      if (!Array.isArray(data.charts)) throw new Error('Invalid chart library response.');
      that.charts = data.charts;
      that.editable = data.editable === true;
      that.render();
      that.busy = false;
      that.$message.text(that.editable ? '' : 'Read only.');
      that.controls();
    }).catch(function (error) {
      if (seq !== that.sequence || that.destroyed) return;
      that.charts = [];
      that.render();
      that.fail(new Error('Chart library unavailable. Set Chart Library in the widget properties to a basidekick Chart Library component. ' + (error.message || '')));
    });
  };
  SavedCharts.prototype.open = function (id) {
    var chart = this.charts.filter(function (item) { return item.id === id; })[0];
    if (!chart) { this.$message.text('Choose a saved chart first.'); return; }
    try {
      var series = decodeSeries(chart.series);
      if (['last24Hours', 'last7Days', 'monthToDate', 'yearToDate'].indexOf(chart.period) < 0)
        throw new Error('This saved chart uses an unsupported time range.');
      var analysisFields = String(chart.analysis || 'sample;60;false').split(';');
      if ((analysisFields.length !== 3 && analysisFields.length !== 4) || !/^(true|false)$/.test(analysisFields[2])) throw new Error('Invalid saved analysis settings.');
      this.widget._restoreChart(chart.period, series, {mode:analysisFields[0],gapMinutes:Number(analysisFields[1]),compare:analysisFields[2]==='true',showExtrema:analysisFields.length<4||analysisFields[3]==='true'});
      this.active = chart;
      this.$name.val(chart.title);
      this.$confirmation.hide();
      this.$message.empty();this.render();
      this.controls();
    } catch (error) { this.fail(error); }
  };
  SavedCharts.prototype.save = function (asNew) {
    var that = this, setup;
    try { setup = encodeSeries(this.widget.$series); }
    catch (error) { this.fail(error); return; }
    var title = String(this.$name.val()).trim();
    if (!title) { this.fail(new Error('Enter a chart name.')); this.$name.trigger('focus'); return; }
    var active = asNew ? null : this.active;
    var period = this.widget.$period;
    var options = this.widget.$analysis.value;
    var analysis = [options.mode, Math.round(options.gapMinutes), options.compare, options.showExtrema].join(';');
    this.busy = true;
    this.controls();
    var seq = ++this.sequence;
    this.rpc('saveChartWithAnalysis', [active ? active.id : '', active ? active.revision : '', title, period, setup, analysis])
      .then(function (response) {
        if (that.destroyed || seq !== that.sequence) return;
        var saved = parse(response);
        if (!saved.id || !saved.revision) throw new Error('The station did not confirm this save. Refresh before retrying.');
        var chart = { id: saved.id, revision: saved.revision, title: title, period: period, series: setup, analysis: analysis };
        that.charts = that.charts.filter(function (item) { return item.id !== chart.id; });
        that.charts.push(chart);
        that.active = chart;
        that.render();
        that.busy = false;
        that.$message.text('Saved.');
        that.$retry.hide();
        that.controls();
      }).catch(function (error) { if (seq === that.sequence) that.fail(error); });
  };
  SavedCharts.prototype.remove = function () {
    if (!this.pendingDelete || this.busy) return;
    var that = this, chart = this.pendingDelete, seq = ++this.sequence;
    this.busy = true;
    this.controls();
    this.rpc('deleteChart', [chart.id, chart.revision]).then(function (response) {
      if (that.destroyed || seq !== that.sequence) return;
      if (parse(response).deleted !== true) throw new Error('The station did not confirm deletion.');
      that.$name.val('');
      return that.refresh();
    }).catch(function (error) { if (seq === that.sequence) that.fail(error); });
  };
  SavedCharts.prototype.destroy = function () { this.destroyed = true; this.sequence++; };
  SavedCharts.encodeSeries = encodeSeries;
  SavedCharts.decodeSeries = decodeSeries;
  return SavedCharts;
});
