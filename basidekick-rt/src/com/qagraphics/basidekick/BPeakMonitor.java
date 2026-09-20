package com.qagraphics.basidekick;

import javax.baja.nre.annotations.NiagaraType;
import javax.baja.nre.annotations.NoSlotomatic;
import javax.baja.sys.*;
import javax.baja.status.*;
import javax.baja.naming.*;

/** Min/max since reset or station start. Historical extrema stay visible when input becomes unavailable. */
@NiagaraType
@NoSlotomatic
public class BPeakMonitor extends BComponent
{
  public static final Property facets = newProperty(0, BFacets.makeNumeric(), null);
  public BFacets getFacets() { return (BFacets)get(facets); }
  public void setFacets(BFacets value) { set(facets, value); }
  public static final Property input = newProperty(0, new BStatusNumeric(0, BStatus.nullStatus), null);
  public BStatusNumeric getInput() { return (BStatusNumeric)get(input); }
  public void setInput(BStatusNumeric value) { set(input, value); }
  public static final Property minimum = newProperty(Flags.READONLY | Flags.TRANSIENT, new BStatusNumeric(0, BStatus.nullStatus), null);
  public BStatusNumeric getMinimum() { return (BStatusNumeric)get(minimum); }
  public void setMinimum(BStatusNumeric value) { set(minimum, value); }
  public static final Property maximum = newProperty(Flags.READONLY | Flags.TRANSIENT, new BStatusNumeric(0, BStatus.nullStatus), null);
  public BStatusNumeric getMaximum() { return (BStatusNumeric)get(maximum); }
  public void setMaximum(BStatusNumeric value) { set(maximum, value); }
  public static final Property minimumTime = newProperty(Flags.READONLY | Flags.TRANSIENT, BAbsTime.NULL, null);
  public BAbsTime getMinimumTime() { return (BAbsTime)get(minimumTime); }
  public void setMinimumTime(BAbsTime value) { set(minimumTime, value); }
  public static final Property maximumTime = newProperty(Flags.READONLY | Flags.TRANSIENT, BAbsTime.NULL, null);
  public BAbsTime getMaximumTime() { return (BAbsTime)get(maximumTime); }
  public void setMaximumTime(BAbsTime value) { set(maximumTime, value); }
  public static final Property resetTime = newProperty(Flags.READONLY | Flags.TRANSIENT, BAbsTime.NULL, null);
  public BAbsTime getResetTime() { return (BAbsTime)get(resetTime); }
  public void setResetTime(BAbsTime value) { set(resetTime, value); }
  public static final Property inputStatus = newProperty(Flags.READONLY | Flags.TRANSIENT, BStatus.nullStatus, null);
  public BStatus getInputStatus() { return (BStatus)get(inputStatus); }
  public void setInputStatus(BStatus value) { set(inputStatus, value); }
  public static final Property state = newProperty(Flags.READONLY | Flags.TRANSIENT, "No valid input since reset", null);
  public String getState() { return getString(state); }
  public void setState(String value) { setString(state, value, null); }
  @Override public BFacets getSlotFacets(Slot slot) {
    if (slot == input || slot == minimum || slot == maximum) return (BFacets)get(facets);
    return super.getSlotFacets(slot);
  }
  public static final Action reset = newAction(0, null);
  public void reset() { invoke(reset, null, null); }
  private boolean seeded;
  @Override public void started() throws Exception { super.started(); doReset(); }
  @Override public void changed(Property p, Context cx) { super.changed(p, cx); if (isRunning()) { if (p == input) capture(); else if (p == facets) doReset(); } }
  public synchronized void doReset() {
    seeded = false; setMinimum(new BStatusNumeric(0, BStatus.nullStatus)); setMaximum(new BStatusNumeric(0, BStatus.nullStatus));
    setMinimumTime(BAbsTime.NULL); setMaximumTime(BAbsTime.NULL); setResetTime(Clock.time()); capture();
  }
  private synchronized void capture() {
    BStatusNumeric value = getInput(); setInputStatus(Double.isFinite(value.getValue()) ? value.getStatus() : BStatus.makeFault(value.getStatus(), true));
    if (!value.getStatus().isValid() || !Double.isFinite(value.getValue())) { setState(seeded ? "Input unavailable; recorded extrema retained" : "No valid input since reset"); return; }
    BAbsTime now = Clock.time();
    if (!seeded || value.getValue() < getMinimum().getValue()) { setMinimum(new BStatusNumeric(value.getValue(), value.getStatus())); setMinimumTime(now); }
    if (!seeded || value.getValue() > getMaximum().getValue()) { setMaximum(new BStatusNumeric(value.getValue(), value.getStatus())); setMaximumTime(now); }
    seeded = true; setState("Extrema since reset; timestamps are station observation times");
  }

  @Override public Type getType() { return TYPE; }
  public static final Type TYPE = Sys.loadType(BPeakMonitor.class);
}
