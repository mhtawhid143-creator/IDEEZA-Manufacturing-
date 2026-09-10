import Link from 'next/link';
import { Text, Tooltip } from '@ideeza/ui';
import type { ChainLink, PipelineStage } from '@ideeza/domain';

export interface RecordChainProps {
  readonly links: readonly ChainLink[];
  /** Which stage the reader is looking at, marked rather than linked. */
  readonly current: PipelineStage;
  /** Where each stage can be opened, for the ones this shop may open. */
  readonly hrefs: Partial<Record<PipelineStage, string>>;
}

/**
 * Where this record sits in the chain, and how to get to the rest of it
 * (UIUX-208, UIUX-146).
 *
 * The review found the chain broken in three places and read it as three copy
 * defects. It was one: no stage said which stage it was, so nobody could start
 * at a live order and get back to the design it was made from. This strip is
 * the fix stated once — every surface that belongs to the pipeline shows the
 * whole of it, as far as it has been built, with the reader's own position
 * marked.
 *
 * The project is deliberately **not** a link. This platform holds the design's
 * files and its bill of materials, and a shop reads those on this request's own
 * tabs; the design tool the buyer drew it in is a different system, and a
 * control that says "View source project" and opens nothing would be worse than
 * the reference it replaced. So the project is quoted, not offered — which is
 * what a reference is for.
 */
export const RecordChain = ({ links, current, hrefs }: RecordChainProps) => (
  <nav
    aria-label="Where this sits, from the design to the order"
    className="flex flex-wrap items-center gap-x-2 gap-y-1"
  >
    {links.map((link, index) => {
      const href = hrefs[link.stage];
      const here = link.stage === current;
      const body = (
        <>
          <span className="text-text-tertiary">{link.label}</span>{' '}
          <span data-numeric className="font-medium">
            {link.reference}
          </span>
          {link.name === null ? '' : <span className="text-text-tertiary"> · {link.name}</span>}
        </>
      );

      return (
        <span key={link.stage} className="inline-flex items-center gap-2">
          {index > 0 && (
            <span aria-hidden className="text-text-disabled">
              ›
            </span>
          )}
          {here ? (
            <span aria-current="true" className="text-xs font-semibold text-text-primary">
              {body}
            </span>
          ) : href === undefined ? (
            <Tooltip content="Held on this platform as its files, bill of materials and specification. The design tool it was drawn in is not part of this portal.">
              <span className="text-xs text-text-secondary">{body}</span>
            </Tooltip>
          ) : (
            <Link
              href={href}
              className="rounded text-xs text-text-link underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus"
            >
              {body}
            </Link>
          )}
        </span>
      );
    })}
  </nav>
);

/**
 * What the request covers, said rather than assumed (UIUX-207).
 *
 * A project can hold more than one thing to make, and this platform sends each
 * as its own request. Naming the one in front of the reader is what stops a
 * surface reading as if it were the whole project — which is the half of
 * multi-product support that does not need a schema to change.
 */
export const CoversLine = ({ packageLabel }: { readonly packageLabel: string }) => (
  <Text tone="muted" size="xs" className="mt-1 block">
    {/*
      The label keeps its own casing. Lowercasing it turned PCB into "pcb",
      which reads as a typo rather than as a sentence.
    */}
    This request covers the {packageLabel} part of that project. Anything else in it
    travels as its own request.
  </Text>
);
