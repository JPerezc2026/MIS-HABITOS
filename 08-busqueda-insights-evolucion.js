"use strict";

  // ---------- Buscador global ----------
  function highlightMatch(text, query){
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if(idx===-1) return escapeHtml(text);
    return escapeHtml(text.slice(0,idx)) + "<mark>" + escapeHtml(text.slice(idx,idx+query.length)) + "</mark>" + escapeHtml(text.slice(idx+query.length));
  }
  function searchAll(query){
    const q = query.trim().toLowerCase();
    if(!q) return [];
    const results = [];

    Object.keys(state.cierres).forEach(d=>{
      const c = state.cierres[d];
      const blob = [c.queHice, c.quePendiente, c.primeraTareaManana].filter(Boolean).join(" · ");
      if(blob.toLowerCase().includes(q)) results.push({tipo:"Cierre del día", fecha:d, texto:blob});
    });

    (state.reflexionesClinicas||[]).forEach(r=>{
      const blob = (r.campos||[]).filter(Boolean).join(" · ");
      if(blob.toLowerCase().includes(q)) results.push({tipo:"Reflexión clínica", fecha:r.fecha, texto:blob});
    });

    Object.keys(state.revisiones).forEach(wk=>{
      const r = state.revisiones[wk];
      const blob = [r.q1,r.q2,r.q3,r.q4,r.q5,r.q6,r.q7].filter(Boolean).join(" · ");
      if(blob.toLowerCase().includes(q)) results.push({tipo:"Revisión semanal", fecha:wk, texto:blob});
    });

    (state.eventos||[]).forEach(ev=>{
      const blob = [ev.titulo, ev.nota].filter(Boolean).join(" · ");
      if(blob.toLowerCase().includes(q)) results.push({tipo:"Evento", fecha:ev.fecha, texto:blob});
    });

    (state.temas||[]).forEach(t=>{
      const blob = [t.nombre, t.categoria].filter(Boolean).join(" · ");
      if(blob.toLowerCase().includes(q)) results.push({tipo:"Tema ENARM", fecha:"", texto:blob});
    });

    return results.sort((a,b)=> (b.fecha||"").localeCompare(a.fecha||""));
  }
  function renderGlobalSearch(){
    const q = document.getElementById("global-search-input").value;
    const wrap = document.getElementById("global-search-results");
    if(!q.trim()){ wrap.innerHTML = `<div class="evo-empty">Escribe algo para buscar.</div>`; return; }
    const results = searchAll(q);
    if(!results.length){ wrap.innerHTML = `<div class="evo-empty">Sin resultados para "${escapeHtml(q)}".</div>`; return; }
    wrap.innerHTML = results.map(r=>`
      <div class="search-result">
        <div class="search-result-head">
          <span class="search-result-type">${r.tipo}</span>
          ${r.fecha?`<span class="search-result-date">${r.fecha}</span>`:""}
        </div>
        <div class="search-result-text">${highlightMatch(r.texto, q)}</div>
      </div>
    `).join("");
  }
  document.getElementById("global-search-btn").addEventListener("click", ()=>{
    document.getElementById("search-fullscreen").classList.add("open");
    document.getElementById("global-search-input").value = "";
    document.getElementById("global-search-results").innerHTML = `<div class="evo-empty">Escribe algo para buscar.</div>`;
    setTimeout(()=> document.getElementById("global-search-input").focus(), 150);
  });
  document.getElementById("search-fs-close").addEventListener("click", ()=>{
    document.getElementById("search-fullscreen").classList.remove("open");
  });
  document.getElementById("global-search-input").addEventListener("input", renderGlobalSearch);

  function avgOf(dates, key){
    const vals = dates.map(d=> state.estados[d] ? state.estados[d][key] : undefined).filter(v=>v!==null && v!==undefined && !isNaN(v));
    if(vals.length===0) return null;
    return vals.reduce((a,b)=>a+b,0)/vals.length;
  }

  function computeHabitInsights(allDates){
    const results = [];
    state.habits.filter(h=>h.activo).forEach(h=>{
      const withDates = allDates.filter(d=> state.logs[d] && (state.logs[d][h.id]==="normal" || state.logs[d][h.id]==="superv"));
      const withoutDates = allDates.filter(d=> !(state.logs[d] && (state.logs[d][h.id]==="normal" || state.logs[d][h.id]==="superv")));
      if(withDates.length<3 || withoutDates.length<3) return;
      const wC = avgOf(withDates,"concentracion"), woC = avgOf(withoutDates,"concentracion");
      if(wC===null || woC===null) return;
      const wE = avgOf(withDates,"energia"), woE = avgOf(withoutDates,"energia");
      results.push({habit:h, delta: wC-woC, wC, woC, wE, woE, nWith:withDates.length, nWithout:withoutDates.length});
    });
    results.sort((a,b)=> Math.abs(b.delta)-Math.abs(a.delta));
    return results.slice(0,4);
  }

  function computeWeekdayInsights(allDates){
    const buckets = [[],[],[],[],[],[],[]];
    allDates.forEach(d=>{
      const wd = new Date(d+"T00:00:00").getDay();
      buckets[wd].push(d);
    });
    const order = [1,2,3,4,5,6,0];
    return order.map((wd,i)=>({
      label: DIAS_ES[i],
      n: buckets[wd].length,
      c: avgOf(buckets[wd], "concentracion"),
      e: avgOf(buckets[wd], "energia"),
      s: avgOf(buckets[wd], "estres"),
    }));
  }

  function renderInsights(){
    const wrap = document.getElementById("insights-wrap");
    if(!wrap) return;
    const allDates = Object.keys(state.estados);

    if(allDates.length < 6){
      wrap.innerHTML = `<div class="month-chart-card">
        <div class="month-chart-top"><span class="month-chart-title">📊 Insights</span></div>
        <div class="chart-empty-note">Necesitas más días de "Estado" registrados (al menos 6) para empezar a ver patrones.</div>
      </div>`;
      return;
    }

    // --- Por hábito ---
    const habitResults = computeHabitInsights(allDates);
    const habitHtml = habitResults.length ? habitResults.map(r=>{
      const cat = CATEGORIES[r.habit.categoria];
      const deltaPos = r.delta >= 0;
      return `<div class="insight-row">
        <div class="insight-row-head">
          <span>${cat?cat.emoji:""} ${escapeHtml(r.habit.nombre)}</span>
          <span class="insight-delta ${deltaPos?"pos":"neg"}">${deltaPos?"+":""}${r.delta.toFixed(1)} concentración</span>
        </div>
        <div class="insight-row-sub">Cumplido: ${r.wC.toFixed(1)} · Sin cumplir: ${r.woC.toFixed(1)} <span class="insight-n">(${r.nWith} vs ${r.nWithout} días)</span></div>
      </div>`;
    }).join("") : `<div class="chart-empty-note">Aún no hay suficientes días con/sin cada hábito para comparar.</div>`;

    // --- Por día de la semana ---
    const weekdayResults = computeWeekdayInsights(allDates);
    const withData = weekdayResults.filter(r=>r.n>=2 && r.c!==null);
    let weekdayHtml;
    if(withData.length < 2){
      weekdayHtml = `<div class="chart-empty-note">Necesitas más días repartidos entre la semana para ver este patrón.</div>`;
    }else{
      const best = withData.reduce((a,b)=> b.c>a.c ? b : a);
      const worst = withData.reduce((a,b)=> b.c<a.c ? b : a);
      weekdayHtml = `
        <div class="insight-weekday-row">
          ${weekdayResults.map(r=>{
            const h = r.c!==null ? Math.max(6, (r.c/10)*100) : 0;
            const isBest = r.c!==null && r===best;
            const isWorst = r.c!==null && r===worst && best!==worst;
            return `<div class="iwd-col">
              <div class="iwd-bar-wrap"><div class="iwd-bar ${isBest?"best":""} ${isWorst?"worst":""}" style="height:${r.c!==null?h:2}%"></div></div>
              <div class="iwd-label">${r.label}</div>
            </div>`;
          }).join("")}
        </div>
        <div class="insight-row-sub" style="margin-top:8px;">Mejor concentración: <b>${best.label}</b> (${best.c.toFixed(1)}) ${worst!==best?`· Más difícil: <b>${worst.label}</b> (${worst.c.toFixed(1)})`:""}</div>
      `;
    }

    // --- Guardia vs normal ---
    const guardiaDates = allDates.filter(d=> state.estados[d].guardia);
    const normalDates = allDates.filter(d=> !state.estados[d].guardia);
    let guardiaHtml;
    if(guardiaDates.length<3 || normalDates.length<3){
      guardiaHtml = `<div class="chart-empty-note">Necesitas más días marcados con/sin guardia para comparar.</div>`;
    }else{
      const metrics = [
        {key:"energia", label:"Energía"},
        {key:"estres", label:"Estrés"},
        {key:"concentracion", label:"Concentración"},
        {key:"horas_sueno", label:"Hrs. sueño"},
      ];
      function col(dates, title, cls){
        return `<div class="med-compare-col ${cls}">
          <h4>${title}</h4>
          ${metrics.map(m=>{
            const v = avgOf(dates, m.key);
            return `<div class="med-compare-metric"><div class="v">${v!==null?v.toFixed(1):"–"}</div><div class="l">${m.label}</div></div>`;
          }).join("")}
          <div class="med-compare-n">${dates.length} día${dates.length!==1?"s":""}</div>
        </div>`;
      }
      guardiaHtml = `<div class="med-compare-row">${col(normalDates,"Sin guardia","")}${col(guardiaDates,"🏥 Con guardia","med-yes")}</div>`;
    }

    // --- Preguntas ENARM vs concentración ---
    const conPregDates = allDates.filter(d=> (state.preguntasDiarias[d]||0) > 0);
    const sinPregDates = allDates.filter(d=> !((state.preguntasDiarias[d]||0) > 0));
    let preguntasInsightHtml;
    if(conPregDates.length<3 || sinPregDates.length<3){
      preguntasInsightHtml = `<div class="chart-empty-note">Necesitas más días con y sin preguntas registradas para comparar.</div>`;
    }else{
      const cCon = avgOf(conPregDates,"concentracion"), cSin = avgOf(sinPregDates,"concentracion");
      const eCon = avgOf(conPregDates,"energia"), eSin = avgOf(sinPregDates,"energia");
      if(cCon===null || cSin===null){
        preguntasInsightHtml = `<div class="chart-empty-note">Necesitas más días con y sin preguntas registradas para comparar.</div>`;
      }else{
        const delta = cCon-cSin;
        const deltaPos = delta>=0;
        preguntasInsightHtml = `<div class="insight-row">
          <div class="insight-row-head">
            <span>📖 Días con preguntas registradas</span>
            <span class="insight-delta ${deltaPos?"pos":"neg"}">${deltaPos?"+":""}${delta.toFixed(1)} concentración</span>
          </div>
          <div class="insight-row-sub">Con preguntas: ${cCon.toFixed(1)} · Sin registrar: ${cSin.toFixed(1)} <span class="insight-n">(${conPregDates.length} vs ${sinPregDates.length} días)</span></div>
          ${eCon!==null && eSin!==null ? `<div class="insight-row-sub">Energía — con: ${eCon.toFixed(1)} · sin: ${eSin.toFixed(1)}</div>` : ""}
        </div>`;
      }
    }

    wrap.innerHTML = `
      <div class="month-chart-card">
        <div class="month-chart-top"><span class="month-chart-title">📊 Insights</span></div>
        <div class="month-chart-sub">patrones detectados en tus datos registrados</div>

        <div class="insight-section">
          <div class="insight-section-title">HÁBITOS Y CONCENTRACIÓN</div>
          ${habitHtml}
        </div>

        <div class="insight-section">
          <div class="insight-section-title">CONCENTRACIÓN POR DÍA DE LA SEMANA</div>
          ${weekdayHtml}
        </div>

        <div class="insight-section">
          <div class="insight-section-title">GUARDIA VS. DÍA NORMAL</div>
          ${guardiaHtml}
        </div>

        <div class="insight-section">
          <div class="insight-section-title">PREGUNTAS ENARM Y CONCENTRACIÓN</div>
          ${preguntasInsightHtml}
        </div>
      </div>
    `;
  }

  // ---------- Evolución ----------
  let evoPeriodDays = 30;
  function datesAgoRange(startAgo, endAgo){
    const arr = [];
    for(let i=startAgo;i<=endAgo;i++) arr.push(fmt(addDays(today,-i)));
    return arr;
  }
  function imcCategoria(imc){
    if(imc===null || imc===undefined || isNaN(imc)) return null;
    if(imc<18.5) return {key:"bajo", label:"Bajo peso"};
    if(imc<25) return {key:"normal", label:"Peso normal"};
    if(imc<30) return {key:"sobrepeso", label:"Sobrepeso"};
    return {key:"obesidad", label:"Obesidad"};
  }
  const DEFAULT_PERSONAJE = {
    tono_piel:"#D9A77A",
    cabello:{estilo:"corto", color:"#3B2A1E"},
    vestimenta:{color_camisa:"#E8A33D", color_pantalon:"#333846"},
    accesorios:[]
  };
  function getPersonaje(){
    const p = state.perfilFisico.personaje || {};
    return {
      tono_piel: p.tono_piel || DEFAULT_PERSONAJE.tono_piel,
      cabello: {
        estilo: (p.cabello && p.cabello.estilo) || DEFAULT_PERSONAJE.cabello.estilo,
        color: (p.cabello && p.cabello.color) || DEFAULT_PERSONAJE.cabello.color
      },
      vestimenta: {
        color_camisa: (p.vestimenta && p.vestimenta.color_camisa) || DEFAULT_PERSONAJE.vestimenta.color_camisa,
        color_pantalon: (p.vestimenta && p.vestimenta.color_pantalon) || DEFAULT_PERSONAJE.vestimenta.color_pantalon
      },
      accesorios: p.accesorios || []
    };
  }
  function pixelCharacterSVG(catKey, personaje){
    const p = personaje || getPersonaje();
    const widths = {bajo:16, normal:20, sobrepeso:26, obesidad:32};
    const tw = widths[catKey] || widths.normal;
    const cx = 40;
    const skin = p.tono_piel, shirt = p.vestimenta.color_camisa, pants = p.vestimenta.color_pantalon, hair = p.cabello.color;
    const hasBarba = p.accesorios.includes("barba");
    const hasLentes = p.accesorios.includes("lentes");

    let hairHtml = "";
    if(p.cabello.estilo === "corto"){
      hairHtml = `<rect x="${cx-9}" y="1" width="18" height="7" rx="3" fill="${hair}"/>`;
    }else if(p.cabello.estilo === "rizado"){
      hairHtml = `<rect x="${cx-9}" y="2" width="18" height="6" rx="3" fill="${hair}"/>` +
        [-8,-4,0,4,8].map(dx=>`<circle cx="${cx+dx}" cy="3" r="3.4" fill="${hair}"/>`).join("");
    } // "calvo" -> sin capa de pelo

    const barbaHtml = hasBarba ? `<rect x="${cx-7}" y="14" width="14" height="6" rx="2" fill="${hair}" opacity="0.9"/>` : "";
    const lentesHtml = hasLentes ? `
      <rect x="${cx-7}" y="9" width="5" height="4" fill="none" stroke="#222" stroke-width="1"/>
      <rect x="${cx+2}" y="9" width="5" height="4" fill="none" stroke="#222" stroke-width="1"/>
      <line x1="${cx-2}" y1="11" x2="${cx+2}" y2="11" stroke="#222" stroke-width="1"/>` : "";

    return `<svg width="80" height="96" viewBox="0 0 80 96" shape-rendering="crispEdges">
      <rect x="${cx-8}" y="4" width="16" height="16" rx="2" fill="${skin}"/>
      ${barbaHtml}
      ${lentesHtml}
      ${hairHtml}
      <rect x="${cx-tw/2-6}" y="24" width="6" height="26" fill="${skin}"/>
      <rect x="${cx+tw/2}" y="24" width="6" height="26" fill="${skin}"/>
      <rect x="${cx-tw/2}" y="22" width="${tw}" height="32" rx="4" fill="${shirt}"/>
      <rect x="${cx-tw*0.32}" y="54" width="${tw*0.28}" height="30" fill="${pants}"/>
      <rect x="${cx+tw*0.04}" y="54" width="${tw*0.28}" height="30" fill="${pants}"/>
    </svg>`;
  }
  function renderEvolucion(){
    document.querySelectorAll("#evo-period-row button").forEach(b=> b.classList.toggle("active", Number(b.dataset.days)===evoPeriodDays));
    const half = Math.floor(evoPeriodDays/2);
    const afterDates = datesAgoRange(0, half-1);
    const beforeDates = datesAgoRange(half, evoPeriodDays-1);

    // --- General ---
    const consAfter = rangeConsistency(0, half-1);
    const consBefore = rangeConsistency(half, evoPeriodDays-1);
    const sleepAfter = avgOf(afterDates,"horas_sueno"), sleepBefore = avgOf(beforeDates,"horas_sueno");
    const concAfter = avgOf(afterDates,"concentracion"), concBefore = avgOf(beforeDates,"concentracion");
    const ganAfter = afterDates.filter(d=>diaGanado(d)).length;
    const ganBefore = beforeDates.filter(d=>diaGanado(d)).length;

    function card(label, before, after, fmt1, suffix){
      if(before===null || after===null) return `<div class="evo-card"><div class="evo-card-label">${label}</div><div class="evo-empty" style="padding:6px 0;">Sin datos suficientes</div></div>`;
      const delta = after-before;
      const pos = delta>=0;
      return `<div class="evo-card">
        <div class="evo-card-label">${label}</div>
        <div class="evo-card-vals">
          <span class="evo-card-before">${fmt1(before)}${suffix||""}</span>
          <span class="evo-card-arrow">→</span>
          <span class="evo-card-after">${fmt1(after)}${suffix||""}</span>
        </div>
        <div class="evo-card-delta ${pos?"pos":"neg"}">${pos?"+":""}${fmt1(delta)}${suffix||""}</div>
      </div>`;
    }
    document.getElementById("evo-general-wrap").innerHTML = `
      <div class="evo-section">
        <div class="evo-section-title">Evolución general</div>
        <div class="evo-cards-grid">
          ${card("CONSISTENCIA", consBefore!==null?consBefore*100:null, consAfter!==null?consAfter*100:null, v=>Math.round(v), "%")}
          ${card("SUEÑO PROMEDIO", sleepBefore, sleepAfter, v=>v.toFixed(1), "h")}
          ${card("CONCENTRACIÓN", concBefore, concAfter, v=>v.toFixed(1), "")}
          ${card("DÍAS GANADOS", ganBefore, ganAfter, v=>Math.round(v), "")}
        </div>
      </div>
    `;

    // --- Funcional ---
    const metrics = [
      {key:"energia", label:"Energía"},
      {key:"estres", label:"Estrés"},
      {key:"concentracion", label:"Concentración"},
    ];
    const barsHtml = metrics.map(m=>{
      const v = avgOf(afterDates, m.key);
      const pct = v!==null ? Math.min(100,(v/10)*100) : 0;
      return `<div class="eb-bar-row">
        <div class="eb-bar-label">${m.label}</div>
        <div class="eb-bar-track"><div class="eb-bar-fill" style="width:${pct}%;background:var(--accent)"></div></div>
        <div class="eb-bar-val">${v!==null?v.toFixed(1):"–"}</div>
      </div>`;
    }).join("");
    document.getElementById("evo-functional-wrap").innerHTML = `
      <div class="evo-section">
        <div class="evo-section-title">Cambios funcionales <span style="font-size:10.5px;color:var(--text-faint);font-weight:400;">(últimos ${half} días)</span></div>
        ${barsHtml}
        <div class="eb-bar-row" style="margin-bottom:0;">
          <div class="eb-bar-label">Sueño</div>
          <div class="eb-bar-track"><div class="eb-bar-fill" style="width:${sleepAfter!==null?Math.min(100,(sleepAfter/9)*100):0}%;background:#5B9BD9"></div></div>
          <div class="eb-bar-val">${sleepAfter!==null?sleepAfter.toFixed(1)+"h":"–"}</div>
        </div>
      </div>
    `;

    // --- Antropometría ---
    const medidaDates = Object.keys(state.medidas).sort();
    let bodyHtml;
    if(medidaDates.length===0){
      bodyHtml = `
        <div class="evo-body-top">
          <div class="evo-char-wrap">${pixelCharacterSVG("normal")}</div>
          <div class="evo-body-info">
            <div class="evo-empty" style="padding:6px 0;text-align:left;">Aún no has registrado ninguna medida.</div>
          </div>
        </div>
        <div class="evo-body-actions">
          <button class="evo-add-medida-btn" id="evo-add-medida-btn">+ Agregar medida</button>
          <button class="evo-add-medida-btn" id="evo-customize-btn">🎨 Personalizar</button>
        </div>`;
    }else{
      const last = state.medidas[medidaDates[medidaDates.length-1]];
      const first = state.medidas[medidaDates[0]];
      const talla = state.perfilFisico.talla_cm;
      const imc = (talla && last.peso) ? last.peso/((talla/100)**2) : null;
      const cat = imcCategoria(imc);
      let compareHtml = "";
      if(medidaDates.length>=2 && first.peso!=null && last.peso!=null){
        const delta = last.peso-first.peso;
        compareHtml = `<div class="evo-body-metric">Peso: <b>${first.peso}kg</b> → <b>${last.peso}kg</b> (<span style="color:${delta<=0?'#7FA65C':'#E8735A'}">${delta>=0?"+":""}${delta.toFixed(1)}kg</span>)</div>`;
      }
      bodyHtml = `
        <div class="evo-body-top">
          <div class="evo-char-wrap">${pixelCharacterSVG(cat?cat.key:"normal")}</div>
          <div class="evo-body-info">
            <div class="evo-body-cat">${cat?cat.label:(talla?"–":"Falta talla")}</div>
            <div class="evo-body-metric">Peso actual: <b>${last.peso!=null?last.peso+"kg":"–"}</b></div>
            <div class="evo-body-metric">IMC: <b>${imc!==null?imc.toFixed(1):"–"}</b></div>
            ${last.cintura!=null?`<div class="evo-body-metric">Cintura: <b>${last.cintura}cm</b></div>`:""}
            ${compareHtml}
          </div>
        </div>
        <div class="evo-body-actions">
          <button class="evo-add-medida-btn" id="evo-add-medida-btn">+ Agregar medida</button>
          <button class="evo-add-medida-btn" id="evo-customize-btn">🎨 Personalizar</button>
        </div>
      `;
    }
    document.getElementById("evo-body-wrap").innerHTML = `
      <div class="evo-section">
        <div class="evo-section-title">Progreso físico</div>
        ${bodyHtml}
      </div>
    `;
    const addMedBtn = document.getElementById("evo-add-medida-btn");
    if(addMedBtn) addMedBtn.addEventListener("click", openMedidaSheet);
    const customizeBtn = document.getElementById("evo-customize-btn");
    if(customizeBtn) customizeBtn.addEventListener("click", openCustomizeSheet);
  }
  document.querySelectorAll("#evo-period-row button").forEach(b=>{
    b.addEventListener("click", ()=>{ evoPeriodDays = Number(b.dataset.days); renderEvolucion(); });
  });

  document.getElementById("evo-report-btn").addEventListener("click", ()=>{
    const half = Math.floor(evoPeriodDays/2);
    const afterDates = datesAgoRange(0, half-1);
    const beforeDates = datesAgoRange(half, evoPeriodDays-1);
    const consAfter = rangeConsistency(0, half-1);
    const consBefore = rangeConsistency(half, evoPeriodDays-1);
    const sleepAfter = avgOf(afterDates,"horas_sueno"), sleepBefore = avgOf(beforeDates,"horas_sueno");
    const concAfter = avgOf(afterDates,"concentracion"), concBefore = avgOf(beforeDates,"concentracion");
    const ganAfter = afterDates.filter(d=>diaGanado(d)).length;
    const ganBefore = beforeDates.filter(d=>diaGanado(d)).length;

    function row(label, before, after, fmt1, suffix){
      if(before===null || after===null) return `<div class="pr-row"><span>${label}</span><b>Sin datos suficientes</b></div>`;
      const delta = after-before;
      return `<div class="pr-row"><span>${label}</span><b>${fmt1(before)}${suffix||""} → ${fmt1(after)}${suffix||""} (${delta>=0?"+":""}${fmt1(delta)}${suffix||""})</b></div>`;
    }

    const medidaDates = Object.keys(state.medidas).sort();
    let bodyRows = `<div class="pr-row"><span>Medidas</span><b>Sin registrar</b></div>`;
    if(medidaDates.length){
      const last = state.medidas[medidaDates[medidaDates.length-1]];
      const talla = state.perfilFisico.talla_cm;
      const imc = (talla && last.peso) ? last.peso/((talla/100)**2) : null;
      bodyRows = `<div class="pr-row"><span>Peso actual</span><b>${last.peso!=null?last.peso+"kg":"–"}</b></div>
        <div class="pr-row"><span>IMC</span><b>${imc!==null?imc.toFixed(1):"–"}</b></div>`;
    }

    const temas = state.temas || [];
    const completos = temas.filter(t=> revisionesEsteAno(t)>=3).length;
    const temasRow = temas.length ? `<div class="pr-row"><span>Temas con 3+ repasos</span><b>${completos} de ${temas.length} (${Math.round(completos/temas.length*100)}%)</b></div>` : `<div class="pr-row"><span>Temas</span><b>Sin registrar</b></div>`;

    document.getElementById("print-report").innerHTML = `
      <h1>Reporte de Evolución</h1>
      <div class="pr-sub">Generado el ${today.toLocaleDateString("es-MX",{day:"numeric",month:"long",year:"numeric"})} · periodo de ${evoPeriodDays} días</div>
      <div class="pr-section">
        <h2>Evolución general</h2>
        ${row("Consistencia", consBefore!==null?consBefore*100:null, consAfter!==null?consAfter*100:null, v=>Math.round(v), "%")}
        ${row("Sueño promedio", sleepBefore, sleepAfter, v=>v.toFixed(1), "h")}
        ${row("Concentración", concBefore, concAfter, v=>v.toFixed(1), "")}
        ${row("Días ganados", ganBefore, ganAfter, v=>Math.round(v), "")}
      </div>
      <div class="pr-section">
        <h2>Progreso físico</h2>
        ${bodyRows}
      </div>
      <div class="pr-section">
        <h2>Temario ENARM</h2>
        ${temasRow}
      </div>
    `;
    setTimeout(()=> window.print(), 100);
  });

  function openMedidaSheet(){
    document.getElementById("med-fecha").value = todayStr;
    document.getElementById("med-peso").value = "";
    document.getElementById("med-talla").value = state.perfilFisico.talla_cm || "";
    document.getElementById("med-cintura").value = "";
    document.getElementById("med-nota").value = "";
    document.getElementById("medida-backdrop").classList.add("open");
  }
  document.getElementById("medida-cancel").addEventListener("click", ()=> document.getElementById("medida-backdrop").classList.remove("open"));
  document.getElementById("medida-backdrop").addEventListener("click",(e)=>{ if(e.target.id==="medida-backdrop") document.getElementById("medida-backdrop").classList.remove("open"); });
  document.getElementById("medida-save").addEventListener("click", async ()=>{
    const fecha = document.getElementById("med-fecha").value;
    const peso = parseFloat(document.getElementById("med-peso").value);
    const talla = parseFloat(document.getElementById("med-talla").value);
    const cintura = document.getElementById("med-cintura").value ? parseFloat(document.getElementById("med-cintura").value) : null;
    const nota = document.getElementById("med-nota").value.trim() || null;
    if(!fecha){ toast("Elige una fecha"); return; }
    if(isNaN(peso)){ toast("Ingresa tu peso"); return; }
    state.medidas[fecha] = {peso, cintura, nota};
    if(!isNaN(talla) && talla>0) state.perfilFisico.talla_cm = talla;
    await persist();
    document.getElementById("medida-backdrop").classList.remove("open");
    renderEvolucion();
    toast("Medida guardada");
  });

  // ---------- Personalizar personaje ----------
  const SKIN_TONE_PALETTE = ["#F5D5B8","#E8B894","#D9A77A","#C68F5D","#A87244","#8B5A34","#6B4226","#4A2C1A"];
  const HAIR_COLOR_PALETTE = ["#0A0A0A","#2B1B0E","#3B2A1E","#5C3A21","#8B5A2B","#B8860B","#C9A876","#E5E5E5"];
  const PANTS_COLOR_PALETTE = ["#333846","#1F2937","#4B5563","#2C2C2C","#3E2723","#1A2E3B","#4A4A4A","#5C4033"];
  let f_pj_piel, f_pj_cabello_estilo, f_pj_cabello_color, f_pj_accesorios, f_pj_camisa, f_pj_pantalon;

  function buildSwatchRow(containerId, palette, onPick){
    const row = document.getElementById(containerId);
    row.innerHTML = palette.map(c=>`<button type="button" class="ev-color-swatch" data-color="${c}" style="background:${c}"></button>`).join("");
    row.querySelectorAll("button").forEach(b=>{
      b.addEventListener("click", ()=>{ onPick(b.dataset.color); updatePersonajeControls(); updatePersonajePreview(); });
    });
  }
  function ensurePersonajeSwatches(){
    if(document.getElementById("pj-piel-row").children.length) return;
    buildSwatchRow("pj-piel-row", SKIN_TONE_PALETTE, c=>{ f_pj_piel=c; });
    buildSwatchRow("pj-cabello-color-row", HAIR_COLOR_PALETTE, c=>{ f_pj_cabello_color=c; });
    buildSwatchRow("pj-camisa-row", EVENT_COLOR_PALETTE, c=>{ f_pj_camisa=c; });
    buildSwatchRow("pj-pantalon-row", PANTS_COLOR_PALETTE, c=>{ f_pj_pantalon=c; });
    document.querySelectorAll("#pj-cabello-estilo-row button").forEach(b=>{
      b.addEventListener("click", ()=>{ f_pj_cabello_estilo = b.dataset.estilo; updatePersonajeControls(); updatePersonajePreview(); });
    });
    document.querySelectorAll("#pj-accesorios-row button").forEach(b=>{
      b.addEventListener("click", ()=>{
        const acc = b.dataset.acc;
        if(f_pj_accesorios.includes(acc)) f_pj_accesorios = f_pj_accesorios.filter(a=>a!==acc);
        else f_pj_accesorios.push(acc);
        updatePersonajeControls(); updatePersonajePreview();
      });
    });
  }
  function updatePersonajeControls(){
    document.querySelectorAll("#pj-piel-row button").forEach(b=> b.classList.toggle("active", b.dataset.color===f_pj_piel));
    document.querySelectorAll("#pj-cabello-color-row button").forEach(b=> b.classList.toggle("active", b.dataset.color===f_pj_cabello_color));
    document.querySelectorAll("#pj-camisa-row button").forEach(b=> b.classList.toggle("active", b.dataset.color===f_pj_camisa));
    document.querySelectorAll("#pj-pantalon-row button").forEach(b=> b.classList.toggle("active", b.dataset.color===f_pj_pantalon));
    document.querySelectorAll("#pj-cabello-estilo-row button").forEach(b=> b.classList.toggle("active", b.dataset.estilo===f_pj_cabello_estilo));
    document.querySelectorAll("#pj-accesorios-row button").forEach(b=> b.classList.toggle("active", f_pj_accesorios.includes(b.dataset.acc)));
    document.getElementById("pj-cabello-color-field").style.display = f_pj_cabello_estilo==="calvo" ? "none" : "block";
  }
  function updatePersonajePreview(){
    const p = {tono_piel:f_pj_piel, cabello:{estilo:f_pj_cabello_estilo, color:f_pj_cabello_color}, vestimenta:{color_camisa:f_pj_camisa, color_pantalon:f_pj_pantalon}, accesorios:f_pj_accesorios};
    document.getElementById("personaje-preview").innerHTML = pixelCharacterSVG("normal", p);
  }
  function openCustomizeSheet(){
    const p = getPersonaje();
    f_pj_piel = p.tono_piel;
    f_pj_cabello_estilo = p.cabello.estilo;
    f_pj_cabello_color = p.cabello.color;
    f_pj_accesorios = [...p.accesorios];
    f_pj_camisa = p.vestimenta.color_camisa;
    f_pj_pantalon = p.vestimenta.color_pantalon;
    ensurePersonajeSwatches();
    updatePersonajeControls();
    updatePersonajePreview();
    document.getElementById("personaje-backdrop").classList.add("open");
  }
  document.getElementById("personaje-cancel").addEventListener("click", ()=> document.getElementById("personaje-backdrop").classList.remove("open"));
  document.getElementById("personaje-backdrop").addEventListener("click",(e)=>{ if(e.target.id==="personaje-backdrop") document.getElementById("personaje-backdrop").classList.remove("open"); });
  document.getElementById("personaje-save").addEventListener("click", async ()=>{
    state.perfilFisico.personaje = {
      tono_piel: f_pj_piel,
      cabello: {estilo: f_pj_cabello_estilo, color: f_pj_cabello_color},
      vestimenta: {color_camisa: f_pj_camisa, color_pantalon: f_pj_pantalon},
      accesorios: f_pj_accesorios
    };
    await persist();
    document.getElementById("personaje-backdrop").classList.remove("open");
    renderEvolucion();
    toast("Personaje guardado");
  });

