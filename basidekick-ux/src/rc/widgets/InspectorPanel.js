define(['jquery','Promise','nmodule/basidekick/rc/widgets/UiFoundation'], function($,Promise,UI){
  'use strict';
  function Panel(){this.sequence=0;this.$overlay=null;this.returnFocus=null;UI.inject();}
  Panel.prototype.close=function(){this.sequence++;if(this.$overlay)this.$overlay.remove();this.$overlay=null;$(document).off('.baskInspector');if(this.returnFocus&&this.returnFocus.focus)this.returnFocus.focus();};
  Panel.prototype.open=function(options){
    var that=this,seq=++this.sequence,ord=String(options.ord||''),scope=String(options.auditScope||options.equipmentOrd||ord),history=String(options.historyOrd||'');
    this.close();this.sequence=seq;this.returnFocus=document.activeElement;
    var $overlay=$('<div class="bask-ui bask-inspector-overlay" role="presentation"></div>'),$panel=$('<section class="bask-inspector" role="dialog" aria-modal="true" aria-label="Point inspector"></section>');this.$overlay=$overlay;
    var $title=$('<div class="bask-inspector-title">Point Inspector</div>'),$sub=$('<div class="bask-inspector-sub"></div>').text(ord),$close=$('<button type="button" class="bask-btn bask-inspector-close" aria-label="Close inspector">×</button>'),$body=$('<div class="bask-inspector-body"><div>Loading current point state...</div></div>');
    $panel.append($('<div class="bask-inspector-head"></div>').append($('<div></div>').append($title,$sub),$close),$body);
    if(options.container){
      $overlay.removeClass('bask-inspector-overlay').css({height:'100%',width:'100%'});
      $panel.attr({'role':'region','aria-modal':'false'}).css({width:'100%',boxShadow:'none',animation:'none'});
      $close.remove();$overlay.append($panel).appendTo(options.container);
    }else{
      $overlay.append($panel).appendTo(document.body);
      $close.on('click',function(){that.close();});$overlay.on('mousedown',function(e){if(e.target===this)that.close();});$(document).on('keydown.baskInspector',function(e){if(e.key==='Escape')that.close();});$close.focus();
    }
    var end=Date.now(),start=end-86400000;
    var requests=[UI.rpc('basidekick:DiagnosticsRpc','inspectPoint',[ord]),UI.rpc('basidekick:OperationsDashboardRpc','listOpenAlarms',[]).catch(function(){return{alarms:[]};}),UI.rpc('basidekick:DiagnosticsRpc','recentChanges',[scope,String(start),String(end)]).catch(function(){return{rows:[]};})];
    if(history)requests.push(UI.rpc('basidekick:DiagnosticsRpc','historySamples',[history,String(start),String(end)]).catch(function(){return{rows:[],error:'History unavailable'};}));else requests.push(Promise.resolve({rows:[]}));
    return Promise.all(requests).then(function(all){if(!that.$overlay||seq!==that.sequence)return;var point=all[0],alarms=(all[1].alarms||[]).filter(function(a){return a.sourceOrd===point.ord||a.sourceOrd===ord;}),changes=all[2].rows||[],samples=all[3].rows||[];$title.text(point.displayName||'Point Inspector');$sub.text(point.ord);
      var sev=UI.severity(point),status=point.groups&&point.groups.length?point.groups.join(', '):'Normal';$body.empty().append($('<div class="bask-card"></div>').css('padding','16px').append($('<div class="bask-inspector-label">Current value</div>'),$('<div class="bask-inspector-value"></div>').text(point.value||'Unavailable'),$('<div></div>').css({display:'flex',alignItems:'center',gap:'7px',fontSize:'12px',color:'var(--bask-muted)'}).append($('<span class="bask-status-dot is-'+sev+'"></span>'),$('<span></span>').text(status))));
      var $trend=$('<div class="bask-inspector-section"></div>').append('<div class="bask-inspector-label">Last 24 hours</div>'),$canvas=$('<canvas class="bask-inspector-spark"></canvas>');$trend.append(history?$canvas:null,samples.length?'':$('<div></div>').css({fontSize:'12px',color:'var(--bask-muted)',marginTop:'8px'}).text(history?'No samples returned.':'No history configured for this inspector.'));$body.append($trend);UI.spark($canvas,samples);
      var $context=$('<div class="bask-inspector-section"></div>').append('<div class="bask-inspector-label">Operating context</div>');$context.append(row('Override',point.groups&&point.groups.indexOf('overridden')>=0?'Active':'None'),row('Open alarm',alarms.length?(alarms[0].message||alarms[0].displayName):'None'),row('Recent change',changes.length?new Date(changes[0].time).toLocaleString()+' · '+changes[0].operation:'None recorded'));$body.append($context);
      $body.append($('<button type="button" class="bask-btn">Open full Niagara view</button>').on('click',function(){UI.navigate(options.detailOrd||point.ord);}));
    }).catch(function(e){if(that.$overlay&&seq===that.sequence)$body.text('Inspector unavailable. '+(e.message||String(e)));});
  };
  function row(label,value){return $('<div class="bask-inspector-row"></div>').append($('<span></span>').css('color','var(--bask-muted)').text(label),$('<strong></strong>').css({textAlign:'right',overflowWrap:'anywhere'}).text(value));}
  return Panel;
});
