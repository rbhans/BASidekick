package com.qagraphics.basidekick.ui;

import javax.baja.gx.BBrush;
import javax.baja.gx.BColor;
import javax.baja.gx.BInsets;
import javax.baja.gx.BPen;
import javax.baja.gx.Graphics;
import javax.baja.gx.PathGeom;
import javax.baja.nre.annotations.NiagaraType;
import javax.baja.nre.annotations.NoSlotomatic;
import javax.baja.sys.*;
import javax.baja.ui.BWidget;
import javax.baja.ui.pane.BPane;
import javax.baja.ui.pane.BScrollPane;
import java.util.ArrayList;
import java.util.List;

/**
 * Auto-fit card grid: the CSS {@code repeat(auto-fit, minmax(min, 1fr))} pattern as a native PX pane.
 * Children are dropped straight in. Columns form from Min Column Width, reflow as the pane width
 * changes and always line up. Every row stretches its cells to the tallest one. Card Style draws a
 * rounded surface behind each cell. Workbench and Hx use this layout; UxMedia uses AutoGridPane.js.
 */
@NiagaraType
@NoSlotomatic
public class BAutoGridPane extends BPane
{
  /** Narrowest a column may get before the grid drops a column. */
  public static final Property minColumnWidth = newProperty(0, 240d, BFacets.make(BFacets.MIN, BDouble.make(1)));
  public double getMinColumnWidth() { return getDouble(minColumnWidth); }
  public void setMinColumnWidth(double value) { setDouble(minColumnWidth, value, null); }
  /** Upper limit on columns; 0 means no limit. 1 turns the grid into a vertical stack. */
  public static final Property maxColumns = newProperty(0, 0, BFacets.make(BFacets.MIN, BInteger.make(0)));
  public int getMaxColumns() { return getInt(maxColumns); }
  public void setMaxColumns(int value) { setInt(maxColumns, value, null); }
  /** When there are fewer items than columns, stretch them across the row (CSS auto-fit). Off keeps empty columns (auto-fill). */
  public static final Property fillRow = newProperty(0, true, null);
  public boolean getFillRow() { return getBoolean(fillRow); }
  public void setFillRow(boolean value) { setBoolean(fillRow, value, null); }
  /** Space between cells, both directions. */
  public static final Property gap = newProperty(0, 16d, BFacets.make(BFacets.MIN, BDouble.make(0)));
  public double getGap() { return getDouble(gap); }
  public void setGap(double value) { setDouble(gap, value, null); }
  /** Space between the pane edge and the cells. */
  public static final Property padding = newProperty(0, BInsets.make(16), null);
  public BInsets getPadding() { return (BInsets)get(padding); }
  public void setPadding(BInsets value) { set(padding, value, null); }
  /** Fixed row height; 0 sizes each row to its tallest cell. */
  public static final Property rowHeight = newProperty(0, 0d, BFacets.make(BFacets.MIN, BDouble.make(0)));
  public double getRowHeight() { return getDouble(rowHeight); }
  public void setRowHeight(double value) { setDouble(rowHeight, value, null); }
  /** Pane background; null leaves the pane transparent. */
  public static final Property background = newProperty(0, BBrush.NULL, null);
  public BBrush getBackground() { return (BBrush)get(background); }
  public void setBackground(BBrush value) { set(background, value, null); }
  /** Draw a card surface behind every cell. */
  public static final Property cardStyle = newProperty(0, true, null);
  public boolean getCardStyle() { return getBoolean(cardStyle); }
  public void setCardStyle(boolean value) { setBoolean(cardStyle, value, null); }
  public static final Property cardBackground = newProperty(0, BColor.make("#ffffff"), null);
  public BColor getCardBackground() { return (BColor)get(cardBackground); }
  public void setCardBackground(BColor value) { set(cardBackground, value, null); }
  /** 1px card outline; null color draws none. */
  public static final Property cardBorderColor = newProperty(0, BColor.make("#e2e8f0"), null);
  public BColor getCardBorderColor() { return (BColor)get(cardBorderColor); }
  public void setCardBorderColor(BColor value) { set(cardBorderColor, value, null); }
  public static final Property cardRadius = newProperty(0, 12d, BFacets.make(BFacets.MIN, BDouble.make(0)));
  public double getCardRadius() { return getDouble(cardRadius); }
  public void setCardRadius(double value) { setDouble(cardRadius, value, null); }
  /** Space between the card edge and its content. Only applies with Card Style on. */
  public static final Property cardPadding = newProperty(0, BInsets.make(16), null);
  public BInsets getCardPadding() { return (BInsets)get(cardPadding); }
  public void setCardPadding(BInsets value) { set(cardPadding, value, null); }
  public static final Property cardShadow = newProperty(0, true, null);
  public boolean getCardShadow() { return getBoolean(cardShadow); }
  public void setCardShadow(boolean value) { setBoolean(cardShadow, value, null); }

