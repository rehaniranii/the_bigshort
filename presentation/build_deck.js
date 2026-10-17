// Builds REGIME-X_Final_Presentation.pptx from presentation/data/*.json.
// Main talk: 8 plain-language slides on what we built (about 4 min), then backup slides for Q&A.
// Usage: NODE_PATH=<dir with pptxgenjs> node build_deck.js <out.pptx>
const pptxgen = require('pptxgenjs');
const path = require('path');
const fs = require('fs');
const SKILL = process.env.PPTX_SKILL || '/Users/rehanirani/Library/Application Support/Claude/local-agent-mode-sessions/skills-plugin/4d58a23c-16f7-4a27-b341-66aed3c159a8/8d552249-3a42-48ce-b25e-3c210871c277/skills/pptx';
const { applyTheme } = require(path.join(SKILL, 'scripts/apply_theme.js'));
const DATA = path.join(__dirname, 'data');
const OUT = process.argv[2];
const J = (n) => JSON.parse(fs.readFileSync(path.join(DATA, n + '.json'), 'utf8'));

const market = J('market'), facts = J('facts'), r1 = J('r1_submission'), r3 = J('r3_backtest');
const regime = J('regime_windows'), strat = J('strategy_compare'), crash = J('crash_test');
const files = J('given_files'), val = J('r1_validation');
const F = Object.fromEntries(facts.map((f) => [f.key, f.value]));
const VS = Object.fromEntries(val.summary.map((r) => [r.model, r]));
const pct = (v, d = 1) => (v * 100).toFixed(d) + '%';
const spct = (v, d = 1) => (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(d) + '%';
const num = (v, d = 2) => (v < 0 ? '−' : '') + Math.abs(v).toFixed(d);
const snum = (v, d = 3) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);

// Palette: graphite-teal ink, deep teal primary, amber for signal, brick red for crash.
const HEX = { ink: '13232B', teal: '1F6F6B', mist: 'EEF3F2', amber: 'D9962B', red: 'C0452F', gray: '8A9A9C', green: '2E7D4F', slate: '55666E' };
const THEME = {
  name: 'Kestrel Desk', headFontFace: 'Cambria', bodyFontFace: 'Calibri',
  colors: { dk1: HEX.ink, lt1: 'FFFFFF', dk2: HEX.teal, lt2: HEX.mist, accent1: HEX.teal, accent2: HEX.amber, accent3: HEX.red,
    accent4: HEX.gray, accent5: HEX.green, accent6: HEX.slate, hlink: HEX.teal, folHlink: HEX.slate },
};

const pres = new pptxgen();
pres.layout = 'LAYOUT_16x9'; // 10 x 5.625
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = 'KESTREL_EM Sprint Playbook';
pres.author = 'Team Renaissance';
const C = pres.SchemeColor;

pres.defineSlideMaster({
  title: 'TITLE_DARK', background: { color: C.text1 },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 1.45, w: 8.8, h: 1.3, fontSize: 44, bold: true, color: C.background1, valign: 'bottom', margin: 0, align: 'left' }, text: '' } },
    { placeholder: { options: { name: 'body', type: 'body', x: 0.6, y: 2.95, w: 8.4, h: 1.4, fontSize: 18, color: 'C9D6D4', valign: 'top', margin: 0 }, text: '' } },
  ],
});
pres.defineSlideMaster({
  title: 'SECTION_DARK', background: { color: C.text1 },
  objects: [
    { placeholder: { options: { name: 'kicker', type: 'body', x: 0.6, y: 1.3, w: 8.8, h: 0.5, fontSize: 14, color: C.accent2, bold: true, charSpacing: 3, margin: 0 }, text: '' } },
    { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 1.8, w: 8.8, h: 1.1, fontSize: 40, bold: true, color: C.background1, valign: 'top', margin: 0, align: 'left' }, text: '' } },
    { placeholder: { options: { name: 'body', type: 'body', x: 0.6, y: 3.0, w: 8.4, h: 1.7, fontSize: 16, color: 'C9D6D4', valign: 'top', margin: 0 }, text: '' } },
  ],
  slideNumber: { x: 9.0, y: 5.2, w: 0.5, h: 0.3, fontSize: 9, color: 'C9D6D4', align: 'right' },
});
pres.defineSlideMaster({
  title: 'CONTENT', background: { color: C.background1 },
  objects: [
    { placeholder: { options: { name: 'title', type: 'title', x: 0.5, y: 0.42, w: 9.0, h: 0.6, fontSize: 28, bold: true, color: C.text1, valign: 'middle', margin: 0, align: 'left' }, text: '' } },
    { text: { text: 'KESTREL_EM · Team Renaissance · BigShort ML Trading Sprint', options: { x: 0.5, y: 5.22, w: 7, h: 0.28, fontSize: 9, color: HEX.gray, margin: 0 } } },
  ],
  slideNumber: { x: 9.0, y: 5.22, w: 0.5, h: 0.28, fontSize: 9, color: HEX.gray, align: 'right' },
});

const AX = { catAxisLabelColor: HEX.slate, valAxisLabelColor: HEX.slate, catAxisLabelFontSize: 10, valAxisLabelFontSize: 10,
  catAxisLabelFontFace: '+mn-lt', valAxisLabelFontFace: '+mn-lt', dataLabelFontFace: '+mn-lt', legendFontFace: '+mn-lt', titleFontFace: '+mn-lt',
  legendFontSize: 10, legendColor: HEX.slate, dataLabelFontSize: 10, dataLabelColor: HEX.ink, titleFontSize: 12, titleColor: HEX.ink,
  catAxisLineColor: 'C9D3D4', valAxisLineShow: false };
const grid = () => ({ valGridLine: { color: 'E1E7E7', size: 0.75 }, catGridLine: { style: 'none' } });

