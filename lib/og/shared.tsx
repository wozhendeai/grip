import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * OG Image shared utilities
 *
 * Provides consistent styling, font loading, and reusable components
 * for OpenGraph and Twitter card images.
 */

// Brand colors (dark theme)
export const colors = {
  background: '#1a1a1c',
  text: '#fafafa',
  textMuted: '#a1a1aa',
  textSubtle: '#71717a',
  border: 'rgba(255,255,255,0.1)',
  lime: '#84cc16',
  green: '#22c55e',
  blue: '#3b82f6',
  purple: '#a855f7',
  red: '#ef4444',
} as const;

// Image dimensions
export const ogSize = { width: 1200, height: 630 };
export const twitterSize = { width: 1200, height: 600 }; // Twitter recommends slightly shorter

/**
 * Load Noto Sans font for ImageResponse
 *
 * Uses the bundled Noto Sans from next/og or falls back to fetching from Google Fonts.
 * Returns font data for ImageResponse options.
 */
export async function loadFont(): Promise<ArrayBuffer> {
  try {
    // Try to load from the bundled next/og font
    const fontPath = join(
      process.cwd(),
      'node_modules/next/dist/compiled/@vercel/og/noto-sans-v27-latin-regular.ttf'
    );
    const fontData = await readFile(fontPath);
    return fontData.buffer.slice(fontData.byteOffset, fontData.byteOffset + fontData.byteLength);
  } catch {
    // Fallback: fetch from Google Fonts
    const response = await fetch(
      'https://fonts.gstatic.com/s/notosans/v36/o-0mIpQlx3QUlC5A4PNB6Ryti20_6n1iPHjcz6L1SoM-jCpoiyD9A99d.ttf'
    );
    return response.arrayBuffer();
  }
}

/**
 * Get font options for ImageResponse
 */
export async function getFontOptions() {
  const fontData = await loadFont();
  return [
    {
      name: 'Noto Sans',
      data: fontData,
      style: 'normal' as const,
      weight: 400 as const,
    },
  ];
}

// Format amount from micro-units (6 decimals) to dollars
export function formatAmount(cents: bigint | string | number): string {
  const value = typeof cents === 'bigint' ? Number(cents) : typeof cents === 'string' ? Number(cents) : cents;
  const dollars = value / 1_000_000;
  if (dollars === 0) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(dollars);
}

// Truncate text with ellipsis
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return `${str.slice(0, maxLength - 1)}…`;
}

// Get status badge color
export function getStatusColor(status: string): string {
  switch (status) {
    case 'open':
      return colors.lime;
    case 'completed':
      return colors.green;
    case 'cancelled':
      return colors.red;
    default:
      return colors.textMuted;
  }
}

// Capitalize first letter
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * GRIP Logo SVG component for OG images
 */
export function GripLogo({ size = 40 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" role="img" aria-label="GRIP Logo">
      <rect width="24" height="24" rx="4" fill={colors.text} />
      <path d="M7 8h10M7 12h6M7 16h8" stroke={colors.background} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Header component with GRIP branding
 */
export function OgHeader({ showUrl = true }: { showUrl?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <GripLogo size={40} />
        <span style={{ fontSize: 28, fontWeight: 700, color: colors.text }}>GRIP</span>
      </div>
      {showUrl && <div style={{ fontSize: 20, color: colors.textSubtle }}>usegrip.xyz</div>}
    </div>
  );
}

/**
 * Footer component
 */
export function OgFooter({ tagline = 'Git Reward & Incentive Platform' }: { tagline?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        borderTop: `1px solid ${colors.border}`,
        paddingTop: 24,
      }}
    >
      <span style={{ fontSize: 18, color: colors.textSubtle }}>{tagline}</span>
    </div>
  );
}

/**
 * Badge component for stats/status
 */
export function Badge({
  children,
  color,
  icon,
}: {
  children: React.ReactNode;
  color: string;
  icon?: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        backgroundColor: `${color}20`,
        border: `1px solid ${color}40`,
        borderRadius: 12,
        padding: '12px 24px',
      }}
    >
      {icon && <span style={{ fontSize: 28 }}>{icon}</span>}
      <span style={{ fontSize: 28, fontWeight: 600, color }}>{children}</span>
    </div>
  );
}