  @Override public Type getType() { return TYPE; }
  public static final Type TYPE = Sys.loadType(BAutoGridPane.class);

  @Override public void changed(Property property, Context cx)
  {
    relayout();
  }

////////////////////////////////////////////////////////////////
// Layout
////////////////////////////////////////////////////////////////

  @Override public void computePreferredSize()
  {
    BInsets pad = getPadding();
    List<BWidget> kids = visibleKids();
    // Natural width: everything on one row (or Max Columns wide) at the minimum column width.
    int columns = Math.max(1, getMaxColumns() > 0 ? Math.min(getMaxColumns(), kids.size()) : kids.size());
    double width = pad.left + pad.right + columns * getMinColumnWidth() + (columns - 1) * getGap();

    // Directly inside a ScrollPane, take the viewport width so the grid reflows instead of
    // scrolling sideways, and grow vertically. Same approach as bajaui:FlowPane.
    BWidget parent = getParentWidget();
    if (parent instanceof BScrollPane && parent.getWidth() > 0)
    {
      BScrollPane scroll = (BScrollPane)parent;
      double viewportWidth = scroll.getWidth() - VIEWPORT_ALLOWANCE;
      double viewportHeight = scroll.getHeight() - VIEWPORT_ALLOWANCE;
      double height = layoutRows(kids, viewportWidth, false);
      if (height > viewportHeight)
      {
        scroll.getVscrollBar().computePreferredSize();
        viewportWidth -= scroll.getVscrollBar().getPreferredWidth();
        height = layoutRows(kids, viewportWidth, false);
      }
      setPreferredSize(Math.max(0, viewportWidth), Math.max(height, viewportHeight));
      return;
    }

    double basis = getWidth() > 0 ? getWidth() : width;
    setPreferredSize(width, layoutRows(kids, basis, false));
  }

  @Override public void doLayout(BWidget[] children)
  {
    List<BWidget> kids = visibleKids();
    layoutRows(kids, getWidth(), true);
  }

  /** Height the grid needs at the given width. Lets a grid nested in another grid size correctly. */
  public double heightForWidth(double width)
  {
    return layoutRows(visibleKids(), width, false);
  }

  /** Column count at the given outer width. */
  public int columnsFor(double width, int itemCount)
  {
    BInsets pad = getPadding();
    double inner = Math.max(0, width - pad.left - pad.right);
    double gapValue = getGap();
    int columns = (int)Math.floor((inner + gapValue) / (getMinColumnWidth() + gapValue));
    columns = Math.max(1, columns);
    if (getMaxColumns() > 0) columns = Math.min(columns, getMaxColumns());
    if (getFillRow() && itemCount > 0) columns = Math.min(columns, itemCount);
    return columns;
  }

  /**
   * Places the cells row by row and returns the total height. With apply false this only measures,
   * so preferred-size calculations never move children.
   */
  private double layoutRows(List<BWidget> kids, double width, boolean apply)
  {
    BInsets pad = getPadding();
    BInsets inset = cellInsets();
    double gapValue = getGap();
    int count = kids.size();
    if (count == 0) return pad.top + pad.bottom;

    int columns = columnsFor(width, count);
    double inner = Math.max(0, width - pad.left - pad.right);
    // Narrower than one column: the single column shrinks to fit, like minmax(min(240px, 100%), 1fr).
    double cellWidth = Math.max(0, (inner - (columns - 1) * gapValue) / columns);
    double contentWidth = Math.max(0, cellWidth - inset.left - inset.right);

    double y = pad.top;
    for (int rowStart = 0; rowStart < count; rowStart += columns)
    {
      int rowEnd = Math.min(count, rowStart + columns);
      double cellHeight = getRowHeight();
      if (cellHeight <= 0)
      {
        for (int i = rowStart; i < rowEnd; i++)
          cellHeight = Math.max(cellHeight, preferredHeight(kids.get(i), contentWidth) + inset.top + inset.bottom);
      }
      if (apply)
      {
        for (int i = rowStart; i < rowEnd; i++)
        {
          double x = pad.left + (i - rowStart) * (cellWidth + gapValue);
          kids.get(i).setBounds(x + inset.left, y + inset.top,
            contentWidth, Math.max(0, cellHeight - inset.top - inset.bottom));
        }
      }
      y += cellHeight + (rowEnd < count ? gapValue : 0);
    }
    return y + pad.bottom;
  }

