"""카드뉴스 모션 엔진 (C안: 요소 순차 등장 + 강조 효과 + 브랜드 스와이프 전환 + 효과음/BGM).

카드 이미지(정사각형)에서 요소(제목, 문장, 아이콘, 상자 등)를 사각형 영역으로 지정하면
배경과 다른 픽셀만 자동으로 오려내 레이어로 만들고, 원래 자리는 배경으로 메운다.
각 레이어는 지정한 시각에 pop/rise/left/right/wipe/grow 등의 효과로 등장한다.

슬라이드별 연출은 storyboard.py 에 정의한다.
"""
import math
import subprocess
import wave
from dataclasses import dataclass, field
from pathlib import Path

import cv2
import numpy as np

W, H = 1920, 1080
FPS = 30
SR = 48000

# 브랜드 색 (BGR)
MAGENTA = np.array([88, 18, 150], np.float32)
CYAN = np.array([235, 215, 95], np.float32)
YELLOW = np.array([60, 200, 250], np.float32)
MARKER = np.array([120, 235, 255], np.float32)


# ───────────────────────── easing ─────────────────────────
def clamp01(x):
    return max(0.0, min(1.0, x))


def smooth(p):
    p = clamp01(p)
    return p * p * (3 - 2 * p)


def out_cubic(p):
    p = clamp01(p)
    return 1 - (1 - p) ** 3


def out_back(p, k=1.9):
    p = clamp01(p)
    return 1 + (k + 1) * (p - 1) ** 3 + k * (p - 1) ** 2


# ───────────────────────── spec ─────────────────────────
@dataclass
class El:
    rect: tuple            # (x0, y0, x1, y1) 원본 좌표
    anim: str              # pop | rise | drop | left | right | fade | wipe | wipel | wiped | grow
    t: float               # 등장 시각 (슬라이드 내 초)
    dur: float = 0.45
    solid: bool = False    # 상자·원처럼 속이 찬 도형 (볼록 껍질로 마스크)
    flat: bool = False     # solid 도형을 단색으로 채움 (가려진 부분 복원 대신)
    disk: tuple = None     # (cx, cy, r): 가려진 원형 배경을 완전한 원으로 다시 그림
    box: float = None      # 사진처럼 사각형 전체를 레이어로 (값 = 모서리 반경)
    tilt: float = 0.0      # photo 등장 시 시작 기울기(도)
    kb: float = 0.0        # 등장 후 사각형 안에서 천천히 확대(Ken Burns) 비율
    thr: float = None      # 배경 판정 임계값
    bgpts: list = field(default_factory=list)   # 배경으로 간주할 색을 뽑을 좌표
    excl: list = field(default_factory=list)    # 제외할 사각형
    pulse: list = field(default_factory=list)   # 강조(살짝 커졌다 돌아오기) 시각
    sfx: str = "auto"


@dataclass
class Slide:
    image: str
    duration: float
    elements: list
    camera: list           # [(t, cx, cy, view_w)]
    highlights: list = field(default_factory=list)  # [(t, (x0,y0,x1,y1))]
    sparks: list = field(default_factory=list)      # [(t, (x, y), size)]
    sounds: list = field(default_factory=list)      # [(t, kind)] 카메라 이동 등 추가 효과음


# ───────────────────────── 레이어 준비 ─────────────────────────
def _ring_color(img, x0, y0, x1, y1):
    ring = np.concatenate([img[y0, x0:x1], img[y1 - 1, x0:x1], img[y0:y1, x0], img[y0:y1, x1 - 1]])
    return np.median(ring, axis=0)


def _sample(img, x, y):
    return np.median(img[y - 2:y + 3, x - 2:x + 3].reshape(-1, 3), axis=0)


def _fill_holes(mask):
    h, w = mask.shape
    m = np.zeros((h + 2, w + 2), np.uint8)
    m[1:-1, 1:-1] = mask
    flood = m.copy()
    cv2.floodFill(flood, None, (0, 0), 1)
    return (m | (1 - flood))[1:-1, 1:-1]


