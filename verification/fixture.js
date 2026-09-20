/* Browser-only test double. This is not station or Workbench runtime evidence. */
var histories = [
  {ord:'history:/Demo/AHU1Supply',displayName:'AHU-1 Supply Air',device:'Demo',historyName:'AHU1Supply'},
  {ord:'history:/Demo/AHU1Return',displayName:'AHU-1 Return Air',device:'Demo',historyName:'AHU1Return'}
];
window.testReadonly = false;
window.testConflict = false;
window.testNavigations = [];
window.niagara = {env: {hyperlink: function (ord) { testNavigations.push(ord); return Promise.resolve(); }}};
function MockWidget(options) {
  var values = {};
  Object.keys(options.defaults.properties).forEach(function (name) { values[name] = options.defaults.properties[name].value; });
  var supplied=(options.params&&options.params.properties)||{};
  Object.keys(supplied).forEach(function(name){values[name]=supplied[name]&&supplied[name].value!==undefined?supplied[name].value:supplied[name];});
  this.properties = function () { return {getValue: function (name) {return values[name];},setValue:function(name,value){values[name]=value;}}; };
}
var baja = {
  Ord: {make: function (ord) {return {
    toUri: function () {return '/ord/' + encodeURIComponent(ord);},
    get: function (options) {
      for (var i = 0; i < 60; i++) {
        (function (i) { options.cursor.each({get:function (key) { return key === 'timestamp' ? Date.now() - (60-i)*60000 : 16 + Math.sin(i/8)*1.8 + (ord.indexOf('Return') >= 0 ? 7 : 0); }}); }(i));
      }
      options.ok(); return Promise.resolve();
    }
  };}},
  rpc: function (request) {
    var args = request.args, data = JSON.parse(sessionStorage.getItem('charts') || '[]');
    switch(request.method) {
      case 'historySamples':
        var start=Number(args[1]), end=Number(args[2]), rows=[];
        for(var i=0;i<120;i++) rows.push([start+(end-start)*i/120,16+Math.sin(i/8)*1.8+(args[0].indexOf('Return')>=0?7:0),i!==30,i===30?'fault':'ok']);
        return Promise.resolve(JSON.stringify({start:start,end:end,units:'°C',truncated:!!window.testTruncated,rows:rows}));
      case 'recentChanges':
        if(window.testAuditDenied)return Promise.reject(new Error('Permission denied'));
        return Promise.resolve(JSON.stringify({rows:[{time:Date.now(),target:'station:|slot:/Equipment/AHU1',slot:'set',operation:'Action invoked',user:'Operator',before:'',after:'21 °C'}],truncated:false,note:'Last recorded operator change; not attribution of current output.'}));
      case 'inspectPoint': return Promise.resolve(JSON.stringify({ord:args[0],displayName:'Zone Temperature',type:'control:NumericPoint',value:'72.4 °F',numeric:72.4,units:'°F',valid:true,status:'ok',groups:[],writable:false}));
      case 'zoneMatrix': return Promise.resolve(JSON.stringify({rows:[{name:'Zone 104',equipmentOrd:'station:|slot:/Equipment/Zone104',pointOrd:'station:|slot:/Equipment/Zone104/ZoneTemp',value:'76.8 °F',setpoint:'72 °F',numeric:76.8,setpointNumeric:72,deviation:4.8,valid:true,status:'ok',groups:[]},{name:'Zone 101',equipmentOrd:'station:|slot:/Equipment/Zone101',pointOrd:'station:|slot:/Equipment/Zone101/ZoneTemp',value:'Unavailable',setpoint:'72 °F',numeric:null,setpointNumeric:72,deviation:null,valid:false,status:'stale',groups:['stale']}]}));
      case 'preview': window.plannerRows=[{id:'1',equipment:'station:|slot:/Equipment/AHU1',source:'AHU1/command/out',target:'AHU1/proof/command',ready:true,status:'Ready to add'},{id:'2',equipment:'station:|slot:/Equipment/AHU2',source:'AHU2/command/out',target:'AHU2/proof/command',ready:false,status:'Blocked: existing incoming link'}];
        return Promise.resolve(JSON.stringify({token:'preview1',undoCount:0,message:'Preview ready',rows:plannerRows}));
      case 'apply': plannerRows[0].ready=false;plannerRows[0].status='Added';return Promise.resolve(JSON.stringify({token:'applied1',undoCount:1,message:'Selected links added',rows:plannerRows}));
      case 'undo': plannerRows[0].status='Preview again after undo';return Promise.resolve(JSON.stringify({token:'undo1',undoCount:0,message:'Removed 1 unchanged link',rows:plannerRows}));
      case 'keep':return Promise.resolve(JSON.stringify({token:'keep1',undoCount:0,message:'Links kept',rows:plannerRows}));
      case 'listHistories': return Promise.resolve(JSON.stringify({histories: histories}));
      case 'listCharts': return Promise.resolve(JSON.stringify({editable: !window.testReadonly, charts: data}));
      case 'saveChart':
      case 'saveChartWithAnalysis':
        if (window.testConflict) return Promise.reject(new Error('This chart changed in another session. Refresh and reopen it before saving.'));
        var chart = {id:args[1] || 'chart_'+Date.now(), revision:String(Date.now()), title:args[3],period:args[4],series:args[5],analysis:args[6]};
        data = data.filter(function (item) {return item.id !== chart.id;});data.push(chart);sessionStorage.setItem('charts',JSON.stringify(data));return Promise.resolve(JSON.stringify(chart));
      case 'deleteChart': data=data.filter(function(item){return item.id!==args[1];});sessionStorage.setItem('charts',JSON.stringify(data));return Promise.resolve('{"deleted":true}');
      case 'listSchedules': return Promise.resolve(JSON.stringify({schedules:[{displayName:'Office Occupancy',ord:'station:|slot:/Schedules/Office',value:'Occupied',outputSource:'Weekly Schedule',specialEventCount:2,editable:true,nextEventMillis:Date.now()+3600000,nextEvent:'in one hour'}]}));
      case 'getScheduleDetails': return Promise.resolve(JSON.stringify({schedule:{value:'Occupied',outputSource:'Holiday',specialEventCount:2,editable:true,days:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(function(day,i){return {label:day,events:i<5?[{startMinutes:480,finishMinutes:1080,value:'Occupied'}]:[]};})}}));
      case 'listPointHealth': return Promise.resolve('{"points":[],"counts":{},"totalCount":0}');
      case 'listOpenAlarms': return Promise.resolve('{"alarms":[]}');
      case 'listEquipmentProofFailures': return Promise.resolve('{"proofs":[{"displayName":"AHU-3 Proof","ord":"station:|slot:/Equipment/AHU3/proof","state":"failedToStart"}]}');
    }
    return Promise.reject(new Error('Unexpected test RPC '+request.method));
  }
};
window.define = function (deps, factory) {
  if (deps.indexOf('nmodule/basidekick/rc/widgets/OperationsOverview') >= 0) window.Dashboard=factory(baja,MockWidget,jQuery,Promise,window.SavedCharts,window.TrendAnalysis,window.RecentChanges,window.OperationsOverview);
  else if (deps.indexOf('nmodule/basidekick/rc/widgets/InspectorPanel') >= 0 && deps.indexOf('bajaux/Widget') >= 0) {
    var value=factory(MockWidget,jQuery,window.UI,window.InspectorPanel);
    if (!window.ValueCard) window.ValueCard=value; else if(!window.InspectorWidget)window.InspectorWidget=value; else window.Matrix=value;
  }
  else if (deps.indexOf('nmodule/basidekick/rc/widgets/UiFoundation') >= 0 && deps.indexOf('Promise') >= 0 && deps.indexOf('bajaux/Widget') < 0) {
    if(!window.InspectorPanel)window.InspectorPanel=factory(jQuery,Promise,window.UI);else window.OperationsOverview=factory(jQuery,Promise,window.UI);
  }
  else if (deps.indexOf('Promise') >= 0 && deps.indexOf('baja!') >= 0) window.UI=factory(baja,jQuery,Promise);
  else if (deps.indexOf('nmodule/basidekick/rc/widgets/UiFoundation') >= 0) window.Planner=factory(baja,MockWidget,jQuery,window.UI);
  else if (deps.length===1) window.TrendAnalysis=factory(jQuery);
  else if (!window.SavedCharts) window.SavedCharts=factory(baja,jQuery);
  else window.RecentChanges=factory(baja,jQuery);
};
