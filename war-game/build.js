const pptxgen = require("pptxgenjs");
const { applyTheme } = require("/root/.claude/skills/synced/fa505535-630c-4ce5-ae48-5156f51f91f1_eea91c40-f353-4fc6-92cd-7e85035259ce/pptx/scripts/apply_theme.js");

const OUT = process.argv[2] || "deck.pptx";

const THEME = {
  name: "War Game HCC",
  headFontFace: "Malgun Gothic",
  bodyFontFace: "Malgun Gothic",
  colors: {
    dk1: "1B2430", lt1: "FFFFFF", dk2: "0E3B43", lt2: "EEF4F3",
    accent1: "0E7C7B", // STRIDE
    accent2: "B4532A", // Nivo/Ipi
    accent3: "E0A526", // Bridge / highlight
    accent4: "D9EEEC", // STRIDE tint
    accent5: "F7E3DA", // Nivo/Ipi tint
    accent6: "5F6B78", // muted
    hlink: "0E7C7B", folHlink: "5F6B78",
  },
};

// ---------- References (global keys; renumbered per slide) ----------
const REFS = {
  H1: "Abou-Alfa GK, et al. NEJM Evid. 2022;1(8):EVIDoa2100070.",
  H5: "Rimassa L, et al. J Hepatol. 2025;83(4):899-908.",
  HLT: "Data on file. HIMALAYA long-term follow-up (7-year OS). [학회/연도 기입 예정]",
  C9: "Yau T, Galle PR, et al. Lancet. 2025;405(10492):1851-1864.",
  C94: "Data on file. CheckMate 9DW 4-year follow-up. [학회/연도 기입 예정]",
  REF: "Kudo M, et al. Lancet. 2018;391(10126):1163-1173.",
  RWE: "Data on file. Lenvatinib vs sorafenib real-world evidence pooled analysis. [출처 기입 예정]",
  S22: "Kelley RK, et al. J Clin Oncol. 2021;39(27):2991-3001.",
  C40: "Yau T, et al. JAMA Oncol. 2020;6(11):e204564.",
  ALBI: "Data on file. HIMALAYA ALBI / Child-Pugh longitudinal exploratory analysis. [출처 기입 예정]",
  KB: "Koyama Y, Brenner DA. J Clin Invest. 2017;127(1):55-64.",
  KI: "Kisseleva T, Brenner DA. J Gastroenterol Hepatol. 2007;22(Suppl 1):S73-S78.",
  DM: "De Martin E, et al. Gut. 2025;74(7):1165-1177.",
  SA: "Sangro B, et al. J Hepatol. 2020;72(2):320-341.",
  DA: "D'Avola D, et al. J Hepatol. 2022;76(5):1185-1198.",
  CA: "Cabibbo G, et al. Dig Liver Dis. 2022;54(4):452-460.",
  DAM: "D'Amico G, et al. J Hepatol. 2006;44(1):217-231.",
};

// Per-slide reference numbering: call refCtx() per slide, then ctx.runs(text, baseOpts)
function refCtx() {
  const order = [];
  const num = (k) => {
    if (!REFS[k]) throw new Error("Unknown ref " + k);
    let i = order.indexOf(k);
    if (i < 0) { order.push(k); i = order.length - 1; }
    return i + 1;
  };
  // Turn "text{H1,C9} more" into runs with superscript numbers
  const runs = (text, opts = {}) => {
    const out = [];
    const re = /\{([A-Z0-9,]+)\}/g;
    let last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) out.push({ text: text.slice(last, m.index), options: { ...opts } });
      const nums = m[1].split(",").map(num);
      out.push({ text: compress(nums), options: { ...opts, superscript: true } });
      last = re.lastIndex;
    }
    if (last < text.length) out.push({ text: text.slice(last), options: { ...opts } });
    return out;
  };
  const footnote = () => order.map((k, i) => `${i + 1}. ${REFS[k]}`).join("  ");
  return { runs, footnote };
}
function compress(nums) {
  const s = [...new Set(nums)].sort((a, b) => a - b);
  const parts = [];
  for (let i = 0; i < s.length; i++) {
    let j = i;
    while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++;
    parts.push(j - i >= 2 ? `${s[i]}-${s[j]}` : s.slice(i, j + 1).join(","));
    i = j;
  }
  return parts.join(",");
}

