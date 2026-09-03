"use strict";

  // ---------- Calendario: helpers de eventos ----------
  function eventOccursOnDate(ev, dateStr){
    if(ev.fecha > dateStr) return false;
    if(ev.repeticionHasta && dateStr > ev.repeticionHasta) return false;
    if(ev.excepciones && ev.excepciones.includes(dateStr)) return false;
    if(ev.repeticion === "diaria") return true;
    if(ev.repeticion === "semanal"){
      const d0 = new Date(ev.fecha+"T00:00:00");
      const d1 = new Date(dateStr+"T00:00:00");
      return d0.getDay() === d1.getDay();
    }
    if(ev.fechaFin) return dateStr <= ev.fechaFin;
    return ev.fecha === dateStr;
  }
  function eventsForDate(dateStr){
    return (state.eventos||[]).filter(ev=> eventOccursOnDate(ev, dateStr))
      .sort((a,b)=> (a.hora||"99:99").localeCompare(b.hora||"99:99"));
  }
  function upcomingEvents(limit, daysAhead){
    const results = [];
    const start = new Date(todayStr+"T00:00:00");
    for(let i=0; i<daysAhead; i++){
      const dStr = fmt(addDays(start, i));
      eventsForDate(dStr).forEach(ev=> results.push({ev, dateStr:dStr}));
      if(results.length >= limit && i>0) break;
    }
    return results.slice(0, limit);
  }
  function eventColor(ev){
    if(ev.color) return ev.color;
    if(ev.categoria && CATEGORIES[ev.categoria]) return CATEGORIES[ev.categoria].color;
    return "var(--accent)";
  }
  function repeatLabel(ev){
    if(ev.repeticion==="diaria") return "cada día";
    if(ev.repeticion==="semanal") return "cada semana";
    if(ev.fechaFin) return `hasta ${calDateLabelShort(ev.fechaFin)}`;
    return "";
  }
  function calDateLabelShort(dateStr){
    const d = new Date(dateStr+"T00:00:00");
    return d.toLocaleDateString("es-MX",{day:"numeric",month:"short"});
  }

  async function loadData(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      state = raw ? JSON.parse(raw) : { habits: [], logs: {}, estados: {}, revisiones: {}, projects: [], ciclosEstudio: [], dismissedAlerts: {}, cierres: {}, reflexionesClinicas: [], snapshots: {}, eventos: [], medidas: {}, perfilFisico: {talla_cm:null}, temas: [], preguntasDiarias: {} };
      if(!state.estados) state.estados = {};
      if(!state.revisiones) state.revisiones = {};
      if(!state.projects) state.projects = [];
      if(!state.ciclosEstudio) state.ciclosEstudio = [];
      if(!state.dismissedAlerts) state.dismissedAlerts = {};
      if(!state.cierres) state.cierres = {};
      if(!state.reflexionesClinicas) state.reflexionesClinicas = [];
      if(!state.snapshots) state.snapshots = {};
      if(!state.eventos) state.eventos = [];
      if(!state.medidas) state.medidas = {};
      if(!state.perfilFisico) state.perfilFisico = {talla_cm:null};
      if(!state.temas) state.temas = [];
      if(!state.preguntasDiarias) state.preguntasDiarias = {};
    }catch(e){
      console.error("Error al cargar datos guardados", e);
      state = { habits: [], logs: {}, estados: {}, revisiones: {}, projects: [], ciclosEstudio: [], dismissedAlerts: {}, cierres: {}, reflexionesClinicas: [], snapshots: {}, eventos: [], medidas: {}, perfilFisico: {talla_cm:null}, temas: [], preguntasDiarias: {} };
      toast("No se pudieron leer tus datos guardados. Se abrió una app vacía.");
    }
    render();
  }
  async function persist(){
    try{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }catch(e){ console.error(e); toast("Error al guardar. Intenta de nuevo."); }
  }

  function logStatus(habitId, dateStr){
    const day = state.logs[dateStr];
    return day && day[habitId] ? day[habitId] : "no";
  }
  function puntuacionObtenida(habit, dateStr){
    const st = logStatus(habit.id, dateStr);
    if(st==="normal") return habit.prioridad;
    if(st==="superv") return habit.prioridad/2;
    return 0;
  }
  function habitActiveOn(habit, dateStr){
    return habit.activo && habit.createdAt.slice(0,10) <= dateStr;
  }

  function consistencyIndex(){
    let earned=0, possible=0;
    for(let i=6;i>=0;i--){
      const d = fmt(addDays(today,-i));
      state.habits.forEach(h=>{
        if(habitActiveOn(h,d)){ possible += h.prioridad; earned += puntuacionObtenida(h,d); }
      });
    }
    if(possible===0) return null;
    return Math.round((earned/possible)*100);
  }

  function diaGanado(dateStr){
    const cumplidoEnCat = (cats)=> state.habits.some(h => cats.includes(h.categoria) && habitActiveOn(h,dateStr) && logStatus(h.id,dateStr)!=="no");
    return cumplidoEnCat(SALUD_CATS) && cumplidoEnCat(ESTUDIO_CATS) && cumplidoEnCat(ORG_CATS);
  }

  // Bandas cualitativas del puntaje del día — evita el "todo o nada".
  // Umbrales tomados de tu sistema final (36/30/24/18 sobre un máximo de referencia de 41).
  function scoreBand(ratio){
    if(ratio===null) return null;
    if(ratio>=36/41) return {cls:"b-excepcional", label:"Día excepcional"};
    if(ratio>=30/41) return {cls:"b-muybueno",    label:"Día muy bueno"};
    if(ratio>=24/41) return {cls:"b-funcional",   label:"Día funcional"};
    if(ratio>=18/41) return {cls:"b-minimo",      label:"Día mínimo aceptable"};
    return {cls:"b-revisar", label:"Revisar qué está interfiriendo"};
  }
  function pointsFor(dateStr){
    let earned=0, possible=0;
    state.habits.forEach(h=>{ if(habitActiveOn(h,dateStr)){ possible+=h.prioridad; earned+=puntuacionObtenida(h,dateStr); } });
    return {earned, possible};
  }
  function renderTodayScore(){
    const wrap = document.getElementById("today-score-box");
    const {earned, possible} = pointsFor(todayStr);
    if(possible===0){ wrap.innerHTML = ""; return; }
    const ratio = earned/possible;
    const band = scoreBand(ratio);
    wrap.innerHTML = `
      <div class="score-band ${band.cls}">
        <span class="sb-pts">${fmtPts(earned)} / ${fmtPts(possible)} pts hoy</span>
        <span class="sb-label">${band.label}</span>
      </div>
    `;
  }
  function fmtPts(n){ return Number.isInteger(n) ? n : n.toFixed(1); }

  // ---------- Rango por hábito (estilo Liftoff) ----------
  const RANK_TIERS = [
    {name:"Bronce",   color:"#C9834A"},
    {name:"Plata",    color:"#B9C0CB"},
    {name:"Oro",      color:"#E8C34A"},
    {name:"Platino",  color:"#6FD1C6"},
    {name:"Diamante", color:"#8CC7F0"},
  ];
  const RANK_SUBS = ["III","II","I"];
  function rankThresholds(){
    const arr = [0]; let inc = 50;
    for(let i=0;i<15;i++){ arr.push(arr[arr.length-1]+inc); inc+=5; }
    return arr; // 16 boundaries -> 15 divisions
  }
  function computeHabitLP(habit){
    const start = habit.createdAt.slice(0,10);
    let lp=0, streak=0;
    for(let d=new Date(start+"T00:00:00"); d<=today; d.setDate(d.getDate()+1)){
      const ds = fmt(d);
      const st = logStatus(habit.id, ds);
      if(st==="no"){
        streak++;
        if(streak>=3) lp -= 8;
      } else {
        streak = 0;
        let gain = st==="normal" ? 10 : 5;
        if(diaGanado(ds)) gain += 2;
        lp += gain;
      }
      if(lp<0) lp = 0;
    }
    return lp;
  }
  function rankInfo(lp){
    const th = rankThresholds();
    let idx = 0;
    for(let i=0;i<15;i++){ if(lp>=th[i]) idx=i; }
    const capped = idx>=15;
    const tier = RANK_TIERS[Math.floor(idx/3)];
    const sub = RANK_SUBS[idx%3];
    const floor = th[idx], ceil = th[idx+1] ?? (floor+9999);
    return { tierName:tier.name, sub, color:tier.color, lp, lpInDiv: lp-floor, lpNeeded: ceil-floor, maxed: idx===14 && lp>=th[15] };
  }
  function buildRankPanel(habit){
    const info = rankInfo(computeHabitLP(habit));
    const pct = info.maxed ? 100 : Math.min(100, Math.round((info.lpInDiv/info.lpNeeded)*100));
    const wrap = document.createElement("div");
    wrap.className = "rank-panel";
    wrap.innerHTML = `
      <div class="rank-top">
        <span class="rank-badge" style="color:${info.color};border-color:${info.color};">${info.tierName} ${info.sub}</span>
        <span class="rank-lp">${info.lp} LP</span>
      </div>
      <div class="rank-bar-track"><div class="rank-bar-fill" style="width:${pct}%;background:${info.color};"></div></div>
      <div class="rank-bar-label">${info.maxed ? "Nivel máximo alcanzado" : `${info.lpInDiv} / ${info.lpNeeded} LP para subir de nivel`}</div>
    `;
    return wrap;
  }

  function renderStats(){
    const ci = consistencyIndex();
    document.getElementById("stat-consistency").textContent = ci===null ? "–" : ci+"%";
    const ganado = diaGanado(todayStr);
    const wonBox = document.getElementById("stat-won-box");
    document.getElementById("stat-won").textContent = ganado ? "✓" : "–";
    document.getElementById("stat-won-label").textContent = ganado ? "día ganado" : "día de hoy";
    wonBox.classList.toggle("won", ganado);
    const activeCount = state.habits.filter(h=>h.activo).length;
    document.getElementById("stat-active").textContent = activeCount+"/"+MAX_ACTIVE;
    document.getElementById("max-warning").textContent = activeCount>MAX_ACTIVE ? "⚠ pasaste el máximo recomendado de "+MAX_ACTIVE : "";

    const opts = {weekday:"long", day:"numeric", month:"long"};
    document.getElementById("eyebrow-today").textContent = today.toLocaleDateString("es-MX",opts);

    renderStateWidget();
    renderWeeklyAverages();
    renderTodayScore();
  }

  function renderStateWidget(){
    const btn = document.getElementById("state-action-btn");
    const line = document.getElementById("state-summary-line");
    const est = state.estados[todayStr];
    if(!est){
      btn.textContent = "+ Estado";
      btn.classList.remove("has-data");
      line.innerHTML = "";
      return;
    }
    btn.textContent = "✓ Estado";
    btn.classList.add("has-data");
    const bits = [
      est.horas_sueno!==null && est.horas_sueno!==undefined ? `<b>${est.horas_sueno}h</b> sueño` : null,
      `<b>${est.energia}</b> energía`,
      `<b>${est.estres}</b> estrés`,
      `<b>${est.concentracion}</b> concentración`,
      est.guardia ? "🏥 guardia" : null,
      est.enfermedad ? "🤒 enfermo" : null,
      est.metilfenidato ? "💊 metilfenidato" : null
    ].filter(Boolean).join(" · ");
    line.innerHTML = bits + (est.primera_tarea ? `<br><b>Primera tarea:</b> ${escapeHtml(est.primera_tarea)}` : "");
  }
  document.getElementById("state-action-btn").addEventListener("click", ()=>openEstadoSheet());

  document.getElementById("flows-toggle-btn").addEventListener("click", ()=>{
    const dd = document.getElementById("flows-dropdown");
    const open = dd.style.display !== "none";
    dd.style.display = open ? "none" : "block";
  });

  function renderWeeklyAverages(){
    const wrap = document.getElementById("weekly-avg-row");
    const days = [];
    for(let i=6;i>=0;i--){ const d=fmt(addDays(today,-i)); if(state.estados[d]) days.push(state.estados[d]); }
    if(days.length===0){ wrap.innerHTML = ""; return; }
    const avg = (key)=> {
      const vals = days.map(x=>x[key]).filter(v=>v!==undefined && v!==null && v!=="" && !isNaN(v)).map(Number);
      if(vals.length===0) return "–";
      return (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1);
    };
    wrap.innerHTML = `
      <div class="stat-box"><div class="stat-num">${avg("horas_sueno")}h</div><div class="stat-label">sueño<br>promedio</div></div>
      <div class="stat-box"><div class="stat-num">${avg("energia")}</div><div class="stat-label">energía<br>promedio</div></div>
      <div class="stat-box"><div class="stat-num">${avg("estres")}</div><div class="stat-label">estrés<br>promedio</div></div>
      <div class="stat-box"><div class="stat-num">${avg("concentracion")}</div><div class="stat-label">concentración<br>promedio</div></div>
    `;
  }

  function buildWeekStrip(habit){
    const strip = document.createElement("div");
    strip.className = "week-strip";
    for(let i=6;i>=0;i--){
      const d = addDays(today,-i);
      const dstr = fmt(d);
      const cell = document.createElement("div");
      cell.className = "d" + (dstr===todayStr ? " today":"");
      const st = habitActiveOn(habit,dstr) ? logStatus(habit.id,dstr) : null;
      if(st==="normal"){ const [r,g,b]=hexToRgb(habit.color); cell.style.background=`rgba(${r},${g},${b},1)`; cell.style.borderColor="transparent"; }
      else if(st==="superv"){ const [r,g,b]=hexToRgb(habit.color); cell.style.background=`rgba(${r},${g},${b},0.45)`; cell.style.borderColor="transparent"; }
      cell.textContent = DIAS_ES[(d.getDay()+6)%7];
      cell.style.color = st ? "rgba(0,0,0,.45)" : "";
      cell.addEventListener("click", ()=> openLogSheet(habit.id, dstr));
      strip.appendChild(cell);
    }
    return strip;
  }

  function buildYearHeatmap(habit){
    const startOffset = (yearStart.getDay()+6)%7;
    const totalDays = Math.round((yearEnd - yearStart)/86400000)+1;
    const totalCols = Math.ceil((totalDays+startOffset)/7);
    const monthRow = document.createElement("div"); monthRow.className="month-row";
    const grid = document.createElement("div"); grid.className="weeks-grid";
    let lastMonthLabeled=-1;
    for(let col=0; col<totalCols; col++){
      let monthLabelHere="";
      for(let row=0; row<7; row++){
        const dayIndex = col*7+row-startOffset;
        const cellDiv = document.createElement("div");
        if(dayIndex<0 || dayIndex>=totalDays){ cellDiv.className="cell future"; }
        else{
          const d = new Date(YEAR,0,1+dayIndex);
          const dstr = fmt(d);
          const isFuture = dstr>todayStr;
          cellDiv.className = "cell"+(isFuture?" future":"")+(dstr===todayStr?" today":"");
          if(!isFuture){
            const st = habitActiveOn(habit,dstr) ? logStatus(habit.id,dstr) : null;
            if(st==="normal"){ const [r,g,b]=hexToRgb(habit.color); cellDiv.style.background=`rgba(${r},${g},${b},1)`; }
            else if(st==="superv"){ const [r,g,b]=hexToRgb(habit.color); cellDiv.style.background=`rgba(${r},${g},${b},0.45)`; }
            cellDiv.title=dstr;
            cellDiv.addEventListener("click", ()=>openLogSheet(habit.id,dstr));
          }
          if(row===0 && d.getDate()<=7 && d.getMonth()!==lastMonthLabeled){ monthLabelHere=MONTHS_ES[d.getMonth()]; lastMonthLabeled=d.getMonth(); }
        }
        grid.appendChild(cellDiv);
      }
      const mCell=document.createElement("div"); mCell.className="month-label"; mCell.textContent=monthLabelHere;
      monthRow.appendChild(mCell);
    }
    const wrap=document.createElement("div"); wrap.className="heatmap-inner"; wrap.appendChild(monthRow); wrap.appendChild(grid);
    const scroller=document.createElement("div"); scroller.className="heatmap-scroll"; scroller.appendChild(wrap);
    return scroller;
  }

  function renderMonthChart(){
    const wrap = document.getElementById("month-chart-wrap");
    const year = today.getFullYear(), month = today.getMonth();
    const daysInMonth = new Date(year, month+1, 0).getDate();
    const currentDay = today.getDate();
    const monthName = today.toLocaleDateString("es-MX",{month:"long"});

    const pts = [];
    for(let d=1; d<=currentDay; d++){
      const dateStr = fmt(new Date(year,month,d));
      const r = dailyRatio(dateStr);
      pts.push({day:d, pct: r===null ? null : Math.round(r*100)});
    }
    const withData = pts.filter(p=>p.pct!==null);
    if(withData.length===0){ wrap.innerHTML = ""; return; }
    const avgPct = Math.round(withData.reduce((s,p)=>s+p.pct,0)/withData.length);

    const W=600, H=170, padL=6, padR=6, padT=10, padB=22;
    const innerW = W-padL-padR, innerH = H-padT-padB;
    const xFor = (day)=> padL + ((day-1)/(daysInMonth-1))*innerW;
    const yFor = (pct)=> padT + (1-(pct/100))*innerH;

    let path = ""; let drawing = false;
    pts.forEach(p=>{
      if(p.pct===null){ drawing=false; return; }
      const cmd = drawing ? "L" : "M";
      path += `${cmd}${xFor(p.day).toFixed(1)},${yFor(p.pct).toFixed(1)} `;
      drawing = true;
    });

    const gridLines = [0,25,50,75,100].map(v=>`<line x1="${padL}" y1="${yFor(v).toFixed(1)}" x2="${W-padR}" y2="${yFor(v).toFixed(1)}" stroke="#333846" stroke-width="1" stroke-dasharray="2,3"/>`).join("");
    const labelDays = [];
    for(let d=1; d<=daysInMonth; d+=3) labelDays.push(d);
    if(labelDays[labelDays.length-1] !== daysInMonth) labelDays.push(daysInMonth);
    const xLabels = labelDays.map(d=>`<text x="${xFor(d).toFixed(1)}" y="${H-6}" font-size="9" fill="#5b6072" font-family="JetBrains Mono, monospace" text-anchor="middle">${d}</text>`).join("");

    wrap.innerHTML = `
      <div class="month-chart-card">
        <div class="month-chart-top">
          <span class="month-chart-title">Progreso de ${monthName}</span>
          <span class="month-chart-pct">${avgPct}%</span>
        </div>
        <div class="month-chart-sub">promedio diario de cumplimiento este mes</div>
        <svg class="month-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
          ${gridLines}
          <path d="${path.trim()}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
          ${xLabels}
        </svg>
      </div>
    `;
  }

  function render(){
    renderStats();
    renderAlerts();
    renderResumenDia();
    renderProjects();
    renderMonthChart();
    renderTodayTimeline();
    renderCalendarCompact();
    renderMedComparison();
    renderInsights();
    requestAnimationFrame(updateCarouselHeight);
    const list = document.getElementById("habit-list");
    list.innerHTML = "";

    if(state.habits.length===0){
      list.innerHTML = `<div class="empty-state"><span class="glyph">🌱</span>
        <p>Aún no hay hábitos. Toca + para agregar el primero — piensa en modo normal y en el mínimo viable de supervivencia.</p></div>`;
      return;
    }

    const sorted = [...state.habits].sort((a,b)=> (b.activo-a.activo) || (b.prioridad-a.prioridad));
    sorted.forEach(habit=>{
      const cat = CATEGORIES[habit.categoria];
      const card = document.createElement("div");
      card.className = "habit-card";
      if(!habit.activo) card.style.opacity = "0.5";
      const st = logStatus(habit.id, todayStr);
      card.innerHTML = `
        <div class="card-top">
          <div>
            <div class="card-title">
              <span class="cat-dot" style="background:${cat.color}"></span>
              <span class="name">${escapeHtml(habit.nombre)}</span>
            </div>
            <div class="card-meta">
              <span class="cat-label">${cat.emoji} ${cat.name}</span>
              <span class="priority-dots">${[1,2,3,4,5].map(n=>`<span class="${n<=habit.prioridad?'on':''}"></span>`).join("")}</span>
              <span class="freq-label">${habit.frecuencia}/7 días</span>
            </div>
          </div>
          <button class="edit-btn" data-edit="${habit.id}">✎</button>
        </div>
        <div class="mode-hints">
          <div><b>Normal:</b> ${escapeHtml(habit.modoNormal||"—")}</div>
          <div><b>Supervivencia:</b> ${escapeHtml(habit.modoSuperv||"—")}</div>
        </div>
        <div class="log-buttons">
          <button data-log="no" class="${st==='no'?'active-no':''}">No cumplido</button>
          <button data-log="superv" class="${st==='superv'?'active-superv':''}">Supervivencia</button>
          <button data-log="normal" class="${st==='normal'?'active-normal':''}">Normal</button>
        </div>
      `;
      const strip = buildWeekStrip(habit);
      card.appendChild(strip);

      const expandBtn = document.createElement("button");
      expandBtn.className = "expand-btn";
      expandBtn.textContent = "Ver progreso completo ▾";
      const yearWrap = document.createElement("div");
      yearWrap.className = "year-wrap";
      let built = false;
      expandBtn.addEventListener("click", ()=>{
        yearWrap.classList.toggle("open");
        const open = yearWrap.classList.contains("open");
        expandBtn.textContent = open ? "Ocultar ▴" : "Ver progreso completo ▾";
        if(open && !built){
          yearWrap.appendChild(buildRankPanel(habit));
          yearWrap.appendChild(buildYearHeatmap(habit));
          built = true;
        }
        if(open){ requestAnimationFrame(()=>{ const sc=yearWrap.querySelector(".heatmap-scroll"); if(sc) sc.scrollLeft = sc.scrollWidth; }); }
      });
      card.appendChild(expandBtn);
      card.appendChild(yearWrap);

      list.appendChild(card);
    });

    const cards = list.querySelectorAll(".habit-card");
    cards.forEach((card, idx)=>{
      const habit = sorted[idx];
      card.querySelector("[data-edit]").addEventListener("click", ()=> openHabitSheet(habit.id));
      card.querySelectorAll("[data-log]").forEach(btn=>{
        btn.addEventListener("click", async ()=>{
          const status = btn.getAttribute("data-log");
          if(!state.logs[todayStr]) state.logs[todayStr] = {};
          state.logs[todayStr][habit.id] = status;
          await persist();
          render();
        });
      });
    });
  }

  async function resetData(){
    if(!confirm("Esto borrará todos tus hábitos y registros. ¿Continuar?")) return;
    state = { habits: [], logs: {}, estados: {}, revisiones: {}, projects: [], ciclosEstudio: [], dismissedAlerts: {}, cierres: {}, reflexionesClinicas: [], snapshots: {}, eventos: [], medidas: {}, perfilFisico: {talla_cm:null}, temas: [], preguntasDiarias: {} };
    await persist();
    render();
    toast("Datos reiniciados");
  }
  document.getElementById("reset-btn").addEventListener("click", resetData);

