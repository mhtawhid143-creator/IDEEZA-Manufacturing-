import { PageHeader } from '@ideeza/ui';
import { BlogWorkspace } from '@/components/blog/blog-workspace.js';
import { listArticles } from '@/data/articles.js';
import { getShopContext } from '@/data/shop.js';
import { requireManufacturer } from '@/lib/auth.js';

export const dynamic = 'force-dynamic';

/**
 * The blog: what a shop writes for buyers to read on its profile.
 *
 * The articles are this shop's own rows. They used to be two examples written
 * here so the states were visible, which meant the profile's Blog tab — reading
 * the table — showed a shop nothing it had written.
 */
const BlogPage = async () => {
  const actor = await requireManufacturer('/blog');
  const shop = await getShopContext(actor.manufacturerId, actor.userId);
  const articles = await listArticles(actor.manufacturerId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Blog"
        description="Write about how your shop works. Buyers read it on your profile, and IDEEZA reads it first."
      />
      <BlogWorkspace shopName={shop?.displayName ?? 'Your shop'} seed={articles} />
    </div>
  );
};

export default BlogPage;