// ---------- Content ----------
const ROUNDS = [
  {
    part: "Part 1 · Efficacy", round: 1, topic: "ORR",
    q: "“Nivo/Ipi는 ORR 36%로 STRIDE보다 response가 더 좋다”",
    a: [
      "높은 ORR은 Nivo/Ipi의 강점. 다만 trial 간 직접 비교보다 각 연구 내 상대적 효과를 봐야 함",
      "대조군 대비 ORR: STRIDE 약 4배{H1}, Nivo/Ipi 약 3배{C9}",
      "TTR 2.1 vs 2.2개월로 유사{H1,C9}",
    ],
    b: [
      "“몇 배”는 대조군 ORR에 따라 달라지는 숫자일 뿐",
      "실제 ORR 36% vs 20%, CR 8%, mDoR 34.3개월{C94,H1}",
      "TTR이 같다 = 같은 속도로 더 많은 환자가 반응",
    ],
    c: [
      "ORR은 대리 지표, 치료의 최종 목표는 OS",
      "ORR이 약 1.8배 높아도 OS HR은 0.76 vs 0.78로 유사{H5,C94}",
      "STRIDE 5년 OS 19.6% vs 9.4% — 장기 생존 tail 확인{H5}",
    ],
    bridge: "Response의 크기가 아니라, 생존의 길이로 말한다",
    notes: `[Round 1 · ORR | 약 2분]
고객 objection: "Nivo/Ipi는 ORR 36%로 STRIDE보다 response가 더 좋다."

① STRIDE 1차 대응
높은 ORR은 Nivo/Ipi의 분명한 강점입니다. 다만 서로 다른 임상시험의 ORR을 직접 비교하기보다 각 연구 내 상대적 효과와 장기 outcome을 함께 봐야 합니다. STRIDE는 sorafenib 대비 약 4배, Nivo/Ipi는 TKI 대비 약 3배의 ORR을 보였고, TTR은 STRIDE 2.1개월, Nivo/Ipi 2.2개월로 유사했습니다. 따라서 높은 ORR뿐 아니라 장기 생존, safety, 환자 적합성을 함께 고려해야 합니다.

② 예상되는 Nivo/Ipi 반박
"몇 배"는 대조군 ORR이 낮으면 커지는 숫자일 뿐입니다. 실제 ORR은 36% 대 20%이고, CR 8%, median DoR 34.3개월로 반응의 깊이와 지속성이 다릅니다. TTR이 같다는 건 같은 속도로 더 많은 환자가 반응한다는 뜻입니다.

③ STRIDE 재반박
ORR은 대리 지표이고, 치료의 최종 목표는 OS입니다. ORR이 약 1.8배 높았지만 각 연구 내 OS HR은 STRIDE 0.76, Nivo/Ipi 0.78로 유사했습니다. 높은 ORR이 장기 생존 우위로 이어진다는 근거는 아직 없습니다. 반면 STRIDE는 5년 OS 19.6% 대 9.4%로 장기 생존 tail을 확인했습니다.

Bridge: Response의 크기가 아니라, 생존의 길이로 말합니다.`,
  },
  {
    part: "Part 1 · Efficacy", round: 2, topic: "Median OS",
    q: "“Nivo/Ipi의 mOS 23.7개월이 STRIDE 16.4개월보다 길다”",
    a: [
      "대조군 상이: CM9DW lenvatinib/sorafenib vs HIMALAYA sorafenib{C9,H1}",
      "환자 특성 상이: BCLC ≤B 약 27% vs 약 20%{C9,H1}",
      "연구 내 HR: STRIDE 0.76 vs Nivo/Ipi 0.78로 유사{H5,C94}",
    ],
    b: [
      "STRIDE의 장기 데이터는 인정",
      "Nivo/Ipi도 4년 OS 31%로 survival benefit 지속성 확인{C94}",
      "ORR 36%, CR 8%, mDoR 34.3개월까지 함께 확보{C94}",
    ],
    c: [
      "대조군 mOS: 9DW 20.6개월 vs HIMALAYA 13.8개월 — 약 7개월 차이{C9,H1}",
      "REFLECT에서 lenvatinib과 sorafenib의 OS 차이는 1.3개월뿐{REF}",
      "23.7개월은 약효보다 환자군 예후 차이를 반영",
      "STRIDE는 5년 이후까지 survival tail 확인{H5,HLT}",
    ],
    bridge: "숫자보다 대조군을 보라 — 가장 긴 생존 추적은 STRIDE",
    notes: `[Round 2 · Median OS | 약 2분]
고객 objection: "Nivo/Ipi의 median OS가 23.7개월로 STRIDE 16.4개월보다 길다."

① STRIDE 1차 대응
두 median OS를 직접 비교하기는 어렵습니다. CM9DW는 lenvatinib 또는 sorafenib, HIMALAYA는 sorafenib을 대조군으로 사용했고, 연구 시점과 환자 특성도 달랐습니다(BCLC ≤B 비율: Nivo/Ipi 약 27%, STRIDE 약 20%). 각 연구 내 상대적 치료 효과는 STRIDE HR 0.76, Nivo/Ipi HR 0.78로 유사했습니다.

② 예상되는 Nivo/Ipi 반박
STRIDE의 mature long-term evidence는 인정합니다. 그러나 Nivo/Ipi 역시 4년 추적에서 median OS 23.7개월, 4년 OS 31%로 survival benefit의 지속성을 확인했고, ORR 36%, CR 8%, median DoR 34.3개월의 response와 durability도 함께 보여줬습니다.

③ STRIDE 재반박
9DW 대조군의 median OS는 20.6개월로, HIMALAYA sorafenib군 13.8개월보다 약 7개월 깁니다. 그런데 REFLECT에서 lenvatinib과 sorafenib의 OS 차이는 1.3개월에 불과했습니다. 그렇다면 7개월의 차이는 대조군 약제가 아니라 9DW 환자군의 예후가 원래 좋았기 때문입니다. 즉 23.7개월이라는 숫자 자체가 환자군 차이를 반영합니다. 그리고 STRIDE는 5년을 넘어 장기 추적에서도 survival tail 유지를 확인했습니다.

Bridge: 숫자보다 대조군을 보십시오. 가장 긴 생존 추적은 STRIDE입니다.`,
  },
  {
    part: "Part 1 · Efficacy", round: 3, topic: "Control arm",
    q: "“CM9DW는 85%가 lenvatinib인 강한 대조군을 이겼으니 근거가 더 강하다”",
    a: [
      "REFLECT: lenvatinib은 sorafenib 대비 OS 비열등성만 입증 (13.6 vs 12.3개월, HR 0.92, 95% CI 0.79–1.06){REF}",
      "RWE 통합분석 결과는 일관되지 않음{RWE}",
      "별개 trial — 각 연구 내 randomized comparison으로 해석",
    ],
    b: [
      "REFLECT에서 lenvatinib은 PFS 7.4 vs 3.7개월로 우월{REF}",
      "현재 진료의 표준 TKI는 lenvatinib",
      "더 현실적이고 더 강한 대조군을 이긴 결과",
    ],
    c: [
      "REFLECT의 교훈: PFS·ORR 우월 ≠ OS 우월{REF}",
      "대조군을 이긴 정도(HR)는 0.76 vs 0.78로 동등{H5,C94}",
      "“강한 대조군” 논리는 결국 Round 1의 ORR 논리와 같은 구조",
    ],
    bridge: "대조군이 더 강했다면 HR이 말해줬을 것 — HR은 동등하다",
    notes: `[Round 3 · Control arm | 약 2분]
고객 objection: "CM9DW는 85%가 lenvatinib인 강한 control arm을 이겼으니 STRIDE보다 근거가 강하다."

① STRIDE 1차 대응
Lenvatinib이 active TKI라는 점은 중요합니다. 다만 REFLECT에서 lenvatinib은 sorafenib 대비 OS noninferiority를 입증했지만 superiority를 입증한 것은 아닙니다(median OS 13.6개월 vs 12.3개월, HR 0.92, 95% CI 0.79–1.06). 일부 real-world evidence 통합분석에서는 OS 개선이 보고됐으나 결과가 일관되지는 않습니다. CM9DW와 HIMALAYA는 서로 다른 환자군과 control regimen을 사용한 별개의 randomized trial이므로, 각 연구 내 randomized comparison과 전체 evidence를 기반으로 해석하는 것이 적절합니다.

② 예상되는 Nivo/Ipi 반박
REFLECT는 noninferiority였지만 lenvatinib은 PFS 7.4개월 대 3.7개월로 sorafenib보다 우월했습니다. 지금 실제 진료의 표준 TKI도 lenvatinib입니다. 더 현실적이고 더 강한 대조군을 이긴 결과입니다.

③ STRIDE 재반박
바로 그 점이 REFLECT의 교훈입니다. PFS와 ORR에서 이겨도 OS 우월로 이어지지 않았습니다. 대조군을 얼마나 이겼는지를 보려면 HR을 봐야 하는데, STRIDE 0.76, Nivo/Ipi 0.78로 같은 수준입니다. "강한 대조군"이라는 논리는 결국 Round 1의 "ORR이 높다"는 논리와 같은 구조입니다.

Bridge: 대조군이 더 강했다면 HR이 말해줬을 것입니다. HR은 동등합니다.`,
  },
  {
    part: "Part 2 · 간기능 & Safety", round: 4, topic: "간기능",
    q: "“CM9DW도 간기능 지표가 양호했으니, 간기능 때문에 STRIDE를 고를 필요는 없다”",
    a: [
      "평균보다 개별 환자의 간 관련 사건이 중요 — 간기능 악화 시 2L 진입 제한",
      "Hepatitis: STRIDE 7.5%{H1} vs Nivo/Ipi 약 18% (가장 흔한 irAE){C9}",
      "STRIDE 투여 중 ALBI·Child-Pugh 안정 유지{ALBI}",
    ],
    b: [
      "9DW hepatitis는 대부분 steroid로 관리됨",
      "영구적 간기능 악화의 근거는 없음",
      "7.5%와 18%는 정의가 달라 나란히 놓을 수 없음",
    ],
    c: [
      "HCC 대부분은 섬유화·간경변이 진행된 간이 배경{DM}",
      "간세포 손상·염증 → hepatic stellate cell 활성화 → 섬유화 진행{KB,KI}",
      "ICI hepatitis는 기저 간질환에서 decompensation 위험{DM,SA}",
      "Decompensation = 가장 강력한 예후 인자{DAM}, 후속 치료 기회 상실{DA,CA}",
    ],
    bridge: "간기능 보존 = Treatment journey 보존",
    notes: `[Round 4 · 간기능 | 약 2분]
고객 objection: "CM9DW에서도 간기능 지표는 전반적으로 양호했으니, 간기능을 이유로 STRIDE를 선택할 필요는 없다."

① STRIDE 1차 대응
시험 전체 수준에서 간기능 지표가 양호했다는 점은 인정합니다. 다만 HCC에서는 평균값보다 개별 환자에게 간 관련 사건이 생겼을 때 어떤 일이 벌어지는지가 중요합니다. 1L 치료 중 간기능이 악화되면 2차 치료로 넘어가지 못할 수 있어, 간기능 보존은 safety 항목을 넘어 전체 treatment journey와 장기 생존에 영향을 주는 요소입니다. HIMALAYA에서 STRIDE의 immune-mediated hepatitis는 7.5%, CM9DW에서 Nivo/Ipi는 hepatitis가 가장 흔한 irAE로 약 18%였습니다. HIMALAYA 탐색적 분석에서 STRIDE 투여 중 평균 ALBI score와 Child-Pugh score는 시간에 따라 안정적으로 유지됐습니다.

② 예상되는 Nivo/Ipi 반박
9DW에서 hepatitis는 대부분 steroid로 관리됐고, 간기능이 영구적으로 나빠졌다는 근거는 없습니다. 7.5%와 18%는 정의가 다른 지표라 나란히 놓을 수 없습니다.

③ STRIDE 재반박
"관리할 수 있다"와 "간에 영향이 없다"는 다른 말입니다. HCC 환자 대부분은 이미 섬유화나 간경변이 진행된 간을 갖고 있습니다. 간세포가 손상되면서 생기는 염증은 hepatic stellate cell을 활성화하고, 이것이 섬유화를 진행시키는 핵심 기전입니다. ICI에 의한 hepatitis는 이런 간에 염증성 손상을 더하고, 기저 간질환이 있는 HCC 환자에서는 간기능 악화, 즉 decompensation으로 이어질 수 있습니다. Decompensation은 간경변 환자의 생존을 가르는 가장 강력한 예후 인자이며, 심하지 않은 간 손상만으로도 다음 치료를 받을 기회를 잃을 수 있습니다. 그래서 hepatitis 발생률을 낮추는 것은 safety 문제를 넘어 전체 treatment journey를 지키는 문제입니다.

Bridge: 간기능 보존이 곧 treatment journey 보존입니다.`,
  },
  {
    part: "Part 2 · 간기능 & Safety", round: 5, topic: "Toxicity 관리",
    q: "“Nivo/Ipi toxicity도 초반만 잘 관리하면 충분히 manageable하다”",
    a: [
      "Monitoring 중요성엔 동의 — 실제 toxicity burden도 함께 봐야",
      "9DW 4년: TRAE 83%, G3/4 41%, TRAE 중단 18% (imAE 중단 13%){C94}",
      "STRIDE는 CTLA-4 1회 — 가장 흔한 irAE는 관리 용이한 hypothyroidism 약 10.8%{H1}",
    ],
    b: [
      "그런 toxicity에도 ORR 36%, mDoR 34.3개월, mOS 23.7개월{C94}",
      "Patient selection과 early monitoring을 전제로 전체 benefit/risk를 평가해야",
    ],
    c: [
      "“Patient selection 전제” = 쓸 수 있는 환자가 좁다는 뜻",
      "급여 이후 real-world: 고령·간기능 경계선·동반질환 환자 증가",
      "Ipi 4회 동안 3주마다 고위험 monitoring vs STRIDE는 1회 priming 후 durvalumab 유지",
      "1L 독성 중단 → 2L 진입 차질{DA,CA}",
    ],
    bridge: "관리할 수 있는 독성보다, 관리할 필요가 적은 구조",
    notes: `[Round 5 · Toxicity 관리 | 약 2분]
고객 objection: "Nivo/Ipi toxicity도 초반만 잘 관리하면 충분히 manageable하다."

① STRIDE 1차 대응
적절한 monitoring과 management가 중요하다는 점에는 동의합니다. 동시에 regimen 선택 시 실제 toxicity burden도 함께 고려해야 합니다. CheckMate 9DW 4년 추적 분석에서 Nivo/Ipi의 치료 관련 이상반응은 83%, Grade 3/4 TRAE는 41%, 치료 관련 이상반응으로 인한 중단은 18%(면역매개 이상반응으로 인한 중단 13%)였습니다. STRIDE는 CTLA-4를 1회만 투여하는 구조로 반복적인 CTLA-4 exposure가 필요하지 않습니다. STRIDE군에서 가장 많이 발생한 irAE는 관리가 용이한 hypothyroidism으로 약 10.8%였습니다.

② 예상되는 Nivo/Ipi 반박
Toxicity와 적극적인 irAE management 필요성은 중요한 고려사항입니다. 그러나 이러한 safety profile 하에서도 ORR 36%, median DoR 34.3개월, median OS 23.7개월의 efficacy가 확인됐습니다. 따라서 적절한 patient selection과 early monitoring을 전제로 toxicity만이 아니라 전체 benefit/risk를 함께 평가해야 합니다.

③ STRIDE 재반박
"Patient selection을 전제로"라는 말은 쓸 수 있는 환자가 좁다는 뜻입니다. 급여가 적용되면 임상시험보다 고령이고, 간기능이 경계선에 있고, 동반질환이 있는 환자가 많이 들어옵니다. 이런 환자에게 Nivo/Ipi는 Ipi를 4회 맞는 동안 3주마다 고위험 모니터링이 필요합니다. STRIDE는 1회 priming 후 durvalumab으로 유지합니다. 1L에서 독성 때문에 치료를 중단하면 2L 진입에도 차질이 생깁니다.

Bridge: 관리할 수 있는 독성보다, 관리할 필요가 적은 구조가 낫습니다.`,
  },
  {
    part: "Part 2 · 간기능 & Safety", round: 6, topic: "초기 OS curve",
    q: "“Nivo/Ipi efficacy가 좋으니 toxicity가 있더라도 1L에서 먼저 쓰겠다”",
    a: [
      "Efficacy와 safety는 함께 — 기저 간질환·동반질환 고려",
      "9DW: 초기 약 12개월 OS curve가 대조군 아래 위치 후 교차{C9}",
      "Early period의 환자 선별과 monitoring이 중요",
    ],
    b: [
      "초기 8~12개월 사망의 약 25%는 치료와 무관한 이상사례{C94}",
      "전체로는 mOS 23.7 vs 20.6개월, HR 0.78{C94}",
      "4년 OS 31% vs 22%로 benefit 유지{C94}",
    ],
    c: [
      "치료 무관 25% → 나머지 75%는 질병 진행 또는 치료 관련 사망",
      "첫 1년은 환자·의사에게 가장 중요한 구간",
      "“첫 1년의 위험”을 감당할 환자를 고를 기준이 아직 없음",
    ],
    bridge: "첫 1년을 지켜야 장기 생존도 있다",
    notes: `[Round 6 · 초기 OS curve | 약 2분]
고객 objection: "Nivo/Ipi의 efficacy가 좋으니 toxicity가 있더라도 1L에서 먼저 쓰겠다."

① STRIDE 1차 대응
Efficacy와 safety는 함께 평가해야 합니다. 특히 HCC 환자는 underlying liver disease와 comorbidity를 함께 가지고 있어 치료의 benefit과 risk를 동시에 고려해야 합니다. 또한 CM9DW에서는 초기 약 12개월 동안 OS curve가 control arm 아래에 위치한 후 교차하는 양상이 관찰됐습니다. 따라서 전체 OS 결과뿐 아니라 early treatment period의 환자 selection과 monitoring도 중요한 consideration입니다.

② 예상되는 Nivo/Ipi 반박
초기 OS curve pattern은 고려해야 합니다. 다만 간암 환자는 대부분 기저 간질환을 동반하고 있어 초기 사망에는 간질환 관련 사건이 영향을 미쳤을 수 있습니다. 실제로 Nivo/Ipi 군에서 첫 8~12개월 내 사망한 환자의 약 25%는 치료와 관련 없는 이상사례였습니다. 그럼에도 전체 follow-up에서는 median OS 23.7개월 대 20.6개월, HR 0.78로 OS benefit을 입증했고, 4년 OS도 31% 대 22%로 benefit이 유지됐습니다.

③ STRIDE 재반박
치료와 무관한 사망이 25%라면, 나머지 75%는 질병 진행이나 치료와 관련된 사망입니다. 첫 1년은 환자와 의사에게 가장 중요한 시기입니다. 실제 진료에서는 "나중의 이득"보다 "첫 1년의 위험"을 누가 감당할 수 있는지를 골라내야 하는데, 그 기준이 아직 없습니다.
(Tip: 이 슬라이드 뒤에 HIMALAYA KM curve를 추가해 초기 구간을 시각적으로 대비하면 효과적입니다.)

Bridge: 첫 1년을 지켜야 장기 생존도 있습니다.`,
  },
  {
    part: "Part 3 · Dosing", round: 7, topic: "CTLA-4 투여 횟수",
    q: "“Ipi를 4회 투여하니까 CTLA-4 효과가 더 강력한 것 아닌가?”",
    a: [
      "CTLA-4 투여 횟수가 많다고 efficacy가 높은 것은 아님",
      "Study 22: T300 1회가 T75 4회보다 더 높은 efficacy{S22}",
      "Single priming dose로 충분한 T cell activation·expansion",
    ],
    b: [
      "Ipi 4회 regimen은 글로벌 3상 CM9DW에서 검증{C9}",
      "ORR 36%, CR 8%, mDoR 34.3개월{C94}",
      "Study 22는 2상, tremelimumab 데이터 — Ipi에 적용 불가",
    ],
    c: [
      "핵심은 CTLA-4 priming 원리: 총 300 mg 동일, 결과는 상이{S22}",
      "T300×1: ORR 24.0%, mOS 18.7개월 vs T75×4: ORR 9.5%, mOS 11.3개월{S22}",
      "이를 근거로 3상 HIMALAYA에서 OS 입증{H1}",
      "반복 노출은 독성↑: G3/4 TRAE 25.8% vs 41%, 중단 8.2% vs 18%{H1,C94}",
    ],
    bridge: "한 번의 priming, 3상으로 입증된 생존",
    notes: `[Round 7 · CTLA-4 투여 횟수 | 약 2분]
고객 objection: "Ipi를 4회 투여하니까 CTLA-4 효과가 더 강력한 것 아닌가?"

① STRIDE 1차 대응
CTLA-4 투여 횟수가 더 많다고 더 높은 efficacy를 의미하지는 않습니다. Study 22에서 tremelimumab 300 mg을 1회 투여한 STRIDE는 tremelimumab 75 mg을 4회 투여한 regimen보다 더 높은 efficacy를 보였습니다. 이는 single priming dose만으로도 효과적인 T cell activation과 expansion이 가능하며, 추가 CTLA-4 투여가 반드시 필요한 것은 아니라는 근거입니다.

② 예상되는 Nivo/Ipi 반박
Ipi 3 mg/kg + Nivo 1 mg/kg, 3주 간격 최대 4회 induction은 글로벌 3상 CheckMate 9DW에서 평가된 regimen입니다. 이 regimen에서 ORR 36%, CR 8%, median DoR 34.3개월의 높은 response와 durability가 확인됐습니다. Study 22는 2상이고 tremelimumab 데이터라 Ipi에 그대로 적용할 수 없습니다.

③ STRIDE 재반박
핵심은 약제 이름이 아니라 CTLA-4 priming 원리입니다. Study 22에서 두 arm은 총 투여량이 300 mg으로 같았는데도 결과가 달랐습니다. 고용량 1회 priming arm은 ORR 24.0%, median OS 18.7개월이었고, 4회 분할 arm은 ORR 9.5%, median OS 11.3개월이었습니다. 이 결과를 바탕으로 설계한 3상 HIMALAYA에서 OS benefit을 입증했습니다. CTLA-4를 반복 투여하면 효과보다 독성이 늘어납니다. Grade 3/4 TRAE는 STRIDE 25.8% vs 9DW 41%, TRAE로 인한 중단은 8.2% vs 18%였습니다.

Bridge: 한 번의 priming, 3상으로 입증된 생존입니다.`,
  },
  {
    part: "Part 3 · Dosing", round: 8, topic: "Ipi 감량",
    q: "“Ipi toxicity가 걱정되면 dose를 줄이거나 4회를 다 투여하지 않으면 된다”",
    a: [
      "9DW 입증 regimen: Nivo 1 + Ipi 3 mg/kg, q3w 최대 4회{C9}",
      "Ipi 투여 중앙값 4회, 90%(300/332)가 2회 이상 투여{C9}",
      "CM040 Ipi 3 vs 1 mg/kg: ORR 32% vs 27%, 24개월 OS 48% vs 30%{C40}",
    ],
    b: [
      "9DW에서도 모든 환자가 4회를 다 맞은 것은 아님",
      "그 환자들을 포함해 OS benefit 입증 → 실제 진료에서 유연한 투여 가능{C9}",
    ],
    c: [
      "부분 투여 환자의 efficacy는 별도로 입증된 적 없음 (사후 분석은 immortal time bias)",
      "Ipi 감량 시 효과 감소: 24개월 OS 48% → 30%{C40}",
      "Nivo/Ipi의 딜레마: 독성↓ = 효과↓, 효과 유지 = 독성 감수",
      "STRIDE는 1회 투여 — 딜레마가 처음부터 없음",
    ],
    bridge: "줄이면 잃는다 — STRIDE는 줄일 필요가 없다",
    notes: `[Round 8 · Ipi 감량 | 약 2분]
고객 objection: "Ipi toxicity가 걱정되면 dose를 줄이거나 4회를 다 투여하지 않으면 된다."

① STRIDE 1차 대응
CM9DW에서 efficacy가 입증된 regimen은 Nivo 1 mg/kg + Ipi 3 mg/kg을 3주 간격 최대 4회 투여한 regimen입니다. Ipilimumab 투여 횟수의 중앙값은 4회였으며, 실제 치료를 받은 환자 332명 중 300명(90%)이 2회 이상 투여받았습니다. 1/2상 CheckMate 040에서 Ipi 고용량(Nivo 1 + Ipi 3 mg/kg)과 저용량(Nivo 3 + Ipi 1 mg/kg) regimen의 ORR은 32% vs 27%, 24개월 OS rate은 48% vs 30%로, dose 감소가 CM9DW와 동일한 efficacy를 유지한다는 근거는 없습니다.

② 예상되는 Nivo/Ipi 반박
9DW에서도 모든 환자가 4회를 다 맞은 것은 아닙니다. 그 환자들까지 포함해서 OS benefit을 입증했으니, 실제 진료에서 유연하게 투여해도 됩니다.

③ STRIDE 재반박
일부만 투여받은 환자의 efficacy는 따로 입증된 적이 없습니다. 이를 사후 분석하면 오래 산 환자가 더 많이 투여받는 immortal time bias가 생깁니다. CM040에서 Ipi를 1 mg/kg로 낮췄을 때 24개월 OS는 48%에서 30%로 떨어졌습니다. 결국 Nivo/Ipi는 독성을 줄이면 효과도 줄고, 효과를 지키려면 독성을 감수해야 하는 딜레마를 안고 있습니다. STRIDE는 1회 투여라 이 딜레마가 처음부터 없습니다.

Bridge: 줄이면 잃습니다. STRIDE는 줄일 필요가 없습니다.`,
  },
];

