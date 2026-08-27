import { PageHeader } from '@ideeza/ui';
import { BlogWorkspace, type Article } from '@/components/blog/blog-workspace.js';
import { getShopContext } from '@/data/shop.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

/**
 * The blog: what a shop writes for buyers to read on its profile.
 *
 * The two articles below are examples so the states are visible — a published
 * one and one IDEEZA sent back with a reason. Everything is editable and nothing
 * is stored yet, which the screen states plainly.
 */
const BlogPage = async () => {
  const actor = await requireManufacturer('/blog');
  const shop = await getShopContext(actor.manufacturerId, actor.userId);
  const shopName = shop?.displayName ?? 'Your shop';

  const seed: readonly Article[] = [
    {
      id: 'example_published',
      title: 'What we check before a board goes on the line',
      category: 'Quality',
      tags: ['AOI', 'process'],
      body: `Every job that reaches our floor gets the same first hour: the gerbers are opened next to the assembly drawing, the stack-up is checked against the impedance the buyer asked for, and the bill of materials is matched line by line against what is on the shelf.\n\nMost problems are found in that hour, and they are cheap there. The same problem found after the stencil is cut is a week and a scrapped panel. This is why our quotes carry a build time rather than a hope, and why we would rather ask a question on day one than send a surprise on day ten.`,
      status: 'published',
      on: new Date(Date.now() - 12 * 86_400_000).toISOString().slice(0, 10),
      rejectReason: null,
      readMinutes: 2,
    },
    {
      id: 'example_rejected',
      title: 'Ten reasons we are the cheapest shop in the region',
      category: 'Manufacturing',
      tags: ['pricing'],
      body: `We are the cheapest, the fastest and the best at everything. Nobody else can do what we do. Send us your work and you will never regret it.`,
      status: 'rejected',
      on: new Date(Date.now() - 3 * 86_400_000).toISOString().slice(0, 10),
      rejectReason:
        'This reads as advertising rather than something a buyer learns from. Write about how you work, not about being the best.',
      readMinutes: 1,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Blog"
        description="Write about how your shop works. Buyers read it on your profile, and IDEEZA reads it first."
      />
      <BlogWorkspace shopName={shopName} seed={seed} />
    </div>
  );
};

export default BlogPage;
