package com.qagraphics.basidekick.ux;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import javax.baja.alarm.AlarmDbConnection;
import javax.baja.alarm.BAckState;
import javax.baja.alarm.BAlarmClass;
import javax.baja.alarm.BAlarmRecord;
import javax.baja.alarm.BAlarmService;
import javax.baja.alarm.BSourceState;
import javax.baja.collection.BITable;
import javax.baja.collection.Row;
import javax.baja.collection.TableCursor;
import javax.baja.control.BControlPoint;
import com.qagraphics.basidekick.BEquipmentProof;
import javax.baja.history.BHistoryDevice;
import javax.baja.history.BHistoryId;
import javax.baja.history.BHistorySpace;
import javax.baja.history.BIHistory;
import javax.baja.naming.BOrd;
import javax.baja.naming.BOrdList;
import javax.baja.naming.OrdTarget;
import javax.baja.nre.annotations.NiagaraType;
import javax.baja.nre.annotations.NoSlotomatic;
import javax.baja.rpc.NiagaraRpc;
import javax.baja.rpc.Transport;
import javax.baja.rpc.TransportType;
import javax.baja.schedule.BAbstractSchedule;
import javax.baja.schedule.BDaySchedule;
import javax.baja.schedule.BTimeSchedule;
import javax.baja.schedule.BWeekSchedule;
import javax.baja.schedule.BWeeklySchedule;
import javax.baja.security.PermissionException;
import javax.baja.security.BPermissions;
import javax.baja.status.BStatus;
import javax.baja.status.BStatusValue;
import javax.baja.sys.Action;
import javax.baja.sys.BAbsTime;
import javax.baja.sys.BComponent;
import javax.baja.sys.BFacets;
import javax.baja.sys.BObject;
import javax.baja.sys.BString;
import javax.baja.sys.BTime;
import javax.baja.sys.BWeekday;
import javax.baja.sys.Clock;
import javax.baja.sys.Context;
import javax.baja.sys.Sys;
import javax.baja.sys.Type;
import javax.baja.user.BUser;
import javax.baja.util.BUuid;

/**
 * Permission-aware RPC methods used by {@link BOperationsDashboardWidget}.
 */
@NiagaraType
@NoSlotomatic
public final class BOperationsDashboardRpc extends BObject
{
  @Override
  public Type getType()
  {
    return TYPE;
  }

  public static final Type TYPE = Sys.loadType(BOperationsDashboardRpc.class);

  /**
   * Return every readable history in the active station History Space.
   */
  @NiagaraRpc(
    transports = {@Transport(type = TransportType.box)},
    permissions = "unrestricted")
  public static String listHistories(String historyParentName, Context cx) throws Exception
  {
    OrdTarget historyTarget = BOrd.make("history:").resolve(null, cx);
    if (!historyTarget.canRead())
    {
      throw new PermissionException();
    }

    BObject target = historyTarget.get();
    if (!(target instanceof BHistorySpace))
    {
      throw new IllegalStateException("History Space is unavailable");
    }

    BHistorySpace historySpace = (BHistorySpace) target;
    List<HistoryEntry> entries = new ArrayList<>();
    String parentName = normalizeHistoryParentName(historyParentName);

    BHistoryDevice[] devices = historySpace.listDevices();
    for (BHistoryDevice device : devices)
    {
      BIHistory[] histories = historySpace.listHistories(device);
      for (BIHistory history : histories)
      {
        BHistoryId id = history.getId();
        if (!parentName.isEmpty() && !parentName.equalsIgnoreCase(id.getDeviceName()))
        {
          continue;
        }

        BOrd ord = history.getOrdInSession();
        OrdTarget readableTarget = ord.resolve(null, cx);
        if (!readableTarget.canRead())
        {
          continue;
        }

        String displayName = history.getNavDisplayName(cx);
        if (displayName == null || displayName.trim().isEmpty())
        {
          displayName = id.getHistoryDisplayName();
        }

        entries.add(new HistoryEntry(
          id.getDeviceName(),
          id.getHistoryName(),
          displayName,
          ord.toString(),
          String.valueOf(history.getRecordType())
        ));
      }
    }

    Collections.sort(entries, new Comparator<HistoryEntry>()
    {
      @Override
      public int compare(HistoryEntry left, HistoryEntry right)
      {
        int deviceResult = left.device.compareToIgnoreCase(right.device);
        if (deviceResult != 0)
        {
          return deviceResult;
        }
        return left.displayName.compareToIgnoreCase(right.displayName);
      }
    });

    StringBuilder json = new StringBuilder(entries.size() * 160 + 32);
    json.append("{\"histories\":[");
    for (int i = 0; i < entries.size(); i++)
    {
      if (i > 0)
      {
        json.append(',');
      }
      entries.get(i).appendJson(json);
    }
    json.append("]}");
    return json.toString();
  }

