#!/usr/bin/env bash
# Builds output/keyframes.jpg (a 4x2 grid of moments from the finished video) and output/poster.jpg.
set -euo pipefail
cd "$(dirname "$0")/.."
VIDEO=output/osu-motion-graphic.mp4
TMP=build/keyframes
mkdir -p "$TMP"
i=0
for t in 5.2 10.6 13.0 19.7 26.9 36.3 43.6 49.6; do
  ffmpeg -y -loglevel error -ss "$t" -i "$VIDEO" -frames:v 1 "$TMP/$(printf %02d $i).png"
  i=$((i + 1))
done
montage "$TMP"/*.png -tile 4x2 -geometry 480x270+4+4 -background '#120916' -quality 88 output/keyframes.jpg
ffmpeg -y -loglevel error -ss 10.6 -i "$VIDEO" -frames:v 1 -q:v 2 output/poster.jpg
echo "wrote output/keyframes.jpg output/poster.jpg"
