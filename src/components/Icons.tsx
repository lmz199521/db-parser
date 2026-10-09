/**
 * 内联 SVG 图标集
 *
 * 为什么不装图标库：整个应用只用到十几个图标，引入 lucide-react / react-icons
 * 会让打包体积多出几百 KB（且难以 tree-shake 干净）。这里统一手写，
 * 尺寸由 size 控制、颜色靠 currentColor 继承，零运行时开销。
 */
import type { ReactNode } from 'react';

interface IconProps {
  size?: number;
  className?: string;
}

function Icon({ size = 16, className, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

export const IconDatabase = (p: IconProps) => (
  <Icon {...p}>
    <ellipse cx="12" cy="5.5" rx="7.5" ry="2.8" />
    <path d="M4.5 5.5v13c0 1.55 3.36 2.8 7.5 2.8s7.5-1.25 7.5-2.8v-13" />
    <path d="M4.5 12c0 1.55 3.36 2.8 7.5 2.8s7.5-1.25 7.5-2.8" />
  </Icon>
);

export const IconTable = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2.2" />
    <path d="M3 9.6h18M9 9.6V20M15 9.6V20" />
  </Icon>
);

export const IconView = (p: IconProps) => (
  <Icon {...p}>
    <path d="M2.5 12S6 6.2 12 6.2 21.5 12 21.5 12 18 17.8 12 17.8 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="2.6" />
  </Icon>
);

export const IconRows = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2.2" />
    <path d="M3 9.8h18M3 14.6h18" />
  </Icon>
);

export const IconColumns = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2.2" />
    <path d="M9.2 4v16M14.8 4v16" />
  </Icon>
);

export const IconBraces = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8.4 2.8H7.2A2.2 2.2 0 0 0 5 5v3.4a2.2 2.2 0 0 1-2.2 2.2v1a2.2 2.2 0 0 1 2.2 2.2V19a2.2 2.2 0 0 0 2.2 2.2h1.2" />
    <path d="M15.6 2.8h1.2A2.2 2.2 0 0 1 19 5v3.4a2.2 2.2 0 0 0 2.2 2.2v1a2.2 2.2 0 0 0-2.2 2.2V19a2.2 2.2 0 0 1-2.2 2.2h-1.2" />
  </Icon>
);

export const IconSearch = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="10.8" cy="10.8" r="6.8" />
    <path d="m20 20-4.3-4.3" />
  </Icon>
);

export const IconSun = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.4v2.4M12 19.2v2.4M2.4 12h2.4M19.2 12h2.4M5.2 5.2l1.7 1.7M17.1 17.1l1.7 1.7M18.8 5.2l-1.7 1.7M6.9 17.1l-1.7 1.7" />
  </Icon>
);

export const IconMoon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1Z" />
  </Icon>
);

export const IconKey = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="7.8" cy="16.2" r="4.2" />
    <path d="m11 13 9-9M16.8 4.2 19.8 7.2M14.4 6.6l3 3" />
  </Icon>
);

export const IconLink = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9.6 14.4 14.4 9.6" />
    <path d="M11.4 6.6 13.3 4.7a4.2 4.2 0 0 1 5.9 5.9l-1.9 1.9" />
    <path d="M12.6 17.4 10.7 19.3a4.2 4.2 0 0 1-5.9-5.9l1.9-1.9" />
  </Icon>
);

export const IconLayers = (p: IconProps) => (
  <Icon {...p}>
    <path d="m12 3 9 4.8-9 4.8-9-4.8L12 3Z" />
    <path d="m3 12.6 9 4.8 9-4.8" />
    <path d="m3 16.9 9 4.8 9-4.8" />
  </Icon>
);

export const IconAlert = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10.3 3.9 2.4 17.4A2 2 0 0 0 4.1 20.4h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
    <path d="M12 9.4v4.2M12 17h.01" />
  </Icon>
);

export const IconInfo = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5.2M12 7.8h.01" />
  </Icon>
);

export const IconShield = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 3 5 6v5.6c0 4.3 2.9 8.3 7 9.4 4.1-1.1 7-5.1 7-9.4V6l-7-3Z" />
    <path d="m9.2 12 2 2 3.6-3.9" />
  </Icon>
);

export const IconUpload = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 16.4V4.2M7.6 8.6 12 4.2l4.4 4.4" />
    <path d="M4 15.6v2.6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.6" />
  </Icon>
);

export const IconGrid = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.4" y="3.4" width="7.2" height="7.2" rx="1.6" />
    <rect x="13.4" y="3.4" width="7.2" height="7.2" rx="1.6" />
    <rect x="3.4" y="13.4" width="7.2" height="7.2" rx="1.6" />
    <rect x="13.4" y="13.4" width="7.2" height="7.2" rx="1.6" />
  </Icon>
);

export const IconCopy = (p: IconProps) => (
  <Icon {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2.2" />
    <path d="M6 15H5.2A2.2 2.2 0 0 1 3 12.8V5.2A2.2 2.2 0 0 1 5.2 3h7.6A2.2 2.2 0 0 1 15 5.2V6" />
  </Icon>
);

export const IconPlay = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 4.8 19 12 7 19.2V4.8Z" />
  </Icon>
);

export const IconClose = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6.2 6.2l11.6 11.6M17.8 6.2 6.2 17.8" />
  </Icon>
);

export const IconClock = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7.2V12l3.2 2" />
  </Icon>
);

export const IconSpark = (p: IconProps) => (
  <Icon {...p}>
    <path d="m12 3 2.35 5.4 5.65.5-4.3 3.8 1.3 5.6L12 15.4 7 18.3l1.3-5.6L4 8.9l5.65-.5L12 3Z" />
  </Icon>
);

export const IconDownload = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 4v12.2M7.6 11.8 12 16.2l4.4-4.4" />
    <path d="M4 15.6v2.6a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.6" />
  </Icon>
);

export const IconTerminal = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2.2" />
    <path d="m7.6 9.4 2.6 2.6-2.6 2.6M12.6 15h4" />
  </Icon>
);

export const IconFolder = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 7.2A2.2 2.2 0 0 1 5.2 5h3.4l2 2.6h8.2A2.2 2.2 0 0 1 21 9.8v7A2.2 2.2 0 0 1 18.8 19H5.2A2.2 2.2 0 0 1 3 16.8v-9.6Z" />
  </Icon>
);