  /**
   * Return every readable control point whose status is not normal.
   *
   * The query executes on the station so browser and UxMedia hosts use the
   * same bounded Box RPC contract.
   */
  @NiagaraRpc(
    transports = {@Transport(type = TransportType.box)},
    permissions = "unrestricted")
  public static String listPointHealth(Context cx) throws Exception
  {
    OrdTarget queryTarget = BOrd.make(
      "station:|slot:/|bql:select from control:ControlPoint" +
      " where status.alarm" +
      " or status.fault" +
      " or status.down" +
      " or status.stale" +
      " or status.overridden" +
      " or status.disabled" +
      " or status.null" +
      " or status.unackedAlarm").resolve(null, cx);
    if (!queryTarget.canRead())
    {
      throw new PermissionException();
    }

    BObject queryResult = queryTarget.get();
    if (!(queryResult instanceof BITable))
    {
      throw new IllegalStateException("Point health query is unavailable");
    }

    List<BControlPoint> points = new ArrayList<>();
    Map<String, BControlPoint> selected = new LinkedHashMap<>();
    int[] counts = new int[HEALTH_GROUP_KEYS.length];
    int[] kept = new int[HEALTH_GROUP_KEYS.length];
    int scanned = 0;
    int total = 0;
    try (TableCursor<?> cursor = ((BITable<?>) queryResult).cursor())
    {
      while (cursor.next() && scanned < MAX_HEALTH_SCAN)
      {
        scanned++;
        BControlPoint point = extractControlPoint(cursor);
        if (point == null || !readable(point, cx))
        {
          continue;
        }

        BStatus status;
        try
        {
          status = point.getStatus();
        }
        catch (Exception ignored)
        {
          continue;
        }
        if (status == null || status.isOk())
        {
          continue;
        }

        boolean[] groups = healthGroupFlags(status);
        boolean keep = false;
        for (int i = 0; i < groups.length; i++)
        {
          if (!groups[i])
          {
            continue;
          }
          counts[i]++;
          if (kept[i] < MAX_ROWS_PER_GROUP)
          {
            keep = true;
          }
        }
        if (!keep)
        {
          total++;
          continue;
        }

        String key = point.getSlotPath().toString();
        if (!selected.containsKey(key))
        {
          selected.put(key, point);
          for (int i = 0; i < groups.length; i++)
          {
            if (groups[i] && kept[i] < MAX_ROWS_PER_GROUP)
            {
              kept[i]++;
            }
          }
        }
        total++;
      }
    }

    points.addAll(selected.values());
    Collections.sort(points, new Comparator<BControlPoint>()
    {
      @Override
      public int compare(BControlPoint left, BControlPoint right)
      {
        return componentDisplayName(left, cx).compareToIgnoreCase(
          componentDisplayName(right, cx));
      }
    });

    StringBuilder json = new StringBuilder(points.size() * 220 + 160);
    json.append("{\"points\":[");
    boolean first = true;
    for (BControlPoint point : points)
    {
      BStatus status;
      try
      {
        status = point.getStatus();
      }
      catch (Exception ignored)
      {
        continue;
      }
      if (status == null || status.isOk())
      {
        continue;
      }

      if (!first)
      {
        json.append(',');
      }
      first = false;
      appendPointHealth(json, point, status, cx);
    }
    json.append("],\"counts\":{");
    for (int i = 0; i < HEALTH_GROUP_KEYS.length; i++)
    {
      if (i > 0)
      {
        json.append(',');
      }
      json.append('"');
      json.append(HEALTH_GROUP_KEYS[i]);
      json.append("\":");
      json.append(counts[i]);
    }
    json.append("},\"total\":");
    json.append(total);
    json.append('}');
    return json.toString();
  }

  /**
   * Return lightweight summaries for every readable weekly schedule.
   */
  @NiagaraRpc(
    transports = {@Transport(type = TransportType.box)},
    permissions = "unrestricted")
  public static String listSchedules(Context cx) throws Exception
  {
    OrdTarget queryTarget = BOrd.make(
      "station:|slot:/|bql:select from schedule:WeeklySchedule").resolve(null, cx);
    if (!queryTarget.canRead())
    {
      throw new PermissionException();
    }

    BObject queryResult = queryTarget.get();
    if (!(queryResult instanceof BITable))
    {
      throw new IllegalStateException("Schedule query is unavailable");
    }

    List<BAbstractSchedule> schedules = new ArrayList<>();
    try (TableCursor<?> cursor = ((BITable<?>) queryResult).cursor())
    {
      while (cursor.next() && schedules.size() < MAX_HEALTH_POINTS)
      {
        BWeeklySchedule schedule = extractWeeklySchedule(cursor);
        if (schedule != null && readable(schedule, cx))
        {
          schedules.add(schedule);
        }
      }
    }

    Collections.sort(schedules, new Comparator<BAbstractSchedule>()
    {
      @Override
      public int compare(BAbstractSchedule left, BAbstractSchedule right)
      {
        return displayName(left, cx).compareToIgnoreCase(displayName(right, cx));
      }
    });

    StringBuilder json = new StringBuilder(schedules.size() * 720 + 32);
    json.append("{\"schedules\":[");
    for (int i = 0; i < schedules.size(); i++)
    {
      if (i > 0)
      {
        json.append(',');
      }
      appendSchedule(json, schedules.get(i), cx, false);
    }
    json.append("]}");
    return json.toString();
  }

