package com.qagraphics.basidekick.ux;

import java.util.UUID;
import java.util.HashSet;
import java.util.Set;
import com.qagraphics.basidekick.BChartLibrary;
import com.qagraphics.basidekick.BSavedChart;
import javax.baja.naming.BOrd;
import javax.baja.naming.OrdTarget;
import javax.baja.nre.annotations.NiagaraType;
import javax.baja.nre.annotations.NoSlotomatic;
import javax.baja.rpc.*;
import javax.baja.security.BPermissions;
import javax.baja.security.PermissionException;
import javax.baja.sys.*;

/** Station-backed presets shared by the Workbench and web dashboard hosts. */
@NiagaraType
@NoSlotomatic
public final class BChartLibraryRpc extends BObject
{
  @Override public Type getType() { return TYPE; }
  public static final Type TYPE = Sys.loadType(BChartLibraryRpc.class);

  @NiagaraRpc(transports = {@Transport(type = TransportType.box)}, permissions = "unrestricted")
  public static String listCharts(String libraryOrd, Context cx) throws Exception
  {
    BChartLibrary library = library(libraryOrd, cx, false, false);
    if (library == null)
      return "{\"editable\":" + cx.getUser().getPermissionsFor(stationRoot(cx)).hasAdminWrite() + ",\"charts\":[]}";
    StringBuilder out = new StringBuilder("{\"editable\":");
    out.append(cx.getUser().getPermissionsFor(library).hasAdminWrite()).append(",\"charts\":[");
    boolean comma = false;
    synchronized (library)
    {
      for (BSavedChart chart : library.getChildren(BSavedChart.class))
      {
        if (!cx.getUser().getPermissionsFor(chart).hasOperatorRead()) continue;
        if (comma) out.append(',');
        out.append("{\"id\":").append(json(chart.getName()))
          .append(",\"title\":").append(json(chart.getTitle()))
          .append(",\"period\":").append(json(chart.getPeriod()))
          .append(",\"series\":").append(json(chart.getSeries()))
          .append(",\"analysis\":").append(json(chart.getAnalysis()))
          .append(",\"revision\":").append(json(chart.getRevision())).append('}');
        comma = true;
      }
    }
    return out.append("]}").toString();
  }

  @NiagaraRpc(transports = {@Transport(type = TransportType.box)}, permissions = "unrestricted")
  public static String saveChart(String libraryOrd, String id, String revision,
    String title, String period, String series, Context cx) throws Exception
  {
    return saveChartWithAnalysis(libraryOrd, id, revision, title, period, series, "sample;60;false", cx);
  }

  @NiagaraRpc(transports = {@Transport(type = TransportType.box)}, permissions = "unrestricted")
  public static String saveChartWithAnalysis(String libraryOrd, String id, String revision,
    String title, String period, String series, String analysis, Context cx) throws Exception
  {
    if (analysis == null || !analysis.matches("(sample|time);[0-9]{1,5};(true|false)(;(true|false))?"))
      throw new IllegalArgumentException("Invalid chart analysis settings");
    int gap = Integer.parseInt(analysis.split(";")[1]);
    if (gap < 1 || gap > 10080) throw new IllegalArgumentException("Maximum gap must be from 1 to 10080 minutes");
    title = title == null ? "" : title.trim();
    if (title.isEmpty() || title.length() > 80) throw new IllegalArgumentException("Use a chart name of 1 to 80 characters.");
    if (!"last24Hours".equals(period) && !"last7Days".equals(period) &&
        !"monthToDate".equals(period) && !"yearToDate".equals(period))
      throw new IllegalArgumentException("Unsupported chart time range.");
    validateSeries(series);
    BChartLibrary library = library(libraryOrd, cx, true, true);
    synchronized (library)
    {
      BSavedChart chart;
      if (id == null || id.isEmpty())
      {
        if (library.getChildren(BSavedChart.class).length >= 100)
          throw new IllegalArgumentException("This library already contains 100 charts.");
        id = "chart_" + UUID.randomUUID().toString().replace("-", "");
        chart = new BSavedChart();
      }
      else chart = existing(library, id, revision, cx);
      // Apply the complete setup as a batched component slot update.
      chart.set(new Property[] {BSavedChart.title, BSavedChart.period, BSavedChart.series, BSavedChart.analysis, BSavedChart.revision},
        new BValue[] {BString.make(title), BString.make(period), BString.make(series), BString.make(analysis),
          BString.make(UUID.randomUUID().toString())}, chart.getParent() != null ? cx : null);
      if (chart.getParent() == null) library.add(id, chart, cx);
      return "{\"id\":" + json(id) + ",\"revision\":" + json(chart.getRevision()) + "}";
    }
  }

