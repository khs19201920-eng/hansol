import numpy as np, math, os, subprocess, shutil, sys
from PIL import Image, ImageDraw, ImageFilter
SRC=sys.argv[1] if len(sys.argv)>1 else 'GI_Buddy_edited.png'
OUT=sys.argv[2] if len(sys.argv)>2 else '.'
base=Image.open(SRC).convert('RGB'); B=np.array(base).astype(np.float32)
H,W=B.shape[:2]
N=72; FPS=20

def smooth(t): return t*t*(3-2*t)
def window(f,a,b): return None if f<a or f>b else (f-a)/(b-a)
def elastic(p,amp):   # 0->peak->settle, always >=0 overshoot
    return amp*abs(math.sin(p*math.pi*2.5))*math.exp(-3.2*p) if p<1 else 0
def blend(fa,x0,y0,img,alpha):
    h,w=alpha.shape[:2]
    x1,y1=min(W,x0+w),min(H,y0+h); xs,ys=max(0,x0),max(0,y0)
    a=alpha[ys-y0:y1-y0,xs-x0:x1-x0]; im=img[ys-y0:y1-y0,xs-x0:x1-x0]
    fa[ys:y1,xs:x1]=fa[ys:y1,xs:x1]*(1-a)+im*a

# ---------- generic pop: scale/rotate a masked region about an anchor ----------
class Pop:
    def __init__(s,box,mask,anchor,pad=24):
        x0,y0,x1,y1=box; s.r=(x0-pad,y0-pad,x1+pad,y1+pad)
        s.crop=base.crop(s.r)
        m=Image.new('L',s.crop.size,0); m.paste(mask,(pad,pad)); s.mask=m
        s.ax,s.ay=anchor[0]-s.r[0],anchor[1]-s.r[1]
    def apply(s,fa,sc,ang=0,dy=0):
        if sc<=1.001 and abs(ang)<0.05 and dy==0: return
        c=math.cos(math.radians(ang)); si=math.sin(math.radians(ang))
        a,b=c/sc,si/sc; d,e=-si/sc,c/sc
        ax,ay=s.ax,s.ay+dy
        inv=(a,b,s.ax-a*ax-b*ay,d,e,s.ay-d*ax-e*ay)
        w,h=s.crop.size
        ci=s.crop.transform((w,h),Image.AFFINE,inv,Image.BICUBIC)
        mi=s.mask.transform((w,h),Image.AFFINE,inv,Image.BILINEAR).filter(ImageFilter.GaussianBlur(1.2))
        blend(fa,s.r[0],s.r[1],np.array(ci).astype(np.float32),np.array(mi).astype(np.float32)[...,None]/255)

def shape_mask(box,cond,grow=9,close=15):
    x0,y0,x1,y1=box; s=B[y0:y1,x0:x1]
    m=Image.fromarray((cond(s)*255).astype(np.uint8))
    m=m.filter(ImageFilter.MaxFilter(close)).filter(ImageFilter.MinFilter(close))
    if grow>=3: m=m.filter(ImageFilter.MaxFilter(grow|1))
    return m
pink=lambda s:(s[...,0]>180)&(s[...,1]<120)&(s[...,2]>80)

# speech bubble
bbox=(480,10,698,166)
bub=Pop(bbox,shape_mask(bbox,pink,6,17),(590,160))
# logo "GI Buddy" (whole word block)
lbox=(32,232,400,334)
logo=Pop(lbox,shape_mask(lbox,lambda s:s.mean(2)<170,8,13),(216,300),pad=30)
# right column icon circles
circles=[]
for cy in (150,258,370,478):
    cx=873; r=42; box=(cx-r,cy-r,cx+r,cy+r)
    m=Image.new('L',(2*r,2*r),0); ImageDraw.Draw(m).ellipse((1,1,2*r-2,2*r-2),fill=255)
    circles.append(Pop(box,m,(cx,cy),pad=14))