let n = 0;
const txt = (s, text, o) => s.addText(text, { isTextBox: true, fontSize: 14, color: C.text1, valign: 'top', margin: 0, ...o, objectName: o.objectName || `text-${++n}` });
// kicker above the title: the repo file or function the slide is about
const content = (section, title, notes, kicker) => {
  const s = pres.addSlide({ masterName: 'CONTENT', sectionTitle: section });
  s.addText(title, { placeholder: 'title' });
  if (kicker) txt(s, kicker, { x: 0.5, y: 0.16, w: 9, h: 0.26, fontSize: 10, bold: true, color: C.accent2, charSpacing: 2, objectName: `kicker-${++n}` });
  if (notes) s.addNotes(notes);
  return s;
};
const card = (s, x, y, w, h, fill) => s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: fill || C.background2 }, line: { color: fill || C.background2 }, objectName: `card-${++n}` });
const bullets = (items, size = 14) => items.map((t, i) => {
  const runs = Array.isArray(t) ? t : [{ text: t }];
  return runs.map((r, j) => ({ text: r.text, options: { ...(r.options || {}), bullet: j === 0 ? { indent: 14 } : undefined, fontSize: size, paraSpaceAfter: 6, breakLine: j === runs.length - 1 && i < items.length - 1 } }));
}).flat();
const B = (t) => ({ text: t, options: { bold: true } });
const tableOpts = (o) => ({ fontFace: 'Calibri', color: HEX.ink, border: { type: 'solid', pt: 0.75, color: 'D5DDDE' }, margin: 0.05, ...o });
const hdr = (t, align) => ({ text: t, options: { bold: true, color: HEX.slate, align: align || 'left' } });

function flow(s, steps, { y = 1.25, per = 4, h = 1.55, start = 0 } = {}) {
  const gap = 0.25, w = (9.0 - gap * (per - 1)) / per;
  steps.forEach(([head, body], i) => {
    const r = Math.floor(i / per), c = i % per;
    const x = 0.5 + c * (w + gap), yy = y + r * (h + 0.25);
    card(s, x, yy, w, h);
    s.addShape(pres.shapes.OVAL, { x: x + 0.15, y: yy + 0.15, w: 0.36, h: 0.36, fill: { color: C.accent1 }, line: { color: C.accent1 }, objectName: `step-dot-${++n}` });
    txt(s, String(i + 1 + start), { x: x + 0.15, y: yy + 0.15, w: 0.36, h: 0.36, fontSize: 13, bold: true, color: C.background1, align: 'center', valign: 'middle' });
    txt(s, head, { x: x + 0.6, y: yy + 0.13, w: w - 0.72, h: 0.4, fontSize: 14, bold: true, valign: 'middle' });
    txt(s, body, { x: x + 0.15, y: yy + 0.62, w: w - 0.3, h: h - 0.72, fontSize: 11.5, color: HEX.slate });
  });
}
function stat(s, x, y, w, big, label, sub, color, size) {
  txt(s, big, { x, y, w, h: 0.75, fontSize: size || 40, bold: true, color: color || C.accent1, fontFace: 'Cambria', valign: 'bottom' });
  txt(s, label, { x, y: y + 0.8, w, h: 0.32, fontSize: 13, bold: true });
  if (sub) txt(s, sub, { x, y: y + 1.12, w, h: 0.3, fontSize: 11.5, color: HEX.slate });
}

/* ═════════════════ MAIN TALK (≈ 4 min) ═════════════════ */
pres.addSection({ title: 'Main talk' });
const plain = { vol_change_5d: 'Volatility change (5 days)', open_ret_10: 'Return over 10 days', high_low_skew: 'Candle shape', open_vs_sma_10: 'Price vs 10-day average',
  rsi_diff_1: 'RSI change (1 day)', of_lag2: 'Order flow, 2 days ago', open_vs_ema_10: 'Price vs 10-day EMA', rsi_vs_ma14: 'RSI vs its average', vol_ratio: 'Volatility vs normal', open_vs_ema_5: 'Price vs 5-day EMA' };
// simple icon row: coloured circle with a number, bold head, one plain line
function points(s, items, { x, y, w, gap = 0.85, color } = {}) {
  items.forEach(([head, body], i) => {
    const yy = y + i * gap;
    s.addShape(pres.shapes.OVAL, { x, y: yy + 0.02, w: 0.36, h: 0.36, fill: { color: color || C.accent1 }, line: { color: color || C.accent1 }, objectName: `pt-${++n}` });
    txt(s, String(i + 1), { x, y: yy + 0.02, w: 0.36, h: 0.36, fontSize: 13, bold: true, color: C.background1, align: 'center', valign: 'middle' });
    txt(s, head, { x: x + 0.5, y: yy - 0.02, w: w - 0.5, h: 0.32, fontSize: 15, bold: true });
    if (body) txt(s, body, { x: x + 0.5, y: yy + 0.3, w: w - 0.5, h: 0.45, fontSize: 12.5, color: HEX.slate });
  });
}

/* 1 ─ Title */
{
  const s = pres.addSlide({ masterName: 'TITLE_DARK', sectionTitle: 'Main talk' });
  s.addText('KESTREL_EM Sprint Playbook', { placeholder: 'title' });
  s.addText([
    { text: 'Team Renaissance · BigShort ML Trading Sprint', options: { breakLine: true } },
    { text: `When the market crashed, holding the stock lost ${pct(-F.bh_return)}. Our causal Round 3 engine lost only ${pct(-F.r3_return)}.`, options: { fontSize: 16 } },
  ], { placeholder: 'body' });
  s.addNotes(`SPEAKER 1 (about 15 seconds)\n\nHi, we're Team Renaissance. We were given one stock, KESTREL_EM, and three rounds. When the market crashed, simply holding the stock lost ${pct(-F.bh_return, 0)}. Our causal Round 3 engine, which only uses past data, lost just ${pct(-F.r3_return)}. Here's how we built it.`);
}

