package com.qagraphics.basidekick.ui;

import javax.baja.gx.BColor;
import javax.baja.hx.HxOp;
import javax.baja.hx.HxUtil;
import javax.baja.hx.PropertiesCollection;
import javax.baja.hx.px.BHxPxWidget;
import javax.baja.nre.annotations.*;
import javax.baja.sys.*;

/**
 * Hx rendering for Auto Grid on standard web PX pages. Hx positions the children from the Java
 * layout, as it does for bajaui panes; this agent adds the pane background and a card layer that
 * sits under the children (the same layering bajaui:BorderPane uses in Hx).
 */
@NiagaraType(agent = @AgentOn(types = "basidekick:AutoGridPane"))
@NiagaraSingleton
@NoSlotomatic
public final class BHxAutoGridPane extends BHxPxWidget
{
  public static final BHxAutoGridPane INSTANCE = new BHxAutoGridPane();
  @Override public Type getType() { return TYPE; }
  public static final Type TYPE = Sys.loadType(BHxAutoGridPane.class);
  private BHxAutoGridPane() {}

  @Override public void write(HxOp op) throws Exception
  {
    // Written before the children, so the cards stay underneath them.
    op.getHtmlWriter()
      .w("<div style='position:absolute;left:0;top:0;right:0;bottom:0;pointer-events:none;'")
      .attr("id", op.scope("cards")).w("></div>");
    op.addOnload(cardsScript(op));
  }

  @Override public void update(int width, int height, boolean full, HxOp op) throws Exception
  {
    BAutoGridPane pane = (BAutoGridPane)op.get();
    PropertiesCollection styles = new PropertiesCollection.Styles();
    HxUtil.makeBackground(pane.getBackground(), null, styles, op);
    styles.write(op);
    op.getHtmlWriter().w("\n").w(cardsScript(op));
  }

  /** Rebuilds the card layer from the current Java layout. */
  private static String cardsScript(HxOp op)
  {
    BAutoGridPane pane = (BAutoGridPane)op.get();
    StringBuilder html = new StringBuilder();
    String look = cardLook(pane);
    for (double[] card : pane.cardBounds())
    {
      html.append("<div style=\"position:absolute;box-sizing:border-box;")
        .append("left:").append(px(card[0])).append("top:").append(px(card[1]))
        .append("width:").append(px(card[2])).append("height:").append(px(card[3]))
        .append(look).append("\"></div>");
    }
    return "(function(e){if(e){e.innerHTML='" + HxUtil.escapeJsStringLiteral(html.toString()) + "';}})" +
      "(document.getElementById('" + HxUtil.escapeJsStringLiteral(op.scope("cards")) + "'));";
  }

  private static String cardLook(BAutoGridPane pane)
  {
    StringBuilder css = new StringBuilder();
    css.append("border-radius:").append(px(pane.getCardRadius()));
    css.append("background:").append(color(pane.getCardBackground())).append(';');
    BColor border = pane.getCardBorderColor();
    if (!border.isNull()) css.append("border:1px solid ").append(color(border)).append(';');
    if (pane.getCardShadow()) css.append("box-shadow:0 1px 2px rgba(15,23,42,0.06),0 2px 6px rgba(15,23,42,0.06);");
    return css.toString();
  }

  private static String color(BColor value)
  {
    return value.isNull() ? "transparent" : value.toHtmlStringWithAlpha();
  }

  private static String px(double value)
  {
    return Math.round(value * 100) / 100d + "px;";
  }
}
