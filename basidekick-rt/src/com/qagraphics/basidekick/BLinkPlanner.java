package com.qagraphics.basidekick;

import java.util.*;
import javax.baja.naming.*;
import javax.baja.nre.annotations.*;
import javax.baja.security.*;
import javax.baja.sys.*;

/** Manual property-link planner. Never replaces existing incoming links. */
@NiagaraType
@NoSlotomatic
public class BLinkPlanner extends BComponent
{
  public static final Property equipmentScope = newProperty(0, BOrd.NULL, null);
  public BOrd getEquipmentScope() { return (BOrd)get(equipmentScope); }
  public void setEquipmentScope(BOrd value) { set(equipmentScope, value); }
  public static final Property sourcePath = newProperty(0, "command", null);
  public String getSourcePath() { return getString(sourcePath); }
  public void setSourcePath(String value) { setString(sourcePath, value, null); }
  public static final Property sourceSlot = newProperty(0, "out", null);
  public String getSourceSlot() { return getString(sourceSlot); }
  public void setSourceSlot(String value) { setString(sourceSlot, value, null); }
  public static final Property targetPath = newProperty(0, "proof", null);
  public String getTargetPath() { return getString(targetPath); }
  public void setTargetPath(String value) { setString(targetPath, value, null); }
  public static final Property targetSlot = newProperty(0, "command", null);
  public String getTargetSlot() { return getString(targetSlot); }
  public void setTargetSlot(String value) { setString(targetSlot, value, null); }
  public static final Property report = newProperty(Flags.READONLY | Flags.TRANSIENT, "Configure a scope of equipment children, then preview in Link Planner.", null);
  public String getReport() { return getString(report); }
  public void setReport(String value) { setString(report, value, null); }
  public static final Action preview = newAction(0, null);
  public void preview() { invoke(preview, null, null); }
  public static final Action applySelected = newAction(0, BString.DEFAULT);
  public void applySelected(BString selected) { invoke(applySelected, selected, null); }
  public static final Action undoAddedLinks = newAction(0, null);
  public void undoAddedLinks() { invoke(undoAddedLinks, null, null); }
  private final Object planLock = new Object();
  private List<PlanRow> rows = new ArrayList<>();
  private final List<AddedLink> journal = new ArrayList<>();
  private String token = "", owner = "", configuration = "";
  private long preparedAt;
  @Override public Type getType() { return TYPE; }
  public static final Type TYPE = Sys.loadType(BLinkPlanner.class);
  public void doPreview(Context cx) throws Exception { previewPlan(cx); }
  public void doApplySelected(BString selected, Context cx) throws Exception { applyPlan(token, selected.toString(), cx); }
  public void doUndoAddedLinks(Context cx) throws Exception { undoPlan(token, cx); }
  @Override public void stopped() throws Exception {
    synchronized (planLock) { rows.clear(); journal.clear(); token = ""; }
    super.stopped();
  }
  private void authorize(Context cx) {
    if (cx == null || cx.getUser() == null || !isRunning()) throw new PermissionException();
    cx.getUser().check(this, BPermissions.adminWrite);
  }
  private String config() { return get(equipmentScope)+"\n"+getString(sourcePath)+"\n"+getString(sourceSlot)+"\n"+getString(targetPath)+"\n"+getString(targetSlot); }
  public String previewPlan(Context cx) throws Exception {
    authorize(cx);
    synchronized (planLock) {
      if (!journal.isEmpty() && !owner.equals(cx.getUser().getUsername()))
        throw new IllegalStateException("Another operator owns the current change journal");
      String scope = get(equipmentScope).toString();
      if (!scope.matches("station:\\|slot:/[^|?#]+")) throw new IllegalArgumentException("Select an equipment folder below station root");
      for (String path : new String[]{getString(sourcePath),getString(targetPath)})
        if (!path.matches("([A-Za-z0-9_$]+(/[A-Za-z0-9_$]+)*)?")) throw new IllegalArgumentException("Use relative component slot paths, without ORD schemes");
      for (String slot : new String[]{getString(sourceSlot),getString(targetSlot)})
        if (!slot.matches("[A-Za-z][A-Za-z0-9_$]*")) throw new IllegalArgumentException("Invalid source or target slot name");
      BComponent root = component(BOrd.make(scope), null, cx);
      BComponent[] equipment = root.getChildComponents();
      if (equipment.length > 100) throw new IllegalArgumentException("Narrow the scope to at most 100 equipment children");
      List<PlanRow> next = new ArrayList<>();
      for (BComponent unit : equipment) {
        cx.getUser().check(unit, BPermissions.operatorRead);
        PlanRow r = new PlanRow(); r.id = Integer.toString(next.size()+1); r.equipment = unit.getSlotPathOrd().toString();
        r.source = r.equipment + (getString(sourcePath).isEmpty() ? "" : "/" + getString(sourcePath));
        r.target = r.equipment + (getString(targetPath).isEmpty() ? "" : "/" + getString(targetPath));
        r.sourceSlot = getString(sourceSlot); r.targetSlot = getString(targetSlot);
        try {
          r.sourceComponent = component(BOrd.make(r.source), this, cx);
          r.targetComponent = component(BOrd.make(r.target), this, cx);
          r.sourceProperty = r.sourceComponent.getSlot(r.sourceSlot);
          r.targetProperty = r.targetComponent.getSlot(r.targetSlot);
          r.status = inspect(r, cx); r.ready = r.status.equals("Ready to add");
        } catch (Exception e) { r.status = "Blocked: " + e.getMessage(); }
        next.add(r);
      }
      rows = next; token = UUID.randomUUID().toString(); owner = cx.getUser().getUsername(); configuration = config(); preparedAt = Clock.ticks();
      return publish();
    }
  }
  public String applyPlan(String expectedToken, String selected, Context cx) throws Exception {
    authorize(cx);
    synchronized (planLock) {
      checkToken(expectedToken, cx);
      if (!config().equals(configuration) || Clock.ticks()-preparedAt > 300000)
        throw new IllegalStateException("Preview expired or configuration changed. Preview again.");
      if (selected == null || !selected.matches("[0-9]+(,[0-9]+)*") || selected.length() > 500)
        throw new IllegalArgumentException("Select row numbers separated by commas");
      Set<String> ids = new HashSet<>(Arrays.asList(selected.split(",")));
      List<PlanRow> chosen = new ArrayList<>();
      for (PlanRow r : rows) if (ids.remove(r.id)) { if (!r.ready) throw new IllegalArgumentException("Selected row is not ready: " + r.id); chosen.add(r); }
      if (!ids.isEmpty() || chosen.isEmpty()) throw new IllegalArgumentException("Selection is not in this preview");
      if (journal.size()+chosen.size() > 500) throw new IllegalStateException("Journal limit reached; review and keep or undo the previous links");
      // Recheck every selected row before the first change, then again immediately before each add.
      for (PlanRow r : chosen) if (!inspect(r,cx).equals("Ready to add")) throw new IllegalStateException("Wiring changed; preview again: row " + r.id);
      for (PlanRow r : chosen) {
        try {
          if (!inspect(r,cx).equals("Ready to add")) throw new IllegalStateException("Wiring changed during apply");
          BLink link = r.targetComponent.makeLink(r.sourceComponent,r.sourceProperty,r.targetProperty,cx);
          String name = "baskLink_" + UUID.randomUUID().toString().replace("-", "");
          try { r.targetComponent.add(name,link,cx); }
          finally {
            // Keep recovery information if an add callback fails after the slot is inserted.
            if (r.targetComponent.get(name) == link) journal.add(new AddedLink(r.targetComponent,name,link));
          }
          r.status = "Added"; r.ready = false;
        } catch (Exception e) { r.status = "Failed: " + e.getMessage(); r.ready = false; }
      }
      token = UUID.randomUUID().toString();
      return publish();
    }
  }
  public String undoPlan(String expectedToken, Context cx) throws Exception {
    authorize(cx);
    synchronized (planLock) {
      checkToken(expectedToken,cx);
      int removed = 0; List<AddedLink> retained = new ArrayList<>();
      for (AddedLink added : journal) {
        try {
          cx.getUser().check(added.target,BPermissions.adminWrite);
          if (added.target.get(added.name) != added.link || !added.snapshot.equals(snapshot(added.link))) { retained.add(added); continue; }
          added.target.remove(added.name,cx); removed++;
        } catch (Exception e) { retained.add(added); }
      }
      journal.clear(); journal.addAll(retained);
      for (PlanRow r : rows) { r.ready = false; r.status = "Preview again after undo"; }
      token = UUID.randomUUID().toString();
      return publish("Removed " + removed + " unchanged links created by this planner; " + retained.size() + " retained (changed, missing or denied)");
    }
  }
  public String keepLinks(String expectedToken, Context cx) {
    authorize(cx);
    synchronized(planLock) { checkToken(expectedToken,cx); journal.clear(); token = UUID.randomUUID().toString(); return publish("Applied links kept; undo journal cleared"); }
  }
  private void checkToken(String expected, Context cx) {
    if (token.isEmpty() || !token.equals(expected) || !owner.equals(cx.getUser().getUsername()))
      throw new IllegalStateException("Preview belongs to another session or changed. Preview again.");
  }
  private BComponent component(BOrd ord, BObject base, Context cx) throws Exception {
    OrdTarget t = ord.resolve(base,cx);
    if (!t.canRead() || !(t.get() instanceof BComponent)) throw new PermissionException();
    return (BComponent)t.get();
  }
  private String inspect(PlanRow r, Context cx) throws Exception {
    if (component(BOrd.make(r.source),this,cx) != r.sourceComponent || component(BOrd.make(r.target),this,cx) != r.targetComponent)
      throw new IllegalStateException("Endpoint replaced since preview");
    cx.getUser().check(r.sourceComponent,BPermissions.operatorRead);
    cx.getUser().check(r.targetComponent,BPermissions.adminWrite);
    if (r.targetComponent == this || r.sourceComponent == this) throw new IllegalArgumentException("Planner cannot be a link endpoint");
    if (r.sourceProperty == null || r.targetProperty == null || !r.sourceProperty.isProperty() || !r.targetProperty.isProperty())
      throw new IllegalArgumentException("First version supports property-to-property links only");
    if (r.sourceComponent.getSlot(r.sourceSlot) != r.sourceProperty || r.targetComponent.getSlot(r.targetSlot) != r.targetProperty)
      throw new IllegalStateException("Slot changed since preview");
    if (!r.sourceProperty.asProperty().getType().is(r.targetProperty.asProperty().getType()))
      throw new IllegalArgumentException("Types differ; configure conversion explicitly");
    for (BLink link : r.targetComponent.getLinks(r.targetProperty)) {
      BObject source;
      try { source = ((BOrd)link.get(BLink.sourceOrd)).get(r.targetComponent,cx); }
      catch (Exception e) { return "Blocked: existing incoming link"; }
      if (source == r.sourceComponent && link.getSourceSlotName().equals(r.sourceSlot) && link.getEnabled()) return "Already linked";
      return "Blocked: existing incoming link";
    }
    LinkCheck check = r.targetComponent.checkLink(r.sourceComponent,r.sourceProperty,r.targetProperty,cx);
    if (!check.isValid()) throw new IllegalArgumentException(check.getInvalidReason());
    return "Ready to add";
  }
  private static String snapshot(BLink link) { return link.get(BLink.sourceOrd)+"|"+link.getSourceSlotName()+"|"+link.getTargetSlotName()+"|"+link.getEnabled(); }
  private String publish() { return publish("Preview rows are exact property links. Only selected ready rows are added; existing wiring is preserved."); }
  private String publish(String message) {
    StringBuilder text = new StringBuilder(message); StringBuilder json = new StringBuilder("{\"token\":").append(quote(token)).append(",\"undoCount\":").append(journal.size()).append(",\"message\":").append(quote(message)).append(",\"rows\":[");
    boolean comma = false;
    for (PlanRow r : rows) {
      text.append('\n').append(r.id).append(": ").append(r.source).append('/').append(r.sourceSlot).append(" -> ").append(r.target).append('/').append(r.targetSlot).append(" : ").append(r.status);
      if (comma) json.append(','); comma = true;
      json.append("{\"id\":").append(quote(r.id)).append(",\"equipment\":").append(quote(r.equipment)).append(",\"source\":").append(quote(r.source+"/"+r.sourceSlot)).append(",\"target\":").append(quote(r.target+"/"+r.targetSlot)).append(",\"ready\":").append(r.ready).append(",\"status\":").append(quote(r.status)).append('}');
    }
    setString(report,text.toString(),null); return json.append("]}").toString();
  }
  private static String quote(String s) {
    StringBuilder b = new StringBuilder("\"");
    for (char c : String.valueOf(s).toCharArray()) {
      if (c == '"' || c == '\\') b.append('\\').append(c);
      else if (c < 32 || c == '\u2028' || c == '\u2029') b.append(String.format("\\u%04x",(int)c)); else b.append(c);
    }
    return b.append('"').toString();
  }
  private static class PlanRow {
    String id,equipment,source,target,sourceSlot,targetSlot,status; boolean ready;
    BComponent sourceComponent,targetComponent; Slot sourceProperty,targetProperty;
  }
  private static class AddedLink {
    final BComponent target; final String name,snapshot; final BLink link;
    AddedLink(BComponent target,String name,BLink link) { this.target=target;this.name=name;this.link=link;this.snapshot=snapshot(link); }
  }
}