// ---------- Deck ----------
const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5
pres.title = "War Game: Nivo/Ipi Objection Handling";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const W = 13.333;

const FOOTER = (dark) => [
  { text: { text: "STRIDE War Game · Internal Training Only", options: { x: 0.5, y: 7.12, w: 6, h: 0.25, fontSize: 9, color: dark ? C.background2 : C.accent6, margin: 0 } } },
];

pres.defineSlideMaster({
  title: "TITLE_DARK",
  background: { color: THEME.colors.dk2 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.8, y: 2.3, w: 11.7, h: 1.6, fontSize: 40, bold: true, color: C.background1, valign: "top", align: "left", margin: 0 }, text: "" } },
    { placeholder: { options: { name: "body", type: "body", x: 0.8, y: 4.1, w: 11.7, h: 1.2, fontSize: 18, color: C.background2, valign: "top", margin: 0 }, text: "" } },
    ...FOOTER(true),
  ],
});
pres.defineSlideMaster({
  title: "CONTENT",
  background: { color: THEME.colors.lt1 },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.35, w: 12.33, h: 0.75, fontSize: 30, bold: true, color: C.text1, valign: "middle", align: "left", margin: 0 }, text: "" } },
    ...FOOTER(false),
  ],
  slideNumber: { x: 12.33, y: 7.12, w: 0.5, h: 0.25, fontSize: 9, color: THEME.colors.accent6, align: "right" },
});
pres.defineSlideMaster({
  title: "ROUND",
  background: { color: THEME.colors.lt1 },
  objects: [
    { placeholder: { options: { name: "label", type: "body", x: 0.5, y: 0.3, w: 12.33, h: 0.32, fontSize: 13, bold: true, color: C.accent1, margin: 0, valign: "middle" }, text: "" } },
    { placeholder: { options: { name: "title", type: "title", x: 0.5, y: 0.66, w: 12.33, h: 0.9, fontSize: 24, bold: true, color: C.text1, valign: "middle", align: "left", margin: 0 }, text: "" } },
    ...FOOTER(false),
  ],
  slideNumber: { x: 12.33, y: 7.12, w: 0.5, h: 0.25, fontSize: 9, color: THEME.colors.accent6, align: "right" },
});

