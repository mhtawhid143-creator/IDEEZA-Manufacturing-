import { DesignSystemGallery } from './gallery.js';

export const metadata = { title: 'Design system — IDEEZA Manufacturing' };

/**
 * The component gallery. Readable without a session so the design can be
 * reviewed on a preview deployment; it renders no buyer data.
 */
const DesignSystemPage = () => (
  <main className="mx-auto w-full max-w-content px-4 py-10 md:px-gutter">
    <DesignSystemGallery />
  </main>
);

export default DesignSystemPage;