# tile icons
tiles=[]
for (x0,x1,y0,y1) in [(95,148,653,703),(268,331,652,700),(458,514,652,697),(646,691,649,703)]:
    box=(x0-6,y0-6,x1+6,y1+6)
    cond=lambda s:((s.max(2)-s.min(2))>70)|(s.mean(2)<120)
    tiles.append(Pop(box,shape_mask(box,cond,10,9),((x0+x1)//2,y1+4),pad=16))
# CTA button
cbox=(946,1167,1235,1228)
cm=Image.new('L',(cbox[2]-cbox[0],cbox[3]-cbox[1]),0)
ImageDraw.Draw(cm).rounded_rectangle((0,0,cm.width-1,cm.height-1),radius=cm.height//2,fill=255)
cta=Pop(cbox,cm,((cbox[0]+cbox[2])//2,(cbox[1]+cbox[3])//2),pad=22)

# ---------- dashes ----------
dx0,dy0,dx1,dy1=698,42,730,92
pm=pinkmask=(pink(B))
dmask=np.array(Image.fromarray((pm[dy0:dy1,dx0:dx1]*255).astype(np.uint8)).filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(1))).astype(np.float32)[...,None]/255
t=B[dy0-10:dy1+10,dx0-10:dx1+10]; bgcol=t[~pm[dy0-10:dy1+10,dx0-10:dx1+10]].mean(0)
def dashes(fa,alpha):
    k=dmask*(1-alpha); fa[dy0:dy1,dx0:dx1]=fa[dy0:dy1,dx0:dx1]*(1-k)+bgcol*k

# ---------- shine sweep ----------
def shine(fa,box,p,strength,width,slant,maskfn):
    x0,y0,x1,y1=box; reg=fa[y0:y1,x0:x1]
    yy,xx=np.mgrid[0:y1-y0,0:x1-x0]
    pos=-width*3+p*(x1-x0+width*6)
    band=np.exp(-(((xx+yy*slant)-pos)/width)**2)[...,None]*strength
    k=band*maskfn(reg)
    fa[y0:y1,x0:x1]=reg*(1-k)+255*k
logomask=lambda r:np.clip((215-r.mean(2))/90,0,1)[...,None]
ctx0=cbox
ctam=np.array(cm.filter(ImageFilter.GaussianBlur(1))).astype(np.float32)[...,None]/255
ctamask=lambda r:ctam

# ---------- eye blink ----------
eyes=[(468,224,523,266),(544,210,598,253)]
def coons(reg):
    h,w,_=reg.shape; v=np.linspace(0,1,h)[:,None,None]; u=np.linspace(0,1,w)[None,:,None]
    return (reg[0][None]*(1-v)+reg[-1][None]*v + reg[:,0][:,None]*(1-u)+reg[:,-1][:,None]*u)/2
eyedata=[]
for (x0,y0,x1,y1) in eyes:
    reg=B[y0:y1,x0:x1]; bg=coons(reg); m=np.clip((reg.mean(2)-bg.mean(2))/150,0,1)[...,None]
    eyedata.append((x0,y0,x1,y1,bg,reg,m))
def blink(fa,sy):
    for (x0,y0,x1,y1,bg,reg,m) in eyedata:
        h,w=reg.shape[:2]; im=Image.fromarray(np.concatenate([reg,m*255],2).astype(np.uint8),'RGBA')
        nh=max(2,round(h*sy)); sq=im.resize((w,nh),Image.LANCZOS)
        cv=Image.new('RGBA',(w,h),(0,0,0,0)); cv.paste(sq,(0,int(h*0.62)-nh//2))
        c=np.array(cv).astype(np.float32); a=c[...,3:]/255
        fa[y0:y1,x0:x1]=bg*(1-a)+c[...,:3]*a

# ---------- glow ring around CTA ----------
gpad=16
ring=Image.new('L',(cm.width+2*gpad,cm.height+2*gpad),0)
ImageDraw.Draw(ring).rounded_rectangle((gpad,gpad,gpad+cm.width,gpad+cm.height),radius=cm.height//2,outline=255,width=6)
ring=np.array(ring.filter(ImageFilter.GaussianBlur(6))).astype(np.float32)[...,None]/255; ring/=ring.max()
def glow(fa,g):
    x0,y0=cbox[0]-gpad,cbox[1]-gpad; h,w=ring.shape[:2]
    blend(fa,x0,y0,np.full((h,w,3),(255,215,235),np.float32),ring*g)

# ---------- sparkles ----------
SS=4
def star_sprite(size,col):
    S=size*SS*2; c=S/2; L=S/2
    def star(scale,w,fill):
        im=Image.new('RGBA',(S,S),(0,0,0,0)); d=ImageDraw.Draw(im); l=L*scale
        for (dx,dy) in [(1,0),(0,1)]:
            d.polygon([(c-dx*l,c-dy*l),(c+dy*w,c+dx*w),(c+dx*l,c+dy*l),(c-dy*w,c-dx*w)],fill=fill)
        return im
    glowim=star(1.0,S*0.10,col+(200,)).filter(ImageFilter.GaussianBlur(S*0.04))
    core=star(0.85,S*0.05,(255,255,255,255))
    dot=Image.new('RGBA',(S,S),(0,0,0,0)); ImageDraw.Draw(dot).ellipse((c-S*0.07,c-S*0.07,c+S*0.07,c+S*0.07),fill=(255,255,255,255))
    return Image.alpha_composite(Image.alpha_composite(glowim,core),dot)
sprites={}
def sparkle(fa,x,y,size,p,col=(255,255,255)):
    if p is None: return
    k=math.sin(math.pi*p)
    if k<=0.02: return
    sz=max(3,round(size*(0.4+0.6*k)))
    key=(sz,col,round(p*8))
    spr=star_sprite(sz,col).rotate(p*90,Image.BICUBIC)
    spr=spr.resize((sz*2,sz*2),Image.LANCZOS)
    a=np.array(spr).astype(np.float32); al=a[...,3:]/255*k
    blend(fa,x-sz,y-sz,a[...,:3],al)
PINK=(255,120,190); WHITE=(255,255,255)
sparks=[  # x,y,size,start,dur,color
 (402,236,13,6,14,PINK),(30,240,10,14,12,WHITE),(150,236,9,22,12,PINK),
 (470,40,12,2,12,PINK),(700,110,10,10,12,PINK),(450,170,9,40,12,PINK),
 (770,215,11,30,14,PINK),(610,300,8,50,12,WHITE),
 (360,180,9,56,12,PINK),(1238,1165,12,50,14,WHITE),(950,1235,10,60,11,WHITE),
 (1225,96,9,26,12,PINK),(800,600,9,64,8,PINK),
]

frames=[]
for f in range(N):
    fa=B.copy()
    # 1 bubble elastic pop + wobble (twice per loop)
    for st in (0,36):
        p=window(f,st,st+16)
        if p is not None:
            bub.apply(fa,1+elastic(p,0.16),ang=6*math.sin(p*math.pi*3)*math.exp(-3*p))
            dashes(fa,0.5+0.5*math.cos(2*math.pi*p*2))
    # 2 logo pulse + strong shine
    p=window(f,10,26)
    if p is not None: shine(fa,(30,228,404,338),smooth(p),0.85,16,0.5,logomask)
    # 3 eyes: double blink
    sy={28:0.4,29:0.1,30:0.5,31:1,32:0.4,33:0.1,34:0.5}.get(f)
    if sy and sy<1: blink(fa,sy)
    # 4 right-column icon circles: sequential pop
    for i,c in enumerate(circles):
        p=window(f,18+i*6,18+i*6+14)
        if p is not None: c.apply(fa,1+elastic(p,0.22),ang=10*math.sin(p*math.pi*2)*math.exp(-3*p))
    # 5 tile icons hop
    for i,tl in enumerate(tiles):
        p=window(f,40+i*5,40+i*5+12)
        if p is not None: tl.apply(fa,1+elastic(p,0.25))
    # 6 CTA heartbeat + glow + shine
    for st in (44,54):
        p=window(f,st,st+8)
        if p is not None: cta.apply(fa,1+0.07*math.sin(math.pi*p))
    p=window(f,42,71)
    if p is not None:
        glow(fa,0.75*math.sin(math.pi*p))
        shine(fa,cbox,smooth(window(f,46,66) or 0) if 46<=f<=66 else -1,0.55,14,-0.6,ctamask) if 46<=f<=66 else None
    # 7 sparkles
    for (x,y,s,st,du,col) in sparks:
        sparkle(fa,x,y,s,window(f,st,st+du),col)
    frames.append(np.clip(fa+0.5,0,255).astype(np.uint8))

tmp='frames'; shutil.rmtree(tmp,ignore_errors=True); os.makedirs(tmp)
for i,fr in enumerate(frames): Image.fromarray(fr).save(f'{tmp}/{i:03d}.png')
def enc(width,out):
    sc=f'scale={width}:-1:flags=lanczos,' if width!=W else ''
    pal=f'{tmp}/pal.png'
    subprocess.run(['ffmpeg','-v','error','-y','-framerate',str(FPS),'-i',f'{tmp}/%03d.png','-vf',sc+'palettegen=max_colors=256:stats_mode=full',pal],check=True)
    subprocess.run(['ffmpeg','-v','error','-y','-framerate',str(FPS),'-i',f'{tmp}/%03d.png','-i',pal,'-lavfi',sc+'paletteuse=dither=sierra2_4a:diff_mode=rectangle','-loop','0',out],check=True)
    print(out,os.path.getsize(out)//1024,'KB')
enc(W,os.path.join(OUT,'GI_Buddy_motion.gif'))
enc(752,os.path.join(OUT,'GI_Buddy_motion_email.gif'))