function footnoteBox(slide, ctx, y = 6.52, h = 0.55) {
  const t = ctx.footnote();
  if (!t) return;
  slide.addText(t, { x: 0.5, y, w: 12.33, h, fontSize: 9, color: C.accent6, valign: "top", margin: 0, isTextBox: true, objectName: "References" });
}

function bulletRuns(ctx, items, color, fontSize = 14) {
  const runs = [];
  items.forEach((it, i) => {
    const rs = ctx.runs(it, { color, fontSize });
    Object.assign(rs[0].options, { bullet: { indent: 14 }, paraSpaceAfter: 6 });
    if (i < items.length - 1) rs[rs.length - 1].options.breakLine = true;
    runs.push(...rs);
  });
  return runs;
}

// 1. Title
pres.addSection({ title: "Opening" });
{
  const s = pres.addSlide({ masterName: "TITLE_DARK", sectionTitle: "Opening" });
  s.addText("War Game\n1L HCC Nivo/Ipi Objection Handling", { placeholder: "title" });
  s.addText("STRIDE Sales Training · 급여 진입 대비 1st-line 경쟁 대응", { placeholder: "body" });
  // motif: three round chips
  const chips = [["STRIDE 대응", C.accent1], ["Nivo/Ipi 반박", C.accent2], ["STRIDE 재반박", C.accent1]];
  chips.forEach(([t, col], i) => {
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.8 + i * 2.55, y: 5.4, w: 2.3, h: 0.5, fill: { color: col }, rectRadius: 0.25, line: { type: "none" }, objectName: `Chip ${i + 1}` });
    s.addText(t, { x: 0.8 + i * 2.55, y: 5.4, w: 2.3, h: 0.5, fontSize: 14, bold: true, color: C.background1, align: "center", valign: "middle", margin: 0, isTextBox: true });
    if (i < 2) s.addText("→", { x: 3.1 + i * 2.55, y: 5.4, w: 0.25, h: 0.5, fontSize: 16, color: C.background2, align: "center", valign: "middle", margin: 0, isTextBox: true });
  });
  s.addNotes("오늘 20분 동안 급여 진입을 앞둔 Nivo/Ipi에 대해 1st-line에서 마주칠 objection 8개를 War Game 형식으로 연습합니다. 각 라운드는 STRIDE 대응 → Nivo/Ipi 반박 → STRIDE 재반박의 3단계로 진행됩니다.");
}

