import numpy as np, math
from PIL import Image, ImageDraw, ImageFilter
SRC='GI_Buddy_edited.png'
base=Image.open(SRC).convert('RGB'); B=np.array(base).astype(np.float32)
H,W=B.shape[:2]
N=40; DUR=75

def smooth(t): return t*t*(3-2*t)
def window(f,a,b):  # 0..1 progress within [a,b], None outside
    return None if f<a or f>b else (f-a)/(b-a)

# ---------- bubble pop ----------
bx0,by0,bx1,by1=470,8,700,168
pinkmask=((B[...,0]>180)&(B[...,1]<120)&(B[...,2]>80))
bub=np.zeros((H,W),bool); bub[by0:by1,bx0:bx1]=pinkmask[by0:by1,bx0:bx1]
bubimg=Image.fromarray((bub*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))
# fill holes (text) by closing
bubimg=bubimg.filter(ImageFilter.MaxFilter(15)).filter(ImageFilter.MinFilter(9))
anchor=(590,160)  # tail tip
def bubble(frame_arr,s):
    if s<=1.0005: return
    region=(bx0-20,by0-8,bx1+20,by1+10)
    crop=base.crop(region); m=bubimg.crop(region)
    w,h=crop.size; ax,ay=anchor[0]-region[0],anchor[1]-region[1]
    # affine scale about anchor
    inv=(1/s,0,ax-ax/s,0,1/s,ay-ay/s)
    c2=crop.transform((w,h),Image.AFFINE,inv,Image.BICUBIC)
    m2=m.transform((w,h),Image.AFFINE,inv,Image.BILINEAR).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(2))
    a=np.array(m2).astype(np.float32)[...,None]/255
    x0,y0=region[:2]
    frame_arr[y0:y0+h,x0:x0+w]=frame_arr[y0:y0+h,x0:x0+w]*(1-a)+np.array(c2).astype(np.float32)*a

# ---------- dashes twinkle ----------
dx0,dy0,dx1,dy1=698,42,730,92
dash=pinkmask[dy0:dy1,dx0:dx1]
dmask=np.array(Image.fromarray((dash*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1))).astype(np.float32)[...,None]/255
# background estimate: blur after replacing pink with neighbours
tmp=base.crop((dx0-10,dy0-10,dx1+10,dy1+10)); t=np.array(tmp).astype(np.float32)
pm=pinkmask[dy0-10:dy1+10,dx0-10:dx1+10]
bgcol=t[~pm].mean(0)
def dashes(fa,alpha):  # alpha 1 = original, 0 = hidden
    reg=fa[dy0:dy1,dx0:dx1]
    k=dmask*(1-alpha)
    fa[dy0:dy1,dx0:dx1]=reg*(1-k)+bgcol*k

# ---------- logo shimmer ----------
lx0,ly0,lx1,ly1=30,228,402,336
L=B[ly0:ly1,lx0:lx1]; lum=L.mean(2)
lmask=np.clip((215-lum)/90,0,1)[...,None]
yy,xx=np.mgrid[0:ly1-ly0,0:lx1-lx0]
def shimmer(fa,p):
    pos=-80+p*(lx1-lx0+160)
    d=(xx+ (yy*0.45))-pos
    band=np.exp(-(d/18)**2)[...,None]*0.55
    reg=fa[ly0:ly1,lx0:lx1]
    k=band*lmask
    fa[ly0:ly1,lx0:lx1]=reg*(1-k)+255*k

# ---------- eye blink ----------
eyes=[(468,224,523,266),(544,210,598,253)]
def coons(reg):
    h,w,_=reg.shape
    top,bot,lef,rig=reg[0],reg[-1],reg[:,0],reg[:,-1]
    v=np.linspace(0,1,h)[:,None,None]; u=np.linspace(0,1,w)[None,:,None]
    a=top[None]*(1-v)+bot[None]*v
    b=lef[:,None]*(1-u)+rig[:,None]*u
    return (a+b)/2
eyedata=[]
for (x0,y0,x1,y1) in eyes:
    reg=B[y0:y1,x0:x1]; bg=coons(reg)
    m=np.clip((reg.mean(2)-bg.mean(2))/150,0,1)[...,None]
    eyedata.append((x0,y0,x1,y1,bg,reg,m))
