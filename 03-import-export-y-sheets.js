"use strict";

  // ---------- Exportar / Importar ----------
  document.getElementById("export-btn").addEventListener("click", ()=>{
    try{
      const dataStr = JSON.stringify(state, null, 2);
      const blob = new Blob([dataStr], {type:"application/json"});
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = fmt(today);
      a.href = url;
      a.download = `nucleo-de-habitos-respaldo-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast("Respaldo descargado");
    }catch(e){
      console.error(e);
      toast("No se pudo exportar. Intenta de nuevo.");
    }
  });

  document.getElementById("import-btn").addEventListener("click", ()=>{
    document.getElementById("import-file-input").click();
  });

  document.getElementById("import-file-input").addEventListener("change", (e)=>{
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = async (ev)=>{
      try{
        const parsed = JSON.parse(ev.target.result);
        if(!parsed || typeof parsed!=="object" || !Array.isArray(parsed.habits)){
          toast("Ese archivo no parece un respaldo válido");
          return;
        }
        if(!confirm("Esto reemplazará TODOS tus datos actuales con los del archivo. ¿Continuar?")) return;
        state = {
          habits: parsed.habits || [],
          logs: parsed.logs || {},
          estados: parsed.estados || {},
          revisiones: parsed.revisiones || {},
          projects: parsed.projects || [],
          ciclosEstudio: parsed.ciclosEstudio || [],
          dismissedAlerts: parsed.dismissedAlerts || {},
          cierres: parsed.cierres || {},
          reflexionesClinicas: parsed.reflexionesClinicas || [],
          snapshots: parsed.snapshots || {},
          eventos: parsed.eventos || [],
          medidas: parsed.medidas || {},
          perfilFisico: parsed.perfilFisico || {talla_cm:null},
          temas: parsed.temas || [],
          preguntasDiarias: parsed.preguntasDiarias || {}
        };
        await persist();
        render();
        toast("Datos importados correctamente");
      }catch(err){
        console.error(err);
        toast("El archivo no se pudo leer. ¿Es un JSON válido?");
      }
      e.target.value = "";
    };
    reader.readAsText(file);
  });

  // ---------- Habit sheet ----------
  function buildCatGrid(){
    const wrap = document.getElementById("cat-grid");
    wrap.innerHTML = "";
    Object.keys(CATEGORIES).forEach(key=>{
      const cat = CATEGORIES[key];
      const el = document.createElement("div");
      el.className = "cat-pick" + (key===f_categoria?" active":"");
      el.innerHTML = `<span class="em">${cat.emoji}</span><span class="nm">${cat.name}</span>`;
      el.addEventListener("click", ()=>{ f_categoria = key; buildCatGrid(); });
      wrap.appendChild(el);
    });
  }
  function buildFreqRow(){
    const wrap = document.getElementById("freq-row");
    wrap.innerHTML = "";
    for(let i=0;i<=7;i++){
      const b = document.createElement("button");
      b.type="button"; b.textContent=i+"/7"; b.className = i===f_frecuencia?"active":"";
      b.addEventListener("click", ()=>{ f_frecuencia=i; buildFreqRow(); });
      wrap.appendChild(b);
    }
  }
  document.querySelectorAll("#pri-row button").forEach(b=>{
    b.addEventListener("click", ()=>{ f_prioridad = parseInt(b.dataset.p); document.querySelectorAll("#pri-row button").forEach(x=>x.classList.toggle("active", x===b)); });
  });
  document.querySelectorAll("#type-row button").forEach(b=>{
    b.addEventListener("click", ()=>{ f_tipo = b.dataset.t; document.querySelectorAll("#type-row button").forEach(x=>x.classList.toggle("active", x===b)); });
  });

  function openHabitSheet(habitId){
    editingHabitId = habitId || null;
    const habit = habitId ? state.habits.find(h=>h.id===habitId) : null;
    document.getElementById("habit-sheet-title").textContent = habit ? "Editar hábito" : "Nuevo hábito";
    document.getElementById("f-name").value = habit ? habit.nombre : "";
    document.getElementById("f-normal").value = habit ? habit.modoNormal : "";
    document.getElementById("f-superv").value = habit ? habit.modoSuperv : "";
    document.getElementById("habit-delete").style.display = habit ? "block" : "none";

    f_categoria = habit ? habit.categoria : "sueno";
    f_prioridad = habit ? habit.prioridad : 3;
    f_frecuencia = habit ? habit.frecuencia : 5;
    f_tipo = habit ? habit.tipo : "resultado";

    buildCatGrid(); buildFreqRow();
    document.querySelectorAll("#pri-row button").forEach(x=> x.classList.toggle("active", parseInt(x.dataset.p)===f_prioridad));
    document.querySelectorAll("#type-row button").forEach(x=> x.classList.toggle("active", x.dataset.t===f_tipo));

    document.getElementById("habit-backdrop").classList.add("open");
  }
  function closeHabitSheet(){ document.getElementById("habit-backdrop").classList.remove("open"); editingHabitId=null; }

  document.getElementById("add-fab").addEventListener("click", ()=>{
    if(activeTab==="proyectos") openProjectSheet(null);
    else openHabitSheet(null);
  });
  document.getElementById("habit-cancel").addEventListener("click", closeHabitSheet);
  document.getElementById("habit-backdrop").addEventListener("click",(e)=>{ if(e.target.id==="habit-backdrop") closeHabitSheet(); });

  document.getElementById("habit-save").addEventListener("click", async ()=>{
    const nombre = document.getElementById("f-name").value.trim();
    if(!nombre){ toast("Ponle un nombre a tu hábito"); return; }
    const modoNormal = document.getElementById("f-normal").value.trim();
    const modoSuperv = document.getElementById("f-superv").value.trim();
    const cat = CATEGORIES[f_categoria];

    if(editingHabitId){
      const h = state.habits.find(x=>x.id===editingHabitId);
      Object.assign(h, {nombre, categoria:f_categoria, color:cat.color, prioridad:f_prioridad, frecuencia:f_frecuencia, tipo:f_tipo, modoNormal, modoSuperv});
    } else {
      const activeCount = state.habits.filter(h=>h.activo).length;
      if(activeCount>=MAX_ACTIVE){ toast("Ya tienes "+MAX_ACTIVE+" hábitos activos — tu propio límite recomendado. Se agregó de todas formas."); }
      state.habits.push({id:uid(), nombre, categoria:f_categoria, color:cat.color, prioridad:f_prioridad, frecuencia:f_frecuencia, tipo:f_tipo, modoNormal, modoSuperv, activo:true, createdAt:new Date().toISOString()});
    }
    await persist();
    closeHabitSheet();
    render();
    toast("Hábito guardado");
  });

  document.getElementById("habit-delete").addEventListener("click", async ()=>{
    if(!editingHabitId) return;
    if(!confirm("¿Eliminar este hábito y todo su historial?")) return;
    state.habits = state.habits.filter(h=>h.id!==editingHabitId);
    Object.keys(state.logs).forEach(d=> delete state.logs[d][editingHabitId]);
    await persist();
    closeHabitSheet();
    render();
    toast("Hábito eliminado");
  });

  // ---------- Log sheet (para días pasados/mini-semana/año) ----------
  function openLogSheet(habitId, dateStr){
    const habit = state.habits.find(h=>h.id===habitId);
    currentLogCtx = {habitId, dateStr};
    const d = new Date(dateStr+"T00:00:00");
    document.getElementById("log-date-label").textContent = d.toLocaleDateString("es-MX",{day:"numeric",month:"long",year:"numeric"});
    document.getElementById("log-habit-name").textContent = `${CATEGORIES[habit.categoria].emoji} ${habit.nombre}`;
    const st = logStatus(habitId, dateStr);
    document.getElementById("log-no").classList.toggle("active-no", st==="no");
    document.getElementById("log-superv").classList.toggle("active-superv", st==="superv");
    document.getElementById("log-normal").classList.toggle("active-normal", st==="normal");
    document.getElementById("log-backdrop").classList.add("open");
  }
  function closeLogSheet(){ document.getElementById("log-backdrop").classList.remove("open"); currentLogCtx=null; }
  document.getElementById("log-cancel").addEventListener("click", closeLogSheet);
  document.getElementById("log-backdrop").addEventListener("click",(e)=>{ if(e.target.id==="log-backdrop") closeLogSheet(); });

  ["no","superv","normal"].forEach(status=>{
    document.getElementById("log-"+status).addEventListener("click", async ()=>{
      if(!currentLogCtx) return;
      const {habitId, dateStr} = currentLogCtx;
      if(!state.logs[dateStr]) state.logs[dateStr] = {};
      state.logs[dateStr][habitId] = status;
      await persist();
      closeLogSheet();
      render();
    });
  });

  // ---------- Estado de hoy ----------
  const sliderIds = ["e-calidad","e-energia","e-estres","e-concentracion"];
  sliderIds.forEach(id=>{
    document.getElementById(id).addEventListener("input", (e)=>{
      document.getElementById(id+"-val").textContent = e.target.value;
    });
  });
  function setTogglePair(wrapId, value, setter){
    document.querySelectorAll("#"+wrapId+" button").forEach(b=>{
      b.classList.toggle("active", parseInt(b.dataset.v)===value);
      b.onclick = ()=>{ setter(parseInt(b.dataset.v)); setTogglePair(wrapId, parseInt(b.dataset.v), setter); };
    });
  }

  function openEstadoSheet(){
    const est = state.estados[todayStr];
    document.getElementById("e-primera-tarea").value = est ? (est.primera_tarea||"") : "";
    document.getElementById("e-horas-sueno").value = est ? (est.horas_sueno ?? "") : "";
    document.getElementById("e-calidad").value = est ? est.calidad_sueno : 5;
    document.getElementById("e-calidad-val").textContent = est ? est.calidad_sueno : 5;
    document.getElementById("e-energia").value = est ? est.energia : 5;
    document.getElementById("e-energia-val").textContent = est ? est.energia : 5;
    document.getElementById("e-estres").value = est ? est.estres : 5;
    document.getElementById("e-estres-val").textContent = est ? est.estres : 5;
    document.getElementById("e-concentracion").value = est ? est.concentracion : 5;
    document.getElementById("e-concentracion-val").textContent = est ? est.concentracion : 5;
    document.getElementById("e-observaciones").value = est ? (est.observaciones||"") : "";
    e_guardia = est && est.guardia ? 1 : 0;
    e_enfermedad = est && est.enfermedad ? 1 : 0;
    e_metilfenidato = est && est.metilfenidato ? 1 : 0;
    setTogglePair("e-guardia-toggle", e_guardia, (v)=>e_guardia=v);
    setTogglePair("e-enfermedad-toggle", e_enfermedad, (v)=>e_enfermedad=v);
    setTogglePair("e-metilfenidato-toggle", e_metilfenidato, (v)=>e_metilfenidato=v);
    document.getElementById("estado-backdrop").classList.add("open");
  }
  function closeEstadoSheet(){ document.getElementById("estado-backdrop").classList.remove("open"); }
  document.getElementById("estado-cancel").addEventListener("click", closeEstadoSheet);
  document.getElementById("estado-backdrop").addEventListener("click",(e)=>{ if(e.target.id==="estado-backdrop") closeEstadoSheet(); });

  document.getElementById("estado-save").addEventListener("click", async ()=>{
    const horasRaw = document.getElementById("e-horas-sueno").value.trim().replace(",",".");
    const horas = horasRaw==="" ? null : parseFloat(horasRaw);
    state.estados[todayStr] = {
      fecha: todayStr,
      primera_tarea: document.getElementById("e-primera-tarea").value.trim(),
      horas_sueno: (horas===null || isNaN(horas)) ? null : horas,
      calidad_sueno: parseInt(document.getElementById("e-calidad").value),
      energia: parseInt(document.getElementById("e-energia").value),
      estres: parseInt(document.getElementById("e-estres").value),
      concentracion: parseInt(document.getElementById("e-concentracion").value),
      guardia: !!e_guardia,
      enfermedad: !!e_enfermedad,
      metilfenidato: !!e_metilfenidato,
      observaciones: document.getElementById("e-observaciones").value.trim(),
      dia_ganado: diaGanado(todayStr)
    };
    await persist();
    closeEstadoSheet();
    render();
    toast("Estado guardado");
  });

  // ---------- Revisión semanal ----------
  function renderReviewList(){
    const wrap = document.getElementById("review-list");
    const keys = Object.keys(state.revisiones).sort().reverse();
    if(keys.length===0){ wrap.innerHTML = ""; return; }
    const qLabels = ["Qué funcionó","Qué no funcionó","Qué hábito tuvo mayor impacto","Qué comportamiento desperdició más tiempo","Qué error se repitió","Qué debo eliminar","Prioridad de la próxima semana"];
    let html = `<h3>Revisiones anteriores</h3>`;
    keys.forEach(k=>{
      const r = state.revisiones[k];
      html += `<div class="review-item"><div class="rd">${weekRangeLabel(k)}</div>`;
      [r.q1,r.q2,r.q3,r.q4,r.q5,r.q6,r.q7].forEach((val,i)=>{
        if(val) html += `<div class="rq"><b>${qLabels[i]}:</b> ${escapeHtml(val)}</div>`;
      });
      html += `</div>`;
    });
    wrap.innerHTML = html;
  }

  function openRevisionSheet(){
    const wk = weekKeyFor(today);
    const r = state.revisiones[wk];
    document.getElementById("revision-title").textContent = "Revisión — semana del " + weekRangeLabel(wk);
    ["q1","q2","q3","q4","q5","q6","q7"].forEach((k,i)=>{
      document.getElementById("r-"+k).value = r ? (r[k]||"") : "";
    });
    renderReviewList();
    document.getElementById("revision-backdrop").classList.add("open");
  }
  function closeRevisionSheet(){ document.getElementById("revision-backdrop").classList.remove("open"); }
  document.getElementById("open-review-btn").addEventListener("click", openRevisionSheet);
  document.getElementById("revision-cancel").addEventListener("click", closeRevisionSheet);
  document.getElementById("revision-backdrop").addEventListener("click",(e)=>{ if(e.target.id==="revision-backdrop") closeRevisionSheet(); });

  document.getElementById("revision-save").addEventListener("click", async ()=>{
    const wk = weekKeyFor(today);
    state.revisiones[wk] = {
      semana: wk,
      q1: document.getElementById("r-q1").value.trim(),
      q2: document.getElementById("r-q2").value.trim(),
      q3: document.getElementById("r-q3").value.trim(),
      q4: document.getElementById("r-q4").value.trim(),
      q5: document.getElementById("r-q5").value.trim(),
      q6: document.getElementById("r-q6").value.trim(),
      q7: document.getElementById("r-q7").value.trim(),
      guardado_en: new Date().toISOString()
    };
    await persist();
    renderReviewList();
    toast("Revisión guardada");
  });

