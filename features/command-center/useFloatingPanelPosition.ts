import { useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { clampPanel, defaultPanelPosition, type PanelBounds, type PanelPoint } from './floatingPanelGeometry';

export function useFloatingPanelPosition() {
  const panelRef = useRef<HTMLElement>(null);
  const point = useRef<PanelPoint | null>(null);
  const anchored = useRef(true);
  const drag = useRef<{ id: number; x: number; y: number; start: PanelPoint } | null>(null);
  const [position, setPosition] = useState<PanelPoint | null>(null);
  const [dragging, setDragging] = useState(false);
  const [docked, setDocked] = useState(false);

  const bounds = (): PanelBounds => {
    const panel = panelRef.current;
    return { width: panel?.parentElement?.clientWidth ?? 0, height: panel?.parentElement?.clientHeight ?? 0,
      panelWidth: panel?.offsetWidth ?? 0, panelHeight: panel?.offsetHeight ?? 0 };
  };
  const move = (next: PanelPoint) => {
    point.current = clampPanel(next, bounds());
    setPosition(point.current);
  };
  const reset = () => {
    anchored.current = true;
    move(defaultPanelPosition(bounds()));
  };

  useLayoutEffect(() => {
    const panel = panelRef.current, host = panel?.parentElement;
    if (!panel || !host) return;
    const resize = () => {
      const isDocked = window.matchMedia('(max-width: 640px)').matches || host.clientWidth < 400;
      setDocked(isDocked);
      drag.current = null;
      setDragging(false);
      const next = anchored.current || isDocked || !point.current
        ? defaultPanelPosition(bounds()) : clampPanel(point.current, bounds());
      point.current = next;
      setPosition(next);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(host);
    observer.observe(panel);
    window.addEventListener('resize', resize);
    resize();
    return () => { observer.disconnect(); window.removeEventListener('resize', resize); };
  }, []);

  const stop = (event: PointerEvent<HTMLButtonElement>) => {
    if (drag.current?.id !== event.pointerId) return;
    drag.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const handleProps = {
    onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
      if (docked || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      event.currentTarget.focus();
      event.currentTarget.setPointerCapture(event.pointerId);
      anchored.current = false;
      drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, start: point.current ?? defaultPanelPosition(bounds()) };
      setDragging(true);
    },
    onPointerMove: (event: PointerEvent<HTMLButtonElement>) => {
      const active = drag.current;
      if (!active || active.id !== event.pointerId) return;
      move({ x: active.start.x + event.clientX - active.x, y: active.start.y + event.clientY - active.y });
    },
    onPointerUp: stop,
    onPointerCancel: stop,
    onLostPointerCapture: () => { drag.current = null; setDragging(false); },
    onKeyDown: (event: KeyboardEvent<HTMLButtonElement>) => {
      if (docked) return;
      const delta = { ArrowLeft: [-16, 0], ArrowRight: [16, 0], ArrowUp: [0, -16], ArrowDown: [0, 16] }[event.key];
      if (!delta) return;
      event.preventDefault();
      anchored.current = false;
      const current = point.current ?? defaultPanelPosition(bounds());
      move({ x: current.x + delta[0], y: current.y + delta[1] });
    },
  };
  return { panelRef, position, dragging, docked, reset, handleProps };
}
