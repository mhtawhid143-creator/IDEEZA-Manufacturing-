/* eslint-disable ideeza/design-tokens -- placeholder cover art generated from the category's own hue, not a colour of the interface. There is no media store behind these screens yet */
import Link from 'next/link';
import { Badge, Card, Icon, Text } from '@ideeza/ui';
import { categoryCounts, type TutorialCategory } from '@/data/tutorials.js';

/**
 * One category on the tutorial index — the Figma card at 357×409.
 *
 * The still is drawn from the category's own hue rather than loaded: there is
 * no media store behind these screens, and a coloured field that is obviously a
 * placeholder is more honest than a broken image and quieter than a grey box.
 * What carries the meaning is the title, the price and the two counts.
 *
 * A category with nothing written in it is not a link. It says so on its face
 * instead of opening an empty page dressed as a full one.
 */
export const TutorialCard = ({ category }: { readonly category: TutorialCategory }) => {
  const { topics, videos } = categoryCounts(category);
  const ready = topics > 0;

  const body = (
    <Card padded={false} className="h-full overflow-hidden">
      <div
        className="h-[200px] w-full"
        style={{
          background: `linear-gradient(140deg, hsl(${category.hue} 62% 62%), hsl(${(category.hue + 40) % 360} 58% 44%))`,
        }}
        role="img"
        aria-label={`Cover art for ${category.title}`}
      />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="min-w-0 truncate text-base font-semibold text-text-primary">
            {category.title}
          </h2>
          <span className="shrink-0 text-sm font-semibold text-text-brand">
            {category.priceLabel}
          </span>
        </div>

        <Text tone="muted" size="sm" className="line-clamp-3">
          {category.summary}
        </Text>

        {ready ? (
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="brand" size="md">
              {topics} {topics === 1 ? 'topic' : 'topics'}
            </Badge>
            <Badge tone="brand" size="md">
              <span className="inline-flex items-center gap-1">
                {videos} {videos === 1 ? 'video' : 'videos'}
                <Icon name="play" size={12} />
              </span>
            </Badge>
          </div>
        ) : (
          <Text tone="muted" size="xs">
            Not written yet — nothing to read here.
          </Text>
        )}
      </div>
    </Card>
  );

  if (!ready) {
    return (
      <div aria-disabled="true" className="opacity-muted">
        {body}
      </div>
    );
  }

  return (
    <Link
      href={`/tutorial/${category.id}`}
      className="rounded-xl transition-shadow duration-fast hover:shadow-2 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-focus"
    >
      {body}
    </Link>
  );
};
