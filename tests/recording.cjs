// 실제 Chrome MP4 녹화의 전체 길이·탐색 색인·브라우저 seek 회귀 검사.
// Node 표준 모듈만 사용. 임시 사본과 임시 프로필을 만들며 원본은 수정하지 않는다.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const chromeBin = process.env.CHROME_BIN || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
assert.ok(fs.existsSync(chromeBin), 'Chrome 경로를 CHROME_BIN으로 지정해 주세요');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shortform-recording-'));
const source = process.argv[2] || 'index.html';
const injection = `<script>
(async () => {
  while (restoring) await new Promise(r => setTimeout(r, 20));
  $('#tracks').replaceChildren();
  const el = addTrack(), buf = ac.createBuffer(1, ac.sampleRate * 7, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = .15 * Math.sin(i * 2 * Math.PI * 440 / ac.sampleRate);
  el.data.buf = buf; el.querySelector('.end').value = '7'; $('#fade').value = '.5'; refresh();
  HTMLAnchorElement.prototype.click = async function () {
    try {
      const blob = await (await fetch(this.href)).blob();
      await fetch('/video', {method:'POST', body:blob});
      const v = document.createElement('video'); v.muted = true; v.preload = 'auto';
      const ready = new Promise((ok,no) => {v.onloadedmetadata=ok;v.onerror=()=>no(new Error('video load failed'));});
      v.src = this.href; document.body.append(v); await ready;
      const seek = new Promise((ok,no) => {v.onseeked=ok;v.onerror=()=>no(new Error('seek failed'));});
      v.currentTime = 5; await seek;
      await fetch('/result', {method:'POST', body:JSON.stringify({duration:v.duration, currentTime:v.currentTime, type:blob.type})});
    } catch(e) {await fetch('/error', {method:'POST',body:String(e.stack)});}
  };
  $('#rec').click();
})().catch(e => fetch('/error', {method:'POST',body:String(e.stack)}));
</script>`;
const html = fs.readFileSync(source, 'utf8').replace('</body>', injection+'</body>');
function boxes(buf, start=0, end=buf.length) {
  const out=[];
  for(let at=start; at<end;) {
    assert.ok(at+8<=end, 'MP4 box header');
    let size=buf.readUInt32BE(at), head=8;
    if(size===1){size=Number(buf.readBigUInt64BE(at+8));head=16;}
    if(size===0)size=end-at;
    assert.ok(size>=head && at+size<=end,'MP4 box bounds');
    out.push({type:buf.toString('ascii',at+4,at+8),at,data:at+head,end:at+size}); at+=size;
  }
  return out;
}
function checkMp4(buf) {
  const top=boxes(buf), moov=top.find(b=>b.type==='moov'); assert.ok(moov,'moov');
  const children=boxes(buf,moov.data,moov.end), mvhd=children.find(b=>b.type==='mvhd');assert.ok(mvhd);
  const wide=buf[mvhd.data]===1, scaleAt=mvhd.data+(wide?20:12), scale=buf.readUInt32BE(scaleAt);
  const duration=(wide?Number(buf.readBigUInt64BE(scaleAt+4)):buf.readUInt32BE(scaleAt+4))/scale;
  assert.ok(duration>7 && duration<9,'movie header must describe the full recording, not zero/first fragment');
  for(const trak of children.filter(b=>b.type==='trak')) {
    const tkhd=boxes(buf,trak.data,trak.end).find(b=>b.type==='tkhd');assert.ok(tkhd);
    const wide=buf[tkhd.data]===1, at=tkhd.data+(wide?28:20);
    const duration=(wide?Number(buf.readBigUInt64BE(at)):buf.readUInt32BE(at))/scale;
    assert.ok(duration>7 && duration<9,'track header must describe full recording');
  }
  const mfra=top.find(b=>b.type==='mfra');assert.ok(mfra,'Chrome MP4 must contain its final seek index');
  const indexes=boxes(buf,mfra.data,mfra.end).filter(b=>b.type==='tfra');
  assert.ok(indexes.some(b=>buf.readUInt32BE(b.data+12)>1),'seek index must cover multiple fragments');
}
let chrome, timer, closed=false;
function finish(error) {
  if(closed)return;closed=true;clearTimeout(timer);chrome?.kill();server.close();
  if(error){console.error(error);process.exitCode=1;}else console.log('실제 MP4 전체 길이·탐색 색인·5초 seek 통과');
  console.log('검증 파일: '+path.join(tmp,'recording.mp4'));
}
const server=http.createServer(async(req,res)=>{
  try {
    if(req.method!=='POST'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);return;}
    const chunks=[];for await(const data of req)chunks.push(data);const body=Buffer.concat(chunks);res.end('ok');
    if(req.url==='/video')fs.writeFileSync(path.join(tmp,'recording.mp4'),body);
    else if(req.url==='/error')finish(new Error(body.toString()));
    else if(req.url==='/result') {
      const report=JSON.parse(body);assert.equal(report.type,'video/mp4');
      assert.ok(report.duration>7 && report.duration<9,'browser full duration');assert.ok(Math.abs(report.currentTime-5)<.1,'browser seeks beyond 3 seconds');
      checkMp4(fs.readFileSync(path.join(tmp,'recording.mp4')));finish();
    }
  } catch(error){if(!res.headersSent)res.end('error');finish(error);}
});
server.listen(0,'127.0.0.1',()=>{
  chrome=spawn(chromeBin,['--headless=new','--autoplay-policy=no-user-gesture-required','--user-data-dir='+path.join(tmp,'profile'),'http://127.0.0.1:'+server.address().port],{stdio:'ignore'});
  chrome.on('error',finish);chrome.on('exit',()=>{if(!closed)finish(new Error('Chrome exited before verification'));});
});
timer=setTimeout(()=>finish(new Error('recording test timed out')),25000);
