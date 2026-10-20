#!/usr/bin/env bash
# Builds output/keyframes.jpg (a 4x3 grid of moments from the finished video) and output/poster.jpg.
set -euo pipefail
cd "$(dirname "$0")/.."
VIDEO=output/osu-motion-graphic.mp4
TMP=build/keyframes
mkdir -p "$TMP"
i=0
for t in 1.6 4.0 9.3 13.6 19.1 23.9 27.9 31.6 35.5 43.0 46.5 52.5; do
  ffmpeg -y -loglevel error -ss "$t" -i "$VIDEO" -frames:v 1 "$TMP/$(printf %02d $i).png"
  i=$((i + 1))
done
montage "$TMP"/*.png -tile 4x3 -geometry 480x270+4+4 -background '#120916' -quality 88 output/keyframes.jpg
ffmpeg -y -loglevel error -ss 7.6 -i "$VIDEO" -frames:v 1 -q:v 2 output/poster.jpg
echo "wrote output/keyframes.jpg output/poster.jpg"
