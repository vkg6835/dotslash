import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'RoadLens | SMC Command Center',
    template: '%s | RoadLens',
  },
  description: 'Explore the RoadLens SMC Command Center with recorded YOLO road-damage detections, a map, annotated footage, and maintenance priorities. Built by Vishal Gautam.',
  openGraph: {
    title: 'RoadLens | SMC Command Center',
    description: 'A read-only command center with recorded road-damage detections, an interactive map, and a maintenance triage queue.',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={inter.className}>
      <body className="min-h-screen flex flex-col antialiased">
        {children}
      </body>
    </html>
  );
}
