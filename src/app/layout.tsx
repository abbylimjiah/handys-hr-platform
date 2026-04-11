import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '핸디즈 인사관리',
  description: '운영지원팀 인사관리 플랫폼',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