// 2. Objectives + agenda
{
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Opening" });
  s.addText("오늘의 목표와 진행 (20분)", { placeholder: "title" });
  const goals = [
    ["1", "Nivo/Ipi의 핵심 메시지를 이해한다"],
    ["2", "8개 objection에 대해 3단계로 대응한다"],
    ["3", "모든 대응을 STRIDE 가치로 연결(Bridge)한다"],
  ];
  goals.forEach(([n, t], i) => {
    const y = 1.55 + i * 1.3;
    s.addShape(pres.shapes.OVAL, { x: 0.5, y, w: 0.8, h: 0.8, fill: { color: C.accent1 }, line: { type: "none" }, objectName: `Goal ${n} circle` });
    s.addText(n, { x: 0.5, y, w: 0.8, h: 0.8, fontSize: 24, bold: true, color: C.background1, align: "center", valign: "middle", margin: 0, isTextBox: true });
    s.addText(t, { x: 1.5, y, w: 4.6, h: 0.8, fontSize: 17, bold: true, color: C.text1, valign: "middle", margin: 0, isTextBox: true });
  });
  const agenda = [
    ["0–3분", "Opening · Landscape", "CM9DW vs HIMALAYA 한눈에 보기"],
    ["3–9분", "Part 1 · Efficacy", "Round 1–3: ORR · mOS · 대조군"],
    ["9–15분", "Part 2 · 간기능 & Safety", "Round 4–6: 간기능 · 독성 관리 · 초기 OS curve"],
    ["15–19분", "Part 3 · Dosing", "Round 7–8: CTLA-4 투여 횟수 · Ipi 감량"],
    ["19–20분", "Wrap-up", "한 줄 답변 정리 · Key takeaways"],
  ];
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 6.5, y: 1.4, w: 6.33, h: 5.3, fill: { color: C.background2 }, line: { type: "none" }, rectRadius: 0.15, objectName: "Agenda card" });
  agenda.forEach(([t, h, d], i) => {
    const y = 1.6 + i * 1.0;
    s.addText(t, { x: 6.75, y, w: 1.3, h: 0.8, fontSize: 14, bold: true, color: C.accent1, valign: "top", margin: 0, isTextBox: true });
    s.addText([
      { text: h, options: { fontSize: 15, bold: true, color: C.text1, breakLine: true } },
      { text: d, options: { fontSize: 13, color: C.accent6 } },
    ], { x: 8.1, y, w: 4.5, h: 0.85, valign: "top", margin: 0, isTextBox: true });
  });
  s.addNotes("교육 목표 3가지와 20분 진행 순서입니다. 라운드당 약 2분: 강사가 고객 objection을 읽고, STRIDE 1차 대응 → 경쟁사 반박 → 재반박 순으로 짚습니다.");
}

