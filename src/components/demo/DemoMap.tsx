'use client';

import { useEffect, useMemo } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer, Tooltip, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { damageLabel, type DemoDetection } from '@/lib/demo';

export interface DemoMapProps {
  samples: DemoDetection[];
  route: DemoDetection[];
  selected: DemoDetection | null;
  onSelect: (sample: DemoDetection) => void;
  resetToken: number;
}

function Viewport({ samples, selected, resetToken }: Pick<DemoMapProps, 'samples' | 'selected' | 'resetToken'>) {
  const map = useMap();
  const positions = useMemo(() => samples.map((sample) => L.latLng(sample.lat, sample.lng)), [samples]);

  useEffect(() => {
    if (positions.length) {
      map.fitBounds(L.latLngBounds(positions), { padding: [55, 55], maxZoom: 17, animate: false });
    }
  }, [map, positions, resetToken]);

  useEffect(() => {
    if (selected) map.panTo([selected.lat, selected.lng], { animate: true });
  }, [map, selected]);

  return null;
}

export default function DemoMap({ samples, route, selected, onSelect, resetToken }: DemoMapProps) {
  const first = route[0];
  return (
    <MapContainer
      center={[first.lat, first.lng]}
      zoom={16}
      zoomControl={false}
      scrollWheelZoom={false}
      style={{ height: '100%', width: '100%', background: '#222222' }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
      />
      <ZoomControl position="bottomright" />
      <Polyline
        positions={route.map((sample) => [sample.lat, sample.lng])}
        pathOptions={{ color: '#b0b0b0', weight: 2, opacity: 0.5, dashArray: '6 8' }}
      />
      <Viewport samples={samples} selected={selected} resetToken={resetToken} />
      {samples.map((sample) => {
        const active = sample.id === selected?.id;
        const color = sample.severity > 60 ? '#ef4444' : sample.severity >= 30 ? '#eab308' : '#22c55e';
        return (
          <CircleMarker
            key={sample.id}
            center={[sample.lat, sample.lng]}
            radius={active ? 10 : 7}
            pathOptions={{
              color: active ? '#ffffff' : color,
              weight: active ? 3 : 2,
              fillColor: color,
              fillOpacity: 1,
            }}
            eventHandlers={{ click: () => onSelect(sample) }}
          >
            <Tooltip direction="top" offset={[0, -10]} opacity={1}>
              <strong>{sample.id}</strong><br />
              {damageLabel(sample.kind)} · {Math.round(sample.confidence * 100)}% confidence<br />
              Severity estimate: {sample.severity}/100
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
