#!/usr/bin/env bash
# scene.html → 프레임 캡처(15fps) → GIF 인코딩 → gifsicle 압축
set -e
cd "$(dirname "$0")"
rm -rf fr && mkdir fr
NODE_PATH=$(npm root -g) node cap.js fr 15
ffmpeg -loglevel error -y -framerate 15 -i fr/f%04d.png -vf "palettegen=max_colors=256:stats_mode=full" pal.png
ffmpeg -loglevel error -y -framerate 15 -i fr/f%04d.png -i pal.png -lavfi "paletteuse=dither=sierra2_4a:diff_mode=rectangle" -loop 0 raw.gif
npx --yes gifsicle@5.3.0 -O3 --lossy=70 --colors 200 raw.gif -o ai-genius-shorts.gif
rm -rf fr pal.png raw.gif