/* 2 ─ The task and the data */
{
  const s = content('Main talk', 'The task: three rounds, one stock', `SPEAKER 1 (about 30 seconds)\n\nWe got three files with the stock's daily prices.\nRound 1: predict if the price goes up or down for 50 days in a calm market.\nRound 2: the same task, but the market crashes.\nRound 3: instead of up or down, decide how much to buy or short each day.\nThe close price is hidden on the days we predict, so our one rule was: only use data you would really have on that day.`, 'WHAT WE WERE GIVEN · 3 CSV FILES');
  const cards = [
    ['ROUND 1', 'Calm market', 'Will the price go up or down?', `Learn from days 1–800, predict days 801–850`, C.accent1],
    ['ROUND 2', 'Flash crash', 'Same question, after a crash', `Learn from days 1–850, predict days 851–900`, C.accent3],
    ['ROUND 3', 'Flash crash', 'How much to buy or short?', 'Pick a position from −1 (short) to +1 (buy)', C.accent3],
  ];
  cards.forEach(([k, m, q, d, col], i) => {
    const x = 0.5 + i * 3.1;
    card(s, x, 1.2, 2.85, 2.7);
    txt(s, k, { x: x + 0.2, y: 1.35, w: 2.5, h: 0.28, fontSize: 12, bold: true, color: col, charSpacing: 1 });
    txt(s, m, { x: x + 0.2, y: 1.68, w: 2.5, h: 0.45, fontSize: 22, bold: true, fontFace: 'Cambria' });
    txt(s, q, { x: x + 0.2, y: 2.3, w: 2.5, h: 0.6, fontSize: 15 });
    txt(s, d, { x: x + 0.2, y: 3.0, w: 2.5, h: 0.75, fontSize: 12.5, color: HEX.slate });
  });
  card(s, 0.5, 4.15, 9.0, 0.9, 'FFFFFF');
  txt(s, [B('Our one rule: '), { text: 'only use data we would really have on that day. The close price is hidden on the days we predict.' }], { x: 0.5, y: 4.3, w: 9.0, h: 0.6, fontSize: 15 });
}

/* 3 ─ Features */
{
  const top = val.permutation.slice(0, 6);
  const s = content('Main talk', 'Round 1: what the model looks at', `SPEAKER 2 (about 30 seconds)\n\nWe never feed the model raw prices, because a price of 240 and a price of 400 mean nothing on their own. Instead we give it changes and comparisons: how fast the price moved, whether volatility is rising, where the price sits against its average, RSI, and buying versus selling pressure. That's 34 inputs in total.\nThe chart shows which inputs mattered most. The top two are the change in volatility and the 10-day return.`, 'ROUND 1 · generate_round1_submission.py');
  points(s, [
    ['Momentum', 'How much the price moved over 1 to 10 days'],
    ['Volatility', 'Is the market getting calmer or wilder?'],
    ['Trend', 'Is the price above or below its average?'],
    ['RSI and order flow', 'Is it overbought? More buyers or sellers?'],
  ], { x: 0.5, y: 1.25, w: 4.4, gap: 0.85 });
  txt(s, '34 inputs, all changes or ratios, never raw prices', { x: 0.5, y: 4.7, w: 4.4, h: 0.35, fontSize: 13, bold: true, color: C.accent1 });
  s.addChart(pres.charts.BAR, [{ name: 'Importance', labels: top.map((t) => plain[t.feature] || t.feature), values: top.map((t) => t.ba_drop) }], {
    x: 5.1, y: 1.1, w: 4.4, h: 4.0, barDir: 'bar', ...AX, catAxisLabelFontSize: 11, valGridLine: { style: 'none' }, catGridLine: { style: 'none' }, chartColors: [HEX.teal], showValue: true, dataLabelPosition: 'outEnd',
    dataLabelFormatCode: '0.0%', valAxisHidden: true, valAxisMinVal: 0, valAxisMaxVal: top[0].ba_drop * 1.3, showLegend: false, barGapWidthPct: 45, catAxisOrientation: 'maxMin',
    showTitle: true, title: 'Which inputs mattered most', objectName: 'chart-importance' });
}

/* 4 ─ Validation */
{
  const order = ['Always UP', 'HistGradientBoosting', 'Logistic regression', 'LightGBM', 'Blend 0.5 / 0.3 / 0.2'];
  const lab = { 'Always UP': 'Guess UP', HistGradientBoosting: 'Model A', 'Logistic regression': 'Model B', LightGBM: 'Model C', 'Blend 0.5 / 0.3 / 0.2': 'Our blend' };
  const b = VS['Blend 0.5 / 0.3 / 0.2'];
  const s = content('Main talk', 'Round 1: we tested it fairly', `SPEAKER 2 (about 30 seconds)\n\nTo test the model honestly, we always trained on the past and tested on the days that came after, never the other way round. We did that five times.\nWe tried three models and mixed them together. The mix scored ${pct(b.balanced_accuracy, 1)}, against 50% for just guessing UP every day. That's a small edge, but a real one. Predicting tomorrow's direction is hard, so we didn't pretend to be very confident.`, 'ROUND 1 · validate_round1.py');
  s.addChart(pres.charts.BAR, [{ name: 'Score', labels: order.map((m) => lab[m]), values: order.map((m) => VS[m].balanced_accuracy) }], {
    x: 0.5, y: 1.1, w: 5.4, h: 4.0, barDir: 'col', ...AX, catAxisLabelFontSize: 11, ...grid(), chartColors: [HEX.gray, HEX.gray, HEX.gray, HEX.gray, HEX.teal], invertedColors: [HEX.gray], showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '0.0%',
    valAxisMinVal: 0.45, valAxisMaxVal: 0.56, valAxisMajorUnit: 0.02, valAxisLabelFormatCode: '0%', showLegend: false, barGapWidthPct: 55,
    showTitle: true, title: 'Balanced accuracy (50% = guessing)', objectName: 'chart-validation' });
  points(s, [
    ['Past → future, 5 times', 'Train on earlier days, test on later days'],
    ['3 models, mixed', 'Logistic regression, HistGB, LightGBM'],
    [`${pct(b.balanced_accuracy, 1)} vs 50%`, 'Small but real edge over guessing'],
  ], { x: 6.2, y: 1.3, w: 3.3, gap: 1.05 });
  txt(s, `Model A = HistGB · B = logistic regression · C = LightGBM`, { x: 6.2, y: 4.6, w: 3.3, h: 0.45, fontSize: 10.5, color: HEX.slate });
}

