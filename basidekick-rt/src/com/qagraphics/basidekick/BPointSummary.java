package com.qagraphics.basidekick;

import javax.baja.nre.annotations.NiagaraType;
import javax.baja.nre.annotations.NoSlotomatic;
import javax.baja.sys.*;
import javax.baja.status.*;
import javax.baja.naming.*;
import javax.baja.control.BNumericPoint;
import javax.baja.collection.*;

/** Bounded current-point summary. Configure category permissions as for any derived station point. */
@NiagaraType
@NoSlotomatic
public class BPointSummary extends javax.baja.util.BWorker
{
  public static final Property points = newProperty(0, BOrdList.DEFAULT, null);
  public BOrdList getPoints() { return (BOrdList)get(points); }
  public void setPoints(BOrdList value) { set(points, value); }
  public static final Property queryScope = newProperty(0, BOrd.NULL, null);
  public BOrd getQueryScope() { return (BOrd)get(queryScope); }
  public void setQueryScope(BOrd value) { set(queryScope, value); }
  public static final Property refreshInterval = newProperty(0, BRelTime.makeSeconds(30), null);
  public BRelTime getRefreshInterval() { return (BRelTime)get(refreshInterval); }
  public void setRefreshInterval(BRelTime value) { set(refreshInterval, value); }
  public static final Property enabled = newProperty(0, true, null);
  public boolean getEnabled() { return getBoolean(enabled); }
  public void setEnabled(boolean value) { setBoolean(enabled, value, null); }
  public static final Property includeSum = newProperty(0, false, null);
  public boolean getIncludeSum() { return getBoolean(includeSum); }
  public void setIncludeSum(boolean value) { setBoolean(includeSum, value, null); }
  public static final Property minimum = newProperty(Flags.READONLY | Flags.TRANSIENT, new BStatusNumeric(0, BStatus.nullStatus), null);
  public BStatusNumeric getMinimum() { return (BStatusNumeric)get(minimum); }
  public void setMinimum(BStatusNumeric value) { set(minimum, value); }
  public static final Property maximum = newProperty(Flags.READONLY | Flags.TRANSIENT, new BStatusNumeric(0, BStatus.nullStatus), null);
  public BStatusNumeric getMaximum() { return (BStatusNumeric)get(maximum); }
  public void setMaximum(BStatusNumeric value) { set(maximum, value); }
  public static final Property average = newProperty(Flags.READONLY | Flags.TRANSIENT, new BStatusNumeric(0, BStatus.nullStatus), null);
  public BStatusNumeric getAverage() { return (BStatusNumeric)get(average); }
  public void setAverage(BStatusNumeric value) { set(average, value); }
  public static final Property sum = newProperty(Flags.READONLY | Flags.TRANSIENT, new BStatusNumeric(0, BStatus.nullStatus), null);
  public BStatusNumeric getSum() { return (BStatusNumeric)get(sum); }
  public void setSum(BStatusNumeric value) { set(sum, value); }
  public static final Property matchedCount = newProperty(Flags.READONLY | Flags.TRANSIENT, 0, null);
  public int getMatchedCount() { return getInt(matchedCount); }
  public void setMatchedCount(int value) { setInt(matchedCount, value, null); }
  public static final Property validCount = newProperty(Flags.READONLY | Flags.TRANSIENT, 0, null);
  public int getValidCount() { return getInt(validCount); }
  public void setValidCount(int value) { setInt(validCount, value, null); }
  public static final Property excludedCount = newProperty(Flags.READONLY | Flags.TRANSIENT, 0, null);
  public int getExcludedCount() { return getInt(excludedCount); }
  public void setExcludedCount(int value) { setInt(excludedCount, value, null); }
  public static final Property minimumPoint = newProperty(Flags.READONLY | Flags.TRANSIENT, BOrd.NULL, null);
  public BOrd getMinimumPoint() { return (BOrd)get(minimumPoint); }
  public void setMinimumPoint(BOrd value) { set(minimumPoint, value); }
  public static final Property maximumPoint = newProperty(Flags.READONLY | Flags.TRANSIENT, BOrd.NULL, null);
  public BOrd getMaximumPoint() { return (BOrd)get(maximumPoint); }
  public void setMaximumPoint(BOrd value) { set(maximumPoint, value); }
  public static final Property resultFacets = newProperty(Flags.READONLY | Flags.TRANSIENT, BFacets.NULL, null);
  public BFacets getResultFacets() { return (BFacets)get(resultFacets); }
  public void setResultFacets(BFacets value) { set(resultFacets, value); }
  public static final Property lastUpdated = newProperty(Flags.READONLY | Flags.TRANSIENT, BAbsTime.NULL, null);
  public BAbsTime getLastUpdated() { return (BAbsTime)get(lastUpdated); }
  public void setLastUpdated(BAbsTime value) { set(lastUpdated, value); }
  public static final Property result = newProperty(Flags.READONLY | Flags.TRANSIENT, "Not evaluated", null);
  public String getResult() { return getString(result); }
  public void setResult(String value) { setString(result, value, null); }
  @Override public BFacets getSlotFacets(Slot slot) {
    if (slot == minimum || slot == maximum || slot == average || slot == sum) return getResultFacets();
    return super.getSlotFacets(slot);
  }
  private final javax.baja.util.Queue queue = new javax.baja.util.Queue(1);
  private final javax.baja.util.Worker worker = new javax.baja.util.Worker(queue);
  private Clock.Ticket ticket;
  private volatile long generation;
  public static final Action refresh = newAction(0, null);
  public void refresh() { invoke(refresh, null, null); }
  public static final Action pulse = newAction(Flags.HIDDEN, null);
  public void pulse() { invoke(pulse, null, null); }
  @Override public javax.baja.util.Worker getWorker() { return worker; }
  @Override public void started() throws Exception { super.started(); schedule(); }
  @Override public void stopped() throws Exception { generation++; if (ticket != null) ticket.cancel(); queue.clear(); super.stopped(); }
  @Override public void changed(Property p, Context cx) {
    super.changed(p, cx);
    if (p == points || p == queryScope || p == enabled || p == includeSum || p == refreshInterval) {
      generation++;
      if (isRunning()) schedule();
    }
  }
  private void schedule() {
    if (ticket != null) ticket.cancel();
    doPulse();
    if (getEnabled()) ticket = Clock.schedulePeriodically(this, BRelTime.make(Math.max(5000, getRefreshInterval().getMillis())), pulse, null);
  }
  public void doRefresh() { doPulse(); }
  public void doPulse() {
    final long expected = generation;
    synchronized (queue) {
      queue.clear();
      queue.enqueue(new Runnable() { public void run() { evaluate(expected); } });
    }
  }
  private final Object evaluationLock = new Object();
  private void evaluate(long expected) { synchronized (evaluationLock) {
    if (!isRunning() || expected != generation) return;
    if (!getEnabled()) { invalidate(BStatus.disabled, "Disabled"); return; }
    try {
      java.util.LinkedHashMap<String, BNumericPoint> selected = new java.util.LinkedHashMap<>();
      BOrdList configured = getPoints();
      if (configured.size() > 500) throw new IllegalArgumentException("Select at most 500 points");
      for (BOrd ord : configured.toArray()) {
        if (ord.toString().length() > 2000 || !ord.toString().matches("(station:\\|)?slot:/[^|?#]*"))
          throw new IllegalArgumentException("Select local station component ORDs only");
        add(selected, ord.get(this));
      }
      String scope = getQueryScope().toString();
      if (!getQueryScope().equals(BOrd.NULL)) {
        if (!scope.matches("station:\\|slot:/[^|?#]*") || scope.equals("station:|slot:/"))
          throw new IllegalArgumentException("Query Scope must be a station subtree below the root");
        BObject result = BOrd.make(scope + "|bql:select from control:NumericPoint").get(this);
        if (!(result instanceof BITable)) throw new IllegalArgumentException("No query table");
        try (TableCursor<?> c = ((BITable<?>)result).cursor()) {
          int scanned = 0;
          while (c.next()) {
            if (++scanned > 500) throw new IllegalArgumentException("Scope exceeds 500 points; narrow it");
            add(selected, c.row().rowObject());
          }
        }
      }
      double min = Double.POSITIVE_INFINITY, max = Double.NEGATIVE_INFINITY, mean = 0, total = 0;
      int valid = 0, bits = 0; BOrd minOrd = BOrd.NULL, maxOrd = BOrd.NULL;
      BFacets facets = BFacets.NULL; BObject unit = null; boolean unitSet = false;
      for (BNumericPoint point : selected.values()) {
        BStatusNumeric value = point.getOut();
        if (!value.getStatus().isValid() || !Double.isFinite(value.getValue())) continue;
        BObject u = point.getFacets().get(BFacets.UNITS);
        if (!unitSet) { unit = u; unitSet = true; facets = point.getFacets(); }
        else if (!java.util.Objects.equals(unit, u)) throw new IllegalArgumentException("Units differ; convert inputs explicitly before summarizing");
        double v = value.getValue(); valid++; mean += (v - mean) / valid; total += v;
        bits |= value.getStatus().getBits();
        if (v < min) { min = v; minOrd = point.getSlotPathOrd(); }
        if (v > max) { max = v; maxOrd = point.getSlotPathOrd(); }
      }
      if (expected != generation || !isRunning()) return;
      if (valid == 0) { invalidate(BStatus.nullStatus, selected.isEmpty() ? "No points selected or matched" : "No valid inputs"); }
      else {
        if (!Double.isFinite(mean) || (getIncludeSum() && !Double.isFinite(total))) throw new IllegalArgumentException("Result exceeds numeric range");
        BStatus status = BStatus.make(bits);
        setMinimum(new BStatusNumeric(min, status)); setMaximum(new BStatusNumeric(max, status));
        setAverage(new BStatusNumeric(mean, status));
        setSum(new BStatusNumeric(getIncludeSum() ? total : 0, getIncludeSum() ? status : BStatus.nullStatus));
        setMinimumPoint(minOrd); setMaximumPoint(maxOrd); setResultFacets(facets);
        setResult("Current values; " + valid + " valid, " + (selected.size() - valid) + " excluded (invalid status or non-finite)");
      }
      setMatchedCount(selected.size()); setValidCount(valid); setExcludedCount(selected.size() - valid); setLastUpdated(Clock.time());
    } catch (Exception e) { if (expected == generation && isRunning()) invalidate(BStatus.fault, "Summary unavailable: " + e.getMessage()); }
  }
  }
  private void add(java.util.Map<String, BNumericPoint> selected, Object value) {
    if (!(value instanceof BNumericPoint)) throw new IllegalArgumentException("Every selected ORD must resolve to a NumericPoint");
    BNumericPoint point = (BNumericPoint)value;
    selected.put(point.getHandleOrd().toString(), point);
    if (selected.size() > 500) throw new IllegalArgumentException("Select at most 500 unique points");
  }
  private void invalidate(BStatus status, String message) {
    setMinimum(new BStatusNumeric(0, status)); setMaximum(new BStatusNumeric(0, status));
    setAverage(new BStatusNumeric(0, status)); setSum(new BStatusNumeric(0, status));
    setMatchedCount(0); setValidCount(0); setExcludedCount(0); setResultFacets(BFacets.NULL);
    setMinimumPoint(BOrd.NULL); setMaximumPoint(BOrd.NULL); setLastUpdated(BAbsTime.NULL); setResult(message);
  }

  @Override public Type getType() { return TYPE; }
  public static final Type TYPE = Sys.loadType(BPointSummary.class);
}
