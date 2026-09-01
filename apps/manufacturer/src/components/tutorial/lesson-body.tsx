/* eslint-disable ideeza/design-tokens -- placeholder stills generated from each block's own hue, not colours of the interface. There is no media store behind these screens yet; the caption beside a still is what carries its meaning */
import { buttonAppearance, Card, Heading, Icon, Text, Tooltip } from '@ideeza/ui';
import type { LessonBlock } from '@/data/tutorials.js';

/**
 * Why the reward is shown but cannot be taken.
 *
 * The Figma offers "Claim 2.0 IDZ Token" under every video. There is no coin in
 * this platform — no balance, no ledger, nothing that could be credited — so a
 * button that appeared to pay one would be inventing an outcome. It is drawn in
 * the unavailable state instead, which is a real appearance in this repository
 * and says what is true: the reward is part of the wider IDEEZA product.
 */
const NO_LEDGER =
  'Tokens belong to the wider IDEEZA product. This platform has no balance to credit yet.';

const Still = ({
  hue,
  caption,
  play,
}: {
  readonly hue: number;
  readonly caption: string;
  readonly play: boolean;
}) => (
  <div
    className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg"
    style={{
      // beside it is what carries the meaning.
      background: `linear-gradient(140deg, hsl(${hue} 55% 55%), hsl(${(hue + 45) % 360} 50% 32%))`,
    }}
    role="img"
    aria-label={caption}
  >
    {play && (
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-bg-surface text-icon-brand shadow-2">
        <Icon name="play" size={16} />
      </span>
    )}
  </div>
);

/**
 * The middle column of a lesson — the Figma content column at 512px.
 *
 * Headings become real headings so the page-contents list on the right has
 * something to point at and the document has an outline; a lesson read with a
 * screen reader should be navigable by heading like any article.
 */
export const LessonBody = ({ blocks }: { readonly blocks: readonly LessonBlock[] }) => (
  <div className="flex max-w-measure flex-col gap-5">
    {blocks.map((block, index) => {
      const key = `${block.kind}-${String(index)}`;

      if (block.kind === 'heading') {
        return (
          <Heading key={key} level={2} id={headingId(block.text ?? '')}>
            {block.text}
          </Heading>
        );
      }

      if (block.kind === 'text') {
        return (
          <Text key={key} size="sm" className="block leading-lg text-text-secondary">
            {block.text}
          </Text>
        );
      }

      if (block.kind === 'figure') {
        return (
          <figure key={key} className="flex flex-col gap-2">
            <Still hue={block.hue ?? 268} caption={block.caption ?? ''} play={false} />
            <figcaption className="text-xs text-text-tertiary">{block.caption}</figcaption>
          </figure>
        );
      }

      return (
        <Card key={key} className="flex flex-col gap-3">
          <Still hue={block.hue ?? 268} caption={block.caption ?? ''} play />
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-text-primary">{block.caption}</p>
              {block.duration !== undefined && (
                <Text tone="muted" size="xs">
                  {block.duration} · watch it and earn {block.tokenReward}
                </Text>
              )}
            </div>
            <Tooltip content={NO_LEDGER} side="top">
              <span>
                <button
                  type="button"
                  disabled
                  aria-describedby={undefined}
                  className={buttonAppearance({ variant: 'primary', size: 'sm', unavailable: true })}
                >
                  Claim {block.tokenReward}
                </button>
              </span>
            </Tooltip>
          </div>
        </Card>
      );
    })}
  </div>
);

/** The anchor a heading answers to, shared with the page-contents list. */
export const headingId = (text: string): string =>
  `section-${text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
