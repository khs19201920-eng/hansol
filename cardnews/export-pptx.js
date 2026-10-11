// HTML 카드뉴스를 '편집 가능한' PowerPoint 한 장으로 옮긴다.
// 글자·태그·카드는 모두 PowerPoint 텍스트/도형으로, 그라데이션(배경·번호 배지·하단 상자)만 이미지로 넣는다.
//   NODE_PATH="$(npm root -g):<pptxgenjs 설치 경로>" node export-pptx.js ai-genius-how-to.html [출력.pptx]
const { chromium } = require('playwright');
const PptxGenJS = require('pptxgenjs');
const path = require('path');

const PX = 160;               // 1600px 카드 = 10인치 → 1인치 = 160px
const PT = 72 / PX;           // px → pt
const FONT = 'Malgun Gothic'; // 맑은 고딕: 사내 Windows PC 기본 한글 글꼴
const inch = (v) => v / PX;

(async () => {
  const src = path.resolve(process.argv[2]);
  const out = process.argv[3] || src.replace(/\.html$/, '.pptx');
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1600, height: 2000 } });
  await page.goto('file://' + src);
  await page.evaluate(() => document.fonts.ready);

  // ── 1. 요소 위치·글자·스타일 측정 ──
  const data = await page.evaluate(() => {
    const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; };
    const style = (el) => { const s = getComputedStyle(el); return { size: parseFloat(s.fontSize), weight: +s.fontWeight, color: s.color, bg: s.backgroundColor }; };
    const one = (sel) => document.querySelector(sel);
    return {
      eyebrow: { ...box(one('.eyebrow')), text: one('.eyebrow').textContent, ...style(one('.eyebrow')) },
      logo: box(one('.logo')),
      h1: { ...box(one('h1')), ...style(one('h1')) },
      lead: { ...box(one('.lead')), text: one('.lead').textContent, ...style(one('.lead')) },
      items: [...document.querySelectorAll('.item')].map((it) => ({
        card: box(it),
        num: { ...box(it.querySelector('.num')), text: it.querySelector('.num').textContent },
        h2: { ...box(it.querySelector('h2')), text: it.querySelector('h2').textContent, ...style(it.querySelector('h2')) },
        flag: it.querySelector('.flag') && { ...box(it.querySelector('.flag')), text: it.querySelector('.flag').textContent, ...style(it.querySelector('.flag')) },
        desc: { ...box(it.querySelector('.desc')), text: it.querySelector('.desc').textContent, ...style(it.querySelector('.desc')) },
        tags: [...it.querySelectorAll('.tag')].map((t) => ({ ...box(t), text: t.textContent.trim(), cls: t.className, ...style(t) })),
      })),
      banner: box(one('.banner')),
      bh3: { ...box(one('.banner h3')), text: one('.banner h3').innerText, ...style(one('.banner h3')) },
      bp: { ...box(one('.banner p')), text: one('.banner p').textContent, ...style(one('.banner p')) },
      foot: box(one('.foot')),
      footItems: [...document.querySelectorAll('.foot > *')].map((f) => ({ ...box(f), text: f.textContent, ...style(f) })),
    };
  });

  // ── 2. 그라데이션 부분만 이미지로 캡처 ──
  const shot = async (prep, clip, transparent) => {
    await page.evaluate(prep);
    const buf = await page.screenshot({ clip, omitBackground: transparent });
    await page.reload();
    await page.evaluate(() => document.fonts.ready);
    return 'image/png;base64,' + buf.toString('base64');
  };
  const bgImg = await shot(() => { for (const el of document.body.children) el.style.visibility = 'hidden'; },
    { x: 0, y: 0, width: 1600, height: 2000 }, false);
  const n0 = data.items[0].num;
  const numImg = await shot(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    for (const el of document.body.children) el.style.visibility = 'hidden';
    const n = document.querySelector('.num'); n.style.visibility = 'visible'; n.style.color = 'transparent';
  }, { x: n0.x, y: n0.y, width: n0.w, height: n0.h }, true);
  const b = data.banner;
  const bannerImg = await shot(() => {
    document.documentElement.style.background = 'transparent';
    document.body.style.background = 'transparent';
    for (const el of document.body.children) el.style.visibility = 'hidden';
    const bn = document.querySelector('.banner'); bn.style.visibility = 'visible';
    for (const c of bn.children) c.style.visibility = 'hidden';
  }, { x: b.x, y: b.y, width: b.w, height: b.h }, true);
  await browser.close();

  // ── 3. PowerPoint 작성 ──
  const hex = (rgb) => rgb.match(/\d+/g).slice(0, 3).map((v) => (+v).toString(16).padStart(2, '0')).join('').toUpperCase();
  const pres = new PptxGenJS();
  pres.defineLayout({ name: 'CARD_4x5', width: 10, height: 12.5 });
  pres.layout = 'CARD_4x5';
  pres.theme = { headFontFace: FONT, bodyFontFace: FONT };
  pres.title = 'AI Genius · 함께하는 방법';
  const slide = pres.addSlide();
  slide.background = { data: bgImg };

  // 글자 상자: 측정한 위치에 그대로, 오른쪽은 글꼴 차이를 감안해 여유를 둔다
  const text = (t, r, o = {}) => slide.addText(t, {
    x: inch(r.x), y: inch(r.y), w: inch(o.w ?? r.w * 1.12), h: inch(r.h),
    fontFace: FONT, fontSize: r.size * PT, bold: r.weight >= 600, color: hex(r.color),
    margin: 0, valign: 'middle', fit: 'none', wrap: o.wrap ?? false, isTextBox: true, ...o.opts,
  });

  text(data.eyebrow.text, data.eyebrow, { opts: { objectName: '머리글' } });
  slide.addImage({ path: path.join(path.dirname(src), 'ai-genius-logo.png'), x: inch(data.logo.x), y: inch(data.logo.y),
    w: inch(data.logo.w), h: inch(data.logo.h), objectName: 'AI Genius 로고' });

  const h1 = data.h1, lineH = h1.h / 2;
  text('AI, 어렵지 않아요', { ...h1, h: lineH }, { w: 1400, opts: { objectName: '제목 1줄' } });
  text([
    { text: 'AI Genius와 ', options: { color: '5A2BD2' } },
    { text: '함께 ', options: { color: '8A1FA8' } },
    { text: '시작하세요', options: { color: 'B3166F' } },
  ], { ...h1, y: h1.y + lineH, h: lineH }, { w: 1400, opts: { objectName: '제목 2줄' } });
  text(data.lead.text, data.lead, { opts: { objectName: '소개 문구' } });

  data.items.forEach((it, i) => {
    const k = i + 1;
    slide.addShape(pres.shapes.ROUNDED_RECTANGLE, {
      x: inch(it.card.x), y: inch(it.card.y), w: inch(it.card.w), h: inch(it.card.h),
      rectRadius: inch(40), fill: { color: 'FFFFFF' }, line: { type: 'none' },
      shadow: { type: 'outer', color: '5A328C', opacity: 0.10, blur: 14, offset: 4, angle: 90 },
      objectName: `항목${k} 카드`,
    });
    slide.addImage({ data: numImg, x: inch(it.num.x), y: inch(it.num.y), w: inch(it.num.w), h: inch(it.num.h), objectName: `항목${k} 번호 배경` });
    slide.addText(it.num.text, {
      x: inch(it.num.x), y: inch(it.num.y), w: inch(it.num.w), h: inch(it.num.h),
      fontFace: FONT, fontSize: 46 * PT, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle',
      margin: 0, isTextBox: true, objectName: `항목${k} 번호`,
    });
    // 제목은 배지 앞까지만 (배지는 카드 오른쪽 끝에 고정)
    const h2W = it.flag ? it.flag.x - 16 - it.h2.x : it.card.x + it.card.w - 46 - it.h2.x;
    text(it.h2.text, it.h2, { w: h2W, opts: { objectName: `항목${k} 제목` } });
    if (it.flag) {
      slide.addText(it.flag.text, {
        shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: inch(12),
        x: inch(it.flag.x - it.flag.w * 0.06), y: inch(it.flag.y), w: inch(it.flag.w * 1.06), h: inch(it.flag.h),
        fill: { color: hex(it.flag.bg) }, line: { type: 'none' },
        fontFace: FONT, fontSize: it.flag.size * PT, bold: true, color: 'FFFFFF', align: 'center', valign: 'middle',
        margin: 0, wrap: false, objectName: `항목${k} 배지`,
      });
    }
    // 설명은 카드 안쪽 폭까지만 (넘치면 줄바꿈)
    const descW = it.card.x + it.card.w - 40 - it.desc.x;
    // 글꼴 폭 차이로 줄바꿈되어 태그와 겹치지 않도록 5% 작게, 한 줄 고정
    text(it.desc.text, { ...it.desc, size: it.desc.size * 0.95 }, { w: descW, opts: { objectName: `항목${k} 설명` } });
    // 태그: 글꼴 폭 차이를 감안해 6% 넓히고, 같은 줄의 다음 태그를 그만큼 민다
    let shift = 0, lastY = null;
    it.tags.forEach((t, j) => {
      if (t.y !== lastY) { shift = 0; lastY = t.y; }
      const w = t.w * 1.06;
      slide.addText(t.text, {
        shape: pres.shapes.ROUNDED_RECTANGLE, rectRadius: inch(t.h / 2),
        x: inch(t.x + shift), y: inch(t.y), w: inch(w), h: inch(t.h),
        fill: { color: hex(t.bg) }, line: { type: 'none' },
        fontFace: FONT, fontSize: t.size * PT, bold: true, color: hex(t.color), align: 'center', valign: 'middle',
        margin: 0, wrap: false, objectName: `항목${k} 태그${j + 1}`,
      });
      shift += w - t.w;
    });
  });

  slide.addImage({ data: bannerImg, x: inch(b.x), y: inch(b.y), w: inch(b.w), h: inch(b.h), objectName: '하단 메시지 배경' });
  const bh = data.bh3;
  slide.addText(bh.text.split('\n').map((line, i, arr) => ({ text: line, options: { breakLine: i < arr.length - 1 } })), {
    x: inch(bh.x), y: inch(bh.y), w: inch(b.x + b.w - 40 - bh.x), h: inch(bh.h),
    fontFace: FONT, fontSize: bh.size * PT, bold: true, color: 'FFFFFF', margin: 0, valign: 'middle',
    lineSpacingMultiple: 1.15, isTextBox: true, objectName: '하단 메시지',
  });
  text(data.bp.text, data.bp, { opts: { color: 'EBDDEA', objectName: '하단 메시지 보조' } });

  const f = data.foot;
  slide.addShape(pres.shapes.LINE, { x: inch(f.x), y: inch(f.y), w: inch(f.w), h: 0, line: { color: 'E6E1EC', width: 1 }, objectName: '바닥 구분선' });
  const [fl, fc, fr] = data.footItems;
  text(fl.text, fl, { opts: { objectName: '바닥 왼쪽' } });
  text(fc.text, { ...fc, x: fc.x - 60 }, { w: fc.w + 120, opts: { align: 'center', objectName: '쪽 번호' } });
  text(fr.text, { ...fr, x: fr.x - 120 }, { w: fr.w + 120, opts: { align: 'right', objectName: '해시태그' } });

  await pres.writeFile({ fileName: out });
  console.log(out);
})();
