# RoadLens

RoadLens connects recorded road-damage detections to a map, annotated video, and maintenance queue. Built by Vishal Gautam at SVNIT Surat.

The public demo runs without a database, login, or environment variables. It uses recorded YOLOv8 predictions. Map coordinates, traffic counts, and severity estimates illustrate the repair workflow.

## Run locally

Use Node.js 22 or newer. From the folder containing this README:

```sh
npm ci
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Both `/` and `/demo` show the public demo.

For a production preview:

```sh
npm run build
npm start
```

## Explore the demo

- Select a marker or review row to inspect its frame, confidence, severity estimate, traffic, and priority.
- Play the annotated recording from the start or jump to a selected detection.
- Filter by damage type, minimum confidence, sample ID, or segment.
- Sort by priority, severity, confidence, or recording time.
- Export the filtered review samples, or download the full recorded detection CSV.

The replay and images are included in [public/demo](public/demo). Serving the demo does not run Python or model inference. The basemap uses CARTO and OpenStreetMap tiles and needs an internet connection.

## What the data represents

The source recording, `inputvideo3.mp4`, contains 1,102 frames over approximately 40 seconds. The CSV contains 1,492 frame-level predictions across 700 frames: 911 pothole predictions and 581 predictions with the original class `other corruption`, shown as “Surface damage” in the demo.

The 12 review samples are selected from successive time windows of that recording. A defect can appear in several frames, so these totals are not counts of unique potholes or independently verified defects. Model confidence is not damage severity.

The Surat coordinates are simulated. They do not establish where the footage was recorded. Bus counts are also simulated. Severity is an illustrative estimate based on the original bounding box:

```text
severity = min(100, round(20 + 180 × sqrt(box area / frame area)))
priority = severity × simulated buses per day
```

Real maintenance decisions require camera calibration, deduplication, measured traffic, and field validation. Source classes, confidence scores, and boxes are preserved in [the full CSV](public/demo/detections.csv); the selected samples and recording metadata are in [demo-data.json](src/data/demo-data.json).

## Rebuild the replay assets

This is optional. The generated assets are already included. To regenerate them, keep `detections.csv` at the project root and `inputvideo3.mp4` in `src/scripts`, then install the Python dependencies:

```sh
python -m pip install -r src/scripts/requirements-demo.txt
npm run demo:assets
```

[generateDemoAssets.py](src/scripts/generateDemoAssets.py) validates the recorded boxes against the source video, annotates the frames, creates a browser-compatible H.264 replay, and writes the review dataset and sample images. It does not rerun YOLO inference.

## Live portal

The original staff dashboard and citizen portal remain at `/dashboard` and `/portal`. Live pages redirect to `/demo`, and `/api/*` responds with HTTP 503, until live mode is enabled with Supabase credentials.

Copy [.env.example](.env.example) to `.env.local` for live development. Set `ROADLENS_ENABLE_LIVE=true`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Staff login uses Supabase Auth; configure the database schema and row-level security policies before enabling a public deployment. The Google Sheets integration additionally uses `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, and `GOOGLE_SHEET_ID`.

Enabling live mode does not change the recorded demo at `/` and `/demo`. The live backend and its access policies need a separate integration review before use with real municipal data.

## Validation

```sh
npm run typecheck
npm run lint:demo
npm run build
```

`npm run lint` checks the entire repository. It currently reports existing typing and React-rule issues in the legacy live portal and utility scripts. `lint:demo` checks the public demo and routing configuration without suppressing those findings.

## Deploy the public demo

Import this repository into Vercel with the Next.js preset, or run the production build on a Node.js host. No environment variables are needed for the public demo. Keep live mode disabled until its backend is configured and reviewed.

When deploying from a workspace that contains this project as a subfolder, choose `RoadLens` as the root directory. When deploying the repository itself, use the repository root. [.vercelignore](.vercelignore) excludes local scripts, source recordings, development files, and logs from the upload; the generated demo assets remain included.

## Stack

Next.js 16.2.1, React 19, TypeScript, Tailwind CSS 4, React Leaflet, and Lucide. The optional live service uses Supabase and Google Sheets. Replay generation uses Python, OpenCV, and FFmpeg.
