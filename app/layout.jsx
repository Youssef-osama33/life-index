import './globals.css';

export const metadata = {
  title: 'LIFE-IDX | مؤشر السنة وتحدي الأربعين',
  description: 'لوحة قياس الأداء الأسبوعي لـ 15 قطاعاً وتحدي الأربعين للمراجعة الذاتية',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'LIFE-IDX',
  },
};

export const viewport = {
  themeColor: '#030303',
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="ar"
      dir="rtl"
      style={{
        '--font-cairo': "'Cairo', system-ui, sans-serif",
        '--font-mono': "'JetBrains Mono', monospace",
      }}
    >
      <head>
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&family=JetBrains+Mono:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