class Layer:
    def __init__(self, el, rgb, alpha):
        self.el, self.rgb, self.alpha = el, rgb, alpha


class CardScene:
    def __init__(self, slide: Slide):
        self.s = slide
        img = cv2.imread(str(slide.image), cv2.IMREAD_COLOR)
        self.size = img.shape[0]
        blur = cv2.GaussianBlur(img, (3, 3), 0).astype(np.float32)
        n = self.size
        claimed = np.zeros((n, n), np.uint8)
        layers = []
        # 위쪽(나중에 그려지는) 레이어부터 픽셀을 차지한다
        for el in reversed(slide.elements):
            x0, y0, x1, y1 = el.rect
            region = blur[y0:y1, x0:x1]
            bgs = [_ring_color(blur, x0, y0, x1, y1)] + [_sample(blur, x, y) for x, y in el.bgpts]
            dist = np.min([np.abs(region - c).max(axis=2) for c in bgs], axis=0)
            thr = el.thr if el.thr is not None else (7 if el.solid else 14)
            fg = (dist > thr).astype(np.uint8)
            for ex0, ey0, ex1, ey1 in el.excl:
                fg[max(ey0 - y0, 0):max(ey1 - y0, 0), max(ex0 - x0, 0):max(ex1 - x0, 0)] = 0
            fg = cv2.morphologyEx(fg, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
            if el.box is not None:
                rr = np.zeros((y1 - y0, x1 - x0), np.uint8)
                r = int(el.box)
                cv2.rectangle(rr, (r, 0), (x1 - x0 - 1 - r, y1 - y0 - 1), 1, -1)
                cv2.rectangle(rr, (0, r), (x1 - x0 - 1, y1 - y0 - 1 - r), 1, -1)
                for cx_, cy_ in [(r, r), (x1 - x0 - 1 - r, r), (r, y1 - y0 - 1 - r), (x1 - x0 - 1 - r, y1 - y0 - 1 - r)]:
                    cv2.circle(rr, (cx_, cy_), r, 1, -1)
                own = rr & (1 - claimed[y0:y1, x0:x1])
                claimed[y0:y1, x0:x1] |= own
                layers.append(Layer(el, img[y0:y1, x0:x1].astype(np.float32),
                                    cv2.GaussianBlur(own.astype(np.float32), (0, 0), 0.8)))
                continue
            if el.disk:
                dcx, dcy, dr = el.disk
                yy, xx = np.mgrid[y0:y1, x0:x1]
                adisk = np.clip(dr - np.hypot(xx - dcx, yy - dcy) + 0.5, 0, 1).astype(np.float32)
                own = (adisk > 0).astype(np.uint8)
                keep = (own & (1 - claimed[y0:y1, x0:x1])).astype(bool) & (dist > 8)
                crop = np.empty((y1 - y0, x1 - x0, 3), np.uint8)
                crop[:] = np.median(img[y0:y1, x0:x1][keep], axis=0)
                claimed[y0:y1, x0:x1] |= own
                layers.append(Layer(el, crop.astype(np.float32), adisk))
                continue
            if el.solid:
                pts = cv2.findNonZero(fg)
                fg = np.zeros_like(fg)
                if pts is not None:
                    cv2.fillPoly(fg, [cv2.convexHull(pts)], 1)
                above = claimed[y0:y1, x0:x1] & fg
                own = fg
            else:
                fg = cv2.dilate(fg, np.ones((5, 5), np.uint8))
                fg = _fill_holes(fg)
                own = fg & (1 - claimed[y0:y1, x0:x1])
                above = np.zeros_like(own)
            crop = img[y0:y1, x0:x1].copy()
            if el.flat:
                keep = (own & (1 - claimed[y0:y1, x0:x1])).astype(bool)
                crop[:] = np.median(crop[keep], axis=0)
            elif above.any():
                crop = cv2.inpaint(crop, cv2.dilate(above, np.ones((7, 7), np.uint8)), 6, cv2.INPAINT_TELEA)
            alpha = cv2.GaussianBlur(own.astype(np.float32), (0, 0), 0.9)
            if not el.solid:
                alpha *= cv2.dilate(own, np.ones((3, 3), np.uint8)).astype(np.float32)
            claimed[y0:y1, x0:x1] |= own
            layers.append(Layer(el, crop.astype(np.float32), alpha))
        self.layers = list(reversed(layers))
        # 비워진 자리를 카드 바탕색(단색)으로 메운 베이스 카드
        mask = cv2.dilate(claimed, np.ones((9, 9), np.uint8))
        inner = np.zeros_like(mask)
        m0 = n // 12
        inner[m0:n - m0, m0:n - m0] = 1
        bgcol = np.median(img[(inner & (1 - mask)).astype(bool)], axis=0).astype(np.float32)
        m = cv2.GaussianBlur(mask.astype(np.float32), (0, 0), 2)[..., None]
        self.base = img.astype(np.float32) * (1 - m) + bgcol * m
        self.full = img.astype(np.float32)

    # ── 레이어 상태 ──
    @staticmethod
    def state(el, t):
        p = (t - el.t) / el.dur
        if p <= 0:
            return None
        e = out_cubic(p)
        st = dict(a=1.0, s=1.0, dx=0.0, dy=0.0, wipe=None, rot=0.0, flash=0.0, kb=1.0)
        a = el.anim
        if a == "pop":
            st["s"] = 0.35 + 0.65 * out_back(p, 2.4)
            st["a"] = clamp01(p * 3)
        elif a == "grow":
            st["s"] = 0.92 + 0.08 * out_back(p, 1.5)
            st["a"] = smooth(p * 1.6)
        elif a in ("rise", "drop", "left", "right"):
            d = {"rise": (0, 46), "drop": (0, -60), "left": (-150, 0), "right": (150, 0)}[a]
            st["dx"], st["dy"] = d[0] * (1 - out_back(p, 1.2)), d[1] * (1 - out_back(p, 1.2))
            st["a"] = smooth(p * 1.8)
        elif a == "photo":
            st["s"] = 1.45 - 0.45 * out_back(p, 1.3)
            st["rot"] = el.tilt * (1 - out_back(p, 1.1))
            st["dy"] = -70 * (1 - out_cubic(p))
            st["a"] = smooth(p * 2.5)
            q = (t - el.t - el.dur * 0.85) / 0.4
            if 0 < q < 1:
                st["flash"] = 0.85 * (1 - q) ** 2
        elif a == "fade":
            st["a"] = smooth(p)
        elif a in ("wipe", "wipel", "wiped"):
            st["wipe"] = (a, smooth(p) if p < 1 else None)
            if p >= 1:
                st["wipe"] = None
        if el.kb:
            st["kb"] = 1 + el.kb * smooth((t - el.t - el.dur) / 7.0)
        if el.kb:
            st["kb"] = 1 + el.kb * smooth((t - el.t - el.dur) / 7.0)
        for pt in el.pulse:
            q = (t - pt) / 0.5
            if 0 < q < 1:
                st["s"] *= 1 + 0.10 * math.sin(math.pi * q)
        return st

    def _paste(self, canvas, layer, st):
        el = layer.el
        x0, y0, x1, y1 = el.rect
        w, h = x1 - x0, y1 - y0
        alpha = layer.alpha * st["a"]
        src = layer.rgb
        if st["kb"] > 1.0005:
            z = st["kb"]
            Mz = cv2.getRotationMatrix2D((w / 2 + (z - 1) * w * 0.15, h / 2), 0, z)
            src = cv2.warpAffine(src, Mz, (w, h), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        if st["flash"] > 0:
            src = src * (1 - st["flash"]) + 255 * st["flash"]
        if st["wipe"]:
            kind, p = st["wipe"]
            soft = 30.0
            if kind == "wiped":
                ramp = np.clip((p * (h + soft) - np.arange(h)) / soft, 0, 1)[:, None]
            elif kind == "wipel":
                ramp = np.clip((p * (w + soft) - (w - 1 - np.arange(w))) / soft, 0, 1)[None, :]
            else:
                ramp = np.clip((p * (w + soft) - np.arange(w)) / soft, 0, 1)[None, :]
            alpha = alpha * ramp
        s, dx, dy = st["s"], st["dx"], st["dy"]
        n = self.size
        rot = st["rot"]
        if abs(s - 1) < 1e-3 and abs(dx) < 0.5 and abs(dy) < 0.5 and abs(rot) < 0.01:
            X0, Y0, rgb, a = x0, y0, src, alpha
        else:
            cx, cy = x0 + w / 2 + dx, y0 + h / 2 + dy
            th = math.radians(rot)
            ew = s * (abs(w * math.cos(th)) + abs(h * math.sin(th))) / 2
            eh = s * (abs(w * math.sin(th)) + abs(h * math.cos(th))) / 2
            X0, Y0 = int(math.floor(cx - ew)) - 1, int(math.floor(cy - eh)) - 1
            X1, Y1 = int(math.ceil(cx + ew)) + 1, int(math.ceil(cy + eh)) + 1
            M = cv2.getRotationMatrix2D((w / 2, h / 2), rot, s)
            M[0, 2] += cx - w / 2 - X0
            M[1, 2] += cy - h / 2 - Y0
            M = M.astype(np.float32)
            sz = (X1 - X0, Y1 - Y0)
            rgb = cv2.warpAffine(src, M, sz, flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
            a = cv2.warpAffine(alpha, M, sz, flags=cv2.INTER_LINEAR, borderValue=0)
        # 캔버스 경계로 자르기
        cx0, cy0 = max(X0, 0), max(Y0, 0)
        cx1, cy1 = min(X0 + rgb.shape[1], n), min(Y0 + rgb.shape[0], n)
        if cx1 <= cx0 or cy1 <= cy0:
            return
        rgb = rgb[cy0 - Y0:cy1 - Y0, cx0 - X0:cx1 - X0]
        a = a[cy0 - Y0:cy1 - Y0, cx0 - X0:cx1 - X0, None]
        dst = canvas[cy0:cy1, cx0:cx1]
        dst *= 1 - a
        dst += rgb * a

    def render_card(self, t):
        canvas = self.base.copy()
        for layer in self.layers:
            st = self.state(layer.el, t)
            if st is not None:
                self._paste(canvas, layer, st)
        for ht, (x0, y0, x1, y1) in self.s.highlights:
            p = smooth((t - ht) / 0.45)
            if p <= 0:
                continue
            xe = int(x0 + (x1 - x0) * p)
            region = canvas[y0:y1, x0:xe]
            k = 0.55
            region *= (1 - k) + k * MARKER / 255
        for stt, (x, y), size in self.s.sparks:
            q = (t - stt) / 0.65
            if 0 < q < 1:
                _sparkle(canvas, x, y, size, q)
        return canvas

    def camera(self, t):
        keys = self.s.camera
        if t <= keys[0][0]:
            return keys[0][1:]
        for (t0, x0, y0, w0), (t1, x1, y1, w1) in zip(keys, keys[1:]):
            if t <= t1:
                u = smooth((t - t0) / (t1 - t0))
                w = math.exp(math.log(w0) + (math.log(w1) - math.log(w0)) * u)
                return x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, w
        return keys[-1][1:]

    def sfx_events(self):
        ev = []
        for el in self.s.elements:
            kind = el.sfx
            if kind == "auto":
                kind = {"pop": "pop", "grow": "pop_soft", "rise": "swish", "drop": "swish", "left": "swish",
                        "right": "swish", "wipe": "tick", "wipel": "tick", "wiped": "tick",
                        "photo": "swish"}.get(el.anim)
            if kind:
                ev.append((el.t, kind))
            if el.anim == "photo":
                ev.append((el.t + el.dur * 0.85, "shutter"))
            for pt in el.pulse:
                ev.append((pt, "pop_soft"))
        ev += [(t, "marker") for t, _ in self.s.highlights]
        ev += [(t, "chime") for t, _, _ in self.s.sparks]
        ev += list(self.s.sounds)
        return ev


def _sparkle(canvas, x, y, size, q):
    e = out_cubic(q)
    overlay = canvas.copy()
    for i in range(10):
        ang = i * math.pi / 5 + 0.3
        r0, r1 = size * (0.35 + 0.9 * e), size * (0.6 + 1.3 * e)
        p0 = (int(x + r0 * math.cos(ang)), int(y + r0 * math.sin(ang)))
        p1 = (int(x + r1 * math.cos(ang)), int(y + r1 * math.sin(ang)))
        col = YELLOW if i % 2 == 0 else MAGENTA
        cv2.line(overlay, p0, p1, col.tolist(), max(2, int(size / 9)), cv2.LINE_AA)
    a = 1 - smooth(q)
    canvas *= 1 - a
    canvas += overlay * a


# ───────────────────────── 화면 합성 ─────────────────────────
def make_backdrop():
    bg = np.full((H, W, 3), (246, 242, 244), np.float32)
    glow = np.zeros_like(bg)
    cv2.circle(glow, (230, 200), 420, MAGENTA.tolist(), -1)
    cv2.circle(glow, (1700, 900), 460, CYAN.tolist(), -1)
    glow = cv2.GaussianBlur(glow, (0, 0), 160)
    m = cv2.GaussianBlur((glow.sum(2) > 0).astype(np.float32), (0, 0), 160)[..., None] * 0.18
    return bg * (1 - m) + glow * m


def place(card, cam, backdrop):
    n = card.shape[0]
    cx, cy, w = cam
    h = w * 9 / 16
    if w <= n:
        cx = min(max(cx, w / 2), n - w / 2)
    if h <= n:
        cy = min(max(cy, h / 2), n - h / 2)
    s = W / w
    M = np.float32([[s, 0, W / 2 - cx * s], [0, s, H / 2 - cy * s]])
    interp = cv2.INTER_CUBIC if s > 1 else cv2.INTER_AREA
    fg = cv2.warpAffine(card, M, (W, H), flags=interp)
    if w <= n and h <= n:
        return fg
    mask = cv2.warpAffine(np.ones((n, n), np.float32), M, (W, H), flags=cv2.INTER_LINEAR)[..., None]
    return fg * mask + backdrop * (1 - mask)


TRANS = 0.8  # 브랜드 스와이프 전환 길이


def swipe(frame, p):
    """대각선 브랜드 띠가 화면을 덮고 지나간다. p: 0→1"""
    e = smooth(p)
    body = 2300
    lead = -300 + e * (W + body + 900)
    yy = np.arange(H, dtype=np.float32)[:, None]
    xx = np.arange(W, dtype=np.float32)[None, :]
    x = xx + (H - yy) * 0.28
    def band(a, b):
        return np.clip((lead - a - x) / 3 + 0.5, 0, 1) * np.clip((x - (lead - b)) / 3 + 0.5, 0, 1)
    cyan = band(0, 70)[..., None]
    mag = band(70, body)[..., None]
    tail = band(body, body + 50)[..., None]
    frame = frame * (1 - cyan) + CYAN * cyan
    frame = frame * (1 - mag) + MAGENTA * mag
    return frame * (1 - tail) + CYAN * tail


# ───────────────────────── 오디오 ─────────────────────────
def _env(n, att, rel):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(att, 1e-4)) * np.exp(-t / rel)


def _lowpass(x, cutoff):
    y = np.zeros_like(x)
    acc = 0.0
    c = np.broadcast_to(cutoff, x.shape)
    a = 1 - np.exp(-2 * np.pi * c / SR)
    for i in range(len(x)):
        acc += a[i] * (x[i] - acc)
        y[i] = acc
    return y


def sfx(kind, rng):
    if kind in ("pop", "pop_soft"):
        n = int(0.12 * SR)
        t = np.arange(n) / SR
        f = 260 + 700 * np.exp(-t / 0.018)
        y = np.sin(2 * np.pi * np.cumsum(f) / SR) * _env(n, 0.002, 0.035)
        return y * (0.42 if kind == "pop" else 0.22)
    if kind == "swish":
        n = int(0.28 * SR)
        t = np.arange(n) / SR
        y = _lowpass(rng.standard_normal(n), 600 + 5000 * np.sin(np.pi * t / t[-1]))
        return y * np.sin(np.pi * t / t[-1]) ** 2 * 0.22
    if kind == "tick":
        n = int(0.05 * SR)
        t = np.arange(n) / SR
        return np.sin(2 * np.pi * 2100 * t) * _env(n, 0.001, 0.012) * 0.16
    if kind == "marker":
        n = int(0.42 * SR)
        t = np.arange(n) / SR
        y = rng.standard_normal(n)
        y = y - _lowpass(y, 2500)
        return y * (0.6 + 0.4 * np.sin(2 * np.pi * 22 * t)) * np.sin(np.pi * t / t[-1]) * 0.07
    if kind == "chime":
        n = int(0.9 * SR)
        t = np.arange(n) / SR
        y = np.zeros(n)
        for i, f in enumerate([1568, 2093, 2637, 3136]):
            d = int(i * 0.05 * SR)
            y[d:] += np.sin(2 * np.pi * f * t[:n - d]) * np.exp(-t[:n - d] / 0.25)
        return y * 0.07
    if kind == "shutter":
        n = int(0.16 * SR)
        y = np.zeros(n)
        for d, g in [(0, 1.0), (0.055, 0.7)]:
            L = int(0.03 * SR)
            b = rng.standard_normal(L)
            b = b - _lowpass(b, 3000)
            i = int(d * SR)
            y[i:i + L] += b * _env(L, 0.0005, 0.006) * g
        return y * 0.5
    if kind == "whoosh":
        n = int(0.8 * SR)
        t = np.arange(n) / SR
        y = _lowpass(rng.standard_normal(n), 300 + 3500 * np.sin(np.pi * t / t[-1]) ** 2)
        return y * np.sin(np.pi * t / t[-1]) ** 1.5 * 0.45
    raise ValueError(kind)


def bgm(total):
    """가볍고 밝은 신스 루프 (C–G–Am–F, 112bpm)."""
    n = int(total * SR)
    out = np.zeros(n)
    beat = 60 / 112
    chords = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]]
    hz = lambda m: 440 * 2 ** ((m - 69) / 12)
    t_bar = beat * 4
    k = 0
    while k * beat / 2 < total:
        t0 = k * beat / 2
        ch = chords[int(t0 // t_bar) % 4]
        note = ch[[0, 1, 2, 1][k % 4]] + 12
        L = int(0.5 * SR)
        tt = np.arange(L) / SR
        y = (np.sin(2 * np.pi * hz(note) * tt) + 0.3 * np.sin(4 * np.pi * hz(note) * tt)) * _env(L, 0.004, 0.16)
        i = int(t0 * SR)
        out[i:i + L] += y[:max(0, min(L, n - i))] * 0.10
        if k % 2 == 0:  # 킥 (매 박)
            Lk = int(0.18 * SR)
            tk = np.arange(Lk) / SR
            kick = np.sin(2 * np.pi * np.cumsum(50 + 90 * np.exp(-tk / 0.03)) / SR) * _env(Lk, 0.001, 0.07)
            out[i:i + Lk] += kick[:max(0, min(Lk, n - i))] * (0.22 if k % 4 == 0 else 0.12)
        k += 1
    # 패드
    t = np.arange(n) / SR
    for b in range(int(total / t_bar) + 1):
        i0, i1 = int(b * t_bar * SR), min(int((b + 1) * t_bar * SR), n)
        if i0 >= n:
            break
        tt = t[i0:i1] - b * t_bar
        env = np.minimum(1, tt / 0.3) * np.minimum(1, (t_bar - tt) / 0.3)
        for m in chords[b % 4]:
            out[i0:i1] += (np.sin(2 * np.pi * hz(m) * tt) + 0.5 * np.sin(2 * np.pi * hz(m) * 1.003 * tt)) * env * 0.025
    fade = np.minimum(1, np.minimum(t / 1.0, (total - t) / 1.5))
    return out * np.clip(fade, 0, 1)


# ───────────────────────── 렌더 ─────────────────────────
def render(slides, out_path, lead=0.25, music=True, intro_swipe=False, outro_swipe=False):
    """intro_swipe: 브랜드 띠가 빠져나가며 시작(이전 편에서 이어짐).
    outro_swipe: 브랜드 띠가 화면을 덮으며 끝(다음 편으로 이어짐)."""
    scenes = [CardScene(s) for s in slides]
    starts, t = [], 0.0
    for s in slides:
        starts.append(t)
        t += s.duration
    total = t
    backdrop = make_backdrop()
    nframes = int(round(total * FPS))
    tmp_video = Path(out_path).with_suffix(".video.mp4")
    ff = subprocess.Popen([
        "ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgr24",
        "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "slow",
        "-crf", "17", "-pix_fmt", "yuv420p", str(tmp_video)], stdin=subprocess.PIPE)
    for f in range(nframes):
        T = f / FPS
        i = max(k for k in range(len(slides)) if starts[k] <= T)
        lt = T - starts[i] - (lead if i > 0 or intro_swipe else 0.1)
        sc = scenes[i]
        frame = place(sc.render_card(max(lt, 0)), sc.camera(max(lt, 0)), backdrop)
        # 전환: 경계 앞뒤 TRANS/2
        for b in starts[1:]:
            p = (T - (b - TRANS / 2)) / TRANS
            if 0 < p < 1:
                frame = swipe(frame, p)
        if intro_swipe:
            if T < TRANS / 2:
                frame = swipe(frame, 0.5 + T / TRANS)
        elif T < 0.35:
            frame = frame * (T / 0.35) + 255 * (1 - T / 0.35)
        if outro_swipe:
            if total - T < TRANS / 2:
                frame = swipe(frame, 0.5 - (total - T) / TRANS)
        elif total - T < 0.6:
            k = (total - T) / 0.6
            frame = frame * k + 255 * (1 - k)
        ff.stdin.write(np.clip(frame, 0, 255).astype(np.uint8).tobytes())
        if f % 150 == 0:
            print(f"  frame {f}/{nframes}", flush=True)
    ff.stdin.close()
    ff.wait()

    # 오디오
    rng = np.random.default_rng(7)
    audio = bgm(total) if music else np.zeros(int(total * SR))
    events = [(b - TRANS / 2 + 0.05, "whoosh") for b in starts[1:]]
    if outro_swipe:
        events.append((total - TRANS / 2 + 0.05, "whoosh"))
    for k, sc in enumerate(scenes):
        off = starts[k] + (lead if k > 0 or intro_swipe else 0.1)
        events += [(off + t, kind) for t, kind in sc.sfx_events()]
    events.sort()
    last = {}
    cache = {}
    for t, kind in events:
        if t - last.get(kind, -9) < 0.12:
            continue
        last[kind] = t
        y = cache.setdefault(kind, sfx(kind, rng))
        i = int(t * SR)
        if i >= len(audio):
            continue
        L = min(len(y), len(audio) - i)
        audio[i:i + L] += y[:L]
    audio = np.tanh(audio * 1.9) * 0.9
    tmp_wav = Path(out_path).with_suffix(".wav")
    with wave.open(str(tmp_wav), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes((audio * 32767).astype(np.int16).tobytes())
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(tmp_video), "-i", str(tmp_wav),
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ac", "2", "-shortest",
                    "-movflags", "+faststart", str(out_path)], check=True)
    tmp_video.unlink()
    tmp_wav.unlink()
    return total
