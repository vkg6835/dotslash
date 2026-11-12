import TopBar from '@/components/TopBar';
import Map from '@/components/Map';
import { fetchPublicMap } from '@/lib/apiClient';
import PublicSearchBar from '@/components/PublicSearchBar';

const getDistanceInMeters = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371e3;
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dp/2) * Math.sin(dp/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
};

export default async function PublicPortal({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const params = await searchParams;
  const q = (params?.q || '').toLowerCase();

  const rawPublicMap = await fetchPublicMap();

  // Automatically generate dynamic "Ward Health Scores" strictly parsed from live anomalies!
  const areaGroups: Record<string, any> = {};

  rawPublicMap.forEach((inc: any) => {
    let area = inc.location_name || 'Surat Region';
    if (area.includes(',')) area = area.split(',')[0].trim();
    if (area.includes('Camera Snapshot') || area.includes('Pi Camera')) return;

    if (!areaGroups[area]) {
      areaGroups[area] = {
        id: area,
        ward_name: area,
        potholes: 0,
        cracks: 0,
        total_severity: 0,
        // Assume structural region scale for math
        assumed_roads: 150
      };
    }

    if (inc.status === 'active') {
      if (inc.type === 'pothole') areaGroups[area].potholes += 1;
      else areaGroups[area].cracks += 1;
      areaGroups[area].total_severity += (inc.severity_score || 0);
    }
  });

  const liveWards = Object.values(areaGroups)
    .map(w => {
      const activeAnomalies = w.potholes + w.cracks;
      const severityPenalty = w.total_severity * 0.05;
      const damageRaw = ((activeAnomalies + severityPenalty) / w.assumed_roads) * 100;

      return {
        id: w.id,
        ward_name: w.ward_name,
        damage_percentage: Math.min(Math.max(Math.round(damageRaw), 1), 99),
        damaged_roads: activeAnomalies,
        total_roads: w.assumed_roads
      };
    })
    .sort((a, b) => b.damage_percentage - a.damage_percentage)
    .slice(0, 12); // Display up to 12 highest risk areas

  const publicMap = q
    ? rawPublicMap.filter((inc: any) => (inc.location_name || '').toLowerCase().includes(q))
    : rawPublicMap;

  const CLUSTER_RADIUS_M = 15;
  const clusteredMarkers: any[] = [];

  for (const inc of publicMap) {
    let foundCluster = null;
    for (const cluster of clusteredMarkers) {
      if (getDistanceInMeters(inc.lat, inc.lng, cluster.lat, cluster.lng) <= CLUSTER_RADIUS_M) {
        foundCluster = cluster;
        break;
      }
    }

    if (foundCluster) {
      foundCluster.incidents.push(inc);
      foundCluster.lat = foundCluster.incidents.reduce((a: number, b: any) => a + b.lat, 0) / foundCluster.incidents.length;
      foundCluster.lng = foundCluster.incidents.reduce((a: number, b: any) => a + b.lng, 0) / foundCluster.incidents.length;
    } else {
      clusteredMarkers.push({
        id: `cluster-${inc.id || Math.random()}`,
        lat: inc.lat,
        lng: inc.lng,
        incidents: [inc],
        type: inc.type
      });
    }
  }

  const mapMarkers = clusteredMarkers.map((c: any) => {
    const isCluster = c.incidents.length > 1;
    const numPotholes = c.incidents.filter((i: any) => i.type === 'pothole').length;
    const numCracks = c.incidents.filter((i: any) => i.type === 'early_crack').length;
    const densityMetric = parseFloat(((numPotholes * 1) + (numCracks * 0.2)).toFixed(2));
    const locationName = isCluster ? `Hazard Cluster (${c.incidents[0].location_name.split(',')[0]})` : (c.incidents[0].location_name || 'Surat Road');

    const maxSeverity = Math.max(...c.incidents.map((i: any) => i.severity_score || 0));

    return {
      id: c.id,
      lat: c.lat,
      lng: c.lng,
      type: isCluster ? 'cluster' : c.incidents[0].type,
      severity: maxSeverity,
      popupData: {
        location_name: locationName,
        status_label: isCluster ? 'Dense Cluster' : (c.incidents[0].status_label || c.incidents[0].type),
        ...(isCluster && { cluster_density: densityMetric, anomaly_count: c.incidents.length }),
        ...(!isCluster && c.incidents[0].repaired_at && { repaired_at: c.incidents[0].repaired_at }),
        ...(!isCluster && c.incidents[0].area && { area_sq_m: c.incidents[0].area })
      }
    };
  });

  const getBarColor = (percentage: number) => {
    if (percentage > 50) return 'bg-severe';
    if (percentage >= 20) return 'bg-moderate';
    return 'bg-repaired';
  };

  return (
    <main className="flex-1 flex flex-col h-screen overflow-hidden bg-[#050505]">
      <TopBar role="public" />

      <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 flex flex-col gap-8">

        {/* Interactive Map Section */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h1 className="text-2xl font-bold tracking-tight">Live Road Conditions</h1>
            <PublicSearchBar />
          </div>

          <div className="h-[50vh] min-h-[400px] w-full relative rounded-xl overflow-hidden shadow-2xl shadow-black">
            <Map
              center={
                q && mapMarkers.length > 0
                  ? [mapMarkers[0].lat, mapMarkers[0].lng] as [number, number]
                  : [21.1702, 72.8311] as [number, number]
              }
              zoom={q && mapMarkers.length > 0 ? 14 : 12}
              markers={mapMarkers}
            />

            {/* Overlay Map Legend */}
            <div className="absolute bottom-4 right-4 z-[400] card bg-black/80 backdrop-blur-md p-4 flex flex-col gap-2 border-white/10">
              <h3 className="text-xs font-bold text-white/50 uppercase tracking-wider mb-1">Status Legend</h3>
              <div className="flex items-center gap-2 text-sm text-white/80">
                <div className="w-3 h-3 rounded-full bg-severe border-[1.5px] border-[#121212]" />
                Severe — avoid if possible
              </div>
              <div className="flex items-center gap-2 text-sm text-white/80">
                <div className="w-3 h-3 rounded-full bg-moderate border-[1.5px] border-[#121212]" />
                Moderate — drive carefully
              </div>
              <div className="flex items-center gap-2 text-sm text-white/80">
                <div className="w-3 h-3 rounded-full bg-repaired border-[1.5px] border-[#121212]" />
                Repaired — all clear
              </div>
            </div>
          </div>
        </section>

        {/* Ward Health Scores */}
        <section className="flex flex-col gap-4 pb-12">
          <h2 className="text-xl font-bold tracking-tight">Ward health scores — this month</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {liveWards.map((ward: any) => (
              <div key={ward.id} className="card p-4 flex flex-col gap-3 hover:border-white/20 transition-colors group cursor-default">
                <div className="flex items-center justify-between">
                  <span className="font-semibold">{ward.ward_name}</span>
                  <span className="text-xl font-bold tracking-tighter">{ward.damage_percentage}%</span>
                </div>

                {/* Progress Bar Container */}
                <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden relative">
                  <div
                    className={`h-full absolute left-0 top-0 transition-all duration-1000 ease-out group-hover:opacity-100 opacity-90 ${getBarColor(ward.damage_percentage)}`}
                    style={{ width: `${ward.damage_percentage}%` }}
                  />
                </div>

                <div className="flex justify-between text-xs text-white/50">
                  <span>Damaged: {ward.damaged_roads}</span>
                  <span>Total: {ward.total_roads}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

      </div>
    </main>
  );
}