/* 5 ─ Crash detection */
{
  const s = content('Main talk', 'The crash changed everything', `SPEAKER 3 (about 30 seconds)\n\nThen the market crashed. Daily swings went from about ${pct(regime[0].daily_vol, 0)} to about ${pct(regime[2].daily_vol, 0)}, five times bigger. A model trained on the calm market stops working.\nSo we added a crash alarm. It goes off if any of three things happens: swings get much bigger than normal, the price drops more than 12% from its recent high, or there is one huge move in a single day. Once it goes off, we stay careful for 15 days.\nFor Round 2 itself we retrained a model on past data only and added a crash adjustment; that's in the backup slides.`, 'ROUND 2 → 3 · generate_round3_signals.py');
  s.addChart(pres.charts.BAR, [{ name: 'Daily swing', labels: ['Calm', 'Before crash', 'Crash'], values: regime.map((r) => r.daily_vol) }], {
    x: 0.5, y: 1.1, w: 4.6, h: 4.0, barDir: 'col', ...AX, catAxisLabelFontSize: 12, ...grid(), chartColors: [HEX.gray, HEX.gray, HEX.red], invertedColors: [HEX.gray], showValue: true, dataLabelPosition: 'outEnd', dataLabelFormatCode: '0.0%',
    valAxisLabelFormatCode: '0%', valAxisMaxVal: 0.08, valAxisMinVal: 0, showLegend: false, barGapWidthPct: 70, showTitle: true, title: 'Average daily price swing', objectName: 'chart-vol' });
  txt(s, 'Our crash alarm goes off if:', { x: 5.4, y: 1.15, w: 4.1, h: 0.35, fontSize: 16, bold: true });
  points(s, [
    ['Swings get 2.5× bigger', 'than their normal level'],
    ['Price falls 12%', 'from its recent high'],
    ['One huge move', 'in a single day'],
  ], { x: 5.4, y: 1.7, w: 4.1, gap: 0.85, color: C.accent3 });
  card(s, 5.4, 4.3, 4.1, 0.75);
  txt(s, 'Once it goes off, we stay careful for 15 days.', { x: 5.55, y: 4.45, w: 3.8, h: 0.45, fontSize: 13.5, bold: true });
}

/* 6 ─ Sizing */
{
  const s = content('Main talk', 'Round 3: our causal engine decides the bet', `SPEAKER 3 (about 30 seconds)\n\nIn Round 3 we choose a position every day, from minus one to plus one. This is our causal engine: it only ever uses past data.\nWhen the market is calm, we follow the trend and buy.\nWhen the crash alarm is on, we take only a small short bet while the price is falling, or we stay out completely.\nWe also change positions slowly when adding risk but quickly when cutting it. That keeps trading costs low.\nIn the chart: the orange bars are our position. Long before the crash, small short during it.`, 'ROUND 3 · generate_round3_signals.py');
  const pts = market.filter((d) => d.t >= 801), lab = pts.map((d) => String(d.t));
  s.addChart(pres.charts.LINE, [{ name: 'Price', labels: lab, values: pts.map((d) => d.close) }], {
    x: 0.5, y: 1.05, w: 5.8, h: 2.1, ...AX, ...grid(), chartColors: [HEX.teal], lineSize: 2, lineDataSymbol: 'none', showLegend: false, catAxisHidden: true, valAxisLabelFormatCode: '#,##0', valAxisMinVal: 150,
    showTitle: true, title: 'Price, days 801–900', objectName: 'chart-r3-close' });
  s.addChart(pres.charts.BAR, [{ name: 'Position', labels: lab, values: pts.map((d) => d.position) }], {
    x: 0.5, y: 3.15, w: 5.8, h: 1.95, barDir: 'col', ...AX, ...grid(), chartColors: [HEX.amber], valAxisMinVal: -1, valAxisMaxVal: 1, valAxisMajorUnit: 1, valAxisLabelFormatCode: '+0;−0;0', catAxisLabelFrequency: 10,
    barGapWidthPct: 30, showLegend: false, showTitle: true, title: 'Our position (+1 buy, −1 short)', objectName: 'chart-r3-pos' });
  points(s, [
    ['Calm: follow the trend', 'Buy when the trend is up'],
    ['Crash: small or nothing', 'Small short while falling, else stay out'],
    ['Add slowly, cut fast', 'Fewer trades, lower costs'],
  ], { x: 6.6, y: 1.3, w: 2.9, gap: 1.2 });
}

/* 7 ─ Result */
{
  const s = content('Main talk', 'Causal engine result: we protected the money', `SPEAKER 3 (about 30 seconds)\n\nThis is what 1 unit of money became over the 50 crash days, after trading costs.\nThe grey line is just holding the stock: it lost ${pct(-F.bh_return, 0)}, and at its worst it was down ${pct(-F.bh_mdd, 0)}.\nThe green line is our causal engine: down only ${pct(-F.r3_return)}, and never more than ${pct(-F.r3_mdd)} down.\nIt doesn't make money in the crash, but it keeps almost all the capital, and it traded very little. This is our own calculation, scored against the next day's move like the target, not the official score.`, 'ROUND 3 · RESULT AFTER TRADING COSTS');
  const lab = r3.map((d) => String(d.t));
  s.addChart(pres.charts.LINE, [
    { name: 'Our causal engine', labels: lab, values: r3.map((d) => d.strategy_equity) },
    { name: 'Just holding the stock', labels: lab, values: r3.map((d) => d.buyhold_equity) },
  ], { x: 0.5, y: 1.05, w: 5.6, h: 4.05, ...AX, ...grid(), chartColors: [HEX.teal, HEX.gray], lineSize: 2.5, lineDataSymbol: 'none', showLegend: true, legendPos: 't', legendFontSize: 11, catAxisLabelFrequency: 7,
    valAxisLabelFormatCode: '0.00', valAxisMinVal: 0.4, valAxisMaxVal: 1.2, showTitle: true, title: 'What 1 unit of money became, days 851–900', objectName: 'chart-r3-eq' });
  const stats = [[spct(F.r3_return), 'Causal engine return', `Holding: ${spct(F.bh_return)}`, C.accent1], [pct(F.r3_mdd), 'Worst drop', `Holding: ${pct(F.bh_mdd)}`, C.accent1]];
  stats.forEach(([b, l, sub, col], i) => { card(s, 6.4, 1.1 + i * 2.0, 3.1, 1.85); stat(s, 6.6, 1.15 + i * 2.0, 2.8, b, l, sub, col); });
}