def blink(fa,sy):
    for (x0,y0,x1,y1,bg,reg,m) in eyedata:
        h,w=reg.shape[:2]
        rgba=np.concatenate([reg,m*255],2).astype(np.uint8)
        im=Image.fromarray(rgba,'RGBA')
        nh=max(2,round(h*sy)); sq=im.resize((w,nh),Image.LANCZOS)
        canvas=Image.new('RGBA',(w,h),(0,0,0,0)); cy=int(h*0.62)
        canvas.paste(sq,(0,cy-nh//2))
        c=np.array(canvas).astype(np.float32); a=c[...,3:]/255
        fa[y0:y1,x0:x1]=bg*(1-a)+c[...,:3]*a

# ---------- CTA shine + glow ----------
cx0,cy0,cx1,cy1=948,1169,1233,1226
cw,ch=cx1-cx0,cy1-cy0
inner=Image.new('L',(cw,ch),0); ImageDraw.Draw(inner).rounded_rectangle((4,4,cw-5,ch-5),radius=(ch-8)//2,fill=255)
inner=np.array(inner.filter(ImageFilter.GaussianBlur(1))).astype(np.float32)[...,None]/255
gx0,gy0,gx1,gy1=cx0-14,cy0-14,cx1+14,cy1+14
ring=Image.new('L',(gx1-gx0,gy1-gy0),0); ImageDraw.Draw(ring).rounded_rectangle((14,14,14+cw,14+ch),radius=ch//2,outline=255,width=5)
ring=np.array(ring.filter(ImageFilter.GaussianBlur(5))).astype(np.float32)[...,None]/255
ring=ring/ring.max()
cyy,cxx=np.mgrid[0:ch,0:cw]
def cta(fa,p,glow):
    if glow>0:
        reg=fa[gy0:gy1,gx0:gx1]; k=ring*glow
        fa[gy0:gy1,gx0:gx1]=reg*(1-k)+np.array([255,225,240],np.float32)*k
    if p is not None:
        pos=-60+p*(cw+120); d=(cxx-cyy*0.6)-pos
        band=np.exp(-(d/14)**2)[...,None]*0.38*inner
        reg=fa[cy0:cy1,cx0:cx1]; fa[cy0:cy1,cx0:cx1]=reg*(1-band)+255*band

frames=[]
for f in range(N):
    fa=B.copy()
    p=window(f,0,10)
    if p is not None:
        bubble(fa,1+0.045*math.sin(math.pi*p)*(1-0.35*p))
        dashes(fa,0.5+0.5*math.cos(2*math.pi*p))
    p=window(f,11,22)
    if p is not None: shimmer(fa,smooth(p))
    sy={24:0.55,25:0.15,26:0.15,27:0.55}.get(f)
    if sy: blink(fa,sy)
    p=window(f,28,N-1)
    if p is not None: cta(fa,smooth(p),0.4*math.sin(math.pi*p))
    frames.append(np.clip(fa+0.5,0,255).astype(np.uint8))

# --- palette: one global palette, base dithered once, only changed pixels re-mapped ---
def build(scale, out):
    fr=[Image.fromarray(x) for x in frames]
    if scale!=1:
        sz=(round(W*scale),round(H*scale)); fr=[x.resize(sz,Image.LANCZOS) for x in fr]
    # add highlight-friendly colours by quantizing a mosaic of all frames
    mosaic=Image.new('RGB',(fr[0].width,fr[0].height*2)); mosaic.paste(fr[0],(0,0)); mosaic.paste(fr[N//2],(0,fr[0].height))
    pal=mosaic.quantize(256,method=Image.Quantize.MEDIANCUT)
    b0=np.array(fr[0]).astype(int)
    q0=fr[0].quantize(palette=pal,dither=Image.Dither.FLOYDSTEINBERG); I0=np.array(q0)
    out_frames=[]
    for x in fr:
        a=np.array(x).astype(int)
        diff=np.abs(a-b0).sum(2)>6
        qi=np.array(x.quantize(palette=pal,dither=Image.Dither.FLOYDSTEINBERG))
        I=np.where(diff,qi,I0).astype(np.uint8)
        im=Image.fromarray(I,'P'); im.putpalette(pal.getpalette())
        out_frames.append(im)
    out_frames[0].save(out,save_all=True,append_images=out_frames[1:],duration=DUR,loop=0,optimize=False,disposal=1)
import os
for s,name in [(1,'GI_Buddy_motion.gif'),(0.6,'GI_Buddy_motion_email.gif')]:
    p=name; build(s,p); print(name, os.path.getsize(p)//1024,'KB')
