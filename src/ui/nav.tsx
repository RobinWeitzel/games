import { ComponentChildren, VNode, createContext } from 'preact';
import { useCallback, useContext, useEffect, useMemo, useRef, useState } from 'preact/hooks';

/**
 * iOS-style navigation stack: push slides in from the right with the previous screen
 * shifting left (parallax), pop reverses it, and a swipe from the left edge goes back.
 */
interface Entry {
  key: number;
  node: VNode;
  phase: 'enter' | 'idle' | 'leave';
}

export interface Nav {
  push(node: VNode): void;
  pop(): void;
  /** Replace the top screen without animation. */
  replace(node: VNode): void;
  depth: number;
}

const NavContext = createContext<Nav | null>(null);
export const useNav = () => useContext(NavContext)!;

/** True for the screen that is currently on top (screens use it to pause timers etc.). */
const TopContext = createContext(true);
export const useIsTop = () => useContext(TopContext);

/** Position of the screen in the stack (0 = root). */
const IndexContext = createContext(0);
export const useScreenIndex = () => useContext(IndexContext);

/**
 * Extra navigation bar button supplied by whoever renders a screen (the shell gives every game
 * hub its Favorites star this way, so games don't have to). Shown when the Screen has no `right`.
 */
const BarAccessoryContext = createContext<ComponentChildren>(null);
export const BarAccessory = BarAccessoryContext.Provider;

const DURATION = 380;
let keySeq = 1;

/**
 * @param root    first screen (never popped)
 * @param initial screens pushed on top at startup without animation (state restoration)
 */
export function Navigator({ root, initial = [] }: { root: VNode; initial?: VNode[] }) {
  const [stack, setStack] = useState<Entry[]>(() => [
    { key: 0, node: root, phase: 'idle' },
    ...initial.map((node): Entry => ({ key: keySeq++, node, phase: 'idle' })),
  ]);
  const stackRef = useRef(stack);
  stackRef.current = stack;
  const busy = useRef(false);

  const push = useCallback((node: VNode) => {
    if (busy.current) return;
    busy.current = true;
    setStack((s) => [...s, { key: keySeq++, node, phase: 'enter' }]);
    setTimeout(() => {
      busy.current = false;
      setStack((s) => s.map((e) => (e.phase === 'enter' ? { ...e, phase: 'idle' } : e)));
    }, DURATION);
  }, []);

  const finishPop = useCallback(() => {
    setStack((s) => s.filter((e) => e.phase !== 'leave'));
    busy.current = false;
  }, []);

  const pop = useCallback(() => {
    if (busy.current || stackRef.current.length < 2) return;
    busy.current = true;
    setStack((s) => s.map((e, i) => (i === s.length - 1 ? { ...e, phase: 'leave' } : e)));
    setTimeout(finishPop, DURATION);
  }, [finishPop]);

  const replace = useCallback((node: VNode) => {
    setStack((s) => [...s.slice(0, -1), { key: keySeq++, node, phase: 'idle' }]);
  }, []);

  /** Swipe-back already animated the screen away: just drop it. */
  const removeTop = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);

  const nav = useMemo<Nav>(() => ({ push, pop, replace, depth: stack.length }), [push, pop, replace, stack.length]);

  // Index of the visually top-most screen that isn't leaving.
  const live = stack.filter((e) => e.phase !== 'leave');
  const topKey = live[live.length - 1].key;

  return (
    <NavContext.Provider value={nav}>
      <div class="nav-root">
        {stack.map((e, i) => {
          const covered = stack.slice(i + 1).some((x) => x.phase !== 'leave');
          const cls = ['screen', `screen-${e.phase}`, covered ? 'screen-covered' : ''].join(' ');
          return (
            <div key={e.key} class={cls} aria-hidden={covered} inert={covered}>
              <IndexContext.Provider value={i}>
                <TopContext.Provider value={e.key === topKey}>{e.node}</TopContext.Provider>
              </IndexContext.Provider>
              {i > 0 && e.key === topKey && <EdgeSwipe onBack={removeTop} />}
            </div>
          );
        })}
      </div>
    </NavContext.Provider>
  );
}

