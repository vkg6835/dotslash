export type DamageKind = 'pothole' | 'surface_damage';

export interface DemoDetection {
  id: string;
  frame: number;
  timestampSeconds: number;
  kind: DamageKind;
  modelClass: string;
  confidence: number;
  box: { x1: number; y1: number; x2: number; y2: number };
  lat: number;
  lng: number;
  severity: number;
  busesPerDay: number;
  segment: string;
  image: string;
}

export interface DemoDataset {
  source: {
    video: string;
    poster: string;
    fullCsv: string;
    recordingName: string;
    modelName: string;
    modelFile: string;
    width: number;
    height: number;
    fps: number;
    durationSeconds: number;
    frameCount: number;
    detectionFrameCount: number;
    detectionCount: number;
    classCounts: Record<string, number>;
    coordinatesAreSimulated: boolean;
  };
  samples: DemoDetection[];
}

export type DemoSort = 'priority' | 'severity' | 'confidence' | 'time';
export interface DemoFilters {
  kind: 'all' | DamageKind;
  minConfidence: number;
  query: string;
  sort: DemoSort;
}

export function damageLabel(kind: DamageKind) {
  return kind === 'pothole' ? 'Pothole' : 'Surface damage';
}

export function priorityScore(detection: DemoDetection) {
  return detection.severity * detection.busesPerDay;
}

export function formatTimestamp(seconds: number) {
  const rounded = Math.max(0, Math.floor(seconds));
  return String(Math.floor(rounded / 60)).padStart(2, '0') + ':' +
    String(rounded % 60).padStart(2, '0');
}

export function filterDetections(samples: DemoDetection[], filters: DemoFilters) {
  const query = filters.query.trim().toLowerCase();
  return samples
    .filter((sample) => {
      const searchable = [sample.id, sample.segment, damageLabel(sample.kind), sample.modelClass].join(' ').toLowerCase();
      return (filters.kind === 'all' || sample.kind === filters.kind) &&
        sample.confidence >= filters.minConfidence &&
        (!query || searchable.includes(query));
    })
    .sort((left, right) => {
      let difference = 0;
      if (filters.sort === 'priority') difference = priorityScore(right) - priorityScore(left);
      else if (filters.sort === 'severity') difference = right.severity - left.severity;
      else if (filters.sort === 'confidence') difference = right.confidence - left.confidence;
      else difference = left.timestampSeconds - right.timestampSeconds;
      return difference || left.frame - right.frame || left.id.localeCompare(right.id);
    });
}

function csvCell(value: string | number) {
  const text = String(value);
  return '"' + text.replaceAll('"', '""') + '"';
}

export function reviewCsv(samples: DemoDetection[]) {
  const columns = [
    'sample_id', 'source_frame', 'video_seconds', 'model_class', 'confidence',
    'demo_severity', 'simulated_buses_per_day', 'demo_priority_score',
    'simulated_latitude', 'simulated_longitude',
  ];
  const rows = samples.map((sample) => [
    sample.id, sample.frame, sample.timestampSeconds, sample.modelClass,
    sample.confidence, sample.severity, sample.busesPerDay, priorityScore(sample),
    sample.lat, sample.lng,
  ]);
  return [columns, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
}
