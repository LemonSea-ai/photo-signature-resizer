/* Exact-size photo & signature resizer — 100% client-side.
   Injects an interactive widget into <div id="app-tool" data-...></div>.
   Reusable across all landing pages. */
(function(){
  var PRESETS = [
    {id:'sig10',  name:'Signature 10KB',   note:'140×60 · white', w:140, h:60,  kb:10,  mode:'contain'},
    {id:'sig20',  name:'Signature 20KB',   note:'140×60 · white', w:140, h:60,  kb:20,  mode:'contain'},
    {id:'photo',  name:'Exam Photo',       note:'200×230 · 50KB', w:200, h:230, kb:50,  mode:'cover'},
    {id:'usvisa', name:'US Visa Photo',    note:'600×600 · 240KB',w:600, h:600, kb:240, mode:'cover'},
    {id:'schengen',name:'Schengen/EU Visa',note:'413×531 · 100KB',w:413, h:531, kb:100, mode:'cover'},
    {id:'free',   name:'Just compress',    note:'keep size · set KB', w:0, h:0, kb:100, mode:'contain'}
  ];

  function el(html){var d=document.createElement('div');d.innerHTML=html.trim();return d.firstChild;}
  function fmt(b){if(b<1024)return b+' B';if(b<1048576)return (b/1024).toFixed(1)+' KB';return (b/1048576).toFixed(2)+' MB';}
  function toBlob(c,t,q){return new Promise(function(r){c.toBlob(function(b){r(b);},t,q);});}

  function render(img, W, H, mode, bg){
    // If W/H are 0 -> keep natural size (optionally capped)
    var nat = {w: img.naturalWidth, h: img.naturalHeight};
    var tw = W>0 ? W : nat.w, th = H>0 ? H : nat.h;
    var c = document.createElement('canvas'); c.width = tw; c.height = th;
    var ctx = c.getContext('2d');
    ctx.fillStyle = bg; ctx.fillRect(0,0,tw,th);
    if(W>0 && H>0){
      var ar = nat.w/nat.h, tr = tw/th, dw, dh;
      if(mode==='cover'){ if(ar>tr){dh=th; dw=th*ar;} else {dw=tw; dh=tw/ar;} }
      else { if(ar>tr){dw=tw; dh=tw/ar;} else {dh=th; dw=th*ar;} } // contain
      ctx.drawImage(img,(tw-dw)/2,(th-dh)/2,dw,dh);
    } else {
      ctx.drawImage(img,0,0,tw,th);
    }
    return c;
  }
  function scaled(canvasSrcImg, img, factor, bg){
    var w=Math.max(1,Math.round(img.naturalWidth*factor)), h=Math.max(1,Math.round(img.naturalHeight*factor));
    var c=document.createElement('canvas');c.width=w;c.height=h;var x=c.getContext('2d');
    x.fillStyle=bg;x.fillRect(0,0,w,h);x.drawImage(img,0,0,w,h);return c;
  }
  async function bestQuality(canvas, type, targetBytes){
    var lo=0.05, hi=1, best=null;
    for(var i=0;i<8;i++){var m=(lo+hi)/2;var b=await toBlob(canvas,type,m);
      if(b && b.size<=targetBytes){best=b;lo=m;} else hi=m;}
    return best;
  }
  // returns {blob, w, h, hit}
  async function compress(img, opts){
    var bg = opts.bg, type = opts.type, targetBytes = opts.kb*1024;
    if(opts.w>0 && opts.h>0){
      var c = render(img, opts.w, opts.h, opts.mode, bg);
      var b = await bestQuality(c, type, targetBytes);
      if(b) return {blob:b, w:c.width, h:c.height, hit:true};
      var low = await toBlob(c, type, 0.05);
      return {blob:low, w:c.width, h:c.height, hit:false};
    }
    // no fixed dims -> shrink dimensions until it fits
    var f=1, bb=null;
    for(var i=0;i<8 && f>0.08;i++){
      var cv=scaled(null,img,f,bg);
      bb=await bestQuality(cv,type,targetBytes);
      if(bb) return {blob:bb, w:cv.width, h:cv.height, hit:true};
      f*=0.8;
    }
    var cv2=scaled(null,img,f,bg); var lo2=await toBlob(cv2,type,0.05);
    return {blob:lo2, w:cv2.width, h:cv2.height, hit:false};
  }

  var TOOL_HTML =
   '<div class="card">'+
    '<div class="presets" data-el="presets"></div>'+
    '<div class="drop" data-el="drop"><strong data-el="droptext">Click to choose an image</strong> or drag &amp; drop'+
      '<p>JPG · PNG · WebP — processed privately in your browser</p>'+
      '<input type="file" accept="image/*" hidden data-el="file"></div>'+
    '<div class="controls" data-el="controls">'+
      '<div class="grid">'+
        '<div class="field"><label>Width (px) — blank = keep</label><input type="number" min="1" data-el="w" placeholder="auto"></div>'+
        '<div class="field"><label>Height (px) — blank = keep</label><input type="number" min="1" data-el="h" placeholder="auto"></div>'+
        '<div class="field"><label>Fit</label><select data-el="mode">'+
          '<option value="contain">Contain (pad white — keep whole image)</option>'+
          '<option value="cover">Cover (crop to fill exactly)</option></select></div>'+
        '<div class="field"><label>Output</label><select data-el="format">'+
          '<option value="image/jpeg">JPG (smallest)</option>'+
          '<option value="image/webp">WebP (keeps transparency)</option></select></div>'+
      '</div>'+
      '<div class="field"><label>Target size (KB)</label><input type="number" min="1" data-el="kb" value="20">'+
        '<div class="kbchips" data-el="kbchips"></div></div>'+
      '<button class="btn" data-el="go" style="margin-top:14px;">Resize &amp; compress</button>'+
    '</div>'+
    '<div class="result" data-el="result">'+
      '<div class="preview"><img data-el="thumb" alt="result preview">'+
        '<div class="stats">'+
          '<div><span>Original</span><span data-el="orig">—</span></div>'+
          '<div><span>Result</span><span class="big" data-el="newsz">—</span></div>'+
          '<div><span>Dimensions</span><span data-el="dims">—</span></div>'+
        '</div></div>'+
      '<p class="note" data-el="note"></p>'+
      '<button class="btn" data-el="dl" style="margin-top:12px;">⬇ Download</button>'+
      '<button class="btn ghost" data-el="reset" style="margin-top:8px;">Start over</button>'+
    '</div>'+
   '</div>';

  function initMount(mount){
    mount.appendChild(el(TOOL_HTML));
    var q=function(n){return mount.querySelector('[data-el="'+n+'"]');};
    var state={file:null,img:null,blob:null};

    // presets
    var defPreset = mount.getAttribute('data-preset') || 'sig20';
    PRESETS.forEach(function(p){
      var b=el('<button class="preset" data-id="'+p.id+'">'+p.name+'<small>'+p.note+'</small></button>');
      b.addEventListener('click',function(){applyPreset(p,b);});
      q('presets').appendChild(b);
      if(p.id===defPreset){ setTimeout(function(){applyPreset(p,b);},0); }
    });
    function applyPreset(p,btn){
      mount.querySelectorAll('.preset').forEach(function(x){x.classList.remove('active');});
      btn.classList.add('active');
      q('w').value = p.w>0?p.w:''; q('h').value = p.h>0?p.h:'';
      q('kb').value = p.kb; q('mode').value = p.mode;
      syncKbChips();
    }

    // kb quick chips
    [10,20,50,100,200,500].forEach(function(k){
      var c=el('<span class="kbchip">'+k+' KB</span>');
      c.addEventListener('click',function(){q('kb').value=k;syncKbChips();});
      q('kbchips').appendChild(c);
    });
    function syncKbChips(){
      var v=parseInt(q('kb').value,10);
      mount.querySelectorAll('.kbchip').forEach(function(c){
        c.classList.toggle('active', parseInt(c.textContent,10)===v);
      });
    }
    q('kb').addEventListener('input',syncKbChips);

    // file
    var drop=q('drop'), file=q('file');
    drop.addEventListener('click',function(){file.click();});
    file.addEventListener('change',function(e){load(e.target.files[0]);});
    ['dragenter','dragover'].forEach(function(ev){drop.addEventListener(ev,function(e){e.preventDefault();drop.classList.add('drag');});});
    ['dragleave','drop'].forEach(function(ev){drop.addEventListener(ev,function(e){e.preventDefault();drop.classList.remove('drag');});});
    drop.addEventListener('drop',function(e){if(e.dataTransfer.files[0])load(e.dataTransfer.files[0]);});
    function load(f){
      if(!f||!f.type.indexOf){return;}
      if(!f.type.startsWith('image/')){alert('Please choose an image file.');return;}
      state.file=f;
      var r=new FileReader();
      r.onload=function(ev){var im=new Image();im.onload=function(){state.img=im;q('controls').style.display='block';q('result').style.display='none';q('droptext').textContent=f.name;};im.src=ev.target.result;};
      r.readAsDataURL(f);
    }

    // go
    q('go').addEventListener('click',async function(){
      if(!state.img)return;
      var go=q('go');go.disabled=true;go.textContent='Working…';
      var out=await compress(state.img,{
        w:parseInt(q('w').value,10)||0, h:parseInt(q('h').value,10)||0,
        mode:q('mode').value, type:q('format').value,
        kb:parseInt(q('kb').value,10)||100, bg:'#ffffff'
      });
      state.blob=out.blob;
      q('thumb').src=URL.createObjectURL(out.blob);
      q('orig').textContent=fmt(state.file.size);
      q('newsz').textContent=fmt(out.blob.size);
      q('dims').textContent=out.w+' × '+out.h+' px';
      var kb=parseInt(q('kb').value,10)||100;
      if(!out.hit){
        q('note').innerHTML='<span class="warn">Couldn\'t fit '+kb+' KB at these exact pixels without wrecking the image. This is the smallest clear version ('+fmt(out.blob.size)+'). Try a slightly larger KB, or allow smaller dimensions.</span>';
      }else{
        q('note').textContent='Done — '+out.w+'×'+out.h+' px, just under '+kb+' KB.';
      }
      q('result').style.display='block';
      go.disabled=false;go.textContent='Resize & compress';
    });

    // download / reset
    q('dl').addEventListener('click',function(){
      if(!state.blob)return;
      var ext=q('format').value==='image/webp'?'webp':'jpg';
      var base=(state.file.name||'image').replace(/\.[^.]+$/,'');
      var a=document.createElement('a');a.href=URL.createObjectURL(state.blob);
      a.download=base+'-resized.'+ext;document.body.appendChild(a);a.click();document.body.removeChild(a);
    });
    q('reset').addEventListener('click',function(){
      state.file=state.img=state.blob=null;file.value='';
      q('controls').style.display='none';q('result').style.display='none';
      q('droptext').textContent='Click to choose an image';
    });
  }

  function boot(){
    var mounts=document.querySelectorAll('#app-tool,[data-app-tool]');
    mounts.forEach(initMount);
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
