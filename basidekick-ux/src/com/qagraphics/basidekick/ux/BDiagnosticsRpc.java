package com.qagraphics.basidekick.ux;

import com.tridium.history.audit.BAuditHistoryService;
import com.tridium.history.audit.BAuditRecord;
import javax.baja.control.BControlPoint;
import javax.baja.collection.*;
import javax.baja.history.*;
import javax.baja.naming.*;
import javax.baja.nre.annotations.*;
import javax.baja.rpc.*;
import javax.baja.security.*;
import javax.baja.status.*;
import javax.baja.sys.*;
import javax.baja.units.BUnit;

/** Bounded, caller-authorized history and audit reads for the dashboard. */
@NiagaraType
@NoSlotomatic
public final class BDiagnosticsRpc extends BObject
{
  @Override public Type getType() { return TYPE; }
  public static final Type TYPE = Sys.loadType(BDiagnosticsRpc.class);

  @NiagaraRpc(transports = {@Transport(type = TransportType.box)}, permissions = "unrestricted")
  public static String historySamples(String ord, String start, String end, Context cx) throws Exception
  {
    requireUser(cx);
    long[] range = range(start, end);
    if (ord == null || !ord.matches("history:/[^|?\\s]+") || ord.length() > 2000)
      throw new IllegalArgumentException("Choose a local history");
    OrdTarget resolved = BOrd.make(ord).resolve(null, cx);
    if (!resolved.canRead()) throw new PermissionException();
    if (!(resolved.get() instanceof BIHistory)) throw new IllegalArgumentException("History unavailable");
    BIHistory selected = (BIHistory)resolved.get();
    BHistoryService service = (BHistoryService)Sys.getService(BHistoryService.TYPE);
    StringBuilder rows = new StringBuilder();
    int count = 0; boolean truncated = false; String units = "";
    try (HistorySpaceConnection connection = service.getDatabase().getConnection(cx)) {
      BIHistory history = connection.getHistory(selected.getId());
      if (history == null) throw new IllegalArgumentException("History unavailable");
      // HistoryExt stores the point's units in <value property name>Facets.
      // Raw database records can retain BUnit.NULL even for a unit-bearing history.
      BHistoryConfig config = history.getConfig();
      BHistoryRecord prototype = config.makeRecord();
      if (prototype instanceof BTrendRecord) {
        String facetsName = ((BTrendRecord)prototype).getValueProperty().getName() + "Facets";
        Property facetsProperty = config.loadSlots().getProperty(facetsName);
        BValue facets = facetsProperty == null ? null : config.get(facetsProperty);
        if (facets instanceof BFacets) units = unitLabel(((BFacets)facets).get(BFacets.UNITS), cx);
      }
      try (TableCursor<BHistoryRecord> cursor = connection.timeQuery(history, BAbsTime.make(range[0]), BAbsTime.make(range[1])).cursor()) {
        while (cursor.next()) {
          if (count == 10000) { truncated = true; break; }
          BHistoryRecord record = cursor.row().rowObject();
          if (record.getTimestamp().getMillis() >= range[1]) continue;
          if (!(record instanceof BTrendRecord)) throw new IllegalArgumentException("Select a numeric, Boolean or enum trend history");
          BTrendRecord trend = (BTrendRecord)record;
          BValue value = trend.get(trend.getValueProperty());
          double number;
          if (value instanceof BNumber) number = ((BNumber)value).getDouble();
          else if (value instanceof BBoolean) number = ((BBoolean)value).getBoolean() ? 1 : 0;
          else if (value instanceof BEnum) number = ((BEnum)value).getOrdinal();
          else throw new IllegalArgumentException("This history has no numeric chart representation");
          if (units.isEmpty()) units = unitLabel(trend.getUnits(), cx);
          if (count++ > 0) rows.append(',');
          rows.append('[').append(record.getTimestamp().getMillis()).append(',')
            .append(Double.isFinite(number) ? Double.toString(number) : "null").append(',')
            .append(trend.getStatus().isValid() && Double.isFinite(number)).append(',')
            .append(json(trend.getStatus().toString())).append(']');
        }
      }
    }
    return "{\"start\":" + range[0] + ",\"end\":" + range[1] + ",\"truncated\":" + truncated +
      ",\"units\":" + json(units) + ",\"rows\":[" + rows + "]}";
  }