  /** Return readable proof blocks currently reporting a confirmed failure. */
  @NiagaraRpc(
    transports = {@Transport(type = TransportType.box)},
    permissions = "unrestricted")
  public static String listEquipmentProofFailures(Context cx) throws Exception
  {
    OrdTarget target = BOrd.make("station:|slot:/|bql:select from basidekick:EquipmentProof").resolve(null, cx);
    if (!target.canRead() || !(target.get() instanceof BITable)) throw new PermissionException();
    StringBuilder json = new StringBuilder("{\"proofs\":[");
    int count = 0;
    try (TableCursor<?> cursor = ((BITable<?>)target.get()).cursor())
    {
      while (cursor.next() && count < 200)
      {
        Object object = cursor.row() == null ? null : cursor.row().rowObject();
        if (!(object instanceof BEquipmentProof)) continue;
        BEquipmentProof proof = (BEquipmentProof)object;
        if (!readable(proof, cx) || !proof.getFailure().getStatus().isValid() || !proof.getFailure().getValue()) continue;
        if (count++ > 0) json.append(',');
        json.append("{\"displayName\":"); appendJsonString(json, componentDisplayName(proof, cx));
        json.append(",\"ord\":"); appendJsonString(json, stationSlotOrd(proof));
        json.append(",\"state\":"); appendJsonString(json, proof.getState());
        json.append('}');
      }
    }
    return json.append("]}").toString();
  }

  /**
   * Return the weekly calendar for one readable schedule selected in the UI.
   */
  @NiagaraRpc(
    transports = {@Transport(type = TransportType.box)},
    permissions = "unrestricted")
  public static String getScheduleDetails(String ordString, Context cx) throws Exception
  {
    String normalizedOrd = ordString == null ? "" : ordString.trim();
    if (!normalizedOrd.startsWith("station:|slot:/"))
    {
      throw new IllegalArgumentException("A station schedule ORD is required");
    }

    OrdTarget target = BOrd.make(normalizedOrd).resolve(null, cx);
    if (!target.canRead())
    {
      throw new PermissionException();
    }

    BComponent component = target.getComponent();
    if (!(component instanceof BWeeklySchedule))
    {
      throw new IllegalArgumentException("The selected component is not a weekly schedule");
    }

    StringBuilder json = new StringBuilder(1024);
    json.append("{\"schedule\":");
    appendSchedule(json, (BWeeklySchedule) component, cx, true);
    json.append('}');
    return json.toString();
  }

  private static String componentDisplayName(BComponent component, Context cx)
  {
    String displayName = component.getNavDisplayName(cx);
    if (displayName == null || displayName.trim().isEmpty())
    {
      displayName = component.getNavName();
    }
    return displayName == null ? "" : displayName;
  }

  private static void appendPointHealth(
    StringBuilder json,
    BControlPoint point,
    BStatus status,
    Context cx)
  {
    json.append('{');
    json.append("\"displayName\":");
    appendJsonString(json, componentDisplayName(point, cx));
    json.append(",\"slotPath\":");
    appendJsonString(json, point.getSlotPath().toString());
    json.append(",\"ord\":");
    appendJsonString(json, stationSlotOrd(point));
    json.append(",\"value\":");
    appendJsonString(json, point.getValueWithFacets(cx));
    json.append(",\"canRelease\":");
    json.append(canReleaseOverride(point, status, cx));
    json.append(",\"groups\":[");
    boolean first = true;
    first = appendStatusGroup(json, first, status.isAlarm(), "alarm");
    first = appendStatusGroup(json, first, status.isUnackedAlarm(), "unackedAlarm");
    first = appendStatusGroup(json, first, status.isFault(), "fault");
    first = appendStatusGroup(json, first, status.isDown(), "down");
    first = appendStatusGroup(json, first, status.isStale(), "stale");
    first = appendStatusGroup(json, first, status.isOverridden(), "overridden");
    first = appendStatusGroup(json, first, status.isDisabled(), "disabled");
    appendStatusGroup(json, first, status.isNull(), "null");
    json.append("]}");
  }

  private static boolean appendStatusGroup(
    StringBuilder json,
    boolean first,
    boolean active,
    String key)
  {
    if (!active)
    {
      return first;
    }
    if (!first)
    {
      json.append(',');
    }
    appendJsonString(json, key);
    return false;
  }

  /**
   * Return security-filtered open alarm records for the dashboard alarm tabs.
   * Copy records and close the alarm cursor before resolving sources so this
   * RPC cannot stall the station engine or hide point-status fallbacks.
   */
  @NiagaraRpc(
    transports = {@Transport(type = TransportType.box)},
    permissions = "unrestricted")
  public static String listOpenAlarms(Context cx) throws Exception
  {
    List<AlarmEntry> entries = new ArrayList<>();
    String error = "";
    try
    {
      List<BAlarmRecord> records = readOpenAlarmRecords(cx);
      for (int i = 0; i < records.size(); i++)
      {
        try
        {
          entries.add(AlarmEntry.make(records.get(i), cx));
        }
        catch (Exception ignored)
        {
          // Skip unreadable records so the Health tab still loads.
        }
      }
    }
    catch (Exception ex)
    {
      error = ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage();
    }

    Collections.sort(entries, new Comparator<AlarmEntry>()
    {
      @Override
      public int compare(AlarmEntry left, AlarmEntry right)
      {
        int classResult = left.alarmClassDisplayName.compareToIgnoreCase(
          right.alarmClassDisplayName);
        if (classResult != 0)
        {
          return classResult;
        }
        int priorityResult = Integer.compare(left.priority, right.priority);
        if (priorityResult != 0)
        {
          return priorityResult;
        }
        return right.timestamp.compareToIgnoreCase(left.timestamp);
      }
    });

    StringBuilder json = new StringBuilder(entries.size() * 420 + 64);
    json.append("{\"alarms\":[");
    for (int i = 0; i < entries.size(); i++)
    {
      if (i > 0)
      {
        json.append(',');
      }
      entries.get(i).appendJson(json);
    }
    json.append("]");
    if (!error.isEmpty())
    {
      json.append(",\"error\":");
      appendJsonString(json, error);
    }
    json.append('}');
    return json.toString();
  }

