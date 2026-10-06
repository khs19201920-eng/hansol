---
name: cardnews-video
description: 카드뉴스(정사각형 카드 이미지)를 'C안' 스타일 모션 영상으로 만든다 — 요소가 하나씩 등장(pop/rise/slide/wipe)하고 형광펜·반짝임·강조 효과, 브랜드 띠 스와이프 전환, 합성 효과음과 BGM을 넣는다. 사용자가 카드뉴스/카드 이미지를 올리고 숏폼·영상·모션으로 만들어 달라고 할 때 사용.
---

# 카드뉴스 → C안 모션 영상

엔진은 `shortform/cardmotion.py`, 예시 스토리보드는 `shortform/storyboard.py`(AI 에이전트 캠페인 01~04장).
새 작업은 이 예시를 복사해 좌표와 시각만 바꾸면 된다.

## 기본값 (사용자가 따로 말하지 않으면)
- 16:9 1920x1080, 30fps, 장당 8~9초
- 효과음 + 가벼운 합성 BGM(저작권 문제 없음), 장 사이 브랜드 띠 스와이프(자주색 #961258 / 하늘색 #5fd7eb)
- 각 장: 제목 pop → 영문 부제 rise → 본문 상자 grow → 상자 안 요소 순차 등장 → 핵심 문구 형광펜 → 단계형 아이콘은 화살표와 함께 1→N 순서로 켜기 → 캐릭터는 좌우에서 slide-in + 반짝임 → 마지막에 전체 보기로 줌아웃
- 결과물 `shortform/<캠페인명>.mp4`

## 절차
1. 첨부 이미지를 **카드에 적힌 페이지 번호 순서**로 `shortform/slides/NN.webp`에 복사(첨부 순서는 뒤섞일 수 있음).
   이미 다른 캠페인 슬라이드가 있으면 `shortform/<캠페인명>/slides/` 처럼 폴더를 나눈다.
2. 좌표 측정: `python3 cardtools.py grid slides/01.webp <scratch>/g01.png` 후 이미지를 보고 요소별 사각형(x0,y0,x1,y1)을 잡는다.
   - 사각형 테두리는 **배경 위**를 지나가게 여유를 둔다(테두리 색의 중앙값을 배경색으로 쓰기 때문).
   - 상자·패널은 `solid=True`, 원형 배경은 `disk=(cx,cy,r)`, 그라데이션 위 요소는 `thr=24`.
   - 다른 색 배경(원, 패널) 위의 캐릭터는 `bgpts=[(x,y)]`로 그 배경색 좌표를 알려준다(좌표가 캐릭터 위에 찍히지 않게 주의).
   - 리스트 순서 = 그리는 순서(z). 상자 다음에 그 안의 요소를 적는다.
   - 위쪽 요소의 사각형이 아래쪽 글자를 가리면 그 글자가 잘려 나간다 → `excl=[...]`로 겹친 부분을 빼거나 사각형을 줄인다.
   - **사진**: `El(rect, "photo", t, box=20, tilt=±6, kb=0.07)` — 기울어진 채 떨어지며 플래시+셔터음, 이후 사진 안에서 천천히 확대.
     사진이 많은 장은 `camera`로 사진을 하나씩 클로즈업하는 투어를 넣고, 이동할 때 `sounds=[(t, "swish")]`를 단다.
   - 카드 크기가 1254가 아니면(예: 1920) 카메라 전체보기 너비는 `크기*16/9`.
3. `python3 cardtools.py check storyboard <scratch>` → 원본과 다른 픽셀이 수백 개 이하인지, 빈 카드에 남은 얼룩이 없는지 확인.
4. `python3 cardtools.py snap storyboard <scratch>` → 중간 장면을 보고 잘림·유령 이미지·겹침을 고친다.
5. `python3 storyboard.py <출력.mp4>` 로 렌더(35초 기준 약 2분). 특정 장만 미리보기: `python3 storyboard.py out.mp4 01 03`.
   - `render(..., music=False)`: BGM 없이 효과음만.
   - 시리즈(1편→2편)로 이어 붙일 때: 앞 편은 `outro_swipe=True`(브랜드 띠가 덮으며 끝), 다음 편은 `intro_swipe=True`(띠가 빠지며 시작).
     예시: `storyboard2.py`(2편, 05~08장, 사진 콜라주 연출 포함), `storyboard2.py --full`(1~8장 한 편).
6. 결과 mp4를 SendUserFile로 보내고, 커밋·푸시.

## 의존성
`pip install numpy opencv-python-headless` + ffmpeg.
