define(['jquery'], function ($) {
  'use strict';
  function unitLabel(value) {
    if (value == null) return '';
    var label = String(value).trim();
    return /^(null|undefined)$/i.test(label) ? '' : label;
  }
  function settings(value) {
    var x = typeof value === 'string' ? JSON.parse(value || '{}') : (value || {});
    var mode = x.mode || 'sample', gapMinutes = x.gapMinutes == null ? 60 : Number(x.gapMinutes);
    if (['sample', 'time'].indexOf(mode) < 0 || !Number.isInteger(gapMinutes) || gapMinutes < 1 || gapMinutes > 10080)
      throw new Error('Use sample or time mean and a maximum gap from 1 minute to 7 days.');
    return {mode:mode, gapMinutes:gapMinutes, compare:x.compare === true, showExtrema:x.showExtrema !== false};
  }
  function range(period, now) {
    var end = now == null ? Date.now() : now, date = new Date(end), start;
    if (period === 'last24Hours') start = end - 86400000;
    else if (period === 'last7Days') start = end - 7 * 86400000;
    else if (period === 'monthToDate') start = new Date(date.getFullYear(), date.getMonth(), 1).getTime();
    else if (period === 'yearToDate') start = new Date(date.getFullYear(), 0, 1).getTime();
    else throw new Error('Unsupported period');
    return {start:start, end:end};
  }
  function stats(rows, start, end, maxGap, mode) {
    var sorted = rows.slice().sort(function (a,b) { return a[0] - b[0]; });
    var count = 0, excluded = 0, mean = 0, weighted = 0, covered = 0, min = null, max = null, largestGap = 0;
    var lastValid = start;
    sorted.forEach(function (r,i) {
      if (r[0] < start || r[0] >= end) return;
      if (!r[2] || r[1] === null || !Number.isFinite(r[1])) { excluded++; return; }
      count++; mean += (r[1] - mean) / count;
      if (!min || r[1] < min[1]) min = r;
      if (!max || r[1] > max[1]) max = r;
      largestGap = Math.max(largestGap, r[0] - lastValid); lastValid = r[0];
      // Hold the last recorded value only until the next record or maximum gap.
      // An invalid next record ends coverage immediately; it is never interpolated across.
      var next = i + 1 < sorted.length ? sorted[i + 1][0] : end;
      var duration = Math.max(0, Math.min(next, end, r[0] + maxGap) - r[0]);
      var newCovered = covered + duration;
      if (newCovered > 0) weighted += (r[1] - weighted) * (duration / newCovered);
      covered = newCovered;
    });
    largestGap = Math.max(largestGap, end - lastValid);
    return {count:count, excluded:excluded, min:min, max:max, mean:mode === 'time' ? (covered ? weighted : null) : (count ? mean : null),
      coverage:Math.max(0, Math.min(1, covered / (end - start))), largestGap:largestGap};
  }
  function cell(v) {
    var text = v == null ? '' : String(v);
    if (/^[\s]*[=+@-]/.test(text) && typeof v !== 'number') text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }
  function csv(series) {
    var lines = [['history','label','units','period_start_utc','period_end_utc','timestamp_utc','value','valid','status','query_truncated'].map(cell).join(',')];
    series.forEach(function (s) {
      if (s.loading || s.error || !s.samples) return;
      s.samples.forEach(function (r) { lines.push([s.ord,s.name,s.units,new Date(s.range.start).toISOString(),new Date(s.range.end).toISOString(),new Date(r[0]).toISOString(),r[1],r[2],r[3],s.truncated].map(cell).join(',')); });
    });
    return lines.join('\r\n');
  }
  function number(n) { return n == null || !Number.isFinite(n) ? 'Unavailable' : Number(n.toPrecision(6)).toLocaleString(); }
  function Analysis(widget) {
    var that = this; this.widget = widget; this.value = settings();
    this.$summary = $('<div class="bask-analysis-summary"></div>').css({display:'flex',gap:'6px',padding:'7px 10px',overflowX:'auto',borderBottom:'1px solid var(--od-border)',flex:'0 0 auto'});
    this.$root = $('<div class="bask-analysis"></div>').css({padding:'8px 12px', borderTop:'1px solid var(--od-border)', maxHeight:'240px', overflow:'auto', flex:'0 0 auto'});
    this.$mode = $('<select class="bask-od-select" aria-label="Average method"><option value="sample">Sample mean</option><option value="time">Time-weighted mean (held value)</option></select>');
    this.$mode.css({maxWidth:'100%',flex:'0 1 260px'});
    this.$gap = $('<input type="number" class="bask-od-input" min="1" max="10080" aria-label="Maximum gap in minutes">').val(60).css('width','85px');
    this.$compare = $('<input type="checkbox" aria-label="Compare preceding period">');
    this.$extrema = $('<input type="checkbox" aria-label="Show minimum and maximum markers">').prop('checked',true);
    this.$message = $('<div class="bask-od-status" role="status"></div>');
    this.$table = $('<div></div>');
    this.$export = widget._makeButton('Export loaded samples').on('click', function () {
      var url = URL.createObjectURL(new Blob([csv(widget.$series)], {type:'text/csv;charset=utf-8'}));
      var a = document.createElement('a'); a.href = url; a.download = 'basidekick-history.csv'; a.click();
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    });
    this.$root.append($('<div class="bask-od-toolbar"></div>').css({flexWrap:'wrap'}).append(this.$mode,
      $('<label>Max gap (min) </label>').css({display:'inline-flex',alignItems:'center',gap:'6px',whiteSpace:'nowrap',flex:'0 0 auto'}).append(this.$gap), $('<label></label>').css({display:'inline-flex',alignItems:'center',gap:'6px',whiteSpace:'nowrap',flex:'0 0 auto'}).append(this.$compare,' Compare preceding period'), $('<label></label>').css({display:'inline-flex',alignItems:'center',gap:'6px',whiteSpace:'nowrap',flex:'0 0 auto'}).append(this.$extrema,' Mark min/max'), this.$export), this.$message,this.$table);
    this.$mode.add(this.$gap).add(this.$compare).add(this.$extrema).on('change', function () {
      try {
        var next = settings({mode:that.$mode.val(),gapMinutes:that.$gap.val(),compare:that.$compare.prop('checked'),showExtrema:that.$extrema.prop('checked')});
        var reload = next.compare !== that.value.compare; that.value = next;
        if (reload) widget._reloadSeries(); else { that.render(); widget._drawChart(); }
      } catch(e) { that.$message.text(e.message); }
    });
  }
  Analysis.prototype.get = function () { return JSON.stringify(this.value); };
  Analysis.prototype.set = function (value) {
    this.value = settings(value); this.$mode.val(this.value.mode); this.$gap.val(this.value.gapMinutes); this.$compare.prop('checked',this.value.compare);this.$extrema.prop('checked',this.value.showExtrema);
  };
  Analysis.prototype.render = function () {
    var that = this, value = this.value;
    this.$table.empty();this.$summary.empty();
    this.$export.prop('disabled', !this.widget.$series.some(function (s) { return !s.loading && !s.error && s.samples && s.samples.length; }));
    this.$message.text('Raw recorded samples. ' + (value.mode === 'time' ? 'Mean uses held values up to the maximum gap. ' : 'Mean weights each valid sample equally. ') +
      'Coverage assumes held values; gaps and invalid records limit it. Calendar ranges use this viewer’s time zone.');
    this.widget.$series.forEach(function (s) {
      if (s.loading || s.error || !s.range) return;
      var a = stats(s.samples || [],s.range.start,s.range.end,value.gapMinutes*60000,value.mode);
      that.$summary.append($('<div></div>').css({flex:'0 0 auto',padding:'5px 8px',border:'1px solid var(--od-border)',borderRadius:'6px',fontSize:'10px'}).append($('<strong></strong>').text(s.name+' · '),document.createTextNode('min '+number(a.min&&a.min[1])+' · max '+number(a.max&&a.max[1])+' · mean '+number(a.mean)+' · '+Math.round(a.coverage*100)+'% coverage')));
      var rows = [['Minimum',a.min ? number(a.min[1]) + ' at ' + new Date(a.min[0]).toLocaleString() : 'Unavailable'],
        ['Maximum',a.max ? number(a.max[1]) + ' at ' + new Date(a.max[0]).toLocaleString() : 'Unavailable'],
        ['Mean',number(a.mean)],['Samples',a.count + ' valid / ' + a.excluded + ' excluded'],
        ['Held-value coverage',Math.round(a.coverage*100) + '%; largest valid-sample gap ' + Math.round(a.largestGap/60000) + ' min']];
      if (value.compare) {
        if (s.previous && !s.previous.truncated && !s.truncated && s.previous.units === s.units) {
          var p = s.previous, previous = stats(p.rows,p.start,p.end,value.gapMinutes*60000,value.mode);
          rows.push(['Previous mean / change',number(previous.mean) + ' / ' + number(a.mean == null || previous.mean == null ? null : a.mean-previous.mean)]);
          rows.push(['Previous coverage',Math.round(previous.coverage*100) + '%']);
        } else rows.push(['Comparison',s.comparisonError || 'Unavailable: incomplete results or incompatible units']);
      }
      var $card = $('<div></div>').css({padding:'6px 0',borderBottom:'1px solid var(--od-border)'}).append($('<strong></strong>').text(s.name + (s.units ? ' ('+s.units+')' : '') + (s.truncated ? ' · PARTIAL: first 10,000 records' : '')));
      rows.forEach(function (row) { $card.append($('<div></div>').css({fontSize:'12px',marginTop:'3px'}).append($('<span></span>').text(row[0]+': '),$('<span></span>').text(row[1]))); });
      that.$table.append($card);
    });
  };
  Analysis.settings=settings; Analysis.range=range; Analysis.stats=stats; Analysis.csv=csv; Analysis.unitLabel=unitLabel;
  return Analysis;
});