  @NiagaraRpc(transports = {@Transport(type = TransportType.box)}, permissions = "unrestricted")
  public static String recentChanges(String scope, String start, String end, Context cx) throws Exception
  {
    requireUser(cx); long[] range = range(start, end);
    if (scope == null || !scope.matches("station:\\|slot:/[^|?#]*") || scope.length() > 2000)
      throw new IllegalArgumentException("Use a station component ORD for equipment scope");
    OrdTarget target = BOrd.make(scope).resolve(null, cx);
    if (!target.canRead() || !(target.get() instanceof BComponent)) throw new PermissionException();
    BAuditHistoryService audit = (BAuditHistoryService)Sys.getService(BAuditHistoryService.TYPE);
    if (audit == null) throw new IllegalStateException("Audit History Service is unavailable");
    cx.getUser().check(audit, BPermissions.operatorRead);
    if (!audit.getEnabled()) throw new IllegalStateException("Audit History Service is disabled");
    BHistoryId id = audit.getHistoryConfig().getId();
    OrdTarget historyTarget = BOrd.make("history:" + id.toString()).resolve(null, cx);
    if (!historyTarget.canRead()) throw new PermissionException();
    String path = scope.substring("station:|".length());
    if (path.endsWith("/") && !path.equals("slot:/")) path = path.substring(0, path.length() - 1);
    StringBuilder rows = new StringBuilder(); int scanned = 0, returned = 0; boolean truncated = false;
    BHistoryService service = (BHistoryService)Sys.getService(BHistoryService.TYPE);
    try (HistorySpaceConnection connection = service.getDatabase().getConnection(cx)) {
      BIHistory history = connection.getHistory(id);
      if (history == null) throw new IllegalStateException("Audit history is unavailable");
      try (TableCursor<BHistoryRecord> cursor = connection.timeQuery(history, BAbsTime.make(range[0]), BAbsTime.make(range[1]), true).cursor()) {
        while (cursor.next()) {
          if (scanned++ >= 10000 || returned >= 200) { truncated = true; break; }
          BHistoryRecord record = cursor.row().rowObject();
          if (record.getTimestamp().getMillis() >= range[1] || !(record instanceof BAuditRecord)) continue;
          BAuditRecord r = (BAuditRecord)record;
          String recordPath = r.getTarget();
          if (recordPath.startsWith("station:|")) recordPath = recordPath.substring("station:|".length());
          if (!(recordPath.equals(path) || recordPath.startsWith(path.equals("slot:/") ? path : path + "/"))) continue;
          if (returned++ > 0) rows.append(',');
          rows.append("{\"time\":").append(r.getTimestamp().getMillis())
            .append(",\"target\":").append(json(r.getTarget())).append(",\"slot\":").append(json(r.getSlotName()))
            .append(",\"operation\":").append(json(r.getOperation())).append(",\"user\":").append(json(r.getUserName()))
            .append(",\"before\":").append(json(r.getOldValue())).append(",\"after\":").append(json(r.getValue())).append('}');
        }
      }
    }
    return "{\"rows\":[" + rows + "],\"truncated\":" + truncated + ",\"scanned\":" + scanned +
      ",\"note\":\"Recorded operator events only. Retention may omit older events; these records do not identify the cause of the current output.\"}";
  }

  /** Return the current, caller-readable state for one local control point. */
  @NiagaraRpc(transports = {@Transport(type = TransportType.box)}, permissions = "unrestricted")
  public static String inspectPoint(String ord, Context cx) throws Exception
  {
    requireUser(cx);
    BControlPoint point = point(ord, cx);
    BStatusValue out = point.getOutStatusValue();
    BStatus status = out == null ? BStatus.nullStatus : out.getStatus();
    Double numeric = out instanceof BStatusNumeric ? ((BStatusNumeric)out).getValue() : null;
    String units = unitLabel(point.getFacets().get(BFacets.UNITS), cx);
    return "{\"ord\":" + json(stationOrd(point)) +
      ",\"displayName\":" + json(displayName(point, cx)) +
      ",\"type\":" + json(point.getType().getTypeSpec().toString()) +
      ",\"value\":" + json(point.getValueWithFacets(cx)) +
      ",\"numeric\":" + (numeric == null || !Double.isFinite(numeric) ? "null" : numeric.toString()) +
      ",\"units\":" + json(units) +
      ",\"valid\":" + status.isValid() +
      ",\"status\":" + json(status.toString()) +
      ",\"groups\":" + statusGroups(status) +
      ",\"writable\":" + point.isWritablePoint() + "}";
  }

  private static String unitLabel(BObject value, Context cx)
  {
    if (!(value instanceof BUnit) || ((BUnit)value).isNull()) return "";
    return ((BUnit)value).getSymbol(cx);
  }