/* 8 ─ The code */
{
  const s = content('Main talk', 'What we built: the code behind each round', `SPEAKER 4 (about 40 seconds)\n\nEverything is in our GitHub repo.\nRound 1 script: builds the inputs, trains three models and mixes them. A second script tests it fairly.\nRound 2 script: a model retrained on past data only, with a crash adjustment.\nRound 3: our final upload used the next day's price, which is look-ahead. Our causal engine, generate_round3_signals.py, has the crash alarm, the position sizing, and a check that proves it never uses future data.\nREGIME-X: our research app, with a dashboard, used to test ideas before using our 10 uploads.\nThank you, happy to take questions.`, 'OUR GITHUB REPO');
  const code = [
    ['Round 1', 'generate_round1_submission.py', 'Builds 34 inputs, trains 3 models, mixes them. Tested by validate_round1.py'],
    ['Round 2', 'generate_round2_round3_submissions.py', 'Causal LR + HistGB model with a crash adjustment'],
    ['Round 3 · causal engine', 'generate_round3_signals.py', 'Crash alarm, position sizing, and a no-future-data check'],
    ['Research app', 'regime-x/', 'Dashboard + backend we used to test ideas before uploading'],
  ];
  code.forEach(([tag, f, d], i) => {
    const x = 0.5 + (i % 2) * 4.6, y = 1.15 + Math.floor(i / 2) * 1.6;
    card(s, x, y, 4.4, 1.4);
    txt(s, tag, { x: x + 0.2, y: y + 0.12, w: 4.0, h: 0.3, fontSize: 12, bold: true, color: C.accent2, charSpacing: 1 });
    txt(s, f, { x: x + 0.2, y: y + 0.42, w: 4.0, h: 0.3, fontSize: 12, bold: true, fontFace: 'Courier New', color: C.accent1 });
    txt(s, d, { x: x + 0.2, y: y + 0.78, w: 4.0, h: 0.55, fontSize: 12.5, color: HEX.slate });
  });
  txt(s, [B('Honest note: '), { text: 'our final Round 3 upload (generate_round3_100.py) used the next day\'s price. The causal engine above does not, and the code checks it.' }], { x: 0.5, y: 4.45, w: 9.0, h: 0.6, fontSize: 13.5 });
}

/* ═════════════════ BACKUP (Q&A) ═════════════════ */
pres.addSection({ title: 'Backup' });

/* A1 ─ Market */
{
  const s = content('Backup', 'The market: a steady climb, then a cliff', `Bars 1 to 800 are a calm uptrend; 801 to 850 the Round 1 test. At bar 852 the price peaked at ${F.peak_close.toFixed(2)} and fell ${pct(-F.crash_drop)} to ${F.end_close.toFixed(2)} by bar 900.`, 'DATA · round2_dataset.csv');
  s.addChart(pres.charts.LINE, [{ name: 'Close', labels: market.map((d) => String(d.t)), values: market.map((d) => d.close) }], {
    x: 0.5, y: 1.1, w: 6.2, h: 3.95, ...AX, ...grid(), chartColors: [HEX.teal], lineSize: 1.5, lineDataSymbol: 'none', showLegend: false,
    catAxisLabelFrequency: 100, valAxisMinVal: 150, valAxisLabelFormatCode: '#,##0', showTitle: true, title: 'KESTREL_EM daily close, bars 1–900', objectName: 'chart-market' });
  [[F.peak_close.toFixed(0), 'Peak close, bar 852', C.accent1], [F.end_close.toFixed(0), 'Close at bar 900', C.accent3], [pct(F.crash_drop), 'Peak to bar 900', C.accent3]]
    .forEach(([b, l, c], i) => { txt(s, b, { x: 7.0, y: 1.15 + i * 1.25, w: 2.5, h: 0.65, fontSize: 34, bold: true, fontFace: 'Cambria', color: c, valign: 'bottom' }); txt(s, l, { x: 7.0, y: 1.82 + i * 1.25, w: 2.5, h: 0.3, fontSize: 12, color: HEX.slate }); });
}

/* A2 ─ R1 pipeline */
{
  const s = content('Backup', 'Round 1 pipeline, step by step', 'Backup for questions on how the Round 1 file was produced.', 'ROUND 1 · generate_round1_submission.py');
  flow(s, [
    ['Load 1–850', 'Train on rows 1–800 where the target is known; predict rows 801–850.'],
    ['Engineer features', `${F.r1_features} stationary features from current and past bars only.`],
    ['Drop warm-up', `Remove rows with incomplete rolling windows: ${F.r1_train_rows} training rows remain.`],
    ['Fit three models', 'Scaled L2 logistic regression (C = 0.1), HistGB and LightGBM at depth 3, 80 rounds, lr 0.03.'],
    ['Blend and decide', 'P(up) = 0.5 LR + 0.3 HistGB + 0.2 LightGBM. UP if ≥ 0.5. Confidence = probability of the side called.'],
    ['Validate the file', '50 rows, timestamps 801–850, labels in {0, 1}, confidence in [0, 1], no nulls.'],
  ], { per: 3 });
}

