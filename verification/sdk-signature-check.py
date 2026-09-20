"""Inspect installed API signatures only. Does not compile or execute Niagara code."""
from pathlib import Path
import json, subprocess, zipfile
base = Path('/Volumes/[C] Niagara/JENEsys')
checks = {
 'baja': {
  'javax.baja.sys.BComponent': ['checkLink(', 'makeLink(', 'getSlotPathOrd(', 'getHandleOrd(', 'getChildComponents('],
  'javax.baja.sys.BComplex': ['getSlotFacets(', 'getSlot('],
  'javax.baja.status.BStatusNumeric': ['BStatusNumeric(double, javax.baja.status.BStatus)', 'getValue('],
  'javax.baja.status.BStatusBoolean': ['getValue('],
  'javax.baja.status.BStatus': ['isValid(', 'getBits('],
  'javax.baja.naming.BOrdList': ['DEFAULT;', 'size(', 'toArray('],
  'javax.baja.util.BWorker': ['getWorker(', 'started(', 'stopped('],
  'javax.baja.util.Queue': ['Queue(int)', 'enqueue(', 'clear('],
  'javax.baja.util.Worker': ['Worker(javax.baja.util.Worker$ITodo)'],
  'javax.baja.sys.Clock': ['ticks(', 'time()', 'schedulePeriodically('],
  'javax.baja.sys.BLink': ['getSourceSlotName(', 'getTargetSlotName(', 'getEnabled('],
  'javax.baja.sys.LinkCheck': ['isValid(', 'getInvalidReason('],
  'javax.baja.units.BUnit': ['boolean isNull(', 'java.lang.String getSymbol(javax.baja.sys.Context)'],
  'javax.baja.naming.BOrd': ['make(javax.baja.naming.BOrd, javax.baja.naming.BOrd)', 'normalize('],
 },
 'control-rt': {
  'javax.baja.control.BNumericPoint': ['javax.baja.status.BStatusNumeric getOut('],
  'javax.baja.control.BBooleanWritable': ['in16;', 'javax.baja.status.BStatusBoolean getIn16('],
 },
 'kitPx-wb': {'com.tridium.kitpx.BPopupProfile': ['public static final javax.baja.sys.Type TYPE;']},
 'workbench-wb': {'com.tridium.workbench.shell.BNiagaraWbDialog': ['BNiagaraWbDialog(javax.baja.sys.Type, javax.baja.ui.BWidget, javax.baja.naming.BOrd, java.lang.String, javax.baja.gx.BPoint, javax.baja.gx.BSize, boolean)', 'void open(']},
 'hx-wb': {
  'javax.baja.hx.px.binding.BHxPxBinding': ['void update(int, int, boolean, javax.baja.hx.HxOp)', 'void handle(javax.baja.ui.event.BInputEvent, javax.baja.hx.HxOp)'],
  'javax.baja.hx.PropertiesCollection$Styles': ['public javax.baja.hx.PropertiesCollection$Styles()'],
  'javax.baja.hx.PropertiesCollection': ['void add(java.lang.String, java.lang.String)', 'void write(javax.baja.hx.HxOp)'],
 },
 'history-rt': {
  'javax.baja.history.BHistoryService': ['getDatabase('],
  'javax.baja.history.HistorySpaceConnection': ['getHistory(', 'timeQuery('],
  'javax.baja.history.BHistoryId': ['make(java.lang.String)', 'encodeToString('],
  'javax.baja.history.BIHistory': ['javax.baja.history.BHistoryConfig getConfig()'],
  'javax.baja.history.BHistoryConfig': ['javax.baja.history.BHistoryRecord makeRecord()'],
  'javax.baja.history.BTrendRecord': ['getValueProperty(', 'getStatus(', 'getUnits('],
  'com.tridium.history.audit.BAbstractAuditHistorySource': ['getHistoryConfig(', 'getEnabled('],
  'com.tridium.history.audit.BAuditRecord': ['getOldValue(', 'getValue(', 'getUserName(', 'getTarget(', 'getSlotName('],
 }
}
results=[]
for version in ['4.15.1.16','4.15.3.28']:
 modules=base/('JENEsys-ProBuilder-N'+version)/'modules'
 if not modules.is_dir(): raise SystemExit('Required SDK unavailable: '+str(modules))
 count=0
 for module, classes in checks.items():
  jar=modules/(module+'.jar')
  for cls, expected in classes.items():
   output=subprocess.check_output(['javap','-classpath',str(jar),cls],text=True)
   for signature in expected: assert signature in output, (version,cls,signature)
   count+=1
 results.append({'sdk':version,'inspectedClasses':count,'result':'pass'})
report={'checks':results,'boundary':'Installed class signatures only. Current source was not compiled or loaded.'}
(Path(__file__).resolve().parents[1]/'task-reports/sdk-signature-validation.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report))