// 3. Landscape table
pres.addSection({ title: "Landscape" });
{
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Landscape" });
  const ctx = refCtx();
  s.addText("Landscape: HIMALAYA vs CheckMate 9DW", { placeholder: "title" });
  const hdr = (t, col) => ({ text: t, options: { bold: true, color: THEME.colors.lt1, fill: { color: col }, align: "center", fontSize: 15 } });
  const cell = (t, o = {}) => ({ text: ctx.runs(t, { fontSize: 14 }), options: { fontSize: 14, color: THEME.colors.dk1, ...o } });
  const lab = (t) => ({ text: t, options: { bold: true, fontSize: 14, color: THEME.colors.dk1, fill: { color: THEME.colors.lt2 } } });
  const rows = [
    [hdr("항목", THEME.colors.dk2), hdr("STRIDE (HIMALAYA)", THEME.colors.accent1), hdr("Nivo/Ipi (CheckMate 9DW)", THEME.colors.accent2)],
    [lab("디자인 / 대조군"), cell("3상 · sorafenib{H1}"), cell("3상 open-label · lenvatinib(약 85%) 또는 sorafenib{C9}")],
    [lab("BCLC ≤B 비율"), cell("약 20%{H1}"), cell("약 27%{C9}")],
    [lab("Median OS (vs 대조군)"), cell("16.4 vs 13.8개월{H1}"), cell("23.7 vs 20.6개월{C94}")],
    [lab("OS HR"), cell("0.76 (5년){H5}"), cell("0.78 (4년){C94}")],
    [lab("장기 OS"), cell("5년 19.6% vs 9.4%{H5}"), cell("4년 31% vs 22%{C94}")],
    [lab("ORR"), cell("20.1% vs 5.1%{H1}"), cell("36% vs 13%{C9}")],
    [lab("G3/4 TRAE · TRAE 중단"), cell("25.8% · 8.2%{H1}"), cell("41% · 18%{C94}")],
    [lab("Hepatitis"), cell("7.5% (immune-mediated){H1}"), cell("약 18% (가장 흔한 irAE){C9}")],
    [lab("CTLA-4 투여"), cell("Tremelimumab 300 mg × 1회"), cell("Ipilimumab 3 mg/kg × 최대 4회")],
  ];
  s.addTable(rows, { x: 0.5, y: 1.3, w: 12.33, colW: [3.0, 4.4, 4.93], rowH: 0.5, border: { type: "solid", pt: 0.75, color: "D5DCE2" }, valign: "middle", margin: [0.04, 0.1, 0.04, 0.1], objectName: "Landscape table" });
  footnoteBox(s, ctx, 6.5, 0.6);
  s.addNotes("두 연구의 주요 지표를 한 장에 정리했습니다. 각 라운드에서 이 수치들이 어떻게 쓰이는지 연결해서 보시면 됩니다. 대조군과 환자 특성이 다르다는 점(대조군 mOS 13.8 vs 20.6개월, BCLC ≤B 20% vs 27%)이 이후 여러 라운드의 핵심 논리입니다.");
}