  /**
   * Acknowledge one open alarm using the same operator-write permission check
   * and acknowledgement transition used by Niagara's installed Hx Alarm Console.
   */
  @NiagaraRpc(
    transports = {@Transport(type = TransportType.box)},
    permissions = "unrestricted")
  public static String acknowledgeAlarm(String uuidString, Context cx) throws Exception
  {
    BUuid uuid = BUuid.make(uuidString == null ? "" : uuidString.trim());
    BAlarmRecord record = findOpenAlarm(uuid, cx);
    if (record == null)
    {
      throw new IllegalStateException("The alarm is no longer open");
    }
    if (record.isAcknowledged() || record.isAckPending())
    {
      return acknowledgementJson(record);
    }

    BAlarmService service = BAlarmService.getService();
    if (service == null)
    {
      throw new IllegalStateException("Alarm Service is unavailable");
    }

    BAlarmClass alarmClass = service.lookupAlarmClass(record.getAlarmClass());
    if (alarmClass == null)
    {
      alarmClass = service.getDefaultAlarmClass();
    }

    BUser user = cx.getUser();
    if (user == null || alarmClass == null)
    {
      throw new PermissionException();
    }
    user.check(alarmClass, BPermissions.operatorWrite);

    record.setUser(user.getUsername());
    record.setAckTime(BAbsTime.now());
    record.setAckState(BAckState.ackPending);

    AlarmDbConnection connection = service.getAlarmDb().getDbConnection(cx);
    try
    {
      BAlarmRecord existing = connection.getRecord(record.getUuid());
      if (existing == null || existing.getAckState() != BAckState.ackPending)
      {
        connection.update(record);
      }
    }
    finally
    {
      connection.close();
    }

    service.ackAlarm(record);
    return acknowledgementJson(record);
  }

  /**
   * Append a timestamped operator note to an open alarm, matching Niagara's
   * Hx Alarm Console note format.
   */
  @NiagaraRpc(
    transports = {@Transport(type = TransportType.box)},
    permissions = "unrestricted")
  public static String addAlarmNote(String uuidString, String noteText, Context cx)
    throws Exception
  {
    String note = noteText == null ? "" : noteText.trim();
    if (note.isEmpty())
    {
      throw new IllegalArgumentException("A note is required");
    }
    if (note.length() > 2000)
    {
      throw new IllegalArgumentException("Notes are limited to 2000 characters");
    }

    BUuid uuid = BUuid.make(uuidString == null ? "" : uuidString.trim());
    BAlarmRecord record = findOpenAlarm(uuid, cx);
    if (record == null)
    {
      throw new IllegalStateException("The alarm is no longer open");
    }

    requireAlarmClassWrite(record, cx);
    applyAlarmNote(record, note, cx);

    BAlarmService service = BAlarmService.getService();
    if (service == null)
    {
      throw new IllegalStateException("Alarm Service is unavailable");
    }

    AlarmDbConnection connection = service.getAlarmDb().getDbConnection(cx);
    try
    {
      connection.update(record);
    }
    finally
    {
      connection.close();
    }

    StringBuilder json = new StringBuilder(96);
    json.append("{\"uuid\":");
    appendJsonString(json, record.getUuid().encodeToString());
    json.append(",\"notes\":");
    appendJsonString(json, formattedAlarmField(record, BAlarmRecord.NOTES, cx));
    json.append('}');
    return json.toString();
  }

  /**
   * Release operator and, if still overridden, emergency priority on a writable
   * control point.
   */
  @NiagaraRpc(
    transports = {@Transport(type = TransportType.box)},
    permissions = "unrestricted")
  public static String releaseOverride(String ordString, Context cx) throws Exception
  {
    String normalizedOrd = ordString == null ? "" : ordString.trim();
    if (!normalizedOrd.startsWith("station:|slot:/"))
    {
      throw new IllegalArgumentException("A station point ORD is required");
    }

    OrdTarget target = BOrd.make(normalizedOrd).resolve(null, cx);
    if (!target.canRead())
    {
      throw new PermissionException();
    }

    BComponent component = target.getComponent();
    if (!(component instanceof BControlPoint))
    {
      throw new IllegalArgumentException("The selected component is not a control point");
    }

    BControlPoint point = (BControlPoint) component;
    if (!point.isWritablePoint())
    {
      throw new IllegalStateException("The selected point is not writable");
    }
    if (!canWrite(point, cx))
    {
      throw new PermissionException();
    }

    // post() queues onto the engine and returns. invoke() waits and can deadlock
    // the Health tab if this RPC is already running on Nre:Engine.
    invokeNamedAction(point, "auto", cx);
    invokeNamedAction(point, "emergencyAuto", cx);

    BStatus status = point.getStatus();
    boolean stillOverridden = status != null && status.isOverridden();
    StringBuilder json = new StringBuilder(160);
    json.append("{\"ord\":");
    appendJsonString(json, stationSlotOrd(point));
    json.append(",\"overridden\":");
    json.append(stillOverridden);
    json.append(",\"value\":");
    appendJsonString(json, point.getValueWithFacets(cx));
    json.append('}');
    return json.toString();
  }

