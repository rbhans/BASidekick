package com.qagraphics.basidekick;

import javax.baja.nre.annotations.NiagaraType;
import javax.baja.nre.annotations.NoSlotomatic;
import javax.baja.sys.*;
import javax.baja.status.*;
import javax.baja.naming.*;

/** Elapsed-time low-pass filter of a held input, without modifying its source. */
@NiagaraType
@NoSlotomatic
public class BNumericSmoother extends BComponent
{
  public static final Property facets = newProperty(0, BFacets.makeNumeric(), null);
  public BFacets getFacets() { return (BFacets)get(facets); }
  public void setFacets(BFacets value) { set(facets, value); }
  public static final Property input = newProperty(0, new BStatusNumeric(0, BStatus.nullStatus), null);
  public BStatusNumeric getInput() { return (BStatusNumeric)get(input); }
  public void setInput(BStatusNumeric value) { set(input, value); }
  public static final Property timeConstant = newProperty(0, BRelTime.makeSeconds(30), null);
  public BRelTime getTimeConstant() { return (BRelTime)get(timeConstant); }
  public void setTimeConstant(BRelTime value) { set(timeConstant, value); }
  public static final Property enabled = newProperty(0, true, null);
  public boolean getEnabled() { return getBoolean(enabled); }
  public void setEnabled(boolean value) { setBoolean(enabled, value, null); }
  public static final Property output = newProperty(Flags.READONLY | Flags.TRANSIENT, new BStatusNumeric(0, BStatus.nullStatus), null);
  public BStatusNumeric getOutput() { return (BStatusNumeric)get(output); }
  public void setOutput(BStatusNumeric value) { set(output, value); }
  public static final Property state = newProperty(Flags.READONLY | Flags.TRANSIENT, "unavailable", null);
  public String getState() { return getString(state); }
  public void setState(String value) { setString(state, value, null); }
  @Override public BFacets getSlotFacets(Slot slot) {
    if (slot == input || slot == output) return (BFacets)get(facets);
    return super.getSlotFacets(slot);
  }
  public static final Action reset = newAction(0, null);
  public void reset() { invoke(reset, null, null); }
  public static final Action sample = newAction(Flags.HIDDEN, null);
  public void sample() { invoke(sample, null, null); }
  private Clock.Ticket ticket;
  private long lastTick;
  private double filtered, held;
  private boolean seeded;
  @Override public void started() throws Exception { super.started(); doReset(); ticket = Clock.schedulePeriodically(this, BRelTime.makeSeconds(1), sample, null); }
  @Override public void stopped() throws Exception { if (ticket != null) ticket.cancel(); seeded = false; super.stopped(); }
  @Override public void changed(Property p, Context cx) {
    super.changed(p, cx);
    if (isRunning()) {
      if (p == facets || p == timeConstant) doReset();
      else if (p == input || p == enabled) doSample();
    }
  }
  public synchronized void doReset() { seeded = false; doSample(); }
  public synchronized void doSample() {
    if (!isRunning()) return;
    long now = Clock.ticks(); BStatusNumeric raw = getInput();
    if (!getEnabled() || !raw.getStatus().isValid() || !Double.isFinite(raw.getValue()) || getTimeConstant().getMillis() <= 0) {
      seeded = false; lastTick = now;
      BStatus status = !getEnabled() ? BStatus.disabled : (!raw.getStatus().isValid() ? raw.getStatus() : BStatus.fault);
      setOutput(new BStatusNumeric(0, status)); setState("unavailable; next valid input reseeds"); return;
    }
    if (!seeded) { filtered = raw.getValue(); seeded = true; }
    else { double alpha = -Math.expm1(-Math.max(0, now - lastTick) / (double)getTimeConstant().getMillis()); filtered = (1 - alpha) * filtered + alpha * held; }
    held = raw.getValue(); lastTick = now;
    if (!Double.isFinite(filtered)) { seeded = false; setOutput(new BStatusNumeric(0, BStatus.fault)); setState("Numeric range exceeded"); return; }
    setOutput(new BStatusNumeric(filtered, raw.getStatus())); setState("Filtering; input retained separately");
  }

  @Override public Type getType() { return TYPE; }
  public static final Type TYPE = Sys.loadType(BNumericSmoother.class);
}