  /**
   * Compare one numeric value and setpoint beneath each immediate child of a
   * readable equipment folder. Missing points remain visible as unavailable.
   */
  @NiagaraRpc(transports = {@Transport(type = TransportType.box)}, permissions = "unrestricted")
  public static String zoneMatrix(String scope, String valuePath, String setpointPath, Context cx) throws Exception
  {
    requireUser(cx);
    BComponent root = component(scope, cx);
    String value = relativePath(valuePath, "Value path");
    String setpoint = relativePath(setpointPath, "Setpoint path");
    BComponent[] children = root.getChildComponents();
    if (children.length > 200) throw new IllegalArgumentException("Narrow the scope to at most 200 immediate children");
    StringBuilder rows = new StringBuilder();
    int returned = 0;
    for (BComponent child : children)
    {
      if (!cx.getUser().getPermissionsFor(child).hasOperatorRead()) continue;
      BControlPoint actual = optionalPoint(child, value, cx);
      BControlPoint target = optionalPoint(child, setpoint, cx);
      BStatusValue actualOut = actual == null ? null : actual.getOutStatusValue();
      BStatusValue targetOut = target == null ? null : target.getOutStatusValue();
      Double actualNumber = actualOut instanceof BStatusNumeric ? ((BStatusNumeric)actualOut).getValue() : null;
      Double targetNumber = targetOut instanceof BStatusNumeric ? ((BStatusNumeric)targetOut).getValue() : null;
      BStatus status = actualOut == null ? BStatus.nullStatus : actualOut.getStatus();
      boolean valid = actualNumber != null && targetNumber != null && status.isValid() && targetOut.getStatus().isValid();
      if (returned++ > 0) rows.append(',');
      rows.append("{\"name\":").append(json(displayName(child, cx)))
        .append(",\"equipmentOrd\":").append(json(stationOrd(child)))
        .append(",\"pointOrd\":").append(json(actual == null ? "" : stationOrd(actual)))
        .append(",\"value\":").append(json(actual == null ? "Unavailable" : actual.getValueWithFacets(cx)))
        .append(",\"setpoint\":").append(json(target == null ? "Unavailable" : target.getValueWithFacets(cx)))
        .append(",\"numeric\":").append(actualNumber == null || !Double.isFinite(actualNumber) ? "null" : actualNumber)
        .append(",\"setpointNumeric\":").append(targetNumber == null || !Double.isFinite(targetNumber) ? "null" : targetNumber)
        .append(",\"deviation\":").append(valid ? Double.toString(actualNumber - targetNumber) : "null")
        .append(",\"valid\":").append(valid)
        .append(",\"status\":").append(json(status.toString()))
        .append(",\"groups\":").append(statusGroups(status)).append('}');
    }
    return "{\"rows\":[" + rows + "],\"scope\":" + json(scope) +
      ",\"valuePath\":" + json(value) + ",\"setpointPath\":" + json(setpoint) + "}";
  }

  private static void requireUser(Context cx) { if (cx == null || cx.getUser() == null) throw new PermissionException(); }
  private static BComponent component(String ord, Context cx) throws Exception {
    if (ord == null || ord.length() > 2000 || !ord.matches("station:\\|slot:/[^|?#]*"))
      throw new IllegalArgumentException("Use a local station component ORD");
    OrdTarget target = BOrd.make(ord).resolve(null, cx);
    if (!target.canRead() || !(target.get() instanceof BComponent)) throw new PermissionException();
    return (BComponent)target.get();
  }
  private static BControlPoint point(String ord, Context cx) throws Exception {
    BComponent component = component(ord, cx);
    if (!(component instanceof BControlPoint)) throw new IllegalArgumentException("Select a control point");
    return (BControlPoint)component;
  }
  private static String relativePath(String path, String label) {
    String value = path == null ? "" : path.trim();
    if (!value.matches("[A-Za-z0-9_$]+(/[A-Za-z0-9_$]+)*"))
      throw new IllegalArgumentException(label + " must be a relative component path");
    return value;
  }
  private static BControlPoint optionalPoint(BComponent base, String path, Context cx) {
    try {
      OrdTarget target = BOrd.make("slot:" + path).resolve(base, cx);
      if (target.canRead() && target.get() instanceof BControlPoint) return (BControlPoint)target.get();
    } catch (Exception ignored) {}
    return null;
  }
  private static String stationOrd(BComponent component) { return "station:|" + component.getSlotPath(); }
  private static String displayName(BComponent component, Context cx) {
    String name = component.getNavDisplayName(cx);
    return name == null || name.trim().isEmpty() ? component.getNavName() : name;
  }
  private static String statusGroups(BStatus status) {
    StringBuilder result = new StringBuilder("["); boolean comma = false;
    String[] names = {"alarm","unackedAlarm","fault","down","stale","overridden","disabled","null"};
    boolean[] values = {status.isAlarm(),status.isUnackedAlarm(),status.isFault(),status.isDown(),status.isStale(),status.isOverridden(),status.isDisabled(),status.isNull()};
    for (int i=0;i<names.length;i++) if (values[i]) { if (comma) result.append(','); comma=true; result.append(json(names[i])); }
    return result.append(']').toString();
  }
  private static long[] range(String start, String end) {
    long a = Long.parseLong(start), b = Long.parseLong(end);
    if (a < 0 || b <= a || b - a > 366L * 86400000 || b > Clock.millis() + 60000)
      throw new IllegalArgumentException("Select a range of at most 366 days ending no later than now");
    return new long[] {a,b};
  }
  private static String json(String s) {
    if (s == null) return "null";
    StringBuilder b = new StringBuilder("\"");
    // Bound potentially large audit values without implying the displayed value is complete.
    if (s.length() > 2000) s = s.substring(0, 2000) + " [truncated]";
    for (char c : s.toCharArray()) {
      if (c == '"' || c == '\\') b.append('\\').append(c);
      else if (c < 32 || c == '\u2028' || c == '\u2029') b.append(String.format("\\u%04x", (int)c));
      else b.append(c);
    }
    return b.append('"').toString();
  }
}
