import { Cairo, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['400', '600', '700', '800'],
  variable: '--font-cairo',
});

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '600', '700'],
  variable: '--font-mono',
});

export const metadata = {
  title: 'LIFE-IDX | مؤشر السنة وتحدي الأربعين',
  description: 'لوحة قياس الأداء الأسبوعي وتحدي الأربعين للمراجعة الذاتية',
};

export default function RootLayout({ children }) {
  return (
    <html lang="ar" dir="rtl" className={`${cairo.variable} ${jetbrains.variable}`}>
      <body>{children}</body>
    </html>
  );
}
