'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, FileText, Info, MapPin, Play, RotateCcw, Search, Video } from 'lucide-react';
import {
  damageLabel, filterDetections, formatTimestamp, priorityScore, reviewCsv,
  type DamageKind, type DemoDataset, type DemoDetection, type DemoSort,
} from '@/lib/demo';
import styles from './demo.module.css';

const DemoMap = dynamic(() => import('./DemoMap'), {
  ssr: false,
  loading: () => <div className={styles.mapLoading} role="status">Opening the detection map...</div>,
});

// The original project's mockFleet snapshot, displayed explicitly as simulated telemetry.
const demoFleet = [
  { id: 'GJ-05-BZ-1001', synced: true, lastSync: '10 mins ago' },
  { id: 'GJ-05-BZ-1045', synced: true, lastSync: '1 hr ago' },
  { id: 'GJ-05-BZ-1088', synced: false, lastSync: '2 days ago' },
  { id: 'GJ-05-BZ-1102', synced: true, lastSync: '5 mins ago' },
  { id: 'GJ-05-BZ-0002', synced: true, lastSync: '200 mins ago' },
];

function number(value: number) {
  return value.toLocaleString('en-IN');
}

function severityLabel(value: number) {
  return value > 60 ? 'Critical' : value >= 30 ? 'Medium' : 'Low';
}

function severityClass(value: number) {
  return value > 60 ? styles.critical : value >= 30 ? styles.moderate : styles.low;
}

function seekVideo(video: HTMLVideoElement | null, seconds: number) {
  if (!video || video.readyState < 1) return false;
  const lastSecond = Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.1) : seconds;
  video.currentTime = Math.max(0, Math.min(seconds, lastSecond));
  return true;
}

function scrollToSection(id: string) {
  const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
  document.getElementById(id)?.scrollIntoView({ behavior, block: 'nearest' });
}

