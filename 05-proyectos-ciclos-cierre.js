"use strict";

  // ---------- Proyectos ----------
  function projectCard(p){
    const statusClass = "status-"+p.estado;
    return `
      <div class="project-card" data-project="${p.id}">
        <div class="project-top">
          <div>
            <div class="project-name">${escapeHtml(p.nombre)}</div>
            <div class="project-meta">
              <span class="status-badge ${statusClass}">${p.estado.replace("_"," ")}</span>
              <span class="priority-dots">${[1,2,3,4,5].map(n=>`<span class="${n<=p.prioridad?'on':''}"></span>`).join("")}</span>
              ${p.fechaObjetivo ? `<span class="freq-label">🎯 ${p.fechaObjetivo}</span>` : ""}
            </div>
          </div>
          <button class="edit-btn" data-edit-project="${p.id}">✎</button>
        </div>
        ${p.descripcion ? `<div class="project-desc">${escapeHtml(p.descripcion)}</div>` : ""}
        ${p.proximaAccion ? `<div class="project-next"><b>Próxima acción:</b> ${escapeHtml(p.proximaAccion)}</div>` : ""}
      </div>
    `;
  }
  function renderProjects(){
    const active = state.projects.filter(p=>p.estado==="Activo").sort((a,b)=>b.prioridad-a.prioridad);
    const waiting = state.projects.filter(p=>p.estado==="En_espera").sort((a,b)=>b.prioridad-a.prioridad);
    const archived = state.projects.filter(p=>p.estado==="Completado"||p.estado==="Archivado");

    document.getElementById("projects-active").innerHTML = active.length ? active.map(projectCard).join("")
      : `<div class="empty-state" style="padding:24px 10px;"><p>Sin proyectos activos todavía.</p></div>`;
    document.getElementById("projects-waiting").innerHTML = waiting.length ? waiting.map(projectCard).join("")
      : `<div class="empty-state" style="padding:24px 10px;"><p>Nada en espera por ahora.</p></div>`;
    document.getElementById("projects-archived").innerHTML = archived.length ? archived.map(projectCard).join("")
      : `<div class="empty-state" style="padding:24px 10px;"><p>Nada aquí todavía.</p></div>`;

    document.querySelectorAll("[data-edit-project]").forEach(btn=>{
      btn.addEventListener("click", ()=> openProjectSheet(btn.getAttribute("data-edit-project")));
    });
  }

  document.getElementById("toggle-archived").addEventListener("click", ()=>{
    const wrap = document.getElementById("projects-archived-wrap");
    const open = wrap.style.display !== "none";
    wrap.style.display = open ? "none" : "block";
    document.getElementById("toggle-archived").textContent = open ? "Ver completados / archivados ▾" : "Ocultar ▴";
  });

  function buildProjPriRow(){
    document.querySelectorAll("#p-pri-row button").forEach(b=>{
      b.classList.toggle("active", parseInt(b.dataset.p)===p_prioridad);
      b.onclick = ()=>{ p_prioridad = parseInt(b.dataset.p); buildProjPriRow(); };
    });
  }
  function buildProjStatusRow(){
    document.querySelectorAll("#p-status-row button").forEach(b=>{
      b.classList.toggle("active", b.dataset.s===p_estado);
      b.onclick = ()=>{ p_estado = b.dataset.s; buildProjStatusRow(); };
    });
  }

  function openProjectSheet(projectId){
    editingProjectId = projectId || null;
    const p = projectId ? state.projects.find(x=>x.id===projectId) : null;
    document.getElementById("project-sheet-title").textContent = p ? "Editar proyecto" : "Nuevo proyecto";
    document.getElementById("p-name").value = p ? p.nombre : "";
    document.getElementById("p-desc").value = p ? p.descripcion : "";
    document.getElementById("p-next").value = p ? p.proximaAccion : "";
    document.getElementById("p-date").value = p ? (p.fechaObjetivo||"") : "";
    document.getElementById("p-notes").value = p ? p.notas : "";
    document.getElementById("project-delete").style.display = p ? "block" : "none";
    p_prioridad = p ? p.prioridad : 3;
    p_estado = p ? p.estado : "Activo";
    buildProjPriRow(); buildProjStatusRow();
    document.getElementById("project-backdrop").classList.add("open");
  }
  function closeProjectSheet(){ document.getElementById("project-backdrop").classList.remove("open"); editingProjectId=null; }
  document.getElementById("project-cancel").addEventListener("click", closeProjectSheet);
  document.getElementById("project-backdrop").addEventListener("click",(e)=>{ if(e.target.id==="project-backdrop") closeProjectSheet(); });

  document.getElementById("project-save").addEventListener("click", async ()=>{
    const nombre = document.getElementById("p-name").value.trim();
    if(!nombre){ toast("Ponle un nombre al proyecto"); return; }
    const activeCountOther = state.projects.filter(p=>p.estado==="Activo" && p.id!==editingProjectId).length;
    if(p_estado==="Activo" && activeCountOther>=3){
      toast("Ya tienes 3 proyectos activos — tu propio límite. Se guardó igual, considera pausar otro.");
    }
    const data = {
      nombre,
      descripcion: document.getElementById("p-desc").value.trim(),
      prioridad: p_prioridad,
      estado: p_estado,
      proximaAccion: document.getElementById("p-next").value.trim(),
      fechaObjetivo: document.getElementById("p-date").value,
      notas: document.getElementById("p-notes").value.trim()
    };
    if(editingProjectId){
      Object.assign(state.projects.find(x=>x.id===editingProjectId), data);
    } else {
      state.projects.push(Object.assign({id:uid(), fechaInicio:todayStr, createdAt:new Date().toISOString()}, data));
    }
    await persist();
    closeProjectSheet();
    renderProjects();
    toast("Proyecto guardado");
  });
  document.getElementById("project-delete").addEventListener("click", async ()=>{
    if(!editingProjectId) return;
    if(!confirm("¿Eliminar este proyecto?")) return;
    state.projects = state.projects.filter(p=>p.id!==editingProjectId);
    await persist();
    closeProjectSheet();
    renderProjects();
    toast("Proyecto eliminado");
  });

  // ---------- Ciclo de estudio ----------
  function renderCycleStep(){
    const dots = document.getElementById("cycle-progress");
    dots.innerHTML = STUDY_STEPS.map((s,i)=>`<span class="dotp ${i<cycleIdx?'done':''} ${i===cycleIdx?'current':''}"></span>`).join("");
    document.getElementById("cycle-step-num").textContent = `Paso ${cycleIdx+1} de ${STUDY_STEPS.length}`;
    document.getElementById("cycle-step-title").textContent = STUDY_STEPS[cycleIdx].title;
    document.getElementById("cycle-note").placeholder = STUDY_STEPS[cycleIdx].ph;
    document.getElementById("cycle-note").value = cycleNotes[cycleIdx];
    document.getElementById("cycle-back").style.visibility = cycleIdx===0 ? "hidden" : "visible";
    document.getElementById("cycle-next").textContent = cycleIdx===STUDY_STEPS.length-1 ? "Finalizar" : "Siguiente";
  }
  document.getElementById("start-study-cycle-btn").addEventListener("click", ()=>{
    cycleIdx = 0; cycleNotes = ["","","","","",""];
    renderCycleStep();
    document.getElementById("cycle-backdrop").classList.add("open");
  });
  document.getElementById("cycle-back").addEventListener("click", ()=>{
    cycleNotes[cycleIdx] = document.getElementById("cycle-note").value;
    if(cycleIdx>0){ cycleIdx--; renderCycleStep(); }
  });
  document.getElementById("cycle-cancel").addEventListener("click", ()=>{
    document.getElementById("cycle-backdrop").classList.remove("open");
  });
  document.getElementById("cycle-backdrop").addEventListener("click",(e)=>{ if(e.target.id==="cycle-backdrop") document.getElementById("cycle-backdrop").classList.remove("open"); });

  document.getElementById("cycle-next").addEventListener("click", async ()=>{
    cycleNotes[cycleIdx] = document.getElementById("cycle-note").value;
    if(cycleIdx < STUDY_STEPS.length-1){ cycleIdx++; renderCycleStep(); return; }
    // finalizar
    if(!state.ciclosEstudio) state.ciclosEstudio = [];
    state.ciclosEstudio.push({
      fecha: todayStr,
      pasos: STUDY_STEPS.map((s,i)=>({titulo:s.title, nota:cycleNotes[i]})),
      creadoEn: new Date().toISOString()
    });
    const estudioHabits = state.habits.filter(h=>h.activo && h.categoria==="estudio").sort((a,b)=>b.prioridad-a.prioridad);
    if(estudioHabits.length>0){
      const h = estudioHabits[0];
      if(!state.logs[todayStr]) state.logs[todayStr] = {};
      if(state.logs[todayStr][h.id]!=="normal") state.logs[todayStr][h.id] = "normal";
    }
    await persist();
    document.getElementById("cycle-backdrop").classList.remove("open");
    render();
    toast(estudioHabits.length ? "Ciclo completado — hábito de estudio marcado como cumplido" : "Ciclo de estudio guardado");
  });

  // ---------- Cierre del día ----------
  function renderClosureStep(){
    const dots = document.getElementById("closure-progress");
    dots.innerHTML = CLOSURE_STEPS.map((s,i)=>`<span class="dotp ${i<closureIdx?'done':''} ${i===closureIdx?'current':''}"></span>`).join("");
    document.getElementById("closure-step-num").textContent = `Paso ${closureIdx+1} de ${CLOSURE_STEPS.length}`;
    document.getElementById("closure-step-title").textContent = CLOSURE_STEPS[closureIdx].title;
    document.getElementById("closure-note").placeholder = CLOSURE_STEPS[closureIdx].ph;
    document.getElementById("closure-note").value = closureNotes[closureIdx];
    document.getElementById("closure-back").style.visibility = closureIdx===0 ? "hidden" : "visible";
    document.getElementById("closure-next").textContent = closureIdx===CLOSURE_STEPS.length-1 ? "Finalizar" : "Siguiente";
  }
  document.getElementById("start-closure-btn").addEventListener("click", ()=>{
    const existing = state.cierres[todayStr];
    closureIdx = 0;
    closureNotes = existing ? [existing.queHice||"", existing.quePendiente||"", existing.primeraTareaManana||""] : ["","",""];
    renderClosureStep();
    document.getElementById("closure-backdrop").classList.add("open");
  });
  document.getElementById("closure-back").addEventListener("click", ()=>{
    closureNotes[closureIdx] = document.getElementById("closure-note").value;
    if(closureIdx>0){ closureIdx--; renderClosureStep(); }
  });
  document.getElementById("closure-cancel").addEventListener("click", ()=>{
    document.getElementById("closure-backdrop").classList.remove("open");
  });
  document.getElementById("closure-backdrop").addEventListener("click",(e)=>{ if(e.target.id==="closure-backdrop") document.getElementById("closure-backdrop").classList.remove("open"); });

  document.getElementById("closure-next").addEventListener("click", async ()=>{
    closureNotes[closureIdx] = document.getElementById("closure-note").value;
    if(closureIdx < CLOSURE_STEPS.length-1){ closureIdx++; renderClosureStep(); return; }
    // finalizar
    state.cierres[todayStr] = {
      fecha: todayStr,
      queHice: closureNotes[0],
      quePendiente: closureNotes[1],
      primeraTareaManana: closureNotes[2],
      creadoEn: new Date().toISOString()
    };
    // pasar la primera tarea de mañana al estado de mañana
    const tomorrowStr = fmt(addDays(today,1));
    if(closureNotes[2]){
      if(!state.estados[tomorrowStr]) state.estados[tomorrowStr] = {fecha:tomorrowStr, horas_sueno:null, calidad_sueno:5, energia:5, estres:5, concentracion:5, guardia:false, enfermedad:false, observaciones:"", primera_tarea:"", dia_ganado:false};
      state.estados[tomorrowStr].primera_tarea = closureNotes[2];
    }
    const orgHabits = state.habits.filter(h=>h.activo && h.categoria==="organizacion").sort((a,b)=>b.prioridad-a.prioridad);
    if(orgHabits.length>0){
      const h = orgHabits[0];
      if(!state.logs[todayStr]) state.logs[todayStr] = {};
      if(state.logs[todayStr][h.id]!=="normal") state.logs[todayStr][h.id] = "normal";
    }
    await persist();
    document.getElementById("closure-backdrop").classList.remove("open");
    render();
    toast("Cierre del día guardado — mañana ya tiene su primera tarea lista");
  });

  // ---------- Reflexión post-caso clínico ----------
  function renderClinicalList(){
    const wrap = document.getElementById("clinical-list");
    if(!state.reflexionesClinicas.length){ wrap.innerHTML = ""; return; }
    const labels = ["Problema principal","Gravedad","Diagnóstico probable","Diagnósticos diferenciales","Dato clave","Conducta","Criterio de referencia","Qué aprendí","Qué haré diferente"];
    const sorted = [...state.reflexionesClinicas].sort((a,b)=> b.fecha.localeCompare(a.fecha));
    let html = `<h3>Reflexiones anteriores</h3>`;
    sorted.slice(0,15).forEach(r=>{
      html += `<div class="review-item"><div class="rd">${r.fecha}</div>`;
      r.campos.forEach((val,i)=>{ if(val) html += `<div class="rq"><b>${labels[i]}:</b> ${escapeHtml(val)}</div>`; });
      html += `</div>`;
    });
    wrap.innerHTML = html;
  }
  document.getElementById("start-clinical-btn").addEventListener("click", ()=>{
    ["c-f1","c-f2","c-f3","c-f4","c-f5","c-f6","c-f7","c-f8","c-f9"].forEach(id=> document.getElementById(id).value = "");
    renderClinicalList();
    document.getElementById("clinical-backdrop").classList.add("open");
  });
  document.getElementById("clinical-cancel").addEventListener("click", ()=>{
    document.getElementById("clinical-backdrop").classList.remove("open");
  });
  document.getElementById("clinical-backdrop").addEventListener("click",(e)=>{ if(e.target.id==="clinical-backdrop") document.getElementById("clinical-backdrop").classList.remove("open"); });

  document.getElementById("clinical-save").addEventListener("click", async ()=>{
    const campos = ["c-f1","c-f2","c-f3","c-f4","c-f5","c-f6","c-f7","c-f8","c-f9"].map(id=>document.getElementById(id).value.trim());
    if(campos.every(v=>!v)){ toast("Escribe al menos un campo"); return; }
    state.reflexionesClinicas.push({ fecha: todayStr, campos, creadoEn: new Date().toISOString() });
    const clinHabits = state.habits.filter(h=>h.activo && h.categoria==="clinica").sort((a,b)=>b.prioridad-a.prioridad);
    if(clinHabits.length>0){
      const h = clinHabits[0];
      if(!state.logs[todayStr]) state.logs[todayStr] = {};
      if(state.logs[todayStr][h.id]!=="normal") state.logs[todayStr][h.id] = "normal";
    }
    await persist();
    renderClinicalList();
    ["c-f1","c-f2","c-f3","c-f4","c-f5","c-f6","c-f7","c-f8","c-f9"].forEach(id=> document.getElementById(id).value = "");
    render();
    toast("Reflexión guardada");
  });

