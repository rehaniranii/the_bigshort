import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'REGIME-X | Adaptive Quant Trading Intelligence',
  description:
    'Institutional-grade quantitative trading platform powered by adaptive regression, ML regime detection, and confidence-based position sizing.',
  keywords: 'quantitative trading, machine learning, market regime, backtesting, Pine Script',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
