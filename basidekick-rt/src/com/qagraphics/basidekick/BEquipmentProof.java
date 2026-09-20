package com.qagraphics.basidekick;

import javax.baja.nre.annotations.NiagaraType;
import javax.baja.nre.annotations.NoSlotomatic;
import javax.baja.sys.*;
import javax.baja.status.*;
import javax.baja.naming.*;

/** Directional proof state; invalid input is not confirmed equipment failure. */
@NiagaraType
@NoSlotomatic
public class BEquipmentProof extends BComponent
{
  public static final Property command = newProperty(0, new BStatusBoolean(false, BStatus.nullStatus), null);
  public BStatusBoolean getCommand() { return (BStatusBoolean)get(command); }
  public void setCommand(BStatusBoolean value) { set(command, value); }
  public static final Property feedback = newProperty(0, new BStatusBoolean(false, BStatus.nullStatus), null);
  public BStatusBoolean getFeedback() { return (BStatusBoolean)get(feedback); }
  public void setFeedback(BStatusBoolean value) { set(feedback, value); }
  public static final Property enabled = newProperty(0, true, null);
  public boolean getEnabled() { return getBoolean(enabled); }
  public void setEnabled(boolean value) { setBoolean(enabled, value, null); }
  public static final Property inhibit = newProperty(0, false, null);
  public boolean getInhibit() { return getBoolean(inhibit); }
  public void setInhibit(boolean value) { setBoolean(inhibit, value, null); }
  public static final Property startDelay = newProperty(0, BRelTime.makeSeconds(30), null);
  public BRelTime getStartDelay() { return (BRelTime)get(startDelay); }
  public void setStartDelay(BRelTime value) { set(startDelay, value); }
  public static final Property stopDelay = newProperty(0, BRelTime.makeSeconds(15), null);
  public BRelTime getStopDelay() { return (BRelTime)get(stopDelay); }
  public void setStopDelay(BRelTime value) { set(stopDelay, value); }
  public static final Property startupGrace = newProperty(0, BRelTime.makeSeconds(30), null);
  public BRelTime getStartupGrace() { return (BRelTime)get(startupGrace); }
  public void setStartupGrace(BRelTime value) { set(startupGrace, value); }
  public static final Property state = newProperty(Flags.READONLY | Flags.TRANSIENT, "unavailable", null);
  public String getState() { return getString(state); }
  public void setState(String value) { setString(state, value, null); }
  public static final Property failure = newProperty(Flags.READONLY | Flags.TRANSIENT, new BStatusBoolean(false, BStatus.nullStatus), null);
  public BStatusBoolean getFailure() { return (BStatusBoolean)get(failure); }
  public void setFailure(BStatusBoolean value) { set(failure, value); }
  public static final Property remaining = newProperty(Flags.READONLY | Flags.TRANSIENT, BRelTime.DEFAULT, null);
  public BRelTime getRemaining() { return (BRelTime)get(remaining); }
  public void setRemaining(BRelTime value) { set(remaining, value); }
  public static final Action evaluate = newAction(Flags.HIDDEN, null);
  public void evaluate() { invoke(evaluate, null, null); }
  private Clock.Ticket ticket;
  private long graceUntil, mismatchSince = -1;
  private boolean lastCommand;
  @Override public void started() throws Exception { super.started(); restartGrace(); ticket = Clock.schedulePeriodically(this, BRelTime.makeSeconds(1), evaluate, null); doEvaluate(); }
  @Override public void stopped() throws Exception { if (ticket != null) ticket.cancel(); mismatchSince = -1; super.stopped(); }
  private void restartGrace() { graceUntil = Clock.ticks() + Math.max(0, getStartupGrace().getMillis()); mismatchSince = -1; }
  @Override public void changed(Property p, Context cx) {
    super.changed(p, cx);
    if (!isRunning()) return;
    if (p == enabled || p == inhibit || p == startupGrace) restartGrace();
    if (p == command || p == feedback || p == enabled || p == inhibit || p == startupGrace || p == startDelay || p == stopDelay) doEvaluate();
  }
  public synchronized void doEvaluate() {
    if (!isRunning()) return;
    long now = Clock.ticks();
    if (!getEnabled() || getInhibit()) { mismatchSince = -1; publish("inhibited", false, BStatus.disabled, 0); return; }
    BStatusBoolean cmd = getCommand(), proof = getFeedback();
    if (!cmd.getStatus().isValid() || !proof.getStatus().isValid()) {
      mismatchSince = -1;
      publish("unavailable", false, BStatus.make(cmd.getStatus().getBits() | proof.getStatus().getBits()), 0); return;
    }
    boolean desired = cmd.getValue();
    if (now < graceUntil) { mismatchSince = -1; publish("startupGrace", false, BStatus.nullStatus, graceUntil - now); return; }
    if (desired == proof.getValue()) { mismatchSince = -1; publish(desired ? "running" : "stopped", false, BStatus.ok, 0); return; }
    if (mismatchSince < 0 || desired != lastCommand) { mismatchSince = now; lastCommand = desired; }
    long wait = Math.max(0, (desired ? getStartDelay() : getStopDelay()).getMillis());
    long left = Math.max(0, wait - (now - mismatchSince));
    publish(left > 0 ? (desired ? "provingOn" : "provingOff") : (desired ? "failedToStart" : "failedToStop"), left == 0, BStatus.ok, left);
  }
  private void publish(String state, boolean failed, BStatus status, long left) {
    setState(state); setFailure(new BStatusBoolean(failed, status)); setRemaining(BRelTime.make(left));
  }

  @Override public Type getType() { return TYPE; }
  public static final Type TYPE = Sys.loadType(BEquipmentProof.class);
}