  @NiagaraRpc(transports = {@Transport(type = TransportType.box)}, permissions = "unrestricted")
  public static String deleteChart(String libraryOrd, String id, String revision, Context cx) throws Exception
  {
    BChartLibrary library = library(libraryOrd, cx, true, false);
    if (library == null) throw new IllegalArgumentException("This chart no longer exists.");
    synchronized (library)
    {
      existing(library, id, revision, cx);
      library.remove(id, cx);
    }
    return "{\"deleted\":true}";
  }

  private static BSavedChart existing(BChartLibrary library, String id, String revision, Context cx)
  {
    if (id == null || !id.matches("[A-Za-z][A-Za-z0-9_]{0,80}"))
      throw new IllegalArgumentException("Invalid chart identifier.");
    BValue value = library.get(id);
    if (!(value instanceof BSavedChart)) throw new IllegalArgumentException("This chart no longer exists. Refresh the library.");
    BSavedChart chart = (BSavedChart)value;
    cx.getUser().check(chart, BPermissions.adminWrite);
    if (!chart.getRevision().equals(revision))
      throw new IllegalStateException("This chart changed in another session. Refresh and reopen it before saving.");
    return chart;
  }

  private static BComponent stationRoot(Context cx) throws Exception
  {
    OrdTarget target = BOrd.make("station:|slot:/").resolve(null, cx);
    if (!target.canRead()) throw new PermissionException();
    return (BComponent)target.get();
  }

  private static BChartLibrary library(String ord, Context cx, boolean write, boolean create) throws Exception
  {
    if (cx == null || cx.getUser() == null) throw new PermissionException();
    if (ord == null || !ord.matches("station:\\|slot:/[^|?#]*"))
      throw new IllegalArgumentException("Set Chart Library to a station component ORD.");
    // Existing Px pages may have persisted the old default. Keep a library
    // already installed there; otherwise use the new default automatically.
    if ("station:|slot:/Services/BasidekickCharts".equals(ord))
    {
      OrdTarget services = BOrd.make("station:|slot:/Services").resolve(null, cx);
      if (!services.canRead()) throw new PermissionException();
      if (((BComponent)services.get()).get("BasidekickCharts") == null)
        ord = "station:|slot:/BasidekickCharts";
    }
    // Provision only the default location, on an explicit, validated Save.
    // Merely opening a dashboard never changes the station.
    if ("station:|slot:/BasidekickCharts".equals(ord))
    {
      BComponent root = stationRoot(cx);
      synchronized (root)
      {
        BValue existing = root.get("BasidekickCharts");
        if (existing == null)
        {
          if (!create) return null;
          cx.getUser().check(root, BPermissions.adminWrite);
          BChartLibrary library = new BChartLibrary();
          root.add("BasidekickCharts", library, cx);
        }
      }
    }
    OrdTarget target = BOrd.make(ord).resolve(null, cx);
    if (!target.canRead()) throw new PermissionException();
    if (!(target.get() instanceof BChartLibrary))
      throw new IllegalArgumentException("The configured component is not a basidekick Chart Library.");
    BChartLibrary library = (BChartLibrary)target.get();
    if (write) cx.getUser().check(library, BPermissions.adminWrite);
    return library;
  }

  private static void validateSeries(String text)
  {
    if (text == null || text.isEmpty() || text.length() > 24000)
      throw new IllegalArgumentException("Add at least one history before saving.");
    String[] rows = text.split("\n", -1);
    if (rows.length > 12) throw new IllegalArgumentException("A chart supports up to 12 histories.");
    Set<String> ords = new HashSet<>();
    for (String row : rows)
    {
      String[] fields = row.split("\t", -1);
      if (fields.length != 3 || !fields[0].matches("history:/[^|?\\s]+") ||
          !fields[1].matches("#[0-9a-fA-F]{6}") || fields[2].length() > 200 || !ords.add(fields[0]))
        throw new IllegalArgumentException("Invalid or duplicate history in chart setup.");
    }
  }

  private static String json(String text)
  {
    StringBuilder out = new StringBuilder("\"");
    for (char c : text.toCharArray())
    {
      if (c == '"' || c == '\\') out.append('\\').append(c);
      else if (c < 32 || c == '\u2028' || c == '\u2029') out.append(String.format("\\u%04x", (int)c));
      else out.append(c);
    }
    return out.append('"').toString();
  }
}
