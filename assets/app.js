/* Photo & signature resizer — 100% client-side.
   Injects a widget into <div id="app-tool" data-preset="..."></div>. Reusable across pages. */
(function(){
  var PRESETS = [
    {id:'sig10',  name:'Signature 10KB',    note:'140×60 · white', w:140, h:60,  kb:10,  mode:'contain'},
    {id:'sig20',  name:'Signature 20KB',    note:'140×60 · white', w:140, h:60,  kb:20,  mode:'contain'},
    {id:'exam',   name:'Exam Photo',        note:'200×230 · 50KB', w:200, h:230, kb:50,  mode:'cover'},
    {id:'usvisa', name:'US Visa 600×600',   note:'600×600 · 240KB',w:600, h:600, kb:240, mode:'cover'},
    {id:'schengen',name:'Schengen/EU Visa', note:'413×531 · 100KB',w:413, h:531, kb:100, mode:'cover'}
  ];

  function el(h){var d=document.createElement('div');d.innerHTML=h.trim();return d.firstChild;}
  function fmt(b){if(b<1024)return b+' B';if(b<1048576)return (b/1024).toFixed(1)+' KB';return (b/1048576).toFixed(2)+' MB';}
  function toBlob(c,t,q){return new Promise(function(r){c.toBlob(function(b){r(b);},t,q);});}

  function fixedCanvas(img,W,H,mode,bg){
    var c=document.createElement('canvas');c.width=W;c.height=H;var x=c.getContext('2d');
    x.fillStyle=bg;x.fillRect(0,0,W,H);
    var ar=img.naturalWidth/img.naturalHeight, tr=W/H, dw,dh;
    if(mode==='cover'){ if(ar>tr){dh=H;dw=H*ar;} else {dw=W;dh=W/ar;} }
    else { if(ar>tr){dw=W;dh=W/ar;} else {dh=H;dw=H*ar;} }
    x.drawImage(img,(W-dw)/2,(H-dh)/2,dw,dh);return c;
  }
  function scaledCanvas(img,scale,bg){
    var w=Math.max(1,Math.round(img.naturalWidth*scale)), h=Math.max(1,Math.round(img.naturalHeight*scale));
    var c=document.createElement('canvas');c.width=w;c.height=h;var x=c.getContext('2d');
    x.fillStyle=bg;x.fillRect(0,0,w,h);x.drawImage(img,0,0,w,h);return c;
  }
  async function bestQuality(c,type,target){
    var lo=0.05,hi=1,best=null;
    for(var i=0;i<8;i++){var m=(lo+hi)/2;var b=await toBlob(c,type,m);if(b&&b.size<=target){best=b;lo=m;}else hi=m;}
    return best;
  }
  // returns {blob,w,h,hit,capped,downscaled}
  async function compress(img,o){
    var type=o.type, target=o.kb*1024, bg=o.bg, fixed=o.w>0&&o.h>0;
    var scales = fixed ? [1] : [1,0.85,0.72,0.6,0.5,0.4,0.3,0.2];
    var smallest=null;
    for(var i=0;i<scales.length;i++){
      var c = fixed ? fixedCanvas(img,o.w,o.h,o.mode,bg) : scaledCanvas(img,scales[i],bg);
      var full=await toBlob(c,type,1);
      if(full && full.size<=target) return {blob:full,w:c.width,h:c.height,hit:true,capped:true,downscaled:i>0};
      var best=await bestQuality(c,type,target);
      if(best) return {blob:best,w:c.width,h:c.height,hit:true,capped:false,downscaled:i>0};
      smallest={blob:await toBlob(c,type,0.05),w:c.width,h:c.height};
    }
    return {blob:smallest.blob,w:smallest.w,h:smallest.h,hit:false,capped:false,downscaled:true};
  }

  var TOOL =
  '<div class="tool">'+
    '<div class="uploader" data-el="uploader">'+
      '<div class="up-ico">🖼️</div>'+
      '<div class="up-title">Drop your image here, or <span class="lk">browse files</span></div>'+
      '<div class="up-sub">JPG, PNG or WebP · stays private on your device</div>'+
      '<input type="file" accept="image/*" hidden data-el="file"></div>'+
    '<div class="errbox" data-el="err" hidden></div>'+
    '<div class="editor" data-el="editor" hidden>'+
      '<div class="orig"><img class="thumb" data-el="origimg" alt="your image">'+
        '<div class="orig-meta"><div class="fname" data-el="fname"></div>'+
          '<div class="muted" data-el="origmeta"></div>'+
          '<button class="lk" data-el="change" type="button">Choose a different image</button></div></div>'+
      '<label class="opt-label">Target file size <span style="font-weight:400;color:#6b7280">(maximum — won\'t be made larger)</span></label>'+
      '<div class="chips" data-el="kbchips"></div>'+
      '<div class="custom-kb">or set exactly <input type="number" min="1" data-el="kb"> KB</div>'+
      '<details class="advanced" data-el="advanced"><summary>Need exact pixel dimensions? (exam / visa / signature forms)</summary>'+
        '<div class="adv-body"><div class="presets" data-el="presets"></div>'+
          '<div class="dims">'+
            '<div><label>Width (px)</label><input type="number" min="1" data-el="w" placeholder="keep original"></div>'+
            '<div><label>Height (px)</label><input type="number" min="1" data-el="h" placeholder="keep original"></div>'+
            '<div><label>Fit</label><select data-el="mode">'+
              '<option value="contain">Keep whole image (pad white)</option>'+
              '<option value="cover">Crop to fill exactly</option></select></div>'+
          '</div></div></details>'+
      '<button class="btn-go" data-el="go" type="button">Compress image</button></div>'+
    '<div class="result" data-el="result" hidden>'+
      '<div class="res-head">Done</div>'+
      '<div class="compare">'+
        '<div class="col"><div class="col-label">Before</div><div class="col-size" data-el="bsize"></div><div class="col-dim" data-el="bdim"></div></div>'+
        '<div class="arrow">→</div>'+
        '<div class="col ok"><div class="col-label">After</div><div class="col-size" data-el="asize"></div><div class="col-dim" data-el="adim"></div></div>'+
      '</div>'+
      '<div class="saved" data-el="saved"></div>'+
      '<img class="res-preview" data-el="resimg" alt="result">'+
      '<p class="note" data-el="note"></p>'+
      '<a class="btn-dl" data-el="dl" download>⬇ Download</a>'+
      '<button class="btn-ghost" data-el="again" type="button">Compress another image</button></div>'+
  '</div>';

  function init(mount){
    mount.appendChild(el(TOOL));
    var q=function(n){return mount.querySelector('[data-el="'+n+'"]');};
    var st={file:null,img:null,blob:null,origW:0,origH:0};
    var defId = mount.getAttribute('data-preset') || '';
    var defPreset = PRESETS.filter(function(p){return p.id===defId;})[0] || null;

    function setGoLabel(){ q('go').textContent = q('advanced').open ? 'Resize & compress' : 'Compress image'; }
    q('advanced').addEventListener('toggle', setGoLabel);

    // KB chips
    [1000,500,200,100,50,20,10].forEach(function(k){
      var label = k>=1000 ? '1 MB' : k+' KB';
      var c=el('<span class="chip">'+label+'</span>');
      c.addEventListener('click',function(){q('kb').value=k;syncChips();});
      q('kbchips').appendChild(c);
    });
    function syncChips(){var v=parseInt(q('kb').value,10);
      mount.querySelectorAll('.chip').forEach(function(c){
        var k=c.textContent==='1 MB'?1000:parseInt(c.textContent,10);c.classList.toggle('active',k===v);});}
    q('kb').addEventListener('input',syncChips);

    // presets (exact dims)
    PRESETS.forEach(function(p){
      var b=el('<button class="preset" type="button">'+p.name+'<small>'+p.note+'</small></button>');
      b.addEventListener('click',function(){
        mount.querySelectorAll('.preset').forEach(function(x){x.classList.remove('active');});
        b.classList.add('active');
        q('w').value=p.w;q('h').value=p.h;q('mode').value=p.mode;q('kb').value=p.kb;syncChips();
      });
      q('presets').appendChild(b);
    });

    // defaults
    if(defPreset){
      q('advanced').open=true;
      q('w').value=defPreset.w;q('h').value=defPreset.h;q('mode').value=defPreset.mode;q('kb').value=defPreset.kb;
      var pb=q('presets').querySelector('.preset:nth-child('+(PRESETS.indexOf(defPreset)+1)+')');
      if(pb)pb.classList.add('active');
    } else {
      q('kb').value=100; // general compress default
    }
    syncChips();setGoLabel();

    // file load
    var drop=q('uploader'), file=q('file');
    drop.addEventListener('click',function(){file.click();});
    file.addEventListener('change',function(e){load(e.target.files[0]);});
    ['dragenter','dragover'].forEach(function(ev){drop.addEventListener(ev,function(e){e.preventDefault();drop.classList.add('drag');});});
    ['dragleave','drop'].forEach(function(ev){drop.addEventListener(ev,function(e){e.preventDefault();drop.classList.remove('drag');});});
    drop.addEventListener('drop',function(e){if(e.dataTransfer.files&&e.dataTransfer.files[0])load(e.dataTransfer.files[0]);});

    function showErr(msg){q('err').textContent=msg;q('err').hidden=false;}
    function load(f){
      q('err').hidden=true;
      if(!f){return;}
      if(!/^image\//.test(f.type) && !/\.(jpe?g|png|webp|gif|bmp)$/i.test(f.name)){
        showErr('Please choose an image file (JPG, PNG or WebP).');return;
      }
      st.file=f;
      var r=new FileReader();
      r.onerror=function(){showErr('Could not read this file. Please try another image.');};
      r.onload=function(ev){
        var im=new Image();
        im.onload=function(){
          st.img=im;st.origW=im.naturalWidth;st.origH=im.naturalHeight;
          q('origimg').src=ev.target.result;
          q('fname').textContent=f.name;
          q('origmeta').textContent=im.naturalWidth+' × '+im.naturalHeight+' px · '+fmt(f.size);
          q('editor').hidden=false;q('uploader').hidden=true;q('result').hidden=true;
        };
        im.onerror=function(){
          showErr("Couldn't open this image. If it's an iPhone photo (HEIC format), please convert it to JPG first, then upload again.");
        };
        im.src=ev.target.result;
      };
      r.readAsDataURL(f);
    }

    q('change').addEventListener('click',reset);
    q('again').addEventListener('click',reset);
    function reset(){
      st.file=st.img=st.blob=null;file.value='';
      q('editor').hidden=true;q('result').hidden=true;q('uploader').hidden=false;q('err').hidden=true;
    }

    q('go').addEventListener('click',async function(){
      if(!st.img)return;
      var go=q('go');go.disabled=true;var lbl=go.textContent;go.textContent='Working…';
      var useDims=q('advanced').open;
      var w=useDims?(parseInt(q('w').value,10)||0):0;
      var h=useDims?(parseInt(q('h').value,10)||0):0;
      var kb=parseInt(q('kb').value,10)||100;
      var out=await compress(st.img,{w:w,h:h,mode:q('mode').value,type:'image/jpeg',kb:kb,bg:'#ffffff'});
      st.blob=out.blob;
      q('resimg').src=URL.createObjectURL(out.blob);
      q('bsize').textContent=fmt(st.file.size);
      q('bdim').textContent=st.origW+'×'+st.origH;
      q('asize').textContent=fmt(out.blob.size);
      q('adim').textContent=out.w+'×'+out.h;
      var pct=Math.max(0,Math.round((1-out.blob.size/st.file.size)*100));
      q('saved').textContent='Saved '+pct+'% · '+fmt(st.file.size)+' → '+fmt(out.blob.size);

      var note='',cls='note';
      if(!out.hit){
        cls='note warn';
        note="Couldn't get under "+kb+" KB at exactly "+out.w+"×"+out.h+" px without ruining the image. This is the smallest clear version ("+fmt(out.blob.size)+"). Raise the KB limit a little, or allow larger dimensions.";
      } else if(out.capped){
        note="✓ This is the best quality at "+out.w+"×"+out.h+" px — "+fmt(out.blob.size)+", comfortably under your "+kb+" KB limit. It can't be made bigger at this size, so you're all set.";
      } else {
        note="✓ Compressed to "+fmt(out.blob.size)+", just under your "+kb+" KB limit.";
        if(out.downscaled) note+=" Dimensions were reduced to "+out.w+"×"+out.h+" px to fit.";
      }
      q('note').textContent=note;q('note').className=cls;

      var ext='jpg';var base=(st.file.name||'image').replace(/\.[^.]+$/,'');
      q('dl').href=URL.createObjectURL(out.blob);q('dl').download=base+'-resized.'+ext;

      q('result').hidden=false;
      q('result').scrollIntoView({behavior:'smooth',block:'nearest'});
      go.disabled=false;go.textContent=lbl;
    });
  }

  function boot(){document.querySelectorAll('#app-tool,[data-app-tool]').forEach(init);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot);else boot();
})();
