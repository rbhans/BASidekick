define(['bajaux/Widget','jquery','nmodule/basidekick/rc/widgets/UiFoundation','nmodule/basidekick/rc/widgets/InspectorPanel'],function(Widget,$,UI,Inspector){
  'use strict';
  function InspectorWidget(params){
    Widget.apply(this,[{params:params,defaults:{properties:{
      targetOrd:{value:'',typeSpec:'baja:Ord'},
      historyOrd:{value:'',typeSpec:'baja:Ord'},
      auditScopeOrd:{value:'',typeSpec:'baja:Ord'},
      detailOrd:{value:'',typeSpec:'baja:Ord'}
    }}}]);this.inspector=new Inspector();
  }
  InspectorWidget.prototype=Object.create(Widget.prototype);
  InspectorWidget.prototype.constructor=InspectorWidget;
  InspectorWidget.prototype.doInitialize=function(dom){
    UI.inject();this.$dom=dom.empty().addClass('bask-ui').css({height:'100%',background:'#fff'});
    dom.text('Select a point for the inspector.');
  };
  InspectorWidget.prototype.doLoad=function(value){
    if(!this.$dom)return;
    this.point=value||this.point;
    var ord=this.point&&typeof this.point.getNavOrd==='function'?String(this.point.getNavOrd()):UI.property(this,'targetOrd','');
    ord=ord.replace(/^(local:\|)+/,'').split('|view:')[0];
    if(!ord)return;
    if(ord.indexOf('slot:')===0)ord='station:|'+ord;
    this.$dom.empty();
    return this.inspector.open({ord:ord,historyOrd:UI.property(this,'historyOrd',''),auditScope:UI.property(this,'auditScopeOrd',''),detailOrd:UI.property(this,'detailOrd',''),container:this.$dom});
  };
  InspectorWidget.prototype.doChanged=function(){return this.doLoad();};
  InspectorWidget.prototype.doDestroy=function(){this.inspector.close();if(this.$dom)this.$dom.empty();};
  return InspectorWidget;
});
