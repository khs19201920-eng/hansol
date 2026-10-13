#!/usr/bin/env bash
# card.png 위에 모션 레이어(scene.html) → 15fps 캡처 → 12fps·가로 720px GIF → gifsicle 압축
set -e
cd "$(dirname "$0")"
mkdir -p fr
NODE_PATH=$(npm root -g) node cap.js "$PWD/fr" 15
ffmpeg -loglevel error -y -framerate 15 -i fr/f%04d.png -vf "scale=720:-1:flags=lanczos,palettegen=max_colors=256:stats_mode=full" pal.png
ffmpeg -loglevel error -y -framerate 15 -i fr/f%04d.png -i pal.png -lavfi "[0]fps=12,scale=720:-1:flags=lanczos[s];[s][1]paletteuse=dither=none:diff_mode=rectangle" -loop 0 raw.gif
npx --yes gifsicle@5.3.0 -O3 --lossy=80 raw.gif -o ai-genius-cardnews-motion.gif
