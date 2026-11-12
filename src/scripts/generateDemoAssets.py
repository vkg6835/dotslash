"""Generate a public replay from recorded detections, without rerunning inference.

Boxes and confidences come from the CSV. Locations are simulated coordinates;
traffic and the bounding-box severity estimate are demonstration inputs.
"""

import csv
import json
import math
import shutil
import subprocess
from collections import Counter, defaultdict
from pathlib import Path

import cv2
import imageio_ffmpeg

REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCE_VIDEO = REPO_ROOT / 'src' / 'scripts' / 'inputvideo3.mp4'
SOURCE_CSV = REPO_ROOT / 'detections.csv'
ASSET_DIR = REPO_ROOT / 'public' / 'demo'
DATA_PATH = REPO_ROOT / 'src' / 'data' / 'demo-data.json'
TRAFFIC = [120, 80, 180, 90, 150, 240, 70, 160, 110, 200, 130, 100]


def main():
    with SOURCE_CSV.open(newline='', encoding='utf-8') as stream:
        rows = list(csv.DictReader(stream))
    if not rows:
        raise ValueError('The detection CSV is empty.')
    capture = cv2.VideoCapture(str(SOURCE_VIDEO))
    if not capture.isOpened():
        raise ValueError('Could not open the source recording.')
    fps = capture.get(cv2.CAP_PROP_FPS)
    width = int(capture.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(capture.get(cv2.CAP_PROP_FRAME_HEIGHT))
    frame_count = int(capture.get(cv2.CAP_PROP_FRAME_COUNT))
    if fps <= 0 or min(width, height, frame_count) <= 0:
        raise ValueError('The recording has invalid video metadata.')

    frame_rows = defaultdict(list)
    for row in rows:
        frame_number = int(row['frame'])
        box = [int(float(row[key])) for key in ('x1', 'y1', 'x2', 'y2')]
        if not (1 <= frame_number <= frame_count and
                0 <= box[0] < box[2] <= width and 0 <= box[1] < box[3] <= height):
            raise ValueError('A recorded bounding box does not match the source video.')
        frame_rows[frame_number].append(row)

    def review_quality(row):
        area = (float(row['x2']) - float(row['x1'])) * (float(row['y2']) - float(row['y1']))
        return float(row['confidence']) + 2 * math.sqrt(area / (width * height))

    selected_rows = []
    for window in range(12):
        first = math.floor(window * frame_count / 12) + 1
        last = math.floor((window + 1) * frame_count / 12)
        candidates = [row for row in rows if first <= int(row['frame']) <= last]
        if candidates:
            selected_rows.append(max(candidates, key=review_quality))
    selected_rows.sort(key=lambda row: int(row['frame']))

    samples = []
    for index, row in enumerate(selected_rows):
        box = {key: int(float(row[key])) for key in ('x1', 'y1', 'x2', 'y2')}
        area_ratio = (box['x2'] - box['x1']) * (box['y2'] - box['y1']) / (width * height)
        sample_id = 'RL-' + str(index + 1).zfill(3)
        samples.append({
            'id': sample_id,
            'frame': int(row['frame']),
            'timestampSeconds': round((int(row['frame']) - 1) / fps, 3),
            'kind': 'pothole' if row['class'] == 'pothole' else 'surface_damage',
            'modelClass': row['class'],
            'confidence': round(float(row['confidence']), 6),
            'box': box,
            'lat': float(row['lat']),
            'lng': float(row['lng']),
            'severity': min(100, round(20 + 180 * math.sqrt(area_ratio))),
            'busesPerDay': TRAFFIC[index],
            'segment': 'Segment ' + str(min(3, index // 4 + 1)),
            'image': '/demo/samples/' + sample_id + '.jpg',
        })

    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    (ASSET_DIR / 'samples').mkdir(exist_ok=True)
    DATA_PATH.parent.mkdir(parents=True, exist_ok=True)
    samples_by_frame = defaultdict(list)
    for sample in samples:
        samples_by_frame[sample['frame']].append(sample)

    output_width = 1152
    output_height = round((height / width * output_width) / 2) * 2
    command = [
        imageio_ffmpeg.get_ffmpeg_exe(), '-y', '-loglevel', 'error',
        '-f', 'rawvideo', '-pixel_format', 'bgr24',
        '-video_size', str(output_width) + 'x' + str(output_height),
        '-framerate', str(fps), '-i', 'pipe:0', '-an',
        '-c:v', 'libx264', '-preset', 'fast', '-crf', '24',
        '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
        str(ASSET_DIR / 'roadlens-replay.mp4'),
    ]
    encoder = subprocess.Popen(command, stdin=subprocess.PIPE, stderr=subprocess.PIPE)
    processed = 0
    poster_frame = max(samples, key=lambda sample: sample['confidence'])['frame']
    try:
        while True:
            okay, frame = capture.read()
            if not okay:
                break
            processed += 1
            for row in frame_rows.get(processed, []):
                x1, y1, x2, y2 = [int(float(row[key])) for key in ('x1', 'y1', 'x2', 'y2')]
                is_pothole = row['class'] == 'pothole'
                color = (112, 139, 248) if is_pothole else (242, 185, 137)
                label = ('Pothole' if is_pothole else 'Surface damage') + ' ' + str(round(float(row['confidence']) * 100)) + '%'
                cv2.rectangle(frame, (x1, y1), (x2, y2), color, 4)
                label_width = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.75, 2)[0][0]
                label_y = max(35, y1)
                cv2.rectangle(frame, (x1, label_y - 32), (min(width, x1 + label_width + 16), label_y), color, -1)
                cv2.putText(frame, label, (x1 + 8, label_y - 8), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (18, 23, 27), 2, cv2.LINE_AA)

            cv2.rectangle(frame, (0, 0), (width, 66), (23, 29, 34), -1)
            cv2.putText(frame, 'ROADLENS  /  RECORDED YOLO OUTPUT', (26, 43), cv2.FONT_HERSHEY_SIMPLEX, 0.85, (190, 239, 128), 2, cv2.LINE_AA)
            timestamp = (processed - 1) / fps
            caption = str(math.floor(timestamp / 60)).zfill(2) + ':' + str(math.floor(timestamp % 60)).zfill(2)
            cv2.putText(frame, caption + '  |  Frame ' + str(processed), (width - 360, 43), cv2.FONT_HERSHEY_SIMPLEX, 0.85, (236, 241, 244), 2, cv2.LINE_AA)
            resized = cv2.resize(frame, (output_width, output_height), interpolation=cv2.INTER_AREA)
            encoder.stdin.write(resized.tobytes())
            for sample in samples_by_frame.get(processed, []):
                cv2.imwrite(str(ASSET_DIR / 'samples' / (sample['id'] + '.jpg')), resized, [cv2.IMWRITE_JPEG_QUALITY, 84])
            if processed == poster_frame:
                cv2.imwrite(str(ASSET_DIR / 'replay-poster.jpg'), resized, [cv2.IMWRITE_JPEG_QUALITY, 88])
            if processed % 250 == 0:
                print('Annotated', processed, 'of', frame_count, 'frames.', flush=True)
    finally:
        capture.release()
        encoder.stdin.close()
    error_output = encoder.stderr.read().decode('utf-8', errors='replace')
    exit_code = encoder.wait()
    if exit_code != 0 or processed != frame_count:
        raise RuntimeError('Video encoding failed: ' + error_output)

    dataset = {
        'source': {
            'video': '/demo/roadlens-replay.mp4',
            'poster': '/demo/replay-poster.jpg',
            'fullCsv': '/demo/detections.csv',
            'recordingName': SOURCE_VIDEO.name,
            'modelName': 'YOLOv8',
            'modelFile': 'best.pt',
            'width': width,
            'height': height,
            'fps': fps,
            'durationSeconds': round(frame_count / fps, 3),
            'frameCount': frame_count,
            'detectionFrameCount': len(frame_rows),
            'detectionCount': len(rows),
            'classCounts': dict(Counter(row['class'] for row in rows)),
            'coordinatesAreSimulated': True,
        },
        'samples': samples,
    }
    DATA_PATH.write_text(json.dumps(dataset, indent=2) + '\n', encoding='utf-8')
    shutil.copyfile(SOURCE_CSV, ASSET_DIR / 'detections.csv')
    print('Created', len(samples), 'review samples and a', dataset['source']['durationSeconds'], 'second replay.', flush=True)
    print('Replay size:', round((ASSET_DIR / 'roadlens-replay.mp4').stat().st_size / 1024 / 1024, 2), 'MiB.', flush=True)


if __name__ == '__main__':
    main()
