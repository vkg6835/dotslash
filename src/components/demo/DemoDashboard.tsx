'use client';

import dynamic from 'next/dynamic';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown, ArrowRight, ArrowUpRight, Camera, Check, ChevronRight,
  Download, ExternalLink, FileText, Info, Layers3, MapPin,
  Play, RotateCcw, Route, ScanLine, Search, ShieldCheck, Video,
} from 'lucide-react';
import {
  damageLabel, filterDetections, formatTimestamp, priorityScore, reviewCsv,
  type DamageKind, type DemoDataset, type DemoDetection, type DemoSort,
} from '@/lib/demo';
import styles from './demo.module.css';

const DemoMap = dynamic(() => import('./DemoMap'), {
  ssr: false,
  loading: () => (
    <div className={styles.mapLoading} role="status">
      <Route size={30} />
      <span>Opening the sample route…</span>
    </div>
  ),
});

const damageFilters: { value: 'all' | DamageKind; label: string }[] = [
  { value: 'all', label: 'All damage' },
  { value: 'pothole', label: 'Potholes' },
  { value: 'surface_damage', label: 'Surface damage' },
];

function number(value: number) {
  return value.toLocaleString('en-IN');
}

function seekVideo(video: HTMLVideoElement | null, seconds: number) {
  if (!video || video.readyState < 1) return false;
  const lastSecond = Number.isFinite(video.duration) ? Math.max(0, video.duration - 0.1) : seconds;
  video.currentTime = Math.max(0, Math.min(seconds, lastSecond));
  return true;
}

function scrollToSection(id: string, block: ScrollLogicalPosition = 'start') {
  const behavior = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth';
  document.getElementById(id)?.scrollIntoView({ behavior, block });
}

