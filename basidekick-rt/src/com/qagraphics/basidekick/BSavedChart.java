package com.qagraphics.basidekick;

import javax.baja.naming.BOrd;
import javax.baja.nre.annotations.NiagaraType;
import javax.baja.nre.annotations.NoSlotomatic;
import javax.baja.sys.*;

/** A named chart setup. Data is queried fresh when opened; no history samples are stored. */
@NiagaraType
@NoSlotomatic
public class BSavedChart extends BComponent
{
  public static final Property title = newProperty(0, "Untitled chart", null);
  public String getTitle() { return getString(title); }
  public void setTitle(String value) { setString(title, value, null); }
  public static final Property period = newProperty(0, "last24Hours", null);
  public String getPeriod() { return getString(period); }
  public void setPeriod(String value) { setString(period, value, null); }
  public static final Property series = newProperty(0, "", null);
  public String getSeries() { return getString(series); }
  public void setSeries(String value) { setString(series, value, null); }
  public static final Property analysis = newProperty(0, "sample;60;false", null);
  public String getAnalysis() { return getString(analysis); }
  public void setAnalysis(String value) { setString(analysis, value, null); }
  public static final Property revision = newProperty(0, "", null);
  public String getRevision() { return getString(revision); }
  public void setRevision(String value) { setString(revision, value, null); }
  @Override public Type getType() { return TYPE; }
  public static final Type TYPE = Sys.loadType(BSavedChart.class);
}
