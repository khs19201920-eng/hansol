import numpy as np, wave
SR=48000; T=30.0; N=int(SR*T)
t=np.arange(N)/SR
L=np.zeros(N); R=np.zeros(N)
rng=np.random.default_rng(7)
def m2f(m): return 440*2**((m-69)/12)
def env(a,b,att,rel):
    e=np.zeros(N); i0,i1=int(a*SR),min(N,int(b*SR))
    tt=t[i0:i1]-a; d=b-a
    e[i0:i1]=np.minimum(np.clip(tt/att,0,1),np.clip((d-tt)/rel,0,1))
    return np.sin(e*np.pi/2)**2
def pad_voice(f,e,det=0.25,bright=8,pan=0):
    out=np.zeros(N); idx=np.nonzero(e)[0]
    if len(idx)==0: return
    s=slice(idx[0],idx[-1]+1); tt=t[s]
    sig=np.zeros(len(tt))
    for dc in (-det,0,det):
        ff=f*2**(dc/12/10); ph=rng.uniform(0,6.28)
        for n in range(1,bright+1):
            sig+=np.sin(2*np.pi*ff*n*tt+ph*n)/n**1.4
    sig*=e[s]/3
    g=0.5
    L[s]+=sig*(1-pan)*g; R[s]+=sig*(1+pan)*g
def chord(notes,a,b,att=1.2,rel=1.2,amp=0.05,bright=7):
    e=env(a,b,att,rel)*amp
    for i,n in enumerate(notes):
        pad_voice(m2f(n),e,bright=bright,pan=((i%3)-1)*0.35)
# chord progression (D major)
chord([50,57,61,64,66],0.0,5.0,att=2.5,amp=.045)          # Dmaj9
chord([47,54,57,61,62,66],4.2,9.4,amp=.045)               # Bm9
chord([43,50,55,59,62,66,69],8.6,12.3,att=1.5,rel=.3,amp=.045,bright=9) # Gmaj7 build
chord([38,50,54,57,62,66,69,74],12.0,17.6,att=.02,rel=1.0,amp=.055,bright=10) # D big
chord([43,50,54,57,62,64,71],17.2,22.2,att=.6,amp=.045,bright=9)        # Gmaj9
chord([45,52,57,62,64,69],21.8,24.2,att=.5,amp=.045,bright=9)           # Asus
chord([45,52,57,61,64,69],24.0,26.5,att=.4,amp=.045,bright=9)           # A
chord([38,50,57,61,64,66,73],26.1,30.0,att=.3,rel=3.0,amp=.055,bright=8) # Dmaj9 resolve
def add(sig,at,amp=1,pan=0):
    i=int(at*SR); n=min(len(sig),N-i)
    L[i:i+n]+=sig[:n]*amp*(1-pan); R[i:i+n]+=sig[:n]*amp*(1+pan)
def bell(f,dur=2.5):
    tt=np.arange(int(dur*SR))/SR
    s=np.sin(2*np.pi*f*tt)+.5*np.sin(2*np.pi*f*2.01*tt)*np.exp(-tt*3)+.25*np.sin(2*np.pi*f*3.98*tt)*np.exp(-tt*5)
    return s*np.exp(-tt*2.2)*np.minimum(tt/0.004,1)
# scene chimes
add(bell(m2f(81)),1.0,.06,-.3); add(bell(m2f(78)),4.5,.06,.3); add(bell(m2f(76)),8.9,.06,-.2)
for i,m in enumerate([74,78,81,86]): add(bell(m2f(m)),22.75+i*.5,.07,(i-1.5)*.3)
add(bell(m2f(90),4),26.3,.05,0)
# riser 10.2-12.0 : filtered noise swell + pitch sweep
dur=1.85; tt=np.arange(int(dur*SR))/SR; k=tt/dur
noise=rng.normal(0,1,len(tt)); 
# crude highpass-ish via diff, then shape
nz=np.diff(noise,prepend=0)*0.5
sweep=np.sin(2*np.pi*np.cumsum(200+1800*k**2)/SR)*0.3
add((nz*.5+sweep)*k**3,10.2,.12)
# reverse cymbal-ish suck before hit
# impact at 12.05 : sub boom + noise burst
tt=np.arange(int(3.0*SR))/SR
boom=np.sin(2*np.pi*np.cumsum(30+90*np.exp(-tt*18))/SR)*np.exp(-tt*1.4)
burst=rng.normal(0,1,len(tt))*np.exp(-tt*9)
add(boom,12.05,.55); add(burst,12.05,.10)
add(boom,26.15,.25)
# heartbeat pulse 12.6-25.6 at 96bpm
def kick():
    tt=np.arange(int(.5*SR))/SR
    return np.sin(2*np.pi*np.cumsum(45+120*np.exp(-tt*30))/SR)*np.exp(-tt*7)
beat=60/96
x=12.05+beat*2
while x<25.7:
    a=.16+0.1*((x-12)/13)
    add(kick(),x,a); x+=beat
# soft pluck arpeggio 17.2-25.8 (eighths)
arp={17.2:[62,66,69,74],21.8:[64,69,71,76],24.0:[64,69,73,76]}
x=17.25; step=beat/2; j=0
while x<25.8:
    key=max(kk for kk in arp if kk<=x); notes=arp[key]
    f=m2f(notes[j%4]+12); tt=np.arange(int(.6*SR))/SR
    s=(np.sin(2*np.pi*f*tt)+.3*np.sin(4*np.pi*f*tt))*np.exp(-tt*8)*np.minimum(tt/.003,1)
    add(s,x,.035,.4*np.sin(j)); x+=step; j+=1
# date counter ticks 17.9-19.0
for i in range(14):
    tt=np.arange(int(.03*SR))/SR
    add(rng.normal(0,1,len(tt))*np.exp(-tt*200),17.9+i*0.08,.04)
# reverb (FFT convolution)
irn=int(3.2*SR); it=np.arange(irn)/SR
def rev(x,seed):
    r=np.random.default_rng(seed).normal(0,1,irn)*np.exp(-it*2.0)
    n=1<<int(np.ceil(np.log2(len(x)+irn)))
    y=np.fft.irfft(np.fft.rfft(x,n)*np.fft.rfft(r,n),n)[:len(x)]
    return y/np.sqrt(np.sum(r**2))
Lw=L+rev(L,1)*.55; Rw=R+rev(R,2)*.55
# master fade & normalize
fade=np.clip(t/0.6,0,1)*np.clip((30-t)/1.2,0,1)
Lw*=fade; Rw*=fade
mx=max(np.abs(Lw).max(),np.abs(Rw).max())
st=np.tanh(np.stack([Lw,Rw],1)/mx*1.2)/np.tanh(1.2)*0.89
with wave.open('bgm.wav','wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((st*32767).astype('<i2').tobytes())
print('ok')
