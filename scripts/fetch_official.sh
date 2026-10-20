#!/usr/bin/env bash
# Fetches the official osu! music and sounds used by the video from ppy/osu-resources
# (CC BY-NC 4.0) into build/official. Set OSU_RESOURCES to reuse an existing checkout.
set -euo pipefail
cd "$(dirname "$0")/.."
RES="${OSU_RESOURCES:-build/osu-resources}"
if [ ! -d "$RES/osu.Game.Resources" ]; then
  git clone --depth 1 --filter=blob:none --sparse https://github.com/ppy/osu-resources "$RES"
  git -C "$RES" sparse-checkout set osu.Game.Resources/Tracks osu.Game.Resources/Samples
fi
R="$RES/osu.Game.Resources"
O=build/official
mkdir -p "$O/tracks" "$O/samples"
for n in welcome circles triangles; do
  rm -rf "$O/tracks/$n"; unzip -o -q "$R/Tracks/$n.osz" -d "$O/tracks/$n"
done
for d in Intro Menu SongSelect Results UI Gameplay/Argon; do
  mkdir -p "$O/samples/$d"; cp -r "$R/Samples/$d/." "$O/samples/$d/"
done
echo "official audio in $O"
