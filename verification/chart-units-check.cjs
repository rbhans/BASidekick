// Exercise the dashboard's real series-loading path with representative RPC data.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const widgets = path.join(__dirname, '../basidekick-ux/src/rc/widgets');
let Analysis, Dashboard, rpcUnits;
vm.runInNewContext(fs.readFileSync(path.join(widgets, 'TrendAnalysis.js'), 'utf8'), {
  define: (_, factory) => { Analysis = factory(null); }
});
vm.runInNewContext(fs.readFileSync(path.join(widgets, 'OperationsDashboard.js'), 'utf8'), {
  define: (_, factory) => {
    Dashboard = factory({rpc: () => Promise.resolve(JSON.stringify({
      units: rpcUnits, rows: [[100, 72, true, 'ok']], truncated: false
    }))}, function Widget() {}, null, Promise, null, Analysis, null, null);
  }
});
(async () => {
  for (const unit of [null, undefined, '', 'null', ' NULL ', '°F', '°C', '%', 'kWh']) {
    rpcUnits = unit;
    const series = {ord: 'history:/Demo/Temperature', loadSequence: 0};
    const host = {
      $analysisRange: {start: 0, end: 1000}, $analysis: {value: {compare: true}},
      _queueHistoryRead: read => read(), _renderLegend() {}, _drawChart() {}
    };
    await Dashboard.prototype._loadSeries.call(host, series);
    assert.equal(series.error, '');
    const expected = Analysis.unitLabel(unit);
    assert.equal(series.units, expected);
    assert.equal(series.previous.units, expected);
    assert.equal(series.data[0].displayValue, '72.0' + (expected ? ' ' + expected : ''));
    assert.equal(series.data[0].value, 72);
    assert.equal(series.loading, false);
  }
  console.log('PASS: chart values, current/comparison units and labels for absent units, legacy null strings and real unit symbols.');
})().catch(error => { console.error(error); process.exitCode = 1; });
