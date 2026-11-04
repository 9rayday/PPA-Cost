(function(){
  var SIDES={
    supply:{name:'발전자원',priceLabel:'매집단가',gapOf:function(s,p){return s-p},priceOf:function(s,g){return s-g}},
    demand:{name:'수요기업',priceLabel:'제안단가',gapOf:function(s,p){return p-s},priceOf:function(s,g){return s+g}}
  };
  var state={supply:{level:0},demand:{level:0}};
  var records=[],yearly=[],db=null,view='month',sel=null,selY=null,viewYear=null,editId=null;
  var $=function(id){return document.getElementById(id)};
  function num(v){var n=parseFloat(v);return isFinite(n)?n:NaN}
  function spot(){return num($('smp').value)+num($('rec').value)}
  function fmt(n,d){return isFinite(n)?n.toFixed(d==null?1:d):'-'}
  function median(a){if(!a.length)return NaN;var s=a.slice().sort(function(x,y){return x-y});var m=s.length>>1;return s.length%2?s[m]:(s[m-1]+s[m])/2}
  function avg(a){return a.length?a.reduce(function(x,y){return x+y},0)/a.length:NaN}
  function p2(n){return String(n).padStart(2,'0')}
  function today(){var d=new Date();return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate())}
  function mkey(y,m){while(m<1){m+=12;y--}while(m>12){m-=12;y++}return y+'-'+p2(m)}
  var now=new Date(), CY=now.getFullYear(), CM=now.getMonth()+1;
  sel=mkey(CY,CM);selY=String(CY);

  function build(key){
    var s=SIDES[key], el=$(key==='supply'?'p-supply':'p-demand'), h=key==='supply'?'s-h':'d-h';
    el.innerHTML=
      '<h2 id="'+h+'">'+s.name+'</h2>'+
      '<div class="card"><label class="lbl" for="'+key+'-price">'+s.priceLabel+'</label><input id="'+key+'-price" type="number" step="0.1" inputmode="decimal"></div>'+
      '<div class="act"><div class="card"><span class="lbl">체결강도</span><div class="levels" id="'+key+'-lv"></div></div>'+
      '<button class="btn" id="'+key+'-save" disabled>기록</button></div>'+
      '<span class="msg" id="'+key+'-msg"></span>'+
      '<details><summary>제안가 계산</summary><div id="'+key+'-out"></div></details>';
    var box=$(key+'-lv');
    for(var i=1;i<=5;i++){(function(i){
      var b=document.createElement('button');b.className='lv';b.type='button';b.textContent=i;b.setAttribute('aria-pressed','false');b.setAttribute('aria-label','체결강도 '+i);
      b.onclick=function(){state[key].level=i;refresh()};box.appendChild(b)})(i)}
    $(key+'-price').oninput=refresh;
    $(key+'-save').onclick=function(){save(key)};
  }

  function withGap(key){return records.filter(function(r){return r.side===key&&isFinite(r.gap)})}
  function stats(key){var by={};withGap(key).forEach(function(r){(by[r.level]=by[r.level]||[]).push(r.gap)});return by}
  function suggest(key){
    var by=stats(key),good=[];[4,5].forEach(function(l){good=good.concat(by[l]||[])});
    if(!good.length)return NaN;
    return SIDES[key].priceOf(spot(),median(good));
  }

  function refresh(){
    var sp=spot();$('spot').textContent=fmt(sp,2);
    ['supply','demand'].forEach(function(key){
      var s=SIDES[key],st=state[key];
      Array.prototype.forEach.call($(key+'-lv').children,function(b,i){b.setAttribute('aria-pressed',String(st.level===i+1))});
      var price=num($(key+'-price').value),gap=s.gapOf(sp,price);
      $(key+'-save').disabled=!(st.level&&isFinite(price)&&isFinite(sp)&&db);
      var by=stats(key),good=[];[4,5].forEach(function(l){good=good.concat(by[l]||[])});
      var g=good.length?median(good):NaN,p=good.length?s.priceOf(sp,g):NaN;
      var h='<div class="dgrid"><div class="card"><span class="lbl">오늘 괴리</span><div class="val '+(gap<0?'neg':'')+'">'+fmt(gap)+'</div></div>'+
        '<div class="card"><span class="lbl">기준 괴리</span><div class="val">'+fmt(g)+'</div></div>'+
        '<div class="card"><span class="lbl">제안가</span><div class="big">'+fmt(p)+'</div></div></div>';
      var rows=[1,2,3,4,5].filter(function(l){return by[l]}).map(function(l){var a=by[l];return '<tr><td>'+l+'</td><td>'+a.length+'</td><td>'+fmt(median(a))+'</td><td>'+fmt(Math.min.apply(null,a))+' ~ '+fmt(Math.max.apply(null,a))+'</td></tr>'});
      if(rows.length)h+='<div class="tw"><table><tr><th>강도</th><th>건수</th><th>괴리 중앙값</th><th>범위</th></tr>'+rows.join('')+'</table></div>';
      if(key==='demand'){
        var sg=suggest('supply'),dg=suggest('demand');
        if(isFinite(sg)&&isFinite(dg))h+='<div class="card" style="margin-top:8px"><span class="lbl">스프레드 (수요 − 발전)</span><div class="big">'+fmt(dg-sg)+'</div></div>';
      }
      $(key+'-out').innerHTML=h;
    });
    renderChart();renderEntry();renderHist();
  }

  /* ---------- chart ---------- */
  function monthVal(side,key){
    var a=[];records.forEach(function(r){if(r.side===side&&r.level===5&&isFinite(r.price)&&String(r.date).slice(0,7)===key)a.push(r.price)});
    return avg(a);
  }
  function yearVal(side,y){
    for(var j=0;j<yearly.length;j++){if(yearly[j].side===side&&String(yearly[j].year)===String(y)&&isFinite(yearly[j].price))return yearly[j].price}
    var a=[];records.forEach(function(r){if(r.side===side&&r.level===5&&isFinite(r.price)&&String(r.date).slice(0,4)===String(y))a.push(r.price)});
    return avg(a);
  }
  function forecast(side){
    var xs=[],ys=[],i,v;
    for(i=-4;i<=0;i++){v=monthVal(side,mkey(CY,CM+i));if(isFinite(v)){xs.push(i);ys.push(v)}}
    if(!ys.length)return NaN;
    if(ys.length===1)return ys[0];
    var mx=avg(xs),my=avg(ys),sxy=0,sxx=0;
    for(i=0;i<xs.length;i++){sxy+=(xs[i]-mx)*(ys[i]-my);sxx+=(xs[i]-mx)*(xs[i]-mx)}
    var slope=sxx?sxy/sxx:0;
    return my+slope*(1-mx);
  }
  function slots(){
    var out=[],i;
    if(view==='month'&&viewYear){
      for(i=1;i<=12;i++){var k2=mkey(viewYear,i),fc2=k2===mkey(CY,CM+1);
        out.push({key:k2,label:p2(i),sup:fc2?forecast('supply'):monthVal('supply',k2),dem:fc2?forecast('demand'):monthVal('demand',k2),fc:fc2});}
    }else if(view==='month'){
      for(i=-10;i<=1;i++){var k=mkey(CY,CM+i);
        var fc=i===1;
        out.push({key:k,label:k.slice(2).replace('-','.'),sup:fc?forecast('supply'):monthVal('supply',k),dem:fc?forecast('demand'):monthVal('demand',k),fc:fc});}
    }else{
      var y0=CY;records.forEach(function(r){var y=parseInt(String(r.date).slice(0,4),10);if(isFinite(y)&&y<y0)y0=y});
      yearly.forEach(function(r){var y=parseInt(r.year,10);if(isFinite(y)&&y<y0)y0=y});
      if(CY-y0<4)y0=CY-4;
      for(var y=y0;y<=CY;y++)out.push({key:String(y),label:String(y),sup:yearVal('supply',y),dem:yearVal('demand',y),fc:false});
    }
    return out;
  }
  function renderChart(){
    var S=slots(),W=Math.max(300,($('chart').clientWidth||640)-16),H=230,L=38,R=10,T=14,B=26,n=S.length,sw=(W-L-R)/n;
    var vals=[];S.forEach(function(s){if(isFinite(s.sup))vals.push(s.sup);if(isFinite(s.dem))vals.push(s.dem)});
    var mn,mx;
    if(vals.length){mn=Math.floor((Math.min.apply(null,vals)-8)/10)*10;mx=Math.ceil((Math.max.apply(null,vals)+8)/10)*10;if(mx-mn<20)mx=mn+20}
    else{mn=160;mx=220}
    var ph=H-T-B,Y=function(v){return T+ph-(v-mn)/(mx-mn)*ph};
    var svg='<svg viewBox="0 0 '+W+' '+H+'" role="img" aria-label="체결 단가 추이">';
    var step=(mx-mn)/4;
    for(var t=0;t<=4;t++){var v=mn+step*t,y=Y(v);svg+='<line class="tick" x1="'+L+'" x2="'+(W-R)+'" y1="'+y+'" y2="'+y+'"/><text x="'+(L-5)+'" y="'+(y+3)+'" text-anchor="end">'+Math.round(v)+'</text>'}
    var bw=Math.min(sw*0.3,22),pts={sup:[],dem:[]};
    S.forEach(function(s,i){
      var c=L+(i+0.5)*sw,sx=c-bw/2-1,dx=c+bw/2+1;
      if(s.key===(view==='month'?sel:selY)&&!s.fc)svg+='<rect class="sel" x="'+(L+i*sw)+'" y="'+T+'" width="'+sw+'" height="'+ph+'" rx="3"/>';
      if(!s.fc){
        if(isFinite(s.sup))svg+='<rect class="b1" x="'+(sx-bw/2)+'" y="'+Y(s.sup)+'" width="'+bw+'" height="'+(T+ph-Y(s.sup))+'"><title>발전 '+fmt(s.sup)+'</title></rect>';
        if(isFinite(s.dem))svg+='<rect class="b2" x="'+(dx-bw/2)+'" y="'+Y(s.dem)+'" width="'+bw+'" height="'+(T+ph-Y(s.dem))+'"><title>수요 '+fmt(s.dem)+'</title></rect>';
      }
      if(s.fc){
        if(isFinite(s.sup))svg+='<rect class="fcb f1" x="'+(sx-bw/2)+'" y="'+Y(s.sup)+'" width="'+bw+'" height="'+(T+ph-Y(s.sup))+'"><title>발전 예상 '+fmt(s.sup)+'</title></rect>';
        if(isFinite(s.dem))svg+='<rect class="fcb f2" x="'+(dx-bw/2)+'" y="'+Y(s.dem)+'" width="'+bw+'" height="'+(T+ph-Y(s.dem))+'"><title>수요 예상 '+fmt(s.dem)+'</title></rect>';
      }
      if(isFinite(s.sup))pts.sup.push({x:sx,y:Y(s.sup),fc:s.fc});
      if(isFinite(s.dem))pts.dem.push({x:dx,y:Y(s.dem),fc:s.fc});
      svg+='<text x="'+c+'" y="'+(H-9)+'" text-anchor="middle">'+(view==='month'&&sw<44?s.label.slice(-2):s.label)+(s.fc?'*':'')+'</text>';
    });
    ['sup','dem'].forEach(function(k,ki){
      var cls=ki?'l2':'l1',p=pts[k],i;
      for(i=1;i<p.length;i++){
        svg+='<line class="'+cls+'" x1="'+p[i-1].x+'" y1="'+p[i-1].y+'" x2="'+p[i].x+'" y2="'+p[i].y+'" stroke-width="2"'+(p[i].fc?' stroke-dasharray="4 3"':'')+'/>';
      }
      p.forEach(function(q){svg+='<circle cx="'+q.x+'" cy="'+q.y+'" r="3.5" class="'+(ki?'b2':'b1')+'"'+(q.fc?' style="fill:var(--card);stroke:var(--'+(ki?'bar2':'bar1')+');stroke-width:2"':' style="stroke:var(--card);stroke-width:1.5"')+'/>'});
    });
    S.forEach(function(s,i){if(!s.fc)svg+='<rect class="hit" data-key="'+s.key+'" x="'+(L+i*sw)+'" y="'+T+'" width="'+sw+'" height="'+(ph+B)+'"/>'});
    svg+='</svg>';
    var el=$('chart');el.innerHTML=svg;
    Array.prototype.forEach.call(el.querySelectorAll('.hit'),function(r){r.onclick=function(){
      var k=r.getAttribute('data-key');
      if(view==='month'){sel=k;renderChart();renderEntry();return}
      selY=k;viewYear=parseInt(k,10);view='month';sel=viewYear===CY?mkey(CY,CM):k+'-01';setView();refresh()}});
  }

  function renderEntry(){
    var el=$('entry');
    if(view!=='month'){el.innerHTML='';el.removeAttribute('data-sel');return}
    var cur=sel;
    var sv=monthVal('supply',cur),dv=monthVal('demand',cur);
    var tag=view+cur;
    var keep=el.getAttribute('data-sel')===tag&&$('m-sup')?[$('m-sup').value,$('m-dem').value]:['',''];
    el.setAttribute('data-sel',tag);
    el.innerHTML='<div class="card"><span class="lbl">월</span><div class="val">'+cur+'</div></div>'+
      '<div class="card"><label class="lbl" for="m-sup">발전</label><input id="m-sup" type="number" step="0.1" placeholder="'+(isFinite(sv)?fmt(sv):'')+'"></div>'+
      '<div class="card"><label class="lbl" for="m-dem">수요</label><input id="m-dem" type="number" step="0.1" placeholder="'+(isFinite(dv)?fmt(dv):'')+'"></div>'+
      '<button class="btn" id="m-save">저장</button>';
    $('m-sup').value=keep[0];$('m-dem').value=keep[1];
    $('m-save').onclick=saveMonth;
  }

  function saveMonth(){
    if(!db){setStatus('저장소 없음');return}
    var jobs=[];
    [['supply','m-sup'],['demand','m-dem']].forEach(function(x){
      var v=num($(x[1]).value);
      if(!isFinite(v))return;
      var p=Math.round(v*100)/100;
      jobs.push(db.collection('records').doc(sel+'_m_'+x[0]).set({date:sel+'-15',side:x[0],level:5,price:p,manual:true}));
    });
    if(!jobs.length)return;
    $('m-save').disabled=true;
    Promise.all(jobs).then(function(){setStatus('저장됨')}).catch(function(e){setStatus('저장 실패: '+errText(e))}).then(function(){renderEntry()});
  }

  function renderHist(){
    var el=$('hist');
    if(editId&&$('e-level'))return;
    if(!records.length){el.innerHTML='';return}
    var ei=function(id,v,st){return '<input class="ei" id="'+id+'" type="number" step="'+st+'" value="'+(isFinite(v)?v:'')+'">'};
    var rows=records.slice().sort(function(x,y){return x.date<y.date?1:x.date>y.date?-1:0}).slice(0,40).map(function(r){
      var side=(r.side==='supply'?'발전':'수요');
      if(r.id===editId)return '<tr><td>'+r.date+'</td><td>'+side+'</td><td>'+ei('e-level',r.level,1)+'</td><td>'+ei('e-spot',r.spot,0.01)+'</td><td>'+ei('e-gap',r.gap,0.1)+'</td><td>'+ei('e-price',r.price,0.1)+'</td><td class="ra"><button class="btn sm" data-save="'+r.id+'">저장</button> <button class="btn sm" data-cancel="1">취소</button></td></tr>';
      return '<tr><td>'+r.date+'</td><td>'+side+'</td><td>'+r.level+'</td><td>'+fmt(r.spot,2)+'</td><td>'+fmt(r.gap)+'</td><td>'+(isFinite(r.price)?fmt(r.price):'-')+'</td><td class="ra"><button class="btn sm" data-edit="'+r.id+'">수정</button> <button class="btn sm" data-id="'+r.id+'">삭제</button></td></tr>'});
    el.innerHTML='<table><tr><th>날짜</th><th>구분</th><th>강도</th><th>현물</th><th>괴리</th><th>체결가</th><th></th></tr>'+rows.join('')+'</table>';
  }
  function errText(e){return (e&&(e.code||e.message))?String(e.code||e.message).slice(0,60):'오류'}
  function onHistClick(ev){
    var b=ev.target.closest&&ev.target.closest('button');
    if(!b)return;
    var id;
    if(b.hasAttribute('data-edit')){editId=b.getAttribute('data-edit');renderHist();return}
    if(b.hasAttribute('data-cancel')){editId=null;renderHist();return}
    if(b.hasAttribute('data-id')){
      id=b.getAttribute('data-id');
      if(!db){setStatus('저장소 없음');return}
      b.disabled=true;
      var ref=db.collection('records').doc(id),old=records.filter(function(x){return x.id===id})[0]||{};
      ref.delete().then(function(){return ref.get()}).then(function(snap){
        if(snap&&snap.exists)return ref.set({deleted:true,date:old.date||'',side:old.side||'',level:0});
      }).then(function(){
        records=records.filter(function(x){return x.id!==id});editId=null;setStatus('삭제됨');refresh();
      }).catch(function(e){b.disabled=false;setStatus('삭제 실패: '+errText(e))});
      return;
    }
    if(b.hasAttribute('data-save')){
      id=b.getAttribute('data-save');
      var r=records.filter(function(x){return x.id===id})[0];
      if(!r)return;
      if(!db){setStatus('저장소 없음');return}
      var lv=Math.round(num($('e-level').value));
      if(!(lv>=1&&lv<=5)){setStatus('강도는 1~5');return}
      var rec={date:r.date,side:r.side,level:lv},sp=num($('e-spot').value),gp=num($('e-gap').value),pr=num($('e-price').value);
      if(isFinite(sp))rec.spot=sp;
      if(isFinite(gp))rec.gap=gp;
      if(lv===5&&isFinite(pr))rec.price=pr;
      if(r.manual)rec.manual=true;
      if(!isFinite(rec.gap)&&!isFinite(rec.price)){setStatus('괴리 또는 체결가 필요');return}
      b.disabled=true;
      db.collection('records').doc(id).set(rec).then(function(){
        rec.id=id;records=records.map(function(x){return x.id===id?rec:x});editId=null;setStatus('수정됨');refresh();
      }).catch(function(e){b.disabled=false;setStatus('수정 실패: '+errText(e))});
    }
  }
  function setStatus(t){$('status').textContent=t;setTimeout(function(){if($('status').textContent===t)$('status').textContent=''},2500)}

  function save(key){
    if(!db)return;
    var sp=spot(),price=num($(key+'-price').value),st=state[key];
    var id=today()+'_'+key,btn=$(key+'-save');btn.disabled=true;
    var rec={date:today(),side:key,level:st.level,spot:Math.round(sp*100)/100,gap:Math.round(SIDES[key].gapOf(sp,price)*100)/100};
    if(st.level===5)rec.price=Math.round(price*100)/100;
    db.collection('records').doc(id).set(rec)
      .then(function(){$(key+'-msg').textContent='기록됨';setTimeout(function(){$(key+'-msg').textContent=''},2500)})
      .catch(function(e){$(key+'-msg').textContent='저장 실패: '+errText(e)})
      .then(function(){refresh()});
  }

  $('hist').addEventListener('click',onHistClick);
  build('supply');build('demand');
  $('smp').oninput=refresh;$('rec').oninput=refresh;
  function setView(){
    $('v-month').setAttribute('aria-pressed',String(view==='month'));
    $('v-year').setAttribute('aria-pressed',String(view==='year'));
    
  }
  $('v-month').onclick=function(){view='month';viewYear=null;sel=mkey(CY,CM);setView();refresh()};
  $('v-year').onclick=function(){view='year';setView();refresh()};
  var rz=null;window.addEventListener('resize',function(){clearTimeout(rz);rz=setTimeout(renderChart,120)});
  refresh();

  /* ---------- storage: Google Sheets (Apps Script) or claude.ai db ---------- */
  var IDLE_MS=5*60*1000,CFG=window.PPA_CONFIG||{},SHEET=!!CFG.APPS_SCRIPT_URL;
  var unlocked=false,unsub=null,lastAct=Date.now();
  function ssGet(k){try{return sessionStorage.getItem(k)}catch(e){return null}}
  function ssSet(k,v){try{if(v==null)sessionStorage.removeItem(k);else sessionStorage.setItem(k,v)}catch(e){}}
  function keyGet(){var t=parseInt(ssGet('ppa_t')||'0',10);if(Date.now()-t>IDLE_MS){ssSet('ppa_key',null);return ''}return ssGet('ppa_key')||''}
  function keySet(v){ssSet('ppa_key',v||null);ssSet('ppa_t',v?String(Date.now()):null)}
  function touch(){lastAct=Date.now();if(unlocked)ssSet('ppa_t',String(lastAct))}
  ['pointerdown','keydown','input','touchstart','scroll','wheel'].forEach(function(ev){document.addEventListener(ev,touch,{passive:true,capture:true})});

  function lockUI(msg){
    document.body.classList.add('locked');
    var o=$('lock');
    if(!o){
      o=document.createElement('div');o.id='lock';
      o.innerHTML='<div class="box lockbox"><div class="card"><label class="lbl" for="k-in">접속 키</label><input id="k-in" type="password" autocomplete="current-password"></div><span class="msg" id="k-msg" role="status"></span><button class="btn" id="k-ok">확인</button></div>';
      document.body.appendChild(o);
    }
    o.hidden=false;$('k-msg').textContent=msg||'';$('k-in').value='';$('k-in').focus();
  }
  function askKey(msg){
    return new Promise(function(resolve){
      lockUI(msg);
      var go=function(){var v=$('k-in').value.trim();if(!v)return;$('lock').hidden=true;document.body.classList.remove('locked');resolve(v)};
      $('k-ok').onclick=go;$('k-in').onkeydown=function(e){if(e.key==='Enter')go()};
    });
  }
  function lockNow(msg){
    unlocked=false;keySet('');
    if(unsub){try{unsub()}catch(e){}unsub=null}
    db=null;records=[];editId=null;
    ['supply','demand'].forEach(function(k){state[k].level=0;$(k+'-price').value=''});
    refresh();
    startSession(msg);
  }
  function sheetDb(url,key){
    var loaders=[];
    function call(body){
      body.key=key;
      return fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(body)})
        .then(function(r){return r.json()})
        .then(function(j){
          if(!j.ok){
            var e=new Error(j.error||'error');e.code=j.error;
            if(j.error==='unauthorized'&&unlocked)lockNow('키가 맞지 않습니다');
            throw e;
          }
          return j;
        });
    }
    function reload(){loaders.forEach(function(f){f()})}
    return {collection:function(name){return {
      onSnapshot:function(cb,err){
        var load=function(){call({action:'list',collection:name}).then(function(j){
          cb({docs:j.docs.map(function(d){return {id:d.id,exists:true,data:function(){return d.data}}})});
        }).catch(function(e){if(err)err(e)})};
        loaders.push(load);load();
        var t=setInterval(load,30000);
        return function(){clearInterval(t);loaders=loaders.filter(function(f){return f!==load})};
      },
      doc:function(id){return {
        set:function(data){return call({action:'set',collection:name,id:id,data:data}).then(function(){reload()})},
        delete:function(){return call({action:'delete',collection:name,id:id}).then(function(){reload()})},
        get:function(){return call({action:'get',collection:name,id:id}).then(function(j){return {exists:!!j.doc,data:function(){return j.doc}}})}
      }}
    }}};
  }
  function getDb(msg){
    if(SHEET){
      var k=keyGet();
      return (k?Promise.resolve(k):askKey(msg)).then(function(key){
        keySet(key);unlocked=true;touch();document.body.classList.remove('locked');
        return sheetDb(CFG.APPS_SCRIPT_URL,key);
      });
    }
    if(window.claude&&window.claude.use)return window.claude.use('db');
    return Promise.resolve(null);
  }
  function startSession(msg){
    getDb(msg).then(function(d){
      if(!d){setStatus('저장소 없음');return}
      db=d;
      var t=setTimeout(function(){setStatus('이력 불러오기 실패')},10000);
      unsub=d.collection('records').onSnapshot(function(snap){
        clearTimeout(t);
        records=snap.docs.map(function(x){var v=x.data()||{};v.id=x.id;return v}).filter(function(r){return !r.deleted&&(r.side==='supply'||r.side==='demand')&&isFinite(r.level)&&(isFinite(r.gap)||isFinite(r.price))});
        refresh();
      },function(e){clearTimeout(t);setStatus('이력 읽기 실패: '+errText(e))});
    }).catch(function(){});
  }
  if(!SHEET)document.body.classList.remove('locked');
  else{
    var idleCheck=function(){if(unlocked&&Date.now()-lastAct>IDLE_MS)lockNow('5분간 동작이 없어 잠겼습니다')};
    setInterval(idleCheck,10000);
    document.addEventListener('visibilitychange',function(){if(!document.hidden)idleCheck()});
  }
  startSession();
})();
