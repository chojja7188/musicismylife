const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = readFileSync('index.html', 'utf8');
const code = html.match(/\/\/ ── 자동 음량[\s\S]*?(?=\/\/ ── 곡 카드)/)?.[0];
assert.ok(code, '음량 분석 함수가 있어야 함');
const box = {}; vm.createContext(box); vm.runInContext(code, box);
function track(amplitude, start = 0, d = 1) {
  const data = Float32Array.from({length: 48000 * 2}, (_, i) => Math.sin(i * 2 * Math.PI * 440 / 48000) * (i < 48000 ? amplitude : amplitude / 4));
  return {buf: {sampleRate:48000, length:data.length, numberOfChannels:1, getChannelData:()=>data}, start, d};
}
const a = track(.1), b = track(.8);
box.matchVolume([a,b], 0);
assert.ok(Math.abs(a.gain * .1 - b.gain * .8) < 1e-6, '다른 입력 음량을 같게');
const c = track(.8,1); box.matchVolume([c],0);
assert.ok(Math.abs(c.gain * .2 - b.gain * .8) < 1e-6, '선택 구간만 분석');
const silent = track(0); box.matchVolume([silent],0); assert.equal(silent.gain,1);
const peak = track(.1); const samples = peak.buf.getChannelData(); samples[1000] = 1; peak.buf.getChannelData = () => samples;
box.matchVolume([peak],0); assert.ok(peak.gain <= Math.pow(10,-1/20) + 1e-12, '최대 음량에 여유');
console.log('음량 차이·선택 구간·무음·피크 보호 통과');
