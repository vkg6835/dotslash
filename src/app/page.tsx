import DemoDashboard from '@/components/demo/DemoDashboard';
import demoData from '@/data/demo-data.json';
import type { DemoDataset } from '@/lib/demo';

export default function HomePage() {
  return <DemoDashboard data={demoData as DemoDataset} />;
}
