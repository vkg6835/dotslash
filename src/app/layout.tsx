import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: {
    default: 'RoadLens | Road damage audit demo',
    template: '%s | RoadLens',
  },
  description: 'Explore recorded YOLO road-damage detections, annotated footage, and maintenance priorities. Built by Vishal Gautam.',
  openGraph: {
    title: 'RoadLens | See road damage. Know what to fix first.',
    description: 'An interactive road audit demo with recorded computer vision results and maintenance priorities.',
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
