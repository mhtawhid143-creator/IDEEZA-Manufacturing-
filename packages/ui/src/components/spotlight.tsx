'use client';

import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cn } from '../lib/cn.js';

export type SpotlightPlacement = 'top' | 'right' | 'bottom' | 'left';

export interface SpotlightProps {
  /**
   * A CSS selector for the element to light up.
   *
   * Undefined, or a selector matching nothing on this screen, is a state the
   * component is designed for rather than a mistake: a tour points at a shop's
   * own data, and a new shop has none. The panel then centres itself and
   * `found` tells the caller to say so in words.
   */
  readonly target?: string | undefined;
  /** Which side of the target the panel prefers, when there is room for it. */
  readonly place?: SpotlightPlacement;
  /** Accessible name for the panel, since its heading is the caller's. */
  readonly label: string;
  /** Escape, and the panel's own close control if it has one. */
  readonly onDismiss?: () => void;
  /**
   * The panel's contents. Given whether the target was found, so the caller can
   * put different words in it rather than pointing at nothing.
   */
  readonly children: (found: boolean) => ReactNode;
  readonly className?: string;
}

interface Rect {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

const PANEL_WIDTH = 360;
const GAP = 12;
const EDGE = 16;

/**
 * Measures an element, and reports nothing for one that cannot be seen.
 *
 * A zero-sized box is not the only way to be invisible here: the rail is in the
 * document at every width but `hidden` below the large breakpoint, so at a phone
 * width it measures zero and must be treated as absent — otherwise the tour
 * points at the top-left corner of the screen and says nothing about why.
 */
const visible = (selector: string | undefined): Element | null => {
  if (selector === undefined) return null;
  let matches: readonly Element[] = [];
  try {
    matches = Array.from(document.querySelectorAll(selector));
  } catch {
    // A malformed selector in content is a content bug, not a crash for the
    // person on the screen: treat it as nothing to point at.
    return null;
  }
  // The first one that can be seen, not simply the first one. A shell often
  // holds the same control twice — this app's navigation is a rail at desktop
  // widths and a drawer below them, both in the document at once — and the copy
  // that is hidden is exactly the one that measures zero.
  return (
    matches.find((element) => {
      const box = element.getBoundingClientRect();
      return box.width > 0 && box.height > 0;
    }) ?? null
  );
};

const measure = (selector: string | undefined): Rect | null => {
  const element = visible(selector);
  if (element === null) return null;
  const box = element.getBoundingClientRect();
  return { top: box.top, left: box.left, width: box.width, height: box.height };
};

/** Where the panel sits: the preferred side if it fits, else the one that does. */
const position = (
  rect: Rect,
  place: SpotlightPlacement,
  panel: { readonly width: number; readonly height: number },
): { readonly top: number; readonly left: number } => {
  const view = { width: window.innerWidth, height: window.innerHeight };

  // On a phone the panel is as wide as the screen, so there is no "beside" to
  // put it: wherever it goes it covers something, and left to choose a side it
  // covered the very control it was pointing at. Docked to the foot of the
  // screen it is always in the same place, and the target — scrolled to the
  // middle — is always above it. This is the one measurement in here that is a
  // breakpoint rather than a fit, and it is the sm step from the preset.
  if (view.width < 640) {
    return { top: Math.max(EDGE, view.height - panel.height - EDGE), left: EDGE };
  }

  const fits = {
    top: rect.top - panel.height - GAP >= EDGE,
    bottom: rect.top + rect.height + panel.height + GAP <= view.height - EDGE,
    left: rect.left - panel.width - GAP >= EDGE,
    right: rect.left + rect.width + panel.width + GAP <= view.width - EDGE,
  };
  // The preferred side first, then the others in the order that keeps the
  // reading direction sensible: beside before above or below.
  const side = ([place, 'right', 'bottom', 'top', 'left'] as const).find((one) => fits[one]) ?? place;

  const clamp = (value: number, size: number, limit: number): number =>
    Math.max(EDGE, Math.min(value, limit - size - EDGE));

  // Both axes are clamped on every side, not only the one the side is free on.
  // Some targets are taller or wider than the window — a whole table, a whole
  // settings pane — and then no side fits and the preferred one is used anyway.
  // Unclamped, that put the panel above the top of the window: the tour was
  // running, the light was on, and the words were nowhere on screen. A panel
  // pushed a little off-centre is a compromise; a panel nobody can read is not.
  if (side === 'top' || side === 'bottom') {
    return {
      top: clamp(
        side === 'top' ? rect.top - panel.height - GAP : rect.top + rect.height + GAP,
        panel.height,
        view.height,
      ),
      left: clamp(rect.left + rect.width / 2 - panel.width / 2, panel.width, view.width),
    };
  }
  return {
    top: clamp(rect.top + rect.height / 2 - panel.height / 2, panel.height, view.height),
    left: clamp(
      side === 'left' ? rect.left - panel.width - GAP : rect.left + rect.width + GAP,
      panel.width,
      view.width,
    ),
  };
};

/**
 * One control on the screen, lit, with something to say about it.
 *
 * The dimming is four panes around the target rather than a hole cut in one
 * layer, and every pane lets the pointer through. Both are deliberate: a guided
 * tour that asks somebody to open one of their own orders has to let them,
 * so this covers the screen without taking it over. What the light does is draw
 * the eye; it never becomes a door the person has to close first.
 *
 * The lit box animates between positions, which is the whole of the motion here:
 * the light slides from one control to the next, so the eye follows it instead
 * of searching for where the panel went.
 *
 * The veil is `bg-bg-overlay` at the system's 0.4 opacity step, not the modal
 * scrim. A modal's scrim is meant to put the page beyond reach; this one has to
 * leave it legible, because the tour is about that page and several of its stops
 * ask somebody to use it. At the modal weight the screen went black and the
 * light lit a control in a void, which taught nothing about where the control
 * lives. The system publishes no scrim step of its own — recorded as a gap in
 * `docs/DESIGN-SYSTEM.md` §11.
 */
export const Spotlight = ({
  target,
  place = 'right',
  label,
  onDismiss,
  children,
  className,
}: SpotlightProps) => {
  const [rect, setRect] = useState<Rect | null>(null);
  const [panelSize, setPanelSize] = useState({ width: PANEL_WIDTH, height: 200 });
  const panelRef = useRef<HTMLDivElement | null>(null);
  const labelId = useId();

  const remeasure = useCallback(() => {
    setRect(measure(target));
  }, [target]);

  // Bring the target into view once per stop, then keep the light on it while
  // the page scrolls or the window changes shape.
  useEffect(() => {
    if (target === undefined) {
      setRect(null);
      return;
    }
    const element = visible(target);
    // Guarded rather than called: not every environment that renders this
    // implements scrolling — jsdom does not, and neither do some embedded
    // webviews — and a tour that throws on its first stop is worse than a tour
    // that leaves the page where it is and still says its piece.
    if (element !== null && typeof element.scrollIntoView === 'function') {
      element.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    // After the scroll, not before it: measuring mid-scroll lights the box in
    // the place the target is leaving. A frame apart is enough on a smooth
    // scroll to catch the settled position, and the listeners below correct it
    // the rest of the way.
    // Three times: once for the case where nothing scrolled, once for a short
    // scroll, and once late for a long one. A smooth scroll down a list of forty
    // orders takes longer than a couple of frames, and a light left behind on
    // the place the target was leaving is worse than one that arrives late.
    const first = window.setTimeout(remeasure, 0);
    const settled = window.setTimeout(remeasure, 350);
    const late = window.setTimeout(remeasure, 800);
    return () => {
      window.clearTimeout(first);
      window.clearTimeout(settled);
      window.clearTimeout(late);
    };
  }, [target, remeasure]);

  useEffect(() => {
    let frame = 0;
    const onChange = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(remeasure);
    };
    window.addEventListener('scroll', onChange, true);
    window.addEventListener('resize', onChange);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onChange, true);
      window.removeEventListener('resize', onChange);
    };
  }, [remeasure]);

  useEffect(() => {
    const box = panelRef.current?.getBoundingClientRect();
    if (box !== undefined) setPanelSize({ width: box.width, height: box.height });
  }, [children, rect]);

  useEffect(() => {
    if (onDismiss === undefined) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  const found = rect !== null;
  const seat = found ? position(rect, place, panelSize) : null;

  return (
    <div className="pointer-events-none fixed inset-0 z-overlay" aria-live="polite">
      {found && (
        <>
          {/* Four panes around the lit control. Nothing is cut out, because
              nothing needs to be: the panes only dim, and the pointer passes
              through all of them. */}
          <div
            aria-hidden
            className="absolute left-0 right-0 top-0 animate-fade-in bg-bg-overlay opacity-disabled"
            style={{ height: Math.max(0, rect.top) }}
          />
          <div
            aria-hidden
            className="absolute bottom-0 left-0 right-0 animate-fade-in bg-bg-overlay opacity-disabled"
            style={{ top: rect.top + rect.height }}
          />
          <div
            aria-hidden
            className="absolute left-0 animate-fade-in bg-bg-overlay opacity-disabled"
            style={{ top: rect.top, height: rect.height, width: Math.max(0, rect.left) }}
          />
          <div
            aria-hidden
            className="absolute right-0 animate-fade-in bg-bg-overlay opacity-disabled"
            style={{ top: rect.top, height: rect.height, left: rect.left + rect.width }}
          />

          <div
            aria-hidden
            className="absolute rounded-lg ring-3 ring-focus transition-all duration-normal ease-decelerate motion-reduce:transition-none"
            style={{
              top: rect.top - 4,
              left: rect.left - 4,
              width: rect.width + 8,
              height: rect.height + 8,
            }}
          />
        </>
      )}

      {!found && <div aria-hidden className="absolute inset-0 animate-fade-in bg-bg-overlay opacity-disabled" />}

      <div
        ref={panelRef}
        role="dialog"
        aria-labelledby={labelId}
        className={cn(
          'pointer-events-auto absolute w-[min(360px,calc(100vw-2rem))] animate-slide-up rounded-xl border border-border bg-bg-surface p-5 shadow-4 transition-all duration-normal ease-decelerate motion-reduce:transition-none',
          className,
        )}
        style={
          seat === null
            ? { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
            : { top: seat.top, left: seat.left }
        }
      >
        <span id={labelId} className="sr-only">
          {label}
        </span>
        {children(found)}
      </div>
    </div>
  );
};
