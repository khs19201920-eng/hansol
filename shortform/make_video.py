"""AI Agent 캠페인 카드뉴스 → 16:9 숏폼 영상 생성기.

slides/NN.webp(1254x1254 정사각형)를 순서대로 읽어, 장마다 정의된 카메라 동선
(제목 → 본문 → 핵심 문장 → 전체 보기)을 따라 확대·이동하며 1920x1080 영상으로 렌더링한다.

사용법: python3 make_video.py [출력파일.mp4]
"""
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np

W, H = 1920, 1080
FPS = 30
SLIDE_SEC = 7.6      # 장당 길이
XFADE_SEC = 0.5      # 장 사이 크로스페이드
EDGE_FADE_SEC = 0.4  # 영상 시작/끝 페이드
SRC = 1254
FULL = SRC * 16 / 9  # 정사각형 전체가 화면 높이에 맞는 뷰 너비

HERE = Path(__file__).resolve().parent

# 카메라 키프레임: (시각 s, 중심 x, 중심 y, 뷰 너비) — 좌표는 원본(1254px) 기준.
# 뷰 높이 = 너비 * 9/16. 키프레임 사이는 ease-in-out으로 이동한다.
SHOTS = {
    # 01 AI 에이전트, 너 내 동료가 돼라
    "01": [(0.0, 470, 300, 1020), (2.0, 470, 320, 1060),
           (2.9, 627, 815, 1180), (4.4, 627, 830, 1200),
           (5.2, 627, 1050, 1200), (6.4, 627, 1050, 1220),
           (7.6, 627, 627, FULL)],
    # 02 그래서, AI 에이전트가 뭐죠?
    "02": [(0.0, 610, 300, 1100), (1.6, 627, 340, 1140),
           (2.5, 627, 620, 1254), (3.9, 627, 625, 1254),
           (4.7, 627, 910, 1254), (5.9, 627, 1060, 1254),
           (7.6, 627, 627, FULL)],
    # 03 AI도 이제 '팀플'합니다
    "03": [(0.0, 590, 290, 1120), (1.6, 610, 330, 1160),
           (2.5, 627, 630, 1254), (3.9, 627, 640, 1254),
           (4.6, 627, 860, 1150), (5.9, 627, 1060, 1220),
           (7.6, 627, 627, FULL)],
    # 04 AI가 일하면, 사람은 뭘 하죠?
    "04": [(0.0, 440, 320, 1040), (1.6, 460, 470, 1080),
           (2.5, 627, 780, 1254), (3.9, 627, 860, 1254),
           (4.7, 627, 1110, 1150), (6.0, 627, 1120, 1170),
           (7.6, 627, 627, FULL)],
}


def ease(u):
    return u * u * (3 - 2 * u)


def camera(keys, t):
    if t <= keys[0][0]:
        return keys[0][1:]
    for (t0, x0, y0, w0), (t1, x1, y1, w1) in zip(keys, keys[1:]):
        if t <= t1:
            u = ease((t - t0) / (t1 - t0))
            w = np.exp(np.log(w0) + (np.log(w1) - np.log(w0)) * u)
            return x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, w
    return keys[-1][1:]


def clamp_view(cx, cy, w):
    h = w * 9 / 16
    if w <= SRC:
        cx = min(max(cx, w / 2), SRC - w / 2)
    if h <= SRC:
        cy = min(max(cy, h / 2), SRC - h / 2)
    return cx, cy, w


class Slide:
    def __init__(self, path, keys):
        img = cv2.imread(str(path), cv2.IMREAD_COLOR)
        self.img = img.astype(np.float32)
        self.keys = keys
        # 전체 보기 때 좌우 여백을 채우는 흐린 배경
        cover = cv2.resize(img, (W, W), interpolation=cv2.INTER_AREA)[(W - H) // 2:(W - H) // 2 + H]
        bg = cv2.GaussianBlur(cover, (0, 0), 40).astype(np.float32)
        self.bg = bg * 0.55 + 255 * 0.45

    def render(self, t):
        cx, cy, w = clamp_view(*camera(self.keys, t))
        s = W / w
        m = np.float32([[s, 0, W / 2 - cx * s], [0, s, H / 2 - cy * s]])
        interp = cv2.INTER_CUBIC if s > 1 else cv2.INTER_AREA
        fg = cv2.warpAffine(self.img, m, (W, H), flags=interp, borderMode=cv2.BORDER_CONSTANT)
        if w <= SRC:
            return fg
        mask = cv2.warpAffine(np.ones((SRC, SRC), np.float32), m, (W, H), flags=cv2.INTER_LINEAR)[..., None]
        return fg * mask + self.bg * (1 - mask)


def main():
    out = Path(sys.argv[1]) if len(sys.argv) > 1 else HERE / "ai-agent-shortform.mp4"
    paths = sorted((HERE / "slides").glob("*.webp"))
    slides = [Slide(p, SHOTS[p.stem]) for p in paths]
    step = SLIDE_SEC - XFADE_SEC
    total = step * (len(slides) - 1) + SLIDE_SEC
    n = int(round(total * FPS))

    ff = subprocess.Popen([
        "ffmpeg", "-y", "-loglevel", "error",
        "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-",
        "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
        "-shortest", "-c:v", "libx264", "-preset", "slow", "-crf", "16",
        "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k",
        "-movflags", "+faststart", str(out),
    ], stdin=subprocess.PIPE)

    for f in range(n):
        T = f / FPS
        frame = None
        for i, sl in enumerate(slides):
            lt = T - i * step
            if lt < 0 or lt > SLIDE_SEC:
                continue
            a = 1.0
            if i > 0 and lt < XFADE_SEC:
                a = ease(lt / XFADE_SEC)
            img = sl.render(lt)
            frame = img if frame is None else frame * (1 - a) + img * a
        edge = min(T / EDGE_FADE_SEC, (total - T) / EDGE_FADE_SEC, 1.0)
        frame = frame * edge + 255 * (1 - edge)
        ff.stdin.write(np.clip(frame, 0, 255).astype(np.uint8).tobytes())

    ff.stdin.close()
    ff.wait()
    print(f"{out} ({total:.1f}s, {len(slides)} slides)")


if __name__ == "__main__":
    main()
