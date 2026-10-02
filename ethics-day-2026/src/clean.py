import cv2, numpy as np
im=cv2.imread('poster.png')
g=cv2.cvtColor(im,cv2.COLOR_BGR2GRAY).astype(np.float32)
bg=cv2.medianBlur(im,41)
d=np.abs(im.astype(np.int16)-bg.astype(np.int16)).max(axis=2)
mask=(d>18).astype(np.uint8)*255
# restrict to text column
lim=np.zeros_like(mask); lim[0:1500,0:790]=255
# exclude arch top-right & ball area
lim[960:1300,700:]=0
lim[720:800,600:700]=0
lim[760:1080,560:]=0
mask=cv2.bitwise_and(mask,lim)
# protect photo area city (x>480,y 730-1100) unless strongly dark purple text
hsv=cv2.cvtColor(im,cv2.COLOR_BGR2HSV)
mask=cv2.dilate(mask,np.ones((9,9),np.uint8),iterations=2)
# logo block + all text boxes explicitly
for (x0,y0,x1,y1) in [(60,30,280,120),(60,180,770,440),(60,440,600,490),(60,505,190,530),(60,550,600,680),(60,695,190,720),(60,735,590,770),(60,780,480,1060),(60,1095,360,1130),(60,1180,480,1345),(60,1365,150,1385),(60,1400,390,1440)]:
    sub=mask[y0:y1,x0:x1]
cv2.imwrite('mask.png',mask)
out=cv2.inpaint(im,mask,12,cv2.INPAINT_TELEA)
# second pass smoothing in masked area
blur=cv2.GaussianBlur(out,(0,0),6)
m=cv2.GaussianBlur(mask.astype(np.float32)/255,(0,0),5)[...,None]
out=(out*(1-m)+blur*m).astype(np.uint8)
cv2.imwrite('clean.png',out)
cv2.imwrite('clean_small.png',cv2.resize(out,(512,768)))