  private static final int MAX_OPEN_ALARMS = 200;
  private static final int MAX_HEALTH_POINTS = 250;
  private static final int MAX_HEALTH_SCAN = 10000;
  private static final int MAX_ROWS_PER_GROUP = 200;
  private static final String[] HEALTH_GROUP_KEYS = {
    "alarm",
    "unackedAlarm",
    "fault",
    "down",
    "stale",
    "overridden",
    "disabled",
    "null"
  };

  private static boolean[] healthGroupFlags(BStatus status)
  {
    return new boolean[] {
      status.isAlarm(),
      status.isUnackedAlarm(),
      status.isFault(),
      status.isDown(),
      status.isStale(),
      status.isOverridden(),
      status.isDisabled(),
      status.isNull()
    };
  }

  private static List<BAlarmRecord> readOpenAlarmRecords(Context cx) throws Exception
  {
    return readOpenAlarmsFromBql(cx);
  }

  private static List<BAlarmRecord> readOpenAlarmsFromBql(Context cx) throws Exception
  {
    List<BAlarmRecord> records = new ArrayList<>();
    OrdTarget queryTarget = BOrd.make("alarm:|bql:select * from openAlarms").resolve(null, cx);
    if (!queryTarget.canRead())
    {
      throw new PermissionException();
    }

    BObject queryResult = queryTarget.get();
    if (!(queryResult instanceof BITable))
    {
      return records;
    }

    try (TableCursor<?> cursor = ((BITable<?>) queryResult).cursor())
    {
      while (cursor.next() && records.size() < MAX_OPEN_ALARMS)
      {
        BAlarmRecord record = copyAlarmRecord(cursor);
        if (record != null)
        {
          records.add(record);
        }
      }
    }
    return records;
  }

  private static BControlPoint extractControlPoint(TableCursor<?> cursor)
  {
    try
    {
      Row<?> row = cursor.row();
      if (row != null)
      {
        Object obj = row.rowObject();
        if (obj instanceof BControlPoint)
        {
          return (BControlPoint) obj;
        }
      }
    }
    catch (Exception ignored)
    {
    }
    try
    {
      Object got = cursor.get();
      if (got instanceof BControlPoint)
      {
        return (BControlPoint) got;
      }
    }
    catch (Exception ignored)
    {
    }
    return null;
  }

  private static BWeeklySchedule extractWeeklySchedule(TableCursor<?> cursor)
  {
    try
    {
      Row<?> row = cursor.row();
      if (row != null)
      {
        Object obj = row.rowObject();
        if (obj instanceof BWeeklySchedule)
        {
          return (BWeeklySchedule) obj;
        }
      }
    }
    catch (Exception ignored)
    {
    }
    try
    {
      Object got = cursor.get();
      if (got instanceof BWeeklySchedule)
      {
        return (BWeeklySchedule) got;
      }
    }
    catch (Exception ignored)
    {
    }
    return null;
  }

  private static BAlarmRecord copyAlarmRecord(TableCursor<?> cursor)
  {
    try
    {
      Row<?> row = cursor.row();
      if (row != null)
      {
        Object obj = row.rowObject();
        if (obj instanceof BAlarmRecord)
        {
          return (BAlarmRecord) ((BAlarmRecord) obj).newCopy();
        }
      }
    }
    catch (Exception ignored)
    {
    }
    try
    {
      Object got = cursor.get();
      if (got instanceof BAlarmRecord)
      {
        return (BAlarmRecord) ((BAlarmRecord) got).newCopy();
      }
    }
    catch (Exception ignored)
    {
    }
    return null;
  }

  private static BAlarmRecord findOpenAlarm(BUuid uuid, Context cx) throws Exception
  {
    String query = "alarm:|bql:select * from openAlarms where uuid = Uuid '" +
      uuid.encodeToString() + "'";
    OrdTarget target = BOrd.make(query).resolve(null, cx);
    if (!target.canRead())
    {
      throw new PermissionException();
    }

    BObject queryResult = target.get();
    if (!(queryResult instanceof BITable))
    {
      return null;
    }

    try (TableCursor<?> cursor = ((BITable<?>) queryResult).cursor())
    {
      if (cursor.next())
      {
        return copyAlarmRecord(cursor);
      }
    }
    return null;
  }

  private static String acknowledgementJson(BAlarmRecord record) throws IOException
  {
    StringBuilder json = new StringBuilder(96);
    json.append("{\"uuid\":");
    appendJsonString(json, record.getUuid().encodeToString());
    json.append(",\"ackState\":");
    appendJsonString(json, record.getAckState().getTag());
    json.append('}');
    return json.toString();
  }