/* A3 ─ R1 calls */
{
  const s = content('Backup', 'The Round 1 file we submitted', `${F.r1_up_calls} UP and ${F.r1_down_calls} DOWN calls, mean confidence ${F.r1_mean_conf.toFixed(2)}.`, 'ROUND 1 · round_1_submission.csv');
  const labels = r1.map((d) => String(d.timestamp));
  s.addChart(pres.charts.BAR, [
    { name: 'UP (1)', labels, values: r1.map((d) => (d.prediction ? d.confidence : 0)) },
    { name: 'DOWN (0)', labels, values: r1.map((d) => (d.prediction ? 0 : d.confidence)) },
  ], { x: 0.5, y: 1.1, w: 6.4, h: 3.95, barDir: 'col', barGrouping: 'stacked', ...AX, ...grid(), chartColors: [HEX.teal, HEX.amber], valAxisMinVal: 0.5, valAxisMaxVal: 0.8, valAxisLabelFormatCode: '0%',
    catAxisLabelFrequency: 5, barGapWidthPct: 40, showLegend: true, legendPos: 't', showTitle: true, title: 'Confidence per call, rows 801–850', objectName: 'chart-r1' });
  card(s, 7.2, 1.1, 2.3, 3.95);
  stat(s, 7.4, 1.2, 2.0, String(F.r1_up_calls), 'UP calls', null, C.accent1);
  stat(s, 7.4, 2.4, 2.0, String(F.r1_down_calls), 'DOWN calls', null, C.accent2);
  stat(s, 7.4, 3.6, 2.0, pct(F.r1_mean_conf, 0), 'Mean confidence', null, C.text1);
}

/* A4 ─ Per-fold validation */
{
  const s = content('Backup', 'Validation detail: every fold', 'Per-fold balanced accuracy and MCC from TimeSeriesSplit with 5 expanding folds on rows 1–800. Produced by presentation/validate_round1.py, which rebuilds the exact Round 1 features and models.', 'ROUND 1 · presentation/validate_round1.py');
  const models = ['Logistic regression', 'HistGradientBoosting', 'LightGBM', 'Blend 0.5 / 0.3 / 0.2', 'Always UP'];
  const head = [hdr('Model'), ...val.folds.map((f) => hdr(`Fold ${f.fold}`, 'right')), hdr('Mean', 'right')];
  const body = models.map((m) => {
    const fr = val.per_fold.filter((r) => r.model === m);
    return [{ text: m, options: { bold: m.startsWith('Blend'), color: m.startsWith('Blend') ? HEX.teal : HEX.ink } },
      ...fr.map((r) => ({ text: `${r.balanced_accuracy.toFixed(3)} / ${snum(r.mcc, 2)}`, options: { align: 'right' } })),
      { text: `${VS[m].balanced_accuracy.toFixed(3)} / ${snum(VS[m].mcc, 2)}`, options: { align: 'right', bold: true } }];
  });
  const tr = [{ text: 'Training rows', options: { color: HEX.slate } }, ...val.per_fold.filter((r) => r.model === 'Always UP').map((r) => ({ text: String(r.train_rows), options: { align: 'right', color: HEX.slate } })), { text: '', options: {} }];
  s.addTable([head, ...body, tr], tableOpts({ x: 0.5, y: 1.2, w: 9.0, colW: [2.1, 1.15, 1.15, 1.15, 1.15, 1.15, 1.15], fontSize: 11, rowH: 0.42, objectName: 'table-folds' }));
  txt(s, 'Each cell: balanced accuracy / MCC. Each fold trains on all earlier rows and tests on the next block; the scaler is refit inside every fold.', { x: 0.5, y: 4.4, w: 9, h: 0.5, fontSize: 11.5, color: HEX.slate });
}

/* A5 ─ R2 forensics: the hidden close */
{
  const s = content('Backup', 'Data forensics: the hidden close', `HOW TO EXPLAIN IT (about 30 seconds)\n\nThe order_flow column turned out to be where the close sits inside the day's high-low range: +1 means it closed at the high, -1 at the low, 0 in the middle. It's a standard indicator called the Close Location Value.\nOn the crash days the organisers hid the close but still gave high, low and order_flow. One equation, one unknown, so we can solve for the close exactly. Row 1 checks out: (2 x 238.56 - 239.57 - 232.41) / 7.16 = 0.7179, the order_flow in the file.\nWe checked it on all 850 rows where the close is known (max error ${F.rec_err.toFixed(4)}, just rounding), and its 10-day average matches the sma_10 column the organisers still gave on the crash days.\nWe needed the close to measure returns, swings and drawdown for the crash alarm.\nOur causal engine only uses yesterday's rebuilt close to set today's position, which is fair. Our final Round 3 upload used tomorrow's rebuilt close to set today's position, which is look-ahead.`, 'DATA FORENSICS · used by generate_round3_signals.py');
  // Formula card with a worked example
  card(s, 0.5, 1.05, 4.45, 1.45);
  txt(s, 'of = order_flow = (2c − h − l) / (h − l)', { x: 0.65, y: 1.13, w: 4.2, h: 0.32, fontSize: 12, fontFace: 'Courier New' });
  txt(s, 'c  = close = ½ · (of · (h − l) + h + l)', { x: 0.65, y: 1.47, w: 4.2, h: 0.32, fontSize: 12, fontFace: 'Courier New', bold: true, color: C.accent1 });
  txt(s, [B('Row 1 check: '), { text: '(2×238.56 − 239.57 − 232.41) ÷ 7.16 = 0.7179 = order_flow in the file ✓' }], { x: 0.65, y: 1.86, w: 4.2, h: 0.55, fontSize: 11, color: HEX.slate });
  // Three plain steps
  points(s, [
    ['order_flow = where the day closed', '+1 = closed at the high, −1 = at the low, 0 = middle'],
    ['Close hidden, the rest given', 'High, low, order_flow known → solve for close'],
    ['Checked twice', `Error ${F.rec_err.toFixed(4)} on 850 known rows; matches given sma_10`],
  ], { x: 0.5, y: 2.72, w: 4.45, gap: 0.8 });
  // Chart: given vs rebuilt
  const pts = market.filter((d) => d.t >= 760), lab = pts.map((d) => String(d.t));
  s.addChart(pres.charts.LINE, [
    { name: 'Close given', labels: lab, values: pts.map((d) => (d.close_given ? d.close : null)) },
    { name: 'Close we rebuilt', labels: lab, values: pts.map((d) => (!d.close_given || d.t === 850 ? d.close : null)) },
  ], { x: 5.2, y: 1.0, w: 4.3, h: 2.65, ...AX, ...grid(), chartColors: [HEX.teal, HEX.red], lineSize: 2, lineDataSymbol: 'none', showLegend: true, legendPos: 't', catAxisLabelFrequency: 35,
    valAxisLabelFormatCode: '#,##0', valAxisMinVal: 150, displayBlanksAs: 'gap', showTitle: false, objectName: 'chart-rebuilt' });
  // Fair vs not fair
  const uses = [
    ['FAIR · causal engine', "Yesterday's rebuilt close → today's position", C.accent5],
    ['LOOK-AHEAD · final Round 3 upload', "Tomorrow's rebuilt close → today's position", C.accent3],
  ];
  uses.forEach(([h, d, col], i) => {
    const y = 3.75 + i * 0.68;
    card(s, 5.2, y, 4.3, 0.6);
    txt(s, h, { x: 5.32, y: y + 0.06, w: 4.1, h: 0.22, fontSize: 10.5, bold: true, color: col, charSpacing: 1 });
    txt(s, d, { x: 5.32, y: y + 0.3, w: 4.1, h: 0.26, fontSize: 11 });
  });
}

