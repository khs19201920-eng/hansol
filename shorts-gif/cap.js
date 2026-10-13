const {chromium}=require('playwright');
(async()=>{
 const [,,out,fps,only]=process.argv;
 const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'}).catch(()=>chromium.launch());
 const p=await b.newPage({viewport:{width:640,height:480}});
 await p.goto('file://'+__dirname+'/scene.html'); await p.evaluate(()=>document.fonts.ready);
 const T=await p.evaluate(()=>window.TOTAL);
 const times= only? only.split(',').map(Number) : Array.from({length:Math.round(T*fps)},(_,i)=>i/fps);
 for(let i=0;i<times.length;i++){await p.evaluate(t=>render(t),times[i]); await p.screenshot({path:`${out}/f${String(i).padStart(4,'0')}.png`});}
 console.log('frames',times.length,'T',T); await b.close();
})();
