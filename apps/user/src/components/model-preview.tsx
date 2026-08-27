import { cn } from '@ideeza/ui';

/** A stable hue per product name, so a card looks the same on every render. */
const hueOf = (seed: string): number => {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) % 360;
  }
  return hash;
};

export interface ModelPreviewProps {
  readonly name: string;
  readonly fileCount: number;
  readonly className?: string;
  readonly tall?: boolean;
}

/**
 * The model image area.
 *
 * The product's images are stored files, and file storage is not part of the
 * user-side tasks: the record exists, the bytes do not. Rather than show a
 * broken image, this draws a deterministic placeholder and says what it stands
 * for, so the layout is real and nothing pretends to be a render that is not.
 */
export const ModelPreview = ({ name, fileCount, className, tall = false }: ModelPreviewProps) => {
  const hue = hueOf(name);
  return (
    <div
      role="img"
      aria-label={`${name}: model preview placeholder. ${fileCount} model ${fileCount === 1 ? 'file' : 'files'} on record, image rendering arrives with file storage.`}
      className={cn(
        'relative flex items-center justify-center border-b border-line',
        tall ? 'h-64' : 'h-40',
        className,
      )}
      style={{
        background: `linear-gradient(135deg, hsl(${hue} 62% 94%), hsl(${(hue + 42) % 360} 68% 86%))`,
      }}
    >
      <svg width="56" height="56" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M12 2.8 3.8 7.2v9.6L12 21.2l8.2-4.4V7.2L12 2.8Z"
          stroke={`hsl(${hue} 40% 38%)`}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
        <path
          d="M3.8 7.2 12 11.6l8.2-4.4M12 11.6v9.6"
          stroke={`hsl(${hue} 40% 38%)`}
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
      <span className="absolute bottom-2 right-2 rounded-full bg-surface/85 px-2 py-0.5 text-[11px] font-semibold text-muted">
        model preview
      </span>
    </div>
  );
};
