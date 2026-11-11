import { JSX } from 'preact';

type P = JSX.SVGAttributes<SVGSVGElement> & { size?: number };

const Icon = ({ size = 24, children, ...rest }: P & { children: JSX.Element | JSX.Element[] }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    {...rest}
  >
    {children}
  </svg>
);

export const IconUndo = (p: P) => (
  <Icon {...p}>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
  </Icon>
);
export const IconErase = (p: P) => (
  <Icon {...p}>
    <path d="M20 5H9l-6 7 6 7h11a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1Z" />
    <path d="m12 9 6 6M18 9l-6 6" />
  </Icon>
);
export const IconPencil = (p: P) => (
  <Icon {...p}>
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </Icon>
);
export const IconBulb = (p: P) => (
  <Icon {...p}>
    <path d="M9 18h6M10 21h4" />
    <path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1.1 1 1.8V16h5v-.3c0-.7.4-1.4 1-1.8A6 6 0 0 0 12 3Z" />
  </Icon>
);
export const IconWand = (p: P) => (
  <Icon {...p}>
    <path d="m4 20 11-11M14 4l1 2 2 1-2 1-1 2-1-2-2-1 2-1ZM19 11l.7 1.3L21 13l-1.3.7L19 15l-.7-1.3L17 13l1.3-.7Z" />
  </Icon>
);
export const IconPause = (p: P) => (
  <Icon {...p}>
    <path d="M9 5v14M15 5v14" stroke-width="2.6" />
  </Icon>
);
export const IconPlay = (p: P) => (
  <Icon {...p}>
    <path d="M7 4.5v15l12.5-7.5Z" fill="currentColor" />
  </Icon>
);
export const IconGear = (p: P) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
  </Icon>
);
export const IconChart = (p: P) => (
  <Icon {...p}>
    <path d="M5 20V12M12 20V4M19 20v-6" stroke-width="2.6" />
  </Icon>
);
export const IconFlame = (p: P) => (
  <Icon {...p}>
    <path
      d="M12 22c4 0 7-2.7 7-6.8 0-3-1.8-5.3-3.4-7-.4 1.6-1.3 2.8-2.6 3.3.3-3.4-1.3-6.6-4-8.5.2 3-1.4 5-3 7-1 1.3-1 2.8-1 4.2C5 19.3 8 22 12 22Z"
      fill="currentColor"
      stroke="none"
    />
  </Icon>
);
export const IconCheck = (p: P) => (
  <Icon {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" stroke-width="2.6" />
  </Icon>
);
export const IconCalendar = (p: P) => (
  <Icon {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
  </Icon>
);
export const IconShare = (p: P) => (
  <Icon {...p}>
    <path d="M12 3v12M8 7l4-4 4 4" />
    <path d="M7 11H6a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-1" />
  </Icon>
);
export const IconChevron = (p: P) => (
  <Icon {...p} viewBox="0 0 10 18">
    <path d="m2 2 6 7-6 7" stroke-width="2" />
  </Icon>
);
export const IconBolt = (p: P) => (
  <Icon {...p}>
    <path d="M13 2.5 4.5 13.5H11l-1 8 8.5-11H12l1-8Z" />
  </Icon>
);
export const IconBook = (p: P) => (
  <Icon {...p}>
    <path d="M12 7c-1.6-1.4-4-2-8-2v13c4 0 6.4.6 8 2 1.6-1.4 4-2 8-2V5c-4 0-6.4.6-8 2Z" />
    <path d="M12 7v13" />
  </Icon>
);
