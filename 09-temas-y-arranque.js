"use strict";

  // ---------- Temas ENARM ----------
  let editingTemaId = null;
  let temasSearchQuery = "";
  function revisionesEsteAno(tema){
    const limite = fmt(addDays(today, -364));
    return (tema.revisiones||[]).filter(d=> d>=limite).length;
  }
  function preguntasStreak(){
    let streak = 0;
    let d = (state.preguntasDiarias[todayStr] > 0) ? todayStr : fmt(addDays(today,-1));
    while(state.preguntasDiarias[d] > 0){
      streak++;
      d = fmt(addDays(new Date(d+"T00:00:00"), -1));
    }
    return streak;
  }
  function preguntasHeatmapHtml(){
    const days = [];
    for(let i=90;i>=0;i--) days.push(fmt(addDays(today,-i)));
    const firstDow = new Date(days[0]+"T00:00:00").getDay();
    const mondayIndex = firstDow===0 ? 6 : firstDow-1;
    const padded = Array(mondayIndex).fill(null).concat(days);
    const weeks = [];
    for(let i=0;i<padded.length;i+=7) weeks.push(padded.slice(i,i+7));
    const maxVal = Math.max(1, ...days.map(d=> state.preguntasDiarias[d]||0));
    function cellColor(d){
      if(!d) return "transparent";
      const v = state.preguntasDiarias[d] || 0;
      if(v===0) return "var(--border)";
      const ratio = v/maxVal;
      if(ratio>0.66) return "var(--accent)";
      if(ratio>0.33) return "rgba(232,163,61,.6)";
      return "rgba(232,163,61,.3)";
    }
    return `<div class="preg-heatmap">
      ${weeks.map(w=>`<div class="preg-heatmap-col">
        ${w.map(d=>`<div class="preg-heatmap-cell" style="background:${cellColor(d)}" title="${d||""}"></div>`).join("")}
      </div>`).join("")}
    </div>`;
  }
  function renderTemas(){
    const todayCount = state.preguntasDiarias[todayStr] || 0;
    const last7 = [];
    for(let i=6;i>=0;i--){ const d = fmt(addDays(today,-i)); last7.push({d, n: state.preguntasDiarias[d]||0}); }
    const weekTotal = last7.reduce((a,b)=>a+b.n,0);
    const maxN = Math.max(1, ...last7.map(x=>x.n));
    const barsHtml = last7.map(x=>{
      const h = Math.max(4, (x.n/maxN)*100);
      const dow = new Date(x.d+"T00:00:00").getDay();
      const label = ["D","L","M","X","J","V","S"][dow];
      return `<div class="tw-col">
        <div class="tw-bar-wrap"><div class="tw-bar" style="height:${x.n>0?h:2}%"></div></div>
        <div class="tw-label">${label}</div>
      </div>`;
    }).join("");
    const streak = preguntasStreak();
    document.getElementById("temas-preguntas-wrap").innerHTML = `
      <div class="evo-section">
        <div class="evo-section-title">Preguntas revisadas</div>
        <div class="temas-preg-row">
          <div>
            <div class="temas-preg-today">${todayCount}</div>
            <div class="temas-preg-sub">hoy</div>
          </div>
          <div class="temas-preg-week">
            <div><b>${weekTotal}</b> esta semana</div>
            <button class="evo-add-medida-btn" id="temas-log-preg-btn" style="margin-top:6px;">+ Registrar</button>
          </div>
        </div>
        <div class="temas-week-bars">${barsHtml}</div>
        ${streak>0 ? `<div class="preg-streak">🔥 ${streak} día${streak!==1?"s":""} seguido${streak!==1?"s":""} registrando preguntas</div>` : ""}
        ${preguntasHeatmapHtml()}
      </div>
    `;
    document.getElementById("temas-log-preg-btn").addEventListener("click", openPreguntasSheet);

    const temas = state.temas || [];
    const completos = temas.filter(t=> revisionesEsteAno(t)>=3).length;
    const enProgreso = temas.filter(t=>{ const r=revisionesEsteAno(t); return r>=1 && r<3; }).length;
    const sinEmpezar = temas.length - completos - enProgreso;
    let progressHtml;
    if(temas.length===0){
      progressHtml = `<div class="evo-empty">Agrega tus temas para ver tu progreso aquí.</div>`;
    }else{
      const pc = Math.round(completos/temas.length*100);
      const pp = Math.round(enProgreso/temas.length*100);
      const ps = 100-pc-pp;
      progressHtml = `
        <div class="temas-stack-bar">
          <div class="temas-stack-seg" style="width:${pc}%;background:#7FA65C;"></div>
          <div class="temas-stack-seg" style="width:${pp}%;background:var(--accent);"></div>
          <div class="temas-stack-seg" style="width:${ps}%;background:var(--border);"></div>
        </div>
        <div class="temas-legend">
          <span><span class="dot" style="background:#7FA65C;"></span>Completos (3+): ${completos} (${pc}%)</span>
          <span><span class="dot" style="background:var(--accent);"></span>En progreso: ${enProgreso} (${pp}%)</span>
          <span><span class="dot" style="background:var(--border);"></span>Sin empezar: ${sinEmpezar} (${ps}%)</span>
        </div>
      `;
    }
    document.getElementById("temas-progress-wrap").innerHTML = `
      <div class="evo-section">
        <div class="evo-section-title">Progreso del temario</div>
        ${progressHtml}
      </div>
    `;

    renderTemasList();
    renderRitmoNecesario();

    const searchInput = document.getElementById("temas-search");
    searchInput.value = temasSearchQuery;
    searchInput.oninput = ()=>{ temasSearchQuery = searchInput.value; renderTemasList(); };
  }
  function renderTemasList(){
    const temas = state.temas || [];
    const q = temasSearchQuery.trim().toLowerCase();
    const filtered = q ? temas.filter(t=> t.nombre.toLowerCase().includes(q) || (t.categoria||"").toLowerCase().includes(q)) : temas;
    const listWrap = document.getElementById("temas-list-wrap");
    if(temas.length===0){
      listWrap.innerHTML = `<div class="evo-empty">Aún no has agregado ningún tema.</div>`;
    }else if(filtered.length===0){
      listWrap.innerHTML = `<div class="evo-empty">Sin resultados para "${escapeHtml(temasSearchQuery)}".</div>`;
    }else{
      listWrap.innerHTML = [...filtered].sort((a,b)=> a.nombre.localeCompare(b.nombre)).map(t=>{
        const r = revisionesEsteAno(t);
        const doneToday = t.revisiones.includes(todayStr);
        const dots = [0,1,2].map(i=> `<span class="tema-dot ${i<Math.min(r,3)?"filled":""}"></span>`).join("");
        return `<div class="tema-row">
          <div class="tema-row-top">
            <div data-edit-tema="${t.id}" style="flex:1;min-width:0;">
              <div class="tema-row-name">${escapeHtml(t.nombre)}</div>
              ${t.categoria?`<div class="tema-row-cat">${escapeHtml(t.categoria)}</div>`:""}
            </div>
            <div class="tema-row-actions">
              <button class="tema-add-rev-btn" data-rev-tema="${t.id}" ${doneToday?"disabled":""}>${doneToday?"✓ Hoy":"+1 repaso"}</button>
            </div>
          </div>
          <div class="tema-row-dots">${dots} <span style="font-size:10.5px;color:var(--text-faint);margin-left:4px;">${Math.min(r,3)}/3 últimos 365 días${r>3?` (+${r-3})`:""}</span></div>
        </div>`;
      }).join("");
      listWrap.querySelectorAll("[data-edit-tema]").forEach(el=>{
        el.addEventListener("click", ()=> openTemaSheet(el.dataset.editTema));
      });
      listWrap.querySelectorAll("[data-rev-tema]").forEach(el=>{
        el.addEventListener("click", async ()=>{
          const t = state.temas.find(x=>x.id===el.dataset.revTema);
          if(!t || t.revisiones.includes(todayStr)) return;
          t.revisiones.push(todayStr);
          await persist();
          renderTemasList();
          renderRitmoNecesario();
          toast("Repaso registrado");
        });
      });
    }
  }
  document.getElementById("temas-add-btn").addEventListener("click", ()=> openTemaSheet(null));

  function renderRitmoNecesario(){
    const wrap = document.getElementById("temas-ritmo-wrap");
    if(!wrap) return;
    const fechaExamen = state.perfilFisico.fecha_examen || "";
    const metaPreguntas = state.perfilFisico.meta_preguntas_total;
    const temas = state.temas || [];

    let resultHtml = "";
    if(fechaExamen){
      const diasRestantes = Math.ceil((new Date(fechaExamen+"T00:00:00") - new Date(todayStr+"T00:00:00")) / 86400000);
      if(diasRestantes<=0){
        resultHtml = `<div class="evo-empty">Tu fecha de examen ya pasó o es hoy.</div>`;
      }else{
        const repasosNecesarios = temas.length*3;
        const repasosHechos = temas.reduce((a,t)=> a+Math.min(revisionesEsteAno(t),3), 0);
        const repasosFaltantes = Math.max(0, repasosNecesarios - repasosHechos);
        const semanasRestantes = diasRestantes/7;
        const repasosPorSemana = semanasRestantes>0 ? repasosFaltantes/semanasRestantes : 0;

        let preguntasBlock = "";
        if(metaPreguntas){
          const preguntasHechas = Object.values(state.preguntasDiarias).reduce((a,b)=>a+b,0);
          const preguntasFaltantes = Math.max(0, metaPreguntas-preguntasHechas);
          const preguntasPorDia = preguntasFaltantes/diasRestantes;
          preguntasBlock = `<div class="evo-card">
            <div class="evo-card-label">PREGUNTAS/DÍA NECESARIAS</div>
            <div class="evo-card-after" style="font-size:18px;">${preguntasPorDia.toFixed(1)}</div>
            <div class="evo-card-before" style="text-decoration:none;">${preguntasFaltantes} restantes de tu meta</div>
          </div>`;
        }else{
          preguntasBlock = `<div class="evo-card"><div class="evo-card-label">PREGUNTAS/DÍA</div><div class="evo-empty" style="padding:6px 0;">Define una meta de preguntas totales arriba para calcularlo</div></div>`;
        }

        resultHtml = `
          <div class="evo-cards-grid">
            <div class="evo-card">
              <div class="evo-card-label">DÍAS RESTANTES</div>
              <div class="evo-card-after" style="font-size:18px;">${diasRestantes}</div>
            </div>
            <div class="evo-card">
              <div class="evo-card-label">REPASOS/SEMANA NECESARIOS</div>
              <div class="evo-card-after" style="font-size:18px;">${repasosPorSemana.toFixed(1)}</div>
              <div class="evo-card-before" style="text-decoration:none;">${repasosFaltantes} repasos faltan de ${repasosNecesarios}</div>
            </div>
            ${preguntasBlock}
          </div>
        `;
      }
    }

    wrap.innerHTML = `
      <div class="evo-section">
        <div class="evo-section-title">Ritmo necesario</div>
        <div class="ritmo-set-row">
          <div class="ritmo-set-field">
            <label>Fecha de examen</label>
            <input type="date" id="ritmo-fecha" value="${fechaExamen}">
          </div>
          <div class="ritmo-set-field">
            <label>Meta de preguntas totales (opcional)</label>
            <input type="number" min="0" step="1" id="ritmo-meta-preguntas" value="${metaPreguntas!=null?metaPreguntas:""}" placeholder="ej. 5000">
          </div>
          <button class="ritmo-save-btn" id="ritmo-save-btn">Guardar</button>
        </div>
        ${fechaExamen ? resultHtml : `<div class="evo-empty">Define tu fecha de examen para ver cuántos repasos y preguntas por día necesitas.</div>`}
      </div>
    `;
    document.getElementById("ritmo-save-btn").addEventListener("click", async ()=>{
      const f = document.getElementById("ritmo-fecha").value || null;
      const mVal = document.getElementById("ritmo-meta-preguntas").value;
      const m = mVal ? parseInt(mVal,10) : null;
      state.perfilFisico.fecha_examen = f;
      state.perfilFisico.meta_preguntas_total = (m && m>0) ? m : null;
      await persist();
      renderRitmoNecesario();
      toast("Ritmo actualizado");
    });
  }

  function openTemaSheet(id){
    editingTemaId = id;
    const t = id ? state.temas.find(x=>x.id===id) : null;
    document.getElementById("tema-sheet-title").textContent = t ? "Editar tema" : "Nuevo tema";
    document.getElementById("tema-nombre").value = t ? t.nombre : "";
    document.getElementById("tema-categoria").value = t && t.categoria ? t.categoria : "";
    document.getElementById("tema-delete").style.display = t ? "block" : "none";
    document.getElementById("tema-backdrop").classList.add("open");
  }
  document.getElementById("tema-cancel").addEventListener("click", ()=> document.getElementById("tema-backdrop").classList.remove("open"));
  document.getElementById("tema-backdrop").addEventListener("click",(e)=>{ if(e.target.id==="tema-backdrop") document.getElementById("tema-backdrop").classList.remove("open"); });
  document.getElementById("tema-save").addEventListener("click", async ()=>{
    const nombre = document.getElementById("tema-nombre").value.trim();
    if(!nombre){ toast("Ponle un nombre al tema"); return; }
    const categoria = document.getElementById("tema-categoria").value.trim() || null;
    if(editingTemaId){
      const t = state.temas.find(x=>x.id===editingTemaId);
      Object.assign(t, {nombre, categoria});
    }else{
      state.temas.push({id:uid(), nombre, categoria, revisiones:[], createdAt:new Date().toISOString()});
    }
    await persist();
    document.getElementById("tema-backdrop").classList.remove("open");
    renderTemas();
    toast("Tema guardado");
  });
  document.getElementById("tema-delete").addEventListener("click", async ()=>{
    if(!editingTemaId) return;
    if(!confirm("¿Eliminar este tema y su historial de repasos?")) return;
    state.temas = state.temas.filter(x=>x.id!==editingTemaId);
    await persist();
    document.getElementById("tema-backdrop").classList.remove("open");
    renderTemas();
    toast("Tema eliminado");
  });

  // ---------- Bulk add de temas ----------
  document.getElementById("temas-bulk-btn").addEventListener("click", ()=>{
    document.getElementById("temas-bulk-textarea").value = "";
    document.getElementById("temas-bulk-backdrop").classList.add("open");
  });
  document.getElementById("temas-bulk-cancel").addEventListener("click", ()=> document.getElementById("temas-bulk-backdrop").classList.remove("open"));
  document.getElementById("temas-bulk-backdrop").addEventListener("click",(e)=>{ if(e.target.id==="temas-bulk-backdrop") document.getElementById("temas-bulk-backdrop").classList.remove("open"); });
  document.getElementById("temas-bulk-save").addEventListener("click", async ()=>{
    const raw = document.getElementById("temas-bulk-textarea").value;
    const lines = raw.split("\n").map(l=>l.trim()).filter(l=>l.length>0);
    if(!lines.length){ toast("Pega al menos un tema"); return; }
    const existentes = new Set(state.temas.map(t=>t.nombre.toLowerCase().trim()));
    let agregados = 0, omitidos = 0;
    lines.forEach(line=>{
      let categoria = null, nombre = line;
      if(line.includes("|")){
        const parts = line.split("|");
        categoria = parts[0].trim() || null;
        nombre = parts.slice(1).join("|").trim();
      }
      if(!nombre) return;
      if(existentes.has(nombre.toLowerCase())){ omitidos++; return; }
      state.temas.push({id:uid(), nombre, categoria, revisiones:[], createdAt:new Date().toISOString()});
      existentes.add(nombre.toLowerCase());
      agregados++;
    });
    await persist();
    document.getElementById("temas-bulk-backdrop").classList.remove("open");
    renderTemas();
    toast(`${agregados} tema${agregados!==1?"s":""} agregado${agregados!==1?"s":""}${omitidos?` · ${omitidos} ya existían`:""}`);
  });

  function openPreguntasSheet(){
    document.getElementById("preg-fecha").value = todayStr;
    document.getElementById("preg-cantidad").value = state.preguntasDiarias[todayStr] || "";
    document.getElementById("preguntas-backdrop").classList.add("open");
  }
  document.getElementById("preguntas-cancel").addEventListener("click", ()=> document.getElementById("preguntas-backdrop").classList.remove("open"));
  document.getElementById("preguntas-backdrop").addEventListener("click",(e)=>{ if(e.target.id==="preguntas-backdrop") document.getElementById("preguntas-backdrop").classList.remove("open"); });
  document.getElementById("preguntas-save").addEventListener("click", async ()=>{
    const fecha = document.getElementById("preg-fecha").value;
    const cantidad = parseInt(document.getElementById("preg-cantidad").value, 10);
    if(!fecha){ toast("Elige una fecha"); return; }
    if(isNaN(cantidad) || cantidad<0){ toast("Ingresa un número válido"); return; }
    state.preguntasDiarias[fecha] = cantidad;
    await persist();
    document.getElementById("preguntas-backdrop").classList.remove("open");
    renderTemas();
    toast("Registrado");
  });

  function renderMedComparison(){
    const wrap = document.getElementById("med-comparison-wrap");
    const allDates = Object.keys(state.estados);
    const withMed = allDates.filter(d=> state.estados[d].metilfenidato);
    const withoutMed = allDates.filter(d=> !state.estados[d].metilfenidato);

    if(allDates.length < 4 || withMed.length===0 || withoutMed.length===0){
      wrap.innerHTML = `<div class="month-chart-card">
        <div class="month-chart-top"><span class="month-chart-title">Metilfenidato: comparación</span></div>
        <div class="chart-empty-note">Necesitas más días de "Estado" registrados, con y sin Metilfenidato, para poder comparar.</div>
      </div>`;
      return;
    }

    function avg(dates, key){
      const vals = dates.map(d=>state.estados[d][key]).filter(v=>v!==null && v!==undefined && !isNaN(v));
      if(vals.length===0) return null;
      return (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1);
    }

    const metrics = [
      {key:"energia", label:"Energía"},
      {key:"estres", label:"Estrés"},
      {key:"concentracion", label:"Concentración"},
    ];

    function colHtml(dates, title, cls){
      return `<div class="med-compare-col ${cls}">
        <h4>${title}</h4>
        ${metrics.map(m=>`<div class="med-compare-metric"><div class="v">${avg(dates,m.key) ?? "–"}</div><div class="l">${m.label}</div></div>`).join("")}
        <div class="med-compare-n">${dates.length} día${dates.length!==1?"s":""}</div>
      </div>`;
    }

    wrap.innerHTML = `
      <div class="month-chart-card">
        <div class="month-chart-top"><span class="month-chart-title">Metilfenidato: comparación</span></div>
        <div class="month-chart-sub">promedios de todos tus días registrados</div>
        <div class="med-compare-row">
          ${colHtml(withoutMed, "Sin Metilfenidato", "")}
          ${colHtml(withMed, "💊 Con Metilfenidato", "med-yes")}
        </div>
      </div>
    `;
  }

  loadData();
