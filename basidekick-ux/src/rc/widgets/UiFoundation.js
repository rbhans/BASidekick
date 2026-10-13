define(['baja!', 'jquery', 'Promise'], function (baja, $, Promise) {
  'use strict';
  var css = [
    '.bask-ui{--bask-bg:#f3f5f7;--bask-surface:#fff;--bask-text:#202832;--bask-muted:#677383;--bask-border:#d9e0e7;--bask-accent:#2463eb;--bask-danger:#c62836;--bask-warning:#b86111;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:var(--bask-text);box-sizing:border-box}',
    '.bask-ui *{box-sizing:border-box}.bask-card{background:var(--bask-surface);border:1px solid var(--bask-border);border-radius:12px;box-shadow:0 1px 3px rgba(20,32,48,.08)}',
    '.bask-btn{border:1px solid var(--bask-border);border-radius:7px;background:var(--bask-surface);color:var(--bask-text);padding:7px 10px;font:inherit;font-size:12px;font-weight:650;cursor:pointer}.bask-btn:hover{border-color:var(--bask-accent);color:var(--bask-accent)}.bask-btn:disabled{opacity:.5;cursor:default}',
    '.bask-field{border:1px solid var(--bask-border);border-radius:7px;background:var(--bask-surface);color:var(--bask-text);padding:7px 9px;font:inherit;font-size:12px;min-width:0}.bask-field:focus,.bask-btn:focus-visible{outline:2px solid color-mix(in srgb,var(--bask-accent) 35%,transparent);outline-offset:1px}',
    '.bask-status-dot{width:8px;height:8px;border-radius:50%;display:inline-block;background:#29a067}.bask-status-dot.is-warning{background:#e08320}.bask-status-dot.is-bad{background:#d23b48}.bask-status-dot.is-muted{background:#9aa5b1}'
  ].join('');
  function inject() {
    if (typeof document === 'undefined' || document.getElementById('basidekick-ui-foundation')) return;
    $('<style id="basidekick-ui-foundation"></style>').text(css).appendTo(document.head);
  }
  function rpc(type, method, args) {
    return baja.rpc({typeSpec:type, method:method, args:args || []}).then(function (result) {
      return JSON.parse(String(result));
    });
  }
  function groups(row) { return row && Array.isArray(row.groups) ? row.groups : []; }
  function severity(row) {
    var g=groups(row);
    if (g.indexOf('alarm')>=0 || g.indexOf('fault')>=0 || g.indexOf('down')>=0) return 'bad';
    if (g.indexOf('stale')>=0 || g.indexOf('overridden')>=0 || g.indexOf('disabled')>=0) return 'warning';
    if (row && row.valid === false) return 'muted';
    return 'ok';
  }
  function navigate(ord) {
    var value=String(ord||'').replace(/^(local:\|)+/,'');
    if (!value) return Promise.reject(new Error('No destination is configured.'));
    var env=typeof window!=='undefined'&&window.niagara&&window.niagara.env;
    if (env&&typeof env.hyperlink==='function') return Promise.resolve(env.hyperlink(value));
    if (typeof window!=='undefined') { window.location.assign('/ord/'+encodeURIComponent(value)); return Promise.resolve(); }
    return Promise.reject(new Error('Niagara navigation is unavailable.'));
  }
  function spark($canvas, rows, color) {
    var canvas=$canvas&&$canvas[0]; if(!canvas)return;
    var width=Math.max(80,Math.floor($canvas.width()||320)),height=Math.max(40,Math.floor($canvas.height()||90)),ratio=window.devicePixelRatio||1;
    canvas.width=width*ratio;canvas.height=height*ratio;var c=canvas.getContext('2d');c.setTransform(ratio,0,0,ratio,0,0);c.clearRect(0,0,width,height);
    var valid=(rows||[]).filter(function(r){return r[2]&&Number.isFinite(r[1]);});if(valid.length<2)return;
    var t0=valid[0][0],t1=valid[valid.length-1][0],min=valid[0][1],max=min;valid.forEach(function(r){min=Math.min(min,r[1]);max=Math.max(max,r[1]);});if(max===min){max++;min--;}
    c.strokeStyle=color||'#2463eb';c.lineWidth=2;c.beginPath();valid.forEach(function(r,i){var x=6+(r[0]-t0)/(t1-t0)*(width-12),y=height-6-(r[1]-min)/(max-min)*(height-12);if(i)c.lineTo(x,y);else c.moveTo(x,y);});c.stroke();
  }
  function property(widget,name,fallback){try{var v=widget.properties().getValue(name);return v==null?fallback:String(v);}catch(e){return fallback;}}
  return {inject:inject,rpc:rpc,severity:severity,navigate:navigate,spark:spark,property:property};
});