export default function DemoDashboard({ data }: { data: DemoDataset }) {
  const [kind, setKind] = useState<'all' | DamageKind>('all');
  const [minSeverity, setMinSeverity] = useState(0);
  const [minConfidence, setMinConfidence] = useState(0.25);
  const [state, setState] = useState('');
  const [segment, setSegment] = useState('');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<DemoSort>('priority');
  const [selectedId, setSelectedId] = useState(() =>
    filterDetections(data.samples, { kind: 'all', minConfidence: 0.25, query: '', sort: 'priority' })[0]?.id,
  );
  const [resetToken, setResetToken] = useState(0);
  const [videoError, setVideoError] = useState(false);
  const [playbackMessage, setPlaybackMessage] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const pendingSeekRef = useRef<number | null>(null);

  const segments = useMemo(() => [...new Set(data.samples.map((sample) => sample.segment))].sort(), [data.samples]);
  const visibleSamples = useMemo(
    () => filterDetections(data.samples, { kind, minConfidence, minSeverity, segment, query, sort }),
    [data.samples, kind, minConfidence, minSeverity, segment, query, sort],
  );
  const triageSamples = useMemo(
    () => [...visibleSamples].sort((left, right) => priorityScore(right) - priorityScore(left) || left.frame - right.frame),
    [visibleSamples],
  );
  const selected = visibleSamples.find((sample) => sample.id === selectedId) ?? visibleSamples[0] ?? null;
  const filtered = kind !== 'all' || minConfidence !== 0.25 || minSeverity !== 0 || segment !== '' || state !== '' || query.trim() !== '';
  const fleetSynced = demoFleet.filter((bus) => bus.synced).length;

  useEffect(() => {
    if (selected) {
      pendingSeekRef.current = selected.timestampSeconds;
      if (seekVideo(videoRef.current, selected.timestampSeconds)) pendingSeekRef.current = null;
    }
  }, [selected]);

  function resetFilters() {
    setKind('all');
    setMinSeverity(0);
    setMinConfidence(0.25);
    setState('');
    setSegment('');
    setQuery('');
    setSort('priority');
    setResetToken((value) => value + 1);
  }

  function selectSample(sample: DemoDetection) {
    setSelectedId(sample.id);
    setPlaybackMessage('');
  }

  function playVideo(seconds: number) {
    const video = videoRef.current;
    if (!video) return;
    pendingSeekRef.current = seconds;
    if (seekVideo(video, seconds)) pendingSeekRef.current = null;
    setPlaybackMessage('');
    scrollToSection('evidence');
    void video.play().catch(() => setPlaybackMessage('Use the video controls to start playback.'));
  }

  function downloadResults(samples = visibleSamples) {
    const url = URL.createObjectURL(new Blob([reviewCsv(samples)], { type: 'text/csv;charset=utf-8;' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'roadlens-review-samples.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function viewOnMap(sample: DemoDetection) {
    selectSample(sample);
    scrollToSection('detection-map');
  }

  return (
    <div className={styles.demo}>
      <a className={styles.skipLink} href="#demo-main">Skip to the dashboard</a>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="RoadLens home">
          <span className={styles.brandDot} />
          <h1>RoadLens <span className={styles.brandSeparator}>/</span> SMC Command Center</h1>
        </Link>
        <div className={styles.headerActions}>
          <span className={styles.department}>Public Works Dept · Recorded demo</span>
          <a href="#evidence">Detection replay</a>
          <a href="#data-notes">Data notes</a>
          <span className={styles.demoBadge}>Read-only demo</span>
        </div>
      </header>

      <main id="demo-main" className={styles.main}>
        <div className={styles.mainColumn}>
          <section className={styles.stats} aria-label="Dashboard statistics">
            <div className={[styles.card, styles.stat, styles.incidentStat].join(' ')}>
              <h2>Incidents for review</h2>
              <strong>{visibleSamples.length}</strong>
              <p>Selected frames, not unique defects</p>
            </div>
            <div className={[styles.card, styles.stat, styles.repairStat].join(' ')}>
              <h2>Repaired this week</h2>
              <strong className={styles.unavailableValue}>Not recorded</strong>
              <p>No repair confirmations in this replay</p>
            </div>
            <div className={[styles.card, styles.stat].join(' ')}>
              <h2>Buses synced today</h2>
              <strong>{fleetSynced} <small>/ {demoFleet.length}</small></strong>
              <p>Simulated fleet snapshot</p>
            </div>
          </section>

          <section id="detection-map" className={[styles.card, styles.mapCard].join(' ')} aria-label="Detection map">
            <div className={styles.map} role="region" aria-label="Map of simulated review-sample positions">
              <DemoMap samples={visibleSamples} route={data.samples} selected={selected} onSelect={selectSample} resetToken={resetToken} />
              <div className={styles.mapNotice}>Surat · simulated coordinates</div>
              <button className={styles.mapReset} onClick={() => setResetToken((value) => value + 1)} aria-label="Reset map view" title="Reset map view"><RotateCcw size={16} /></button>
              <div className={styles.mapLegend} aria-label="Illustrative severity legend">
                <span><i className={styles.criticalDot} />&gt; 60</span>
                <span><i className={styles.moderateDot} />30-60</span>
                <span><i className={styles.lowDot} />&lt; 30</span>
                <small>Severity estimate</small>
              </div>
              {!visibleSamples.length && <div className={styles.mapEmpty}><Search size={23} /><strong>No matching samples</strong><button onClick={resetFilters}>Reset filters</button></div>}
            </div>
            <div className={styles.mapFooter}>
              <span><MapPin size={13} />Select a marker or use View in the triage list.</span>
              <span aria-live="polite">{visibleSamples.length} of {data.samples.length} samples shown</span>
            </div>
          </section>

          <section className={[styles.card, styles.crackPanel].join(' ')} aria-labelledby="crack-title">
            <div className={styles.panelHeading}>
              <div><h2 id="crack-title"><span className={styles.crackDiamond} />ML Crack Detection <span className={styles.neutralBadge}>No recorded results</span></h2><p>The original command center&apos;s preventive maintenance queue.</p></div>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th scope="col">Location</th><th scope="col">Severity</th><th scope="col">Fix within</th><th scope="col">Action</th></tr></thead>
                <tbody><tr><td colSpan={4} className={styles.crackEmpty}>This recording contains pothole and &ldquo;other corruption&rdquo; predictions. It has no early-crack class or verified repair deadlines. Surface damage remains labelled separately below.</td></tr></tbody>
              </table>
            </div>
          </section>

          <section className={styles.card} aria-labelledby="queue-title">
            <div className={styles.panelHeading}>
              <div><h2 id="queue-title">Recorded detection samples <span className={styles.neutralBadge}>{visibleSamples.length} shown</span></h2><p>Original YOLO classes, confidence scores, and annotated frames.</p></div>
              <button className={styles.textButton} onClick={() => downloadResults()} disabled={!visibleSamples.length}><Download size={14} />Export CSV</button>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th scope="col">Review sample</th><th scope="col">Damage type</th><th scope="col">Confidence</th><th scope="col">Severity estimate</th><th scope="col">Priority</th><th scope="col">Action</th></tr></thead>
                <tbody>
                  {visibleSamples.map((sample) => (
                    <tr key={sample.id} data-selected={selected?.id === sample.id}>
                      <td><button className={styles.sampleButton} onClick={() => selectSample(sample)} aria-label={'Inspect ' + sample.id + ', ' + damageLabel(sample.kind)} aria-pressed={selected?.id === sample.id}>
                        <Image src={sample.image} width={64} height={40} alt="" className={styles.thumbnail} />
                        <span><strong>{sample.id}</strong><small>{sample.segment} · {formatTimestamp(sample.timestampSeconds)}</small></span>
                      </button></td>
                      <td>{damageLabel(sample.kind)}</td>
                      <td className={styles.numeric}>{Math.round(sample.confidence * 100)}%</td>
                      <td><span className={[styles.severityBadge, severityClass(sample.severity)].join(' ')}>{sample.severity} · {severityLabel(sample.severity)}</span></td>
                      <td className={styles.numeric}>{number(priorityScore(sample))}</td>
                      <td><button className={styles.smallButton} onClick={() => { selectSample(sample); playVideo(sample.timestampSeconds); }} aria-label={'Play ' + sample.id}><Play size={12} />Play</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!visibleSamples.length && <div className={styles.tableEmpty}><p>No matching review samples.</p><button className={styles.smallButton} onClick={resetFilters}>Reset filters</button></div>}
            </div>
          </section>

          <section id="evidence" className={styles.card} aria-labelledby="evidence-title">
            <div className={styles.panelHeading}>
              <div><h2 id="evidence-title"><Video size={18} />Detection replay</h2><p>Recorded YOLOv8 output · {Math.round(data.source.durationSeconds)} seconds</p></div>
              <button className={styles.textButton} onClick={() => playVideo(0)}><Play size={14} />Watch from start</button>
            </div>
            <div className={styles.evidenceBody}>
              <div className={styles.videoWrap}>
                <video ref={videoRef} className={styles.video} src={data.source.video} poster={data.source.poster} controls muted playsInline preload="metadata" aria-label="Annotated road footage showing recorded YOLO detections"
                  onLoadedMetadata={() => { seekVideo(videoRef.current, pendingSeekRef.current ?? selected?.timestampSeconds ?? 0); pendingSeekRef.current = null; }}
                  onError={() => setVideoError(true)} />
                {videoError && <p className={styles.videoError}>The replay could not load. <a href={data.source.video}>Open the video directly</a>.</p>}
              </div>
              <div className={styles.selectedDetails}>
                {selected ? <>
                  <span className={styles.detailLabel}>Selected sample</span>
                  <h3>{selected.id} · {damageLabel(selected.kind)}</h3>
                  <Image src={selected.image} width={384} height={240} alt={'Annotated source frame ' + selected.frame + ' for ' + selected.id} className={styles.selectedImage} />
                  <dl className={styles.detailGrid}>
                    <div><dt>Model confidence</dt><dd>{Math.round(selected.confidence * 100)}%</dd></div>
                    <div><dt>Severity estimate</dt><dd>{selected.severity} <small>/ 100</small></dd></div>
                    <div><dt>Simulated traffic</dt><dd>{selected.busesPerDay} <small>buses/day</small></dd></div>
                    <div><dt>Priority score</dt><dd>{number(priorityScore(selected))}</dd></div>
                    <div><dt>Source frame</dt><dd>{selected.frame} <small>at {formatTimestamp(selected.timestampSeconds)}</small></dd></div>
                    <div><dt>Source class</dt><dd className={styles.classValue}>{selected.modelClass}</dd></div>
                  </dl>
                  <button className={styles.primaryButton} onClick={() => playVideo(selected.timestampSeconds)}><Play size={14} />Play this detection</button>
                </> : <div className={styles.tableEmpty}><p>No sample matches the filters.</p><button className={styles.smallButton} onClick={resetFilters}>Show all samples</button></div>}
                {playbackMessage && <p className={styles.playbackMessage} role="status">{playbackMessage}</p>}
              </div>
            </div>
            <p className={styles.footnote}><Info size={13} />Model confidence is not a measure of damage severity.</p>
          </section>

          <section id="data-notes" className={[styles.card, styles.dataNotes].join(' ')} aria-labelledby="notes-title">
            <h2 id="notes-title">About the public demo</h2>
            <p>This is a read-only version of the original SMC Command Center, populated with recorded model output. It does not connect to the live municipal service.</p>
            <div className={styles.notesGrid}>
              <div><h3>Recorded detections</h3><p>{number(data.source.detectionCount)} frame-level predictions across {number(data.source.detectionFrameCount)} of {number(data.source.frameCount)} frames: {number(data.source.classCounts.pothole ?? 0)} pothole and {number(data.source.classCounts['other corruption'] ?? 0)} &ldquo;other corruption&rdquo; predictions, shown as surface damage. The {data.samples.length} samples may include repeated views of the same defect.</p></div>
              <div><h3>Simulated operations</h3><p>Surat map positions, segment names, traffic counts, and the original five-bus fleet snapshot illustrate the workflow. They do not establish the recording&apos;s location or represent live telemetry. Repair confirmations and early-crack deadlines are unavailable.</p></div>
              <div><h3>Priority calculation</h3><p>Priority = severity estimate × simulated buses per day. Severity = min(100, round(20 + 180 × √(box area / frame area))). Camera calibration and field validation are needed for maintenance decisions.</p></div>
            </div>
            <a className={styles.sourceLink} href={data.source.fullCsv} download><FileText size={15} />Download the full recorded CSV</a>
          </section>

          <footer className={styles.footer}><span>RoadLens · Vishal Gautam · SVNIT Surat</span><a href="https://github.com/vkg6835/dotslash/tree/feat/public-demo" target="_blank" rel="noreferrer">View source</a></footer>
        </div>

        <aside className={styles.sidebar} aria-label="Dashboard filters and maintenance triage">
          <section className={[styles.card, styles.filterCard].join(' ')}>
            <label className={styles.sliderLabel} htmlFor="severity-filter">Filter Map by Minimum Severity <strong>{minSeverity}+</strong></label>
            <input id="severity-filter" type="range" min="0" max="100" step="5" value={minSeverity} onChange={(event) => setMinSeverity(Number(event.target.value))} />
            <div className={styles.sliderTicks}><span>0 (All)</span><span>50 (Moderate)</span><span>100 (Critical)</span></div>
          </section>

          <section className={[styles.card, styles.filterCard].join(' ')}>
            <label htmlFor="state-filter">Select State</label>
            <select id="state-filter" value={state} onChange={(event) => { setState(event.target.value); setSegment(''); setResetToken((value) => value + 1); }}>
              <option value="">All States / National</option><option value="Gujarat">Gujarat</option>
            </select>
            <p>Sample coordinates are in Surat, Gujarat.</p>
          </section>

          <section className={[styles.card, styles.filterCard].join(' ')}>
            <label htmlFor="area-filter">Select Area / Location</label>
            <select id="area-filter" value={segment} onChange={(event) => setSegment(event.target.value)}><option value="">All Areas</option>{segments.map((value) => <option key={value} value={value}>{value}</option>)}</select>
            <p>Simulated route segments</p>
          </section>

          <section className={[styles.card, styles.triagePanel].join(' ')} aria-labelledby="triage-title">
            <div className={styles.panelHeading}><div><h2 id="triage-title">Smart Triage List</h2><p>Severity estimate × simulated buses/day</p></div></div>
            <div className={styles.triageList}>
              {triageSamples.map((sample) => <article key={sample.id} className={styles.triageItem} data-selected={selected?.id === sample.id}>
                <div className={styles.triageTitle}><h3>{sample.segment} · {sample.id}</h3><span className={[styles.severityBadge, severityClass(sample.severity)].join(' ')}>{severityLabel(sample.severity)}</span></div>
                <p className={styles.triageType}>{damageLabel(sample.kind)} · {sample.busesPerDay} simulated buses/day</p>
                <div className={styles.triageBottom}>
                  <div><span>Severity score</span><strong>{sample.severity}</strong></div>
                  <div className={styles.priority}><span>Priority</span><strong>{number(priorityScore(sample))}</strong></div>
                  <div className={styles.triageActions}><button className={styles.smallButton} onClick={() => viewOnMap(sample)} aria-label={'View ' + sample.id + ' on map'}>View</button><button className={styles.smallButton} onClick={() => downloadResults([sample])} aria-label={'Export ' + sample.id}>CSV</button></div>
                </div>
              </article>)}
              {!triageSamples.length && <div className={styles.tableEmpty}><p>No matching samples.</p><button className={styles.smallButton} onClick={resetFilters}>Reset filters</button></div>}
            </div>
            <div className={styles.triageFooter}><button className={styles.primaryButton} onClick={() => downloadResults(triageSamples)} disabled={!triageSamples.length}><Download size={15} />Export Crew CSV</button><p>Downloads the filtered review queue. Repairs are managed in the staff portal.</p></div>
          </section>

          <section className={styles.card} aria-labelledby="fleet-title">
            <div className={styles.panelHeading}><div><h2 id="fleet-title">Fleet Diagnostics <span className={styles.neutralBadge}>Simulated</span></h2><p>Original project&apos;s sample fleet; no live telemetry.</p></div></div>
            <div className={styles.fleetList}>{demoFleet.map((bus) => <div key={bus.id} className={styles.fleetRow}><span>{bus.id}</span><div><strong className={bus.synced ? styles.synced : styles.offline}><i />{bus.synced ? 'Synced' : 'Offline'}</strong><small>{bus.lastSync} · simulated</small></div></div>)}</div>
          </section>

          <section className={[styles.card, styles.filterCard, styles.reviewFilters].join(' ')} aria-labelledby="review-filter-title">
            <h2 id="review-filter-title">Review filters</h2>
            <label htmlFor="damage-filter">Damage type</label>
            <select id="damage-filter" value={kind} onChange={(event) => setKind(event.target.value as 'all' | DamageKind)}><option value="all">All damage</option><option value="pothole">Potholes</option><option value="surface_damage">Surface damage</option></select>
            <label htmlFor="sample-search">Search review samples</label>
            <div className={styles.search}><Search size={15} /><input id="sample-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Sample ID or segment" /></div>
            <label className={styles.sliderLabel} htmlFor="confidence-filter">Minimum confidence <strong>{Math.round(minConfidence * 100)}%</strong></label>
            <input id="confidence-filter" type="range" min="25" max="90" step="5" value={Math.round(minConfidence * 100)} onChange={(event) => setMinConfidence(Number(event.target.value) / 100)} />
            <label htmlFor="sort-filter">Sort review samples</label>
            <select id="sort-filter" value={sort} onChange={(event) => setSort(event.target.value as DemoSort)}><option value="priority">Priority score</option><option value="severity">Severity estimate</option><option value="confidence">Model confidence</option><option value="time">Recording time</option></select>
            <button className={styles.secondaryButton} onClick={resetFilters} disabled={!filtered && sort === 'priority'}><RotateCcw size={14} />Reset filters</button>
          </section>
        </aside>
      </main>
    </div>
  );
}