/** Invisible strip on the left edge that drags the current screen back. */
function EdgeSwipe({ onBack }: { onBack: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const strip = ref.current!;
    const screen = strip.parentElement as HTMLElement;
    let startX = 0;
    let lastX = 0;
    let lastT = 0;
    let velocity = 0;
    let active = false;

    const below = () => screen.previousElementSibling as HTMLElement | null;
    const set = (x: number, animate: boolean) => {
      const w = screen.offsetWidth;
      const t = animate ? `transform ${DURATION / 2}ms cubic-bezier(.2,.8,.2,1)` : 'none';
      screen.style.transition = t;
      screen.style.transform = `translate3d(${x}px,0,0)`;
      const b = below();
      if (b) {
        b.style.transition = t;
        b.style.transform = `translate3d(${-w * 0.3 * (1 - x / w)}px,0,0)`;
      }
    };
    const clear = () => {
      screen.style.transition = screen.style.transform = '';
      const b = below();
      if (b) b.style.transition = b.style.transform = '';
    };

    let startY = 0;
    let dragging = false;

    const down = (e: PointerEvent) => {
      active = true;
      dragging = false;
      startX = lastX = e.clientX;
      startY = e.clientY;
      lastT = e.timeStamp;
      velocity = 0;
      strip.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!active) return;
      if (!dragging) {
        // Only a horizontal movement starts the swipe; until then it may still be a tap.
        if (Math.abs(e.clientX - startX) < 8 && Math.abs(e.clientY - startY) < 8) return;
        dragging = true;
        screen.classList.add('screen-dragging');
      }
      const dt = e.timeStamp - lastT || 1;
      velocity = (e.clientX - lastX) / dt;
      lastX = e.clientX;
      lastT = e.timeStamp;
      set(Math.max(0, e.clientX - startX), false);
    };
    /**
     * A tap on the strip belongs to whatever is underneath (e.g. the first board column or a
     * key): forward it, so the strip never makes content near the edge harder to hit.
     */
    const forwardTap = (e: PointerEvent) => {
      strip.style.pointerEvents = 'none';
      const target = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
      strip.style.pointerEvents = '';
      if (!target || target === strip) return;
      const init = { bubbles: true, cancelable: true, clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId, pointerType: e.pointerType, isPrimary: true };
      target.dispatchEvent(new PointerEvent('pointerdown', init));
      target.dispatchEvent(new PointerEvent('pointerup', init));
      target.click();
    };
    const up = (e: PointerEvent) => {
      if (!active) return;
      active = false;
      if (!dragging) {
        if (e.type === 'pointerup') forwardTap(e);
        return;
      }
      const w = screen.offsetWidth;
      const dx = lastX - startX;
      if (dx > w * 0.35 || velocity > 0.5) {
        const b = below();
        set(w, true);
        setTimeout(() => {
          onBack();
          if (b) b.style.transition = b.style.transform = '';
        }, DURATION / 2);
      } else {
        set(0, true);
        setTimeout(() => {
          screen.classList.remove('screen-dragging');
          clear();
        }, DURATION / 2);
      }
    };
    strip.addEventListener('pointerdown', down);
    strip.addEventListener('pointermove', move);
    strip.addEventListener('pointerup', up);
    strip.addEventListener('pointercancel', up);
    return () => {
      strip.removeEventListener('pointerdown', down);
      strip.removeEventListener('pointermove', move);
      strip.removeEventListener('pointerup', up);
      strip.removeEventListener('pointercancel', up);
    };
  }, [onBack]);

  return <div ref={ref} class="edge-swipe" />;
}

/**
 * Standard screen layout: navigation bar + content.
 *
 * - `largeTitle`: top-level screens (HIG): a large title at the top of the content that
 *   collapses into the navigation bar as you scroll.
 * - `title`: inline title for detail screens.
 * - The bar shows its material + hairline only once content scrolls underneath it.
 */
export function Screen(props: {
  title?: string;
  largeTitle?: string;
  back?: string | false;
  right?: ComponentChildren;
  children: ComponentChildren;
  /** Don't scroll (game screens). */
  fixed?: boolean;
  class?: string;
}) {
  const nav = useNav();
  const index = useScreenIndex();
  const accessory = useContext(BarAccessoryContext);
  const [scrolled, setScrolled] = useState(0);
  const onScroll = (e: Event) => {
    const y = (e.currentTarget as HTMLElement).scrollTop;
    // 0: at top, 1: content under the bar, 2: large title scrolled away
    setScrolled(y <= 0 ? 0 : props.largeTitle && y < 44 ? 1 : 2);
  };
  const barTitle = props.largeTitle ?? props.title;
  const showBarTitle = !props.largeTitle || scrolled === 2;

  return (
    <div class={`screen-inner ${props.class ?? ''}`}>
      <header class={`navbar ${scrolled ? 'navbar-scrolled' : ''}`}>
        <div class="navbar-side">
          {props.back !== false && index > 0 && (
            <button class="nav-back" onClick={() => nav.pop()} aria-label={`Back to ${props.back ?? 'previous screen'}`}>
              <svg viewBox="0 0 12 20" width="12" height="20" aria-hidden="true">
                <path d="M10 2 2 10l8 8" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <span>{props.back ?? 'Back'}</span>
            </button>
          )}
        </div>
        <div class={`navbar-title ${showBarTitle ? '' : 'navbar-title-hidden'}`} aria-hidden={!showBarTitle}>
          {barTitle}
        </div>
        <div class="navbar-side navbar-right">{props.right ?? accessory}</div>
      </header>
      <main class={props.fixed ? 'content-fixed' : 'content-scroll'} onScroll={props.fixed ? undefined : onScroll}>
        {props.largeTitle && <h1 class="large-title">{props.largeTitle}</h1>}
        {props.children}
      </main>
    </div>
  );
}
