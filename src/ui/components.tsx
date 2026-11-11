import { ComponentChildren, JSX } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { IconChevron } from './icons';

/** Grouped list section (iOS "inset grouped" table). */
export function Section(props: { header?: ComponentChildren; footer?: ComponentChildren; children: ComponentChildren }) {
  return (
    <section class="section">
      {props.header && <h2 class="section-header">{props.header}</h2>}
      <div class="section-body">{props.children}</div>
      {props.footer && <p class="section-footer">{props.footer}</p>}
    </section>
  );
}

export function Row(props: {
  icon?: ComponentChildren;
  iconBg?: string;
  title: ComponentChildren;
  subtitle?: ComponentChildren;
  detail?: ComponentChildren;
  chevron?: boolean;
  destructive?: boolean;
  onClick?: () => void;
  children?: ComponentChildren;
}) {
  const Tag = props.onClick ? 'button' : 'div';
  return (
    <Tag
      class={`row ${props.onClick ? 'row-tappable' : ''} ${props.destructive ? 'row-destructive' : ''}`}
      onClick={props.onClick}
    >
      {props.icon && (
        <span class="row-icon" style={{ background: props.iconBg }}>
          {props.icon}
        </span>
      )}
      <span class="row-text">
        <span class="row-title">{props.title}</span>
        {props.subtitle && <span class="row-subtitle">{props.subtitle}</span>}
      </span>
      {props.detail != null && <span class="row-detail">{props.detail}</span>}
      {props.children}
      {props.chevron && <IconChevron class="row-chevron" size={14} />}
    </Tag>
  );
}

export function Toggle(props: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <input
      type="checkbox"
      // Safari 17.4+ renders a native iOS switch (with haptics).
      {...({ switch: true } as JSX.HTMLAttributes<HTMLInputElement>)}
      class="toggle"
      aria-label={props.label}
      checked={props.checked}
      onChange={(e) => props.onChange((e.currentTarget as HTMLInputElement).checked)}
    />
  );
}

export function Segmented<T extends string>(props: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const idx = Math.max(0, props.options.findIndex((o) => o.value === props.value));
  return (
    <div class="segmented" role="tablist" style={{ '--n': props.options.length, '--i': idx }}>
      <span class="segmented-thumb" />
      {props.options.map((o) => (
        <button
          role="tab"
          aria-selected={o.value === props.value}
          class={o.value === props.value ? 'active' : ''}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export interface SheetAction {
  label: string;
  style?: 'default' | 'destructive' | 'primary';
  onClick: () => void;
}

/** Bottom sheet / action sheet. Animates in and out. */
export function Sheet(props: {
  open: boolean;
  onClose?: () => void;
  title?: ComponentChildren;
  message?: ComponentChildren;
  children?: ComponentChildren;
  actions?: SheetAction[];
  cancel?: string | false;
}) {
  const [mounted, setMounted] = useState(props.open);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (props.open) {
      setMounted(true);
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    } else {
      setVisible(false);
      const t = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(t);
    }
  }, [props.open]);
  if (!mounted) return null;
  return (
    <div class={`sheet-backdrop ${visible ? 'visible' : ''}`} onClick={() => props.onClose?.()}>
      <div class="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div class="sheet-card">
          {(props.title || props.message) && (
            <div class="sheet-head">
              {props.title && <div class="sheet-title">{props.title}</div>}
              {props.message && <div class="sheet-message">{props.message}</div>}
            </div>
          )}
          {props.children}
          {props.actions?.map((a) => (
            <button
              class={`sheet-action ${a.style ?? 'default'}`}
              onClick={a.onClick}
            >
              {a.label}
            </button>
          ))}
        </div>
        {props.cancel !== false && props.onClose && (
          <button class="sheet-cancel" onClick={() => props.onClose!()}>
            {props.cancel ?? 'Cancel'}
          </button>
        )}
      </div>
    </div>
  );
}

export function Toast(props: { show: boolean; children: ComponentChildren; onClick?: () => void }) {
  return (
    <button class={`toast ${props.show ? 'visible' : ''}`} onClick={props.onClick} tabIndex={props.show ? 0 : -1}>
      {props.children}
    </button>
  );
}