  private static double preferredHeight(BWidget kid, double width)
  {
    if (kid instanceof BAutoGridPane) return ((BAutoGridPane)kid).heightForWidth(width);
    kid.computePreferredSize();
    return kid.getPreferredHeight();
  }

  private BInsets cellInsets()
  {
    return getCardStyle() ? getCardPadding() : BInsets.NULL;
  }

  private List<BWidget> visibleKids()
  {
    List<BWidget> kids = new ArrayList<>();
    for (BWidget kid : getChildWidgets())
      if (kid.isVisible()) kids.add(kid);
    return kids;
  }

  /**
   * Card rectangles in pane coordinates, {x, y, width, height} per visible child, taken from the
   * current child bounds. Empty when Card Style is off. The Hx agent draws from these.
   */
  public double[][] cardBounds()
  {
    if (!getCardStyle()) return new double[0][];
    BInsets inset = getCardPadding();
    List<BWidget> kids = visibleKids();
    double[][] cards = new double[kids.size()][];
    for (int i = 0; i < cards.length; i++)
    {
      BWidget kid = kids.get(i);
      cards[i] = new double[] {
        kid.getX() - inset.left, kid.getY() - inset.top,
        kid.getWidth() + inset.left + inset.right, kid.getHeight() + inset.top + inset.bottom };
    }
    return cards;
  }

////////////////////////////////////////////////////////////////
// Paint
////////////////////////////////////////////////////////////////

  @Override public void paint(Graphics g)
  {
    BBrush brush = getBackground();
    if (!brush.isNull())
    {
      g.setBrush(brush);
      g.fillRect(0, 0, getWidth(), getHeight());
    }
    if (getCardStyle()) paintCards(g);
    paintChildren(g);
  }

  private void paintCards(Graphics g)
  {
    g.useAntiAliasing(true);
    double radius = getCardRadius();
    BColor fill = getCardBackground();
    BColor border = getCardBorderColor();
    for (double[] card : cardBounds())
    {
      double x = card[0], y = card[1], w = card[2], h = card[3];
      if (w <= 0 || h <= 0) continue;
      if (getCardShadow())
      {
        // Soft drop shadow: a few widening translucent layers offset downward.
        for (int i = 3; i >= 1; i--)
        {
          g.setBrush(BBrush.makeSolid(BColor.make(15, 23, 42, 6)));
          g.fill(roundRect(x - i + 1, y + i, w + 2 * (i - 1), h, radius + i));
        }
      }
      if (!fill.isNull())
      {
        g.setBrush(BBrush.makeSolid(fill));
        g.fill(roundRect(x, y, w, h, radius));
      }
      if (!border.isNull())
      {
        g.setBrush(BBrush.makeSolid(border));
        g.setPen(BPen.make(1));
        g.stroke(roundRect(x + 0.5, y + 0.5, w - 1, h - 1, radius));
      }
    }
  }

  private static PathGeom roundRect(double x, double y, double w, double h, double radius)
  {
    double r = Math.max(0, Math.min(radius, Math.min(w, h) / 2));
    PathGeom path = new PathGeom();
    path.moveTo(true, x + r, y);
    path.lineTo(true, x + w - r, y);
    path.quadTo(true, x + w, y, x + w, y + r);
    path.lineTo(true, x + w, y + h - r);
    path.quadTo(true, x + w, y + h, x + w - r, y + h);
    path.lineTo(true, x + r, y + h);
    path.quadTo(true, x, y + h, x, y + h - r);
    path.lineTo(true, x, y + r);
    path.quadTo(true, x, y, x + r, y);
    path.closePath();
    return path;
  }

  @Override public BIcon getIcon() { return icon; }
  private static final BIcon icon = BIcon.std("widgets/flowPane.png");

  /** Room left for the ScrollPane border so the grid never triggers a horizontal scrollbar. */
  private static final double VIEWPORT_ALLOWANCE = 4;
}