  private static String normalizeHistoryParentName(String value)
  {
    String parent = value == null ? "" : value.trim();
    String stationPrefix = "station:|history:/";
    String historyPrefix = "history:/";
    if (parent.startsWith(stationPrefix))
    {
      parent = parent.substring(stationPrefix.length());
    }
    else if (parent.startsWith(historyPrefix))
    {
      parent = parent.substring(historyPrefix.length());
    }
    while (parent.startsWith("/"))
    {
      parent = parent.substring(1);
    }
    while (parent.endsWith("/"))
    {
      parent = parent.substring(0, parent.length() - 1);
    }
    return parent;
  }

  private static String displayName(BAbstractSchedule schedule, Context cx)
  {
    String displayName = schedule.getNavDisplayName(cx);
    if (displayName == null || displayName.trim().isEmpty())
    {
      displayName = schedule.getNavName();
    }
    return displayName == null ? "" : displayName;
  }

  private static String stationSlotOrd(BComponent component)
  {
    return "station:|" + component.getSlotPath();
  }

  private static String normalizeNavigationOrd(BOrd ord)
  {
    String normalized = ord == null ? "" : ord.toString();
    while (normalized.startsWith("local:|"))
    {
      normalized = normalized.substring("local:|".length());
    }
    return normalized;
  }

  private static void appendSchedule(
    StringBuilder json,
    BAbstractSchedule schedule,
    Context cx,
    boolean includeDays)
  {
    json.append('{');
    json.append("\"displayName\":");
    appendJsonString(json, displayName(schedule, cx));
    json.append(",\"slotPath\":");
    appendJsonString(json, schedule.getSlotPath().toString());
    json.append(",\"ord\":");
    appendJsonString(json, stationSlotOrd(schedule));
    json.append(",\"editable\":");
    json.append(canWrite(schedule, cx));
    json.append(",\"value\":");
    BObject output = schedule.get("out");
    appendJsonString(json, output instanceof BStatusValue ? formatStatusValue((BStatusValue)output, cx) : "");
    json.append(",\"outputSource\":");
    appendJsonString(json, schedule instanceof BWeeklySchedule ? ((BWeeklySchedule)schedule).getOutSource() : "");
    BWeeklySchedule weeklySchedule =
      schedule instanceof BWeeklySchedule ? (BWeeklySchedule) schedule : null;
    json.append(",\"specialEventCount\":");
    json.append(weeklySchedule == null ? 0 : weeklySchedule.getSpecialEventsChildren().length);
    BAbsTime nextEvent = schedule.nextEvent(BAbsTime.make(Clock.millis()));
    json.append(",\"nextEventMillis\":");
    json.append(nextEvent == null ? "null" : Long.toString(nextEvent.getMillis()));
    json.append(",\"nextEvent\":");
    appendJsonString(json, nextEvent == null ? "" : nextEvent.toString(cx));
    json.append(",\"days\":[");
    if (!includeDays)
    {
      json.append("]}");
      return;
    }

    BWeekSchedule week = weeklySchedule == null ? null : weeklySchedule.getWeek();
    BWeekday[] weekdays =
      weeklySchedule == null ? new BWeekday[0] : BWeekSchedule.daysInOrder(cx);
    for (int dayIndex = 0; dayIndex < weekdays.length; dayIndex++)
    {
      if (dayIndex > 0)
      {
        json.append(',');
      }

      BWeekday weekday = weekdays[dayIndex];
      BDaySchedule daySchedule = week == null ? null : week.get(weekday);
      BTimeSchedule[] times =
        daySchedule == null ? new BTimeSchedule[0] : daySchedule.getTimesInOrder();

      json.append('{');
      json.append("\"key\":");
      appendJsonString(json, weekday.getTag());
      json.append(",\"label\":");
      appendJsonString(json, weekday.getShortDisplayTag(cx));
      json.append(",\"events\":[");
      for (int eventIndex = 0; eventIndex < times.length; eventIndex++)
      {
        if (eventIndex > 0)
        {
          json.append(',');
        }

        BTimeSchedule timeSchedule = times[eventIndex];
        BTime start = timeSchedule.getStart();
        BTime finish = timeSchedule.getFinish();
        int startMinutes = minutesOfDay(start);
        int finishMinutes = minutesOfDay(finish);
        if (finishMinutes <= startMinutes)
        {
          finishMinutes = 1440;
        }

        json.append('{');
        json.append("\"startMinutes\":");
        json.append(startMinutes);
        json.append(",\"finishMinutes\":");
        json.append(finishMinutes);
        json.append(",\"value\":");
        appendJsonString(json, formatStatusValue(timeSchedule.getEffectiveValue(), cx));
        json.append('}');
      }
      json.append("]}");
    }

    json.append("]}");
  }

  private static int minutesOfDay(BTime time)
  {
    if (time == null)
    {
      return 0;
    }
    return time.getHour() * 60 + time.getMinute();
  }

  private static boolean readable(BComponent component, Context cx)
  {
    return cx != null && cx.getUser() != null && cx.getUser().getPermissionsFor(component).hasOperatorRead();
  }

  private static boolean canWrite(BComponent component, Context cx)
  {
    BUser user = cx.getUser();
    if (user == null)
    {
      return false;
    }
    BPermissions permissions = user.getPermissionsFor(component);
    return permissions.hasOperatorWrite() || permissions.hasAdminWrite();
  }