export default function DemoDashboard({ data }: { data: DemoDataset }) {
  const [kind, setKind] = useState<'all' | DamageKind>('all');
  const [minConfidence, setMinConfidence] = useState(0.25);
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

  const visibleSamples = useMemo(
    () => filterDetections(data.samples, { kind, minConfidence, query, sort }),
    [data.samples, kind, minConfidence, query, sort],
  );
  const selected = visibleSamples.find((sample) => sample.id === selectedId) ?? visibleSamples[0] ?? null;
  const filtered = kind !== 'all' || minConfidence !== 0.25 || query.trim() !== '';
  const highestPriority = useMemo(
    () => filterDetections(data.samples, { kind: 'all', minConfidence: 0.25, query: '', sort: 'priority' })[0],
    [data.samples],
  );

  useEffect(() => {
    if (selected) {
      pendingSeekRef.current = selected.timestampSeconds;
      if (seekVideo(videoRef.current, selected.timestampSeconds)) pendingSeekRef.current = null;
    }
  }, [selected]);

  function resetFilters() {
    setKind('all');
    setMinConfidence(0.25);
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
    scrollToSection('evidence', 'nearest');
    void video.play().catch(() => setPlaybackMessage('Use the video controls to start playback.'));
  }

  function downloadResults() {
    const blob = new Blob([reviewCsv(visibleSamples)], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'roadlens-review-samples.csv';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className={styles.demo}>
      <a className={styles.skipLink} href="#demo-main">Skip to the demo</a>
      <header className={styles.header}>
        <Link className={styles.brand} href="/" aria-label="RoadLens home">
          <span className={styles.brandMark}><Route size={24} strokeWidth={2.3} /></span>
          <span>RoadLens<small>ROAD INTELLIGENCE</small></span>
        </Link>
        <nav className={styles.navigation} aria-label="Main navigation">
          <a href="#explore">Explore demo</a>
          <a href="#evidence">Model evidence</a>
          <a href="#how-it-works">How it works</a>
        </nav>
        <span className={styles.demoBadge}><span />Recorded demo</span>
      </header>

      <main id="demo-main" className={styles.main}>
        <section className={styles.hero} aria-labelledby="hero-title">
          <div>
            <p className={styles.eyebrow}><span />FROM CAMERA TO MAINTENANCE QUEUE</p>
            <h1 id="hero-title">See road damage.<br /><span>Know what to fix first.</span></h1>
            <p className={styles.heroDescription}>
              RoadLens turns road footage into visible detections and clear repair priorities.
              Explore the recorded model output, one frame at a time.
            </p>
            <div className={styles.heroActions}>
              <button className={styles.primaryButton} onClick={() => playVideo(0)}><Play size={15} fill="currentColor" />Watch the detection replay</button>
              <a className={styles.textButton} href="#explore">Explore the map <ArrowDown size={15} /></a>
            </div>
          </div>
          <aside className={styles.heroNote} aria-label="About this demonstration">
            <div className={styles.heroNoteIcon}><ScanLine size={22} /></div>
            <p>Real detections.<br />An explorable demo.</p>
            <span>Boxes and confidence scores come from the recorded YOLO output. Map positions and traffic are simulated.</span>
            <a href="#data-notes">See what the data represents <ArrowUpRight size={14} /></a>
          </aside>
        </section>

        <section className={styles.stats} aria-label="Recording statistics">
          <div className={styles.stat}>
            <span><Layers3 size={16} />Review samples</span>
            <strong>{number(data.samples.length)}<small> selected frames</small></strong>
            <p>A closer look at the recording</p>
          </div>
          <div className={styles.stat}>
            <span><span className={styles.potholeDot} />Pothole detections</span>
            <strong>{number(data.source.classCounts.pothole ?? 0)}</strong>
            <p>Frame-level model predictions</p>
          </div>
          <div className={styles.stat}>
            <span><span className={styles.surfaceDot} />Surface-damage detections</span>
            <strong>{number(data.source.classCounts['other corruption'] ?? 0)}</strong>
            <p>Recorded as “other corruption”</p>
          </div>
          <div className={styles.stat}>
            <span><Camera size={16} />Frames with detections</span>
            <strong>{number(data.source.detectionFrameCount)}<small> / {number(data.source.frameCount)}</small></strong>
            <p>Across a {Math.round(data.source.durationSeconds)}-second recording</p>
          </div>
        </section>

        <section id="explore" className={styles.explore} aria-labelledby="explore-title">
          <div className={styles.sectionHeading}>
            <div><p className={styles.eyebrow}>EXPLORE THE RESULTS</p><h2 id="explore-title">A road audit you can inspect.</h2></div>
            <button className={styles.secondaryButton} onClick={downloadResults} disabled={!visibleSamples.length}><Download size={15} />Download results</button>
          </div>

          <div className={styles.filters}>
            <div className={styles.filterTabs} role="group" aria-label="Damage type">
              {damageFilters.map((filter) => (
                <button key={filter.value} aria-pressed={kind === filter.value} onClick={() => setKind(filter.value)}>
                  {filter.label}
                </button>
              ))}
            </div>
            <label className={styles.search}>
              <Search size={16} />
              <span className={styles.srOnly}>Search review samples</span>
              <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search samples or segments" />
            </label>
            <div className={styles.confidenceFilter}>
              <label htmlFor="confidence-filter">Min. confidence <strong>{Math.round(minConfidence * 100)}%</strong></label>
              <input id="confidence-filter" type="range" min="25" max="90" step="5" value={Math.round(minConfidence * 100)} onChange={(event) => setMinConfidence(Number(event.target.value) / 100)} />
            </div>
          </div>

          <div className={styles.workspace}>
            <section className={styles.panel} aria-labelledby="map-title">
              <div className={styles.panelHeading}>
                <div><h3 id="map-title"><MapPin size={17} />Detection map</h3><p>Surat sample route · simulated coordinates</p></div>
                <button className={styles.iconButton} onClick={() => setResetToken((value) => value + 1)} aria-label="Reset map view" title="Reset map view"><RotateCcw size={16} /></button>
              </div>
              <div className={styles.map} role="region" aria-label="Map of simulated review-sample positions">
                <DemoMap samples={visibleSamples} route={data.samples} selected={selected} onSelect={selectSample} resetToken={resetToken} />
                {!visibleSamples.length && (
                  <div className={styles.mapEmpty}><Search size={23} /><strong>No matching samples</strong><button onClick={resetFilters}>Reset filters</button></div>
                )}
                <div className={styles.mapLabel}><Route size={13} />Sample route</div>
              </div>
              <div className={styles.mapFooter}>
                <div><span className={styles.potholeDot} />Pothole<span className={styles.surfaceDot} />Surface damage</div>
                <span aria-live="polite">{visibleSamples.length} of {data.samples.length} samples shown</span>
              </div>
            </section>

            <section id="evidence" className={[styles.panel, styles.evidence].join(' ')} aria-labelledby="evidence-title">
              <div className={styles.panelHeading}>
                <div><h3 id="evidence-title"><Video size={17} />Detection replay</h3><p>Recorded model output · {Math.round(data.source.durationSeconds)} seconds</p></div>
                <span className={styles.recordingBadge}><span />REPLAY</span>
              </div>
              <div className={styles.videoWrap}>
                <video
                  ref={videoRef}
                  className={styles.video}
                  src={data.source.video}
                  poster={data.source.poster}
                  controls
                  muted
                  playsInline
                  preload="metadata"
                  aria-label="Annotated road footage showing recorded YOLO detections"
                  onLoadedMetadata={() => {
                    seekVideo(videoRef.current, pendingSeekRef.current ?? selected?.timestampSeconds ?? 0);
                    pendingSeekRef.current = null;
                  }}
                  onError={() => setVideoError(true)}
                />
                {videoError && <p className={styles.videoError}>The replay could not load. <a href={data.source.video}>Open the video directly</a>.</p>}
              </div>
              <div className={styles.selectedDetails}>
                {selected ? (
                  <>
                    <div className={styles.selectedHeading}>
                      <div><span className={styles.detailLabel}>SELECTED SAMPLE</span><h4>{selected.id}<ChevronRight size={14} /><span>{damageLabel(selected.kind)}</span></h4></div>
                      <span className={[styles.confidenceBadge, styles[selected.kind]].join(' ')}>{Math.round(selected.confidence * 100)}% confidence</span>
                    </div>
                    <div className={styles.detailGrid}>
                      <div><span>Severity estimate</span><strong>{selected.severity}<small> / 100</small></strong></div>
                      <div><span>Sample traffic</span><strong>{selected.busesPerDay}<small> buses / day</small></strong></div>
                      <div><span>Priority score</span><strong className={styles.priorityValue}>{number(priorityScore(selected))}</strong></div>
                      <div><span>Source frame</span><strong>{selected.frame}<small> at {formatTimestamp(selected.timestampSeconds)}</small></strong></div>
                    </div>
                    <button className={styles.playSample} onClick={() => playVideo(selected.timestampSeconds)}><Play size={13} fill="currentColor" />Play this detection<ArrowRight size={14} /></button>
                  </>
                ) : (
                  <div className={styles.noSelection}><Search size={22} /><p>No samples match these filters.</p><button onClick={resetFilters}>Show all samples</button></div>
                )}
                {playbackMessage && <p className={styles.playbackMessage} role="status">{playbackMessage}</p>}
              </div>
              <div className={styles.evidenceFootnote}><Info size={13} /><span>Model confidence is not a measure of damage severity.</span></div>
            </section>
          </div>

          <section className={[styles.panel, styles.queue].join(' ')} aria-labelledby="queue-title">
            <div className={styles.queueHeading}>
              <div><h3 id="queue-title">Maintenance priorities</h3><p>Inspect a sample to connect the map, frame, and ranking.</p></div>
              <label className={styles.sortLabel}>Sort by
                <select value={sort} onChange={(event) => setSort(event.target.value as DemoSort)} aria-label="Sort review samples">
                  <option value="priority">Priority score</option>
                  <option value="severity">Severity estimate</option>
                  <option value="confidence">Model confidence</option>
                  <option value="time">Recording time</option>
                </select>
              </label>
            </div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead><tr><th scope="col">Review sample</th><th scope="col">Damage type</th><th scope="col">Confidence</th><th scope="col">Severity estimate</th><th scope="col">Sample traffic</th><th scope="col">Priority score</th><th scope="col"><span className={styles.srOnly}>Play detection</span></th></tr></thead>
                <tbody>
                  {visibleSamples.map((sample, index) => (
                    <tr key={sample.id} data-selected={selected?.id === sample.id}>
                      <td>
                        <button className={styles.sampleButton} onClick={() => selectSample(sample)} aria-label={'Inspect ' + sample.id + ', ' + damageLabel(sample.kind)} aria-pressed={selected?.id === sample.id}>
                          <span className={styles.rank}>{String(index + 1).padStart(2, '0')}</span>
                          <Image src={sample.image} width={64} height={40} alt="" className={styles.thumbnail} />
                          <span><strong>{sample.id}</strong><small>{sample.segment} · {formatTimestamp(sample.timestampSeconds)}</small></span>
                        </button>
                      </td>
                      <td><span className={[styles.damagePill, styles[sample.kind]].join(' ')}><span />{damageLabel(sample.kind)}</span></td>
                      <td className={styles.numeric}>{Math.round(sample.confidence * 100)}%</td>
                      <td><div className={styles.severityCell}><span>{sample.severity}</span><div><span style={{ width: sample.severity + '%' }} /></div></div></td>
                      <td className={styles.numeric}>{sample.busesPerDay}<small className={styles.tableUnit}> buses/day</small></td>
                      <td className={[styles.numeric, styles.scoreCell].join(' ')}>{number(priorityScore(sample))}</td>
                      <td><button className={styles.iconButton} aria-label={'Play ' + sample.id} title={'Play ' + sample.id} onClick={() => { selectSample(sample); playVideo(sample.timestampSeconds); }}><Play size={14} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!visibleSamples.length && <div className={styles.tableEmpty}><Search size={25} /><h4>No matching review samples</h4><p>Try a lower confidence threshold or a different search.</p><button className={styles.secondaryButton} onClick={resetFilters}><RotateCcw size={14} />Reset filters</button></div>}
            </div>
            <div className={styles.queueFooter}><span><Info size={13} />Priority = severity estimate × simulated buses per day</span>{filtered ? <button onClick={resetFilters}>Clear filters <RotateCcw size={12} /></button> : <span>Selected frames may show the same damage more than once.</span>}</div>
          </section>
        </section>

        <section id="how-it-works" className={styles.methodology} aria-labelledby="method-title">
          <div className={styles.methodPanel}>
            <p className={styles.eyebrow}>A SIMPLE PATH TO ACTION</p>
            <h2 id="method-title">From footage to a repair queue.</h2>
            <div className={styles.steps}>
              <div><span className={styles.stepIcon}><Camera size={19} /></span><span><small>01 / CAPTURE</small><h3>Record the road</h3><p>Use camera footage from vehicles already travelling the route.</p></span></div>
              <div><span className={styles.stepIcon}><ScanLine size={19} /></span><span><small>02 / DETECT</small><h3>Locate visible damage</h3><p>YOLO produces bounding boxes, damage classes, and confidence scores.</p></span></div>
              <div><span className={styles.stepIcon}><Layers3 size={19} /></span><span><small>03 / PRIORITIZE</small><h3>Make the next repair clear</h3><p>Combine a severity estimate with traffic to compare maintenance priorities.</p></span></div>
            </div>
          </div>
          <aside id="data-notes" className={styles.dataNotes} aria-labelledby="notes-title">
            <div className={styles.notesHeading}><ShieldCheck size={20} /><h2 id="notes-title">What this demo shows</h2></div>
            <div className={styles.noteRow}><Check size={15} /><p><strong>Recorded model results</strong>{number(data.source.detectionCount)} predictions across {number(data.source.detectionFrameCount)} frames, with their original classes, boxes, and confidence scores. These are frame-level results, not a count of unique road defects.</p></div>
            <div className={styles.noteRow}><Route size={15} /><p><strong>Simulated operational inputs</strong>The Surat coordinates and bus counts illustrate a maintenance workflow. They do not establish where the footage was recorded or represent measured traffic.</p></div>
            <div className={styles.noteRow}><Info size={15} /><p><strong>An illustrative severity estimate</strong>Severity uses relative bounding-box size: 20 + 180 × √(box area / frame area), capped at 100. It needs camera calibration and field validation for real maintenance decisions.</p></div>
            <a className={styles.sourceLink} href={data.source.fullCsv} download><FileText size={15} />Download the full recorded CSV<ExternalLink size={13} /></a>
          </aside>
        </section>

        <div className={styles.closingNote}>
          <MapPin size={17} />
          <p>Start with <strong>{highestPriority.id}</strong> to see why it leads the demo repair queue.</p>
          <button onClick={() => { resetFilters(); selectSample(highestPriority); scrollToSection('explore'); }}>Inspect this sample <ArrowRight size={14} /></button>
        </div>
      </main>

      <footer className={styles.footer}><span><Route size={17} /><strong>RoadLens</strong><span>Built by Vishal Gautam · SVNIT Surat</span></span><a href="https://github.com/vkg6835/dotslash" target="_blank" rel="noreferrer">View source <ArrowUpRight size={14} /></a></footer>
    </div>
  );
}
