const { chromium } = require('/opt/node22/lib/node_modules/playwright');
(async()=>{
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
  const p=await b.newPage({viewport:{width:1280,height:900},deviceScaleFactor:2});
  await p.goto('file://'+__dirname+'/card.html'); await p.evaluate(()=>document.fonts.ready);
  await p.waitForTimeout(300);
  const info=await p.evaluate(()=>{const r=s=>[...document.querySelectorAll(s)].map(e=>{const b=e.getBoundingClientRect();return [Math.round(b.top),Math.round(b.height),Math.round(b.width), e.scrollWidth>e.clientWidth+1]});return {h:document.body.scrollHeight,cols:r('.col'),tiles:r('.tile p'),rec:r('.rec span'),q:r('.q')}});
  console.log(JSON.stringify(info));
  await p.screenshot({path:process.argv[2]||'card.png',fullPage:true});
  await b.close();
})();