  private static boolean canReleaseOverride(
    BControlPoint point,
    BStatus status,
    Context cx)
  {
    if (status == null || !status.isOverridden() || !point.isWritablePoint() || !canWrite(point, cx))
    {
      return false;
    }
    return point.getAction("auto") != null || point.getAction("emergencyAuto") != null;
  }

  private static void invokeNamedAction(BControlPoint point, String actionName, Context cx)
  {
    Action action = point.getAction(actionName);
    if (action == null)
    {
      return;
    }
    point.post(action, null, cx);
  }

  private static void requireAlarmClassWrite(BAlarmRecord record, Context cx)
  {
    BAlarmService service = BAlarmService.getService();
    if (service == null)
    {
      throw new IllegalStateException("Alarm Service is unavailable");
    }

    BAlarmClass alarmClass = service.lookupAlarmClass(record.getAlarmClass());
    if (alarmClass == null)
    {
      alarmClass = service.getDefaultAlarmClass();
    }

    BUser user = cx.getUser();
    if (user == null || alarmClass == null)
    {
      throw new PermissionException();
    }
    user.check(alarmClass, BPermissions.operatorWrite);
  }

  private static boolean canAddAlarmNote(BAlarmRecord record, Context cx)
  {
    try
    {
      requireAlarmClassWrite(record, cx);
      return true;
    }
    catch (RuntimeException ignored)
    {
      return false;
    }
  }

  private static void applyAlarmNote(BAlarmRecord record, String note, Context cx)
  {
    BFacets alarmData = record.getAlarmData();
    String existing = "";
    if (alarmData != null)
    {
      BObject current = alarmData.get(BAlarmRecord.NOTES);
      if (current != null)
      {
        existing = current.toString();
      }
    }

    String username = "";
    BUser user = cx.getUser();
    if (user != null && user.getUsername() != null)
    {
      username = user.getUsername();
    }

    StringBuilder text = new StringBuilder();
    text.append("##");
    text.append(BAbsTime.now());
    text.append(" - ");
    text.append(username);
    text.append(" ##\n");
    text.append(note);
    text.append("\n\n");
    text.append(existing);

    BFacets notesFacet = BFacets.make(BAlarmRecord.NOTES, BString.make(text.toString()));
    if (alarmData == null)
    {
      record.setAlarmData(notesFacet);
    }
    else
    {
      record.setAlarmData(BFacets.make(alarmData, notesFacet));
    }
  }

  private static String formatStatusValue(BStatusValue value, Context cx)
  {
    return value == null ? "" : value.valueToString(cx);
  }

  private static void appendJsonString(StringBuilder json, String value)
  {
    json.append('"');
    if (value != null)
    {
      for (int i = 0; i < value.length(); i++)
      {
        char ch = value.charAt(i);
        switch (ch)
        {
          case '"':
            json.append("\\\"");
            break;
          case '\\':
            json.append("\\\\");
            break;
          case '\b':
            json.append("\\b");
            break;
          case '\f':
            json.append("\\f");
            break;
          case '\n':
            json.append("\\n");
            break;
          case '\r':
            json.append("\\r");
            break;
          case '\t':
            json.append("\\t");
            break;
          default:
            if (ch < 0x20)
            {
              String hex = Integer.toHexString(ch);
              json.append("\\u");
              for (int padding = hex.length(); padding < 4; padding++)
              {
                json.append('0');
              }
              json.append(hex);
            }
            else
            {
              json.append(ch);
            }
        }
      }
    }
    json.append('"');
  }

  private static String formattedAlarmField(
    BAlarmRecord record,
    String field,
    Context cx)
  {
    try
    {
      String value = record.getFormattedAlarmDataValue(field, cx);
      return value == null ? "" : value.trim();
    }
    catch (Exception ignored)
    {
      return "";
    }
  }

  private static final class AlarmEntry
  {
    private static AlarmEntry make(BAlarmRecord record, Context cx)
    {
      String sourceOrd = "";
      String displayName = "";
      String value = "";
      try
      {
        BOrdList sources = record.getSource();
        if (sources != null && !sources.isNull())
        {
          for (BOrd ord : sources)
          {
            if (ord != null)
            {
              sourceOrd = normalizeNavigationOrd(ord);
              break;
            }
          }
        }
      }
      catch (Exception ignored)
      {
      }

      displayName = formattedAlarmField(record, BAlarmRecord.SOURCE_NAME, cx);
      if (displayName.isEmpty())
      {
        displayName = sourceOrd;
      }
      value = formattedAlarmField(record, BAlarmRecord.PRESENT_VALUE, cx);
      if (value.isEmpty())
      {
        value = formattedAlarmField(record, BAlarmRecord.ALARM_VALUE, cx);
      }

      BSourceState sourceState = null;
      BAckState ackState = null;
      BAbsTime timestamp = null;
      int priority = 0;
      String alarmClass = "";
      String alarmClassDisplayName = "";
      boolean acknowledged = false;
      boolean ackPending = false;
      try
      {
        sourceState = record.getSourceState();
      }
      catch (Exception ignored)
      {
      }
      try
      {
        ackState = record.getAckState();
      }
      catch (Exception ignored)
      {
      }
      try
      {
        timestamp = record.getTimestamp();
      }
      catch (Exception ignored)
      {
      }
      try
      {
        priority = record.getPriority();
      }
      catch (Exception ignored)
      {
      }
      try
      {
        alarmClass = record.getAlarmClass();
      }
      catch (Exception ignored)
      {
      }
      try
      {
        alarmClassDisplayName = record.getAlarmClassDisplayName(cx);
      }
      catch (Exception ignored)
      {
      }
      try
      {
        acknowledged = record.isAcknowledged();
      }
      catch (Exception ignored)
      {
      }
      try
      {
        ackPending = record.isAckPending();
      }
      catch (Exception ignored)
      {
      }

      String uuid = "";
      try
      {
        if (record.getUuid() != null)
        {
          uuid = record.getUuid().encodeToString();
        }
      }
      catch (Exception ignored)
      {
      }

      return new AlarmEntry(
        uuid,
        sourceOrd,
        displayName,
        value,
        priority,
        alarmClass,
        alarmClassDisplayName,
        sourceState == null ? "" : sourceState.getTag(),
        ackState == null ? "" : ackState.getTag(),
        acknowledged,
        ackPending,
        timestamp == null ? "" : timestamp.toString(cx),
        formattedAlarmField(record, BAlarmRecord.MSG_TEXT, cx),
        formattedAlarmField(record, BAlarmRecord.INSTRUCTIONS, cx),
        formattedAlarmField(record, BAlarmRecord.NOTES, cx),
        true
      );
    }

