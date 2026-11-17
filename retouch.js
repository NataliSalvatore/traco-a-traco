'use strict';
// Replace a local outlier only when samples on every side agree on its surroundings.
function removeSpecks(image, strength, cleanPaper = false) {
  const {data, width, height} = image;
  const result = new Uint8ClampedArray(data);
  const threshold = [42, 32, 25][strength];
  const tolerance = [12, 16, 20][strength];
  for (let radius = 1; radius <= strength + 1; radius++) {
    const dx = radius * 4, dy = dx * width;
    const offsets = [-dx, dx, -dy, dy, -dx-dy, dx+dy, dx-dy, dy-dx];
    for (let y = radius; y < height-radius; y++) {
      for (let x = radius; x < width-radius; x++) {
        const p = (y*width+x)*4, left = p-dx;
        if (data[p+3] === 0 || Math.max(Math.abs(data[p]-data[left]), Math.abs(data[p+1]-data[left+1]), Math.abs(data[p+2]-data[left+2])) < threshold) continue;
        let r=0, g=0, b=0, count=0;
        for (const offset of offsets) {
          const q = p+offset;
          if (data[q+3] !== data[p+3] || Math.max(Math.abs(data[q]-data[left]),Math.abs(data[q+1]-data[left+1]),Math.abs(data[q+2]-data[left+2])) > tolerance) break;
          r+=data[q]; g+=data[q+1]; b+=data[q+2]; count++;
        }
        if (count===offsets.length) {
          result[p]=r/count; result[p+1]=g/count; result[p+2]=b/count;
        }
      }
    }
  }
  smoothPaint(result,width,height,strength);
  if (cleanPaper) whitenPaper(result,width,height);
  return result;
}

// Smooth within a painted region. Strong color changes and alpha edges stop
// the recursive filter, including during the reverse pass.
function smoothPaint(data,width,height,strength) {
  const count=width*height;
  const horizontal=new Uint8Array(count), vertical=new Uint8Array(count);
  function difference(p,q){
    if(data[p+3]!==data[q+3])return 255;
    return Math.max(Math.abs(data[p]-data[q]),Math.abs(data[p+1]-data[q+1]),Math.abs(data[p+2]-data[q+2]));
  }
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=y*width+x,p=i*4;
    if(x)horizontal[i]=difference(p,p-4);
    if(y)vertical[i]=difference(p,p-width*4);
  }
  const field=new Float32Array(count);
  const radius=[6,20,42][strength], contrast=[4,8,12][strength];
  for(let channel=0;channel<3;channel++){
    for(let i=0;i<count;i++)field[i]=data[4*i+channel];
    for(const factor of [1,0.5,0.25]){
      const weight=Float32Array.from({length:256},(_,d)=>d>=40?0:Math.exp(-1/(radius*factor)-d*d/(contrast*contrast*factor)));
      for(let y=0;y<height;y++){
        const start=y*width,end=start+width;
        for(let i=start+1;i<end;i++)field[i]+=weight[horizontal[i]]*(field[i-1]-field[i]);
        for(let i=end-2;i>=start;i--)field[i]+=weight[horizontal[i+1]]*(field[i+1]-field[i]);
      }
      for(let i=width;i<count;i++)field[i]+=weight[vertical[i]]*(field[i-width]-field[i]);
      for(let i=count-width-1;i>=0;i--)field[i]+=weight[vertical[i+width]]*(field[i+width]-field[i]);
    }
    for(let i=0;i<count;i++)if(data[4*i+3])data[4*i+channel]=field[i];
  }
}

// Only the nearly white, neutral paper reachable from the outer edge is eligible.
function whitenPaper(data,width,height) {
  const visited=new Uint8Array(width*height), queue=new Int32Array(width*height);
  let head=0,tail=0;
  function add(n){
    if(visited[n])return;
    visited[n]=1;
    const i=n*4,low=Math.min(data[i],data[i+1],data[i+2]);
    if(data[i+3]!==255 || low<245 || Math.max(data[i],data[i+1],data[i+2])-low>5)return;
    queue[tail++]=n;
    // Taper gently into off-white edges.
    const amount=Math.min(1,(low-245)/6);
    for(let c=0;c<3;c++)data[i+c]+=(255-data[i+c])*amount;
  }
  for(let x=0;x<width;x++){add(x);add((height-1)*width+x);}
  for(let y=0;y<height;y++){add(y*width);add(y*width+width-1);}
  while(head<tail){
    const n=queue[head++],x=n%width;
    if(x)add(n-1);if(x+1<width)add(n+1);
    if(n>=width)add(n-width);if(n+width<queue.length)add(n+width);
  }
}