/* A5b ─ What we uploaded */
{
  const s = content('Backup', 'What we actually uploaded', `HOW TO EXPLAIN IT\n\nRound 1 was our three-model blend, using only past data.\nRound 2 was a model retrained on past data with a crash adjustment. It scores ${pct(F.r2_up_ba, 1)} balanced accuracy against the rebuilt closes, but the two adjustment numbers may have been set while checking crash-day accuracy, so treat that as in-sample.\nRound 3: our final upload, generate_round3_100.py, set each position from the next day's rebuilt close. It matches the next day's direction on every bar, which is look-ahead. Our causal engine, generate_round3_signals.py, is what we presented: it only uses past data and passes the no-future-data check.`, 'SUBMISSIONS · FROM GIT HISTORY');
  const rows = [[hdr('Round'), hdr('Script'), hdr('How it works'), hdr('Uses future data?')],
    ['Round 1', 'generate_round1_submission.py', 'LR + HistGB + LightGBM blend on 34 inputs', 'No'],
    ['Round 2', 'generate_round2_round3_submissions.py', `LR + HistGB, crash adjustment; ${pct(F.r2_up_ba, 1)} bal. acc. vs rebuilt closes`, 'No in features; adjustment may be tuned on test rows'],
    ['Round 3 upload', 'generate_round3_100.py', `Sign of next day's rebuilt return; matches ${pct(F.r3_up_match, 0)} of bars`, 'Yes, look-ahead'],
    ['Causal engine', 'generate_round3_signals.py', 'Crash alarm + vol-targeted trend + smoother', 'No, checked on all 50 bars'],
  ].map((r, i) => i === 0 ? r : r.map((c, j) => ({ text: c, options: { bold: j === 0, fontFace: j === 1 ? 'Courier New' : 'Calibri', fontSize: j === 1 ? 9.5 : 11.5,
    color: j === 3 ? (c.startsWith('Yes') ? HEX.red : c.startsWith('No,') || c === 'No' ? HEX.green : HEX.amber) : HEX.ink } })));
  s.addTable(rows, tableOpts({ x: 0.5, y: 1.2, w: 9.0, colW: [1.3, 3.25, 2.6, 1.85], fontSize: 12, rowH: 0.62, objectName: 'table-uploads' }));
  txt(s, 'Upload files are in git history: Round 1 b1a5941 · Round 2 0394367 · Round 3 056f38f', { x: 0.5, y: 4.65, w: 9.0, h: 0.35, fontSize: 11, color: HEX.slate });
}

/* A6 ─ R3 engine */
{
  const s = content('Backup', 'Round 3 engine, all seven steps', 'Backup for questions on the Round 3 signal code. Step 7 is the proof: for each of the 50 test bars we delete every later row, rebuild the signal and require an exact match.', 'ROUND 3 · generate_round3_signals.py');
  flow(s, [
    ['Recover closes', 'Same order_flow identity. A bar\'s close is used only from the next bar on.'],
    ['Measure risk', '20- and 5-bar vol, 120-bar baseline vol, 60-bar drawdown, 30-bar mean.'],
    ['Detect crisis', 'Vol spike > 2.5× baseline, drawdown past −12%, or a 4× move. Hold 15 bars.'],
    ['Set a target', 'Calm: EMA10 vs EMA30 trend at a 0.6% vol target. Crisis: short below SMA30 (max 0.5), else flat.'],
    ['Lag one bar', 'Computed at the close of t−1, held during bar t.'],
    ['Smooth', 'Add risk at speed 0.3, cut or flip at 0.8. Saves cost, keeps fast exits.'],
    ['Prove it', `Rebuild all ${F.lookahead_bars} signals with later rows deleted; must match exactly.`],
  ], { per: 4, h: 1.6 });
}

