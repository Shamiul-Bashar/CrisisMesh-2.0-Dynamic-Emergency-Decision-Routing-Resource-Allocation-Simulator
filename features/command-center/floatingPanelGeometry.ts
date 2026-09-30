export type PanelPoint = { x: number; y: number };
export type PanelBounds = { width: number; height: number; panelWidth: number; panelHeight: number };

/** CSS-pixel positioning only; independent of the SVG pan/zoom transform. */
export function clampPanel(point: PanelPoint, bounds: PanelBounds): PanelPoint {
  const maxX = Math.max(0, bounds.width - bounds.panelWidth - 12);
  const maxY = Math.max(0, bounds.height - bounds.panelHeight - 12);
  return {
    x: Math.max(Math.min(12, maxX), Math.min(maxX, Number.isFinite(point.x) ? point.x : maxX)),
    y: Math.max(Math.min(12, maxY), Math.min(maxY, Number.isFinite(point.y) ? point.y : maxY)),
  };
}

export const defaultPanelPosition = (bounds: PanelBounds) => clampPanel({ x: bounds.width, y: bounds.height }, bounds);
