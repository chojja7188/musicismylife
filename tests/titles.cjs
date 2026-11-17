const {readFileSync}=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=readFileSync('index.html','utf8');
const code=html.match(/function fitTitle[\s\S]*?(?=let rot =)/)?.[0];
assert.ok(code,'제목 자동 맞춤 함수');
const ctx={font:'',measureText(text){return {width:Array.from(text).length*parseFloat(this.font.match(/([\d.]+)px/)[1])};}};
const box={ctx,FONT:'sans-serif'};vm.createContext(box);vm.runInContext(code,box);
let title=box.fitTitle('짧은 제목',840,76,56);assert.equal(title.size,76);assert.equal(title.lines.length,1);
title=box.fitTitle('열다섯글자제목을한줄에표시',840,76,56);assert.equal(title.lines.length,1);assert.ok(title.size<76 && title.size>=56);
for(const text of ['아주 긴 노래 제목은 읽기 좋도록 두 줄로 나눠서 표시해요','띄어쓰기없이아주아주길게이어지는노래제목을표시하는경우입니다']) {
 title=box.fitTitle(text,840,76,56);assert.equal(title.lines.length,2);
 for(const line of title.lines)assert.ok(ctx.measureText(line).width<=840,'줄이 영역을 넘지 않음');
}
console.log('짧은 제목·한 줄 축소·긴 제목 두 줄·띄어쓰기 없는 제목 통과');
