import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ToastProvider } from '@ideeza/ui';
import './globals.css';

/** The panel design is drawn in Inter. */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--ids-font-loaded',
});

export const metadata: Metadata = {
  title: 'IDEEZA Manufacturing',
  description:
    'Send a product to manufacture, compare quotes from selected manufacturers and track the order.',
};

const RootLayout = ({ children }: { readonly children: React.ReactNode }) => (
  <html lang="en" className={inter.className}>
    <body>
      <ToastProvider>{children}</ToastProvider>
    </body>
  </html>
);

export default RootLayout;