// 4. Round format
{
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Landscape" });
  s.addText("War Game 라운드 진행 방식", { placeholder: "title" });
  const steps = [
    ["고객 objection", "Nivo/Ipi를 선호하는 고객의 질문", C.text2, C.background1],
    ["① STRIDE 대응", "인정 → 관점 전환 → 근거", C.accent1, C.background1],
    ["② Nivo/Ipi 반박", "경쟁사가 되받아칠 논리", C.accent2, C.background1],
    ["③ STRIDE 재반박", "반박을 무력화하는 한 수", C.accent1, C.background1],
    ["Bridge", "STRIDE 핵심 가치로 연결", C.accent3, C.text1],
  ];
  const bw = 2.25, gap = 0.27;
  steps.forEach(([h, d, fill, fc], i) => {
    const x = 0.5 + i * (bw + gap);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 2.1, w: bw, h: 2.2, fill: { color: fill }, line: { type: "none" }, rectRadius: 0.12, objectName: `Step ${i + 1}` });
    s.addText([
      { text: h, options: { fontSize: 18, bold: true, color: fc, breakLine: true } },
      { text: d, options: { fontSize: 14, color: fc } },
    ], { x: x + 0.15, y: 2.25, w: bw - 0.3, h: 1.9, valign: "middle", align: "center", margin: 0, isTextBox: true });
    if (i < steps.length - 1) s.addText("→", { x: x + bw, y: 2.1, w: gap, h: 2.2, fontSize: 18, bold: true, color: C.accent6, align: "center", valign: "middle", margin: 0, isTextBox: true });
  });
  s.addText([
    { text: "슬라이드 읽는 법  ", options: { bold: true, color: C.accent1 } },
    { text: "각 라운드는 한 장. 왼쪽에서 오른쪽으로 대화가 오가고, 하단 Bridge 한 줄로 마무리합니다. 상세 스크립트는 발표자 노트에 있습니다." },
  ], { x: 0.5, y: 4.9, w: 12.33, h: 0.9, fontSize: 15, color: C.text1, margin: 0, valign: "top", isTextBox: true });
  s.addNotes("모든 라운드는 같은 구조입니다. 고객 objection을 들으면 먼저 인정하고, 관점을 전환하고, 근거를 제시합니다. 경쟁사 담당자가 어떻게 반박할지 미리 알고, 그 반박에 대한 재반박까지 준비하는 것이 War Game의 목적입니다. 마지막은 항상 STRIDE 가치로 Bridge합니다.");
}

// Round slides
let currentPart = null;
ROUNDS.forEach((r) => {
  if (r.part !== currentPart) { pres.addSection({ title: r.part }); currentPart = r.part; }
  const s = pres.addSlide({ masterName: "ROUND", sectionTitle: r.part });
  const ctx = refCtx();
  s.addText(`${r.part}  ·  Round ${r.round}  ·  ${r.topic}`, { placeholder: "label" });
  s.addText(r.q, { placeholder: "title" });

  const cardW = 3.93, gap = 0.27, y = 1.7, h = 4.05;
  const cards = [
    { head: "① STRIDE 대응", items: r.a, fill: C.accent4, headCol: C.accent1, txt: C.text1 },
    { head: "② Nivo/Ipi 반박", items: r.b, fill: C.accent5, headCol: C.accent2, txt: C.text1 },
    { head: "③ STRIDE 재반박", items: r.c, fill: C.accent1, headCol: C.background1, txt: C.background1 },
  ];
  cards.forEach((c, i) => {
    const x = 0.5 + i * (cardW + gap);
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: cardW, h, fill: { color: c.fill }, line: { type: "none" }, rectRadius: 0.12, objectName: c.head });
    s.addText(c.head, { x: x + 0.22, y: y + 0.18, w: cardW - 0.44, h: 0.4, fontSize: 17, bold: true, color: c.headCol, margin: 0, valign: "middle", isTextBox: true });
    s.addText(bulletRuns(ctx, c.items, c.txt, 14), { x: x + 0.22, y: y + 0.7, w: cardW - 0.44, h: h - 0.85, valign: "top", margin: 0, isTextBox: true, objectName: `${c.head} body` });
    if (i < 2) s.addText("→", { x: x + cardW, y, w: gap, h, fontSize: 16, bold: true, color: C.accent6, align: "center", valign: "middle", margin: 0, isTextBox: true });
  });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.5, y: 5.92, w: 12.33, h: 0.5, fill: { color: C.accent3 }, line: { type: "none" }, rectRadius: 0.1, objectName: "Bridge" });
  s.addText([
    { text: "Bridge  ", options: { bold: true, color: C.text2 } },
    { text: r.bridge, options: { bold: true, color: C.text1 } },
  ], { x: 0.75, y: 5.92, w: 11.9, h: 0.5, fontSize: 16, valign: "middle", margin: 0, isTextBox: true });
  footnoteBox(s, ctx);
  s.addNotes(r.notes);
});