/* A7 ─ ARBM */
{
  const s = content('Backup', 'ARBM: trade the breakout after a squeeze', 'Adaptive Regression Breakout Map, a Pine Script v6 indicator we ported line by line to Python inside REGIME-X. The Round 1 to 3 submission scripts do not call ARBM.', 'REGIME-X · adaptive_regression_breakout_map.pine → backend/engine/arbm.py');
  card(s, 0.5, 1.05, 5.4, 4.05);
  const ox = 0.7, oy = 1.25, sx = 4.9 / 620, sy = 3.3 / 290;
  const P = (x, y) => [ox + x * sx, oy + y * sy];
  const seg = (a, b, color, w, dash) => { const [x1, y1] = P(...a), [x2, y2] = P(...b);
    s.addShape(pres.shapes.LINE, { x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.max(Math.abs(x2 - x1), 0.001), h: Math.max(Math.abs(y2 - y1), 0.001), flipV: (y2 - y1) * (x2 - x1) < 0, line: { color, width: w, dashType: dash || 'solid' }, objectName: `line-${++n}` }); };
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: P(150, 0)[0], y: P(0, 20)[1], w: 200 * sx, h: 240 * sy, rectRadius: 0.05, fill: { color: 'FFFFFF' }, line: { color: 'D5DDDE' }, objectName: 'squeeze-zone' });
  txt(s, 'Squeeze zone', { x: P(158, 0)[0], y: P(0, 26)[1], w: 1.4, h: 0.25, fontSize: 10, color: HEX.slate });
  const upper = [[0, 80], [100, 110], [150, 140], [200, 150], [350, 152]], lower = [[0, 270], [100, 245], [150, 222], [200, 214], [350, 212]];
  for (let i = 0; i < upper.length - 1; i++) { seg(upper[i], upper[i + 1], HEX.gray, 1.25); seg(lower[i], lower[i + 1], HEX.gray, 1.25); }
  const px = [[0, 200], [25, 130], [50, 240], [75, 125], [100, 225], [125, 160], [150, 200], [175, 168], [200, 192], [225, 172], [250, 190], [275, 175], [300, 186], [325, 170], [350, 160], [368, 132], [390, 118], [410, 104], [430, 108], [450, 90], [465, 70], [480, 56], [495, 44]];
  for (let i = 0; i < px.length - 1; i++) seg(px[i], px[i + 1], HEX.ink, 2);
  seg([368, 132], [620, 132], HEX.ink, 1.25);
  seg([368, 212], [620, 212], HEX.red, 1.5);
  [[105, 'TP1 · stop → entry'], [78, 'TP2 · stop → TP1'], [51, 'TP3 · exit']].forEach(([y, l]) => { seg([368, y], [620, y], HEX.green, 1.25, 'dash'); txt(s, l, { x: P(505, 0)[0], y: P(0, y)[1] - 0.24, w: 1.25, h: 0.22, fontSize: 10, color: HEX.green }); });
  txt(s, 'Entry: break above band after a squeeze', { x: P(372, 0)[0], y: P(0, 132)[1] + 0.03, w: 2.3, h: 0.22, fontSize: 10 });
  txt(s, 'Stop: prior opposite band', { x: P(372, 0)[0], y: P(0, 212)[1] + 0.03, w: 2.3, h: 0.22, fontSize: 10, color: HEX.red });
  txt(s, 'Schematic, not market data', { x: 0.7, y: 4.8, w: 3, h: 0.22, fontSize: 10, color: HEX.slate });
  txt(s, 'The four rules', { x: 6.1, y: 1.05, w: 3.4, h: 0.35, fontSize: 16, bold: true });
  txt(s, bullets([[B('Channel: '), { text: 'linreg(close, 50) ± 2 × population stdev' }], [B('Squeeze: '), { text: 'width in the bottom 20% of its 100-bar range' }],
    [B('Breakout: '), { text: 'close crosses the band right after a squeeze bar' }], [B('Exit ladder: '), { text: 'stop ratchets at TP1 and TP2; TP3 closes' }]], 12.5), { x: 6.1, y: 1.45, w: 3.4, h: 2.0 });
  txt(s, 'Python port fixes', { x: 6.1, y: 3.4, w: 3.4, h: 0.35, fontSize: 14, bold: true });
  txt(s, bullets(['Fill at next open plus slippage', 'Population std to match Pine', 'Gap-aware stops and costs on both legs', 'Stop never moves backward after TP2'], 11.5), { x: 6.1, y: 3.75, w: 3.4, h: 1.35 });
}

/* A8 ─ REGIME-X */
{
  const s = content('Backup', 'REGIME-X: the research terminal', 'Any Yahoo Finance or NSE ticker, or a CSV, through the full stack: ARBM, four-regime detection on trailing windows, three calibrated classifiers chosen by validation MCC, a hybrid position blend capped by regime, and a cost-aware backtest. FastAPI backend, Next.js dashboard.', 'REGIME-X · regime-x/backend + regime-x/frontend');
  flow(s, [['Data loader', 'data/loader.py · yfinance or CSV, Parquet cache'], ['ARBM engine', 'engine/arbm.py · channel, squeeze, breakouts'], ['Regime detector', 'engine/regime.py · 4 regimes from trailing vol, drawdown'], ['ML pipeline', 'ml/pipeline.py · 3 calibrated models, pick by MCC']], { y: 1.1, per: 4, h: 1.2 });
  flow(s, [['Hybrid signal', 'engine/signals.py · ML 0.45 + ARBM 0.35 + regime 0.20'], ['Backtester', 'engine/signals.py · overnight + intraday P&L, fees'], ['FastAPI', 'api/main.py · analyze, stress test, walk-forward'], ['Next.js UI', 'frontend/components · charts, crash simulator, risk']], { y: 2.5, per: 4, h: 1.2, start: 4 });
  const regimes = [['Low vol', '< 25th pct', 'Full size', HEX.green], ['Normal', '25th–75th', 'Full size', HEX.teal], ['High vol', '≥ 75th pct', 'Cap 0.5', HEX.amber], ['Extreme', '≥ 95th, DD ≤ −10%, or −3σ', 'Cap 0.1', HEX.red]];
  txt(s, 'Four regimes → position caps', { x: 0.5, y: 3.88, w: 9, h: 0.3, fontSize: 13, bold: true });
  regimes.forEach(([nme, rule, cap, col], i) => {
    const x = 0.5 + i * 2.3;
    s.addShape(pres.shapes.OVAL, { x, y: 4.28, w: 0.22, h: 0.22, fill: { color: col }, line: { color: col }, objectName: `regime-dot-${i}` });
    txt(s, [B(nme + '  '), { text: cap, options: { color: HEX.slate } }], { x: x + 0.3, y: 4.22, w: 1.95, h: 0.32, fontSize: 12 });
    txt(s, rule, { x: x + 0.3, y: 4.55, w: 1.95, h: 0.5, fontSize: 10.5, color: HEX.slate });
  });
}

(async () => {
  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  console.log('wrote', OUT);
})();
