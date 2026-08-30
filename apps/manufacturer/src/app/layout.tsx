import type { Metadata } from 'next';
import { Manrope } from 'next/font/google';
import { ToastProvider } from '@ideeza/ui';
import './globals.css';

/** The typeface the design system names: @ideeza/tokens, font-family/body. */
const manrope = Manrope({
  subsets: ['latin'],
  display: 'swap',
  variable: '--ids-font-loaded',
});

export const metadata: Metadata = {
  title: 'IDEEZA Manufacturing — Manufacturer',
  description:
    'Read the requests routed to your shop, quote them, run the orders you win, and get paid.',
};

const RootLayout = ({ children }: { readonly children: React.ReactNode }) => (
  <html lang="en" className={manrope.className}>
    <body>
      <ToastProvider>{children}</ToastProvider>
    </body>
  </html>
);

export default RootLayout;