    private AlarmEntry(
      String uuid,
      String sourceOrd,
      String displayName,
      String value,
      int priority,
      String alarmClass,
      String alarmClassDisplayName,
      String sourceState,
      String ackState,
      boolean acknowledged,
      boolean ackPending,
      String timestamp,
      String message,
      String instructions,
      String notes,
      boolean canAddNote)
    {
      this.uuid = uuid == null ? "" : uuid;
      this.sourceOrd = sourceOrd == null ? "" : sourceOrd;
      this.displayName = displayName == null ? "" : displayName;
      this.value = value == null ? "" : value;
      this.priority = priority;
      this.alarmClass = alarmClass == null ? "" : alarmClass;
      this.alarmClassDisplayName =
        alarmClassDisplayName == null ? "" : alarmClassDisplayName;
      this.sourceState = sourceState == null ? "" : sourceState;
      this.ackState = ackState == null ? "" : ackState;
      this.acknowledged = acknowledged;
      this.ackPending = ackPending;
      this.timestamp = timestamp == null ? "" : timestamp;
      this.message = message == null ? "" : message;
      this.instructions = instructions == null ? "" : instructions;
      this.notes = notes == null ? "" : notes;
      this.canAddNote = canAddNote;
    }

    private void appendJson(StringBuilder json)
    {
      json.append('{');
      json.append("\"uuid\":");
      appendJsonString(json, uuid);
      json.append(",\"sourceOrd\":");
      appendJsonString(json, sourceOrd);
      json.append(",\"displayName\":");
      appendJsonString(json, displayName);
      json.append(",\"value\":");
      appendJsonString(json, value);
      json.append(",\"priority\":");
      json.append(priority);
      json.append(",\"alarmClass\":");
      appendJsonString(json, alarmClass);
      json.append(",\"alarmClassDisplayName\":");
      appendJsonString(json, alarmClassDisplayName);
      json.append(",\"sourceState\":");
      appendJsonString(json, sourceState);
      json.append(",\"ackState\":");
      appendJsonString(json, ackState);
      json.append(",\"acknowledged\":");
      json.append(acknowledged);
      json.append(",\"ackPending\":");
      json.append(ackPending);
      json.append(",\"timestamp\":");
      appendJsonString(json, timestamp);
      json.append(",\"message\":");
      appendJsonString(json, message);
      json.append(",\"instructions\":");
      appendJsonString(json, instructions);
      json.append(",\"notes\":");
      appendJsonString(json, notes);
      json.append(",\"canAddNote\":");
      json.append(canAddNote);
      json.append('}');
    }

    private final String uuid;
    private final String sourceOrd;
    private final String displayName;
    private final String value;
    private final int priority;
    private final String alarmClass;
    private final String alarmClassDisplayName;
    private final String sourceState;
    private final String ackState;
    private final boolean acknowledged;
    private final boolean ackPending;
    private final String timestamp;
    private final String message;
    private final String instructions;
    private final String notes;
    private final boolean canAddNote;
  }

  private static final class HistoryEntry
  {
    private HistoryEntry(
      String device,
      String historyName,
      String displayName,
      String ord,
      String recordType)
    {
      this.device = device == null ? "" : device;
      this.historyName = historyName == null ? "" : historyName;
      this.displayName = displayName == null ? "" : displayName;
      this.ord = ord == null ? "" : ord;
      this.recordType = recordType == null ? "" : recordType;
    }

    private void appendJson(StringBuilder json)
    {
      json.append('{');
      json.append("\"device\":");
      appendJsonString(json, device);
      json.append(",\"historyName\":");
      appendJsonString(json, historyName);
      json.append(",\"displayName\":");
      appendJsonString(json, displayName);
      json.append(",\"ord\":");
      appendJsonString(json, ord);
      json.append(",\"recordType\":");
      appendJsonString(json, recordType);
      json.append('}');
    }

    private final String device;
    private final String historyName;
    private final String displayName;
    private final String ord;
    private final String recordType;
  }
}
