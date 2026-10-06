"""스토리보드 작성·검수용 도구.

  python3 cardtools.py grid  <카드.webp> <출력.png>          좌표 격자(50px) 그리기
  python3 cardtools.py check <storyboard모듈> <출력폴더>      레이어 분리 검수(빈 카드 + 원본과 차이)
  python3 cardtools.py snap  <storyboard모듈> <출력폴더> [초…]  슬라이드별 장면 미리보기
"""
import importlib
import sys

import cv2
import numpy as np

from cardmotion import CardScene, make_backdrop, place


def grid(src, out):
    im = cv2.imread(src)
    n = im.shape[0]
    for v in range(0, n, 50):
        c = (0, 0, 255) if v % 100 == 0 else (255, 180, 0)
        cv2.line(im, (v, 0), (v, n - 1), c, 1)
        cv2.line(im, (0, v), (n - 1, v), c, 1)
        if v % 100 == 0:
            for p in range(0, n, 200):
                cv2.putText(im, str(v), (v + 2, p + 12), 0, 0.4, (0, 0, 200), 1)
                cv2.putText(im, str(v), (p + 2, v + 12), 0, 0.4, (0, 0, 200), 1)
    cv2.imwrite(out, im)


def check(module, outdir):
    for sl in importlib.import_module(module).SLIDES:
        sl.highlights, sl.sparks = [], []
        sc = CardScene(sl)
        k = sl.image.stem
        d = np.abs(sc.render_card(60) - sc.full).max(2)
        print(f"{k}: 원본과 다른 픽셀(>40) {int((d > 40).sum())}개  ← 수백 개 이하면 정상")
        small = lambda x: cv2.resize(np.clip(x, 0, 255).astype(np.uint8), (627, 627), interpolation=cv2.INTER_AREA)
        dd = cv2.cvtColor(np.clip(d * 4, 0, 255).astype(np.uint8), cv2.COLOR_GRAY2BGR)
        cv2.imwrite(f"{outdir}/check{k}.png", np.hstack([small(sc.base), small(dd)]))


def snap(module, outdir, times=None):
    bd = make_backdrop()
    for sl in importlib.import_module(module).SLIDES:
        sc = CardScene(sl)
        ts = times or [sl.duration * f for f in (0.12, 0.25, 0.4, 0.55, 0.75, 0.92)]
        fr = [cv2.resize(np.clip(place(sc.render_card(t), sc.camera(t), bd), 0, 255).astype(np.uint8),
                         (640, 360), interpolation=cv2.INTER_AREA) for t in ts]
        while len(fr) % 3:
            fr.append(np.zeros_like(fr[0]))
        rows = [np.hstack(fr[i:i + 3]) for i in range(0, len(fr), 3)]
        cv2.imwrite(f"{outdir}/snap{sl.image.stem}.png", np.vstack(rows))


if __name__ == "__main__":
    cmd, *a = sys.argv[1:]
    if cmd == "grid":
        grid(*a)
    elif cmd == "check":
        check(*a)
    elif cmd == "snap":
        snap(a[0], a[1], [float(x) for x in a[2:]] or None)