// Cheat sheet
pres.addSection({ title: "Wrap-up" });
{
  const s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Wrap-up" });
  const ctx = refCtx();
  s.addText("한 줄 답변 Cheat Sheet", { placeholder: "title" });
  const H = (t, col) => ({ text: t, options: { bold: true, color: THEME.colors.lt1, fill: { color: col }, fontSize: 14 } });
  const c1 = (t) => ({ text: t, options: { fontSize: 13, bold: true, color: THEME.colors.dk1, fill: { color: THEME.colors.lt2 } } });
  const c2 = (t) => ({ text: ctx.runs(t, { fontSize: 13 }), options: { fontSize: 13, color: THEME.colors.dk1 } });
  const rows = [
    [H("고객 objection", THEME.colors.accent2), H("STRIDE 한 줄 답변", THEME.colors.accent1)],
    [c1("① ORR이 더 높다"), c2("ORR 약 1.8배에도 OS HR은 0.76 vs 0.78 — 생존으로 말한다{H5,C94}")],
    [c1("② mOS가 더 길다"), c2("대조군 mOS부터 7개월 차이 — 환자군 차이. 가장 긴 추적은 STRIDE{C9,H1,H5}")],
    [c1("③ 강한 대조군을 이겼다"), c2("Lenvatinib은 OS 비열등성만 입증 — HR은 동등{REF}")],
    [c1("④ 간기능 지표가 양호했다"), c2("Hepatitis → 섬유화·decompensation → 2L 기회 상실. 간기능 보존 = journey 보존{KB,DM,DA}")],
    [c1("⑤ 독성은 초반만 관리하면 된다"), c2("G3/4 41%, 중단 18% — 관리할 필요가 적은 구조가 낫다{C94}")],
    [c1("⑥ 효과 좋으니 1L 먼저"), c2("초기 12개월 curve 교차 — 첫 1년을 지켜야 장기 생존도 있다{C9}")],
    [c1("⑦ Ipi 4회라 CTLA-4가 더 강하다"), c2("같은 300 mg, 1회 priming이 우월 → 3상 OS 입증{S22,H1}")],
    [c1("⑧ 줄이거나 덜 맞히면 된다"), c2("Ipi 감량 시 24개월 OS 48% → 30% — STRIDE는 줄일 필요가 없다{C40}")],
  ];
  s.addTable(rows, { x: 0.5, y: 1.3, w: 12.33, colW: [3.6, 8.73], rowH: 0.52, border: { type: "solid", pt: 0.75, color: "D5DCE2" }, valign: "middle", margin: [0.04, 0.1, 0.04, 0.1], objectName: "Cheat sheet table" });
  footnoteBox(s, ctx, 6.38, 0.7);
  s.addNotes("8개 objection에 대한 한 줄 답변입니다. 현장에서 시간이 없을 때는 이 한 줄로 시작하고, 고객이 더 물으면 라운드별 재반박 논리로 들어가십시오.");
}

// Takeaways
{
  const s = pres.addSlide({ masterName: "TITLE_DARK", sectionTitle: "Wrap-up" });
  const ctx = refCtx();
  s.addText("Key Takeaways", { x: 0.8, y: 0.6, w: 11.7, h: 0.8, fontSize: 36, bold: true, color: C.background1, margin: 0, isTextBox: true });
  const tk = [
    ["01", "생존으로 말한다", "ORR·mOS 숫자 경쟁 대신 연구 내 HR(0.76 vs 0.78)과 5년 이상 survival tail{H5,C94}"],
    ["02", "간기능 보존 = Journey 보존", "Hepatitis 7.5% vs 약 18% — 간 손상은 2L 기회까지 좌우{H1,C9,DA}"],
    ["03", "한 번의 priming", "CTLA-4 1회로 3상 OS 입증 — 줄이거나 반복할 필요가 없는 구조{S22,H1}"],
  ];
  tk.forEach(([n, h, d], i) => {
    const x = 0.8 + i * 4.0;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 1.8, w: 3.7, h: 4.0, fill: { color: C.accent1 }, line: { type: "none" }, rectRadius: 0.12, objectName: `Takeaway ${n}` });
    s.addText(n, { x: x + 0.3, y: 2.05, w: 3.1, h: 0.8, fontSize: 40, bold: true, color: C.accent3, margin: 0, isTextBox: true });
    s.addText(h, { x: x + 0.3, y: 2.95, w: 3.1, h: 0.9, fontSize: 20, bold: true, color: C.background1, margin: 0, valign: "top", isTextBox: true });
    s.addText(ctx.runs(d, { fontSize: 15, color: C.background1 }), { x: x + 0.3, y: 3.9, w: 3.1, h: 1.75, margin: 0, valign: "top", isTextBox: true });
  });
  s.addText(ctx.footnote(), { x: 0.8, y: 6.1, w: 11.7, h: 0.9, fontSize: 9, color: C.background2, margin: 0, valign: "top", isTextBox: true, objectName: "References" });
  s.addNotes("오늘의 세 가지 메시지입니다. 첫째, 생존으로 말한다. 둘째, 간기능 보존이 곧 treatment journey 보존이다. 셋째, 한 번의 priming으로 충분하다. 어떤 objection이 와도 이 세 가지 중 하나로 Bridge하십시오.");
}

// pptxgenjs writes one <a:pPr> per run; keep only the first in each paragraph
async function fixParagraphProps(file) {
  const fs = require("fs");
  const JSZip = require("jszip");
  const zip = await JSZip.loadAsync(fs.readFileSync(file));
  for (const name of Object.keys(zip.files).filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))) {
    let xml = await zip.file(name).async("string");
    xml = xml.replace(/<a:p>([\s\S]*?)<\/a:p>/g, (m, inner) => {
      let seen = false;
      const out = inner.replace(/<a:pPr\b[^>]*?(?:\/>|>[\s\S]*?<\/a:pPr>)/g, (pp) => (seen ? "" : ((seen = true), pp)));
      return `<a:p>${out}</a:p>`;
    });
    zip.file(name, xml);
  }
  fs.writeFileSync(file, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  await fixParagraphProps(OUT);
  await applyTheme(OUT, THEME);
  console.log("wrote", OUT);
})();
