"use strict";

  // ---------- Pestañas ----------
  let activeTab = "hoy";
  document.querySelectorAll(".tab-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      document.querySelectorAll(".tab-btn").forEach(b=>b.classList.toggle("active", b===btn));
      const tab = btn.dataset.tab;
      activeTab = tab;
      document.getElementById("tab-hoy").style.display = tab==="hoy" ? "block" : "none";
      document.getElementById("tab-proyectos").style.display = tab==="proyectos" ? "block" : "none";
      document.getElementById("tab-evolucion").style.display = tab==="evolucion" ? "block" : "none";
      document.getElementById("tab-temas").style.display = tab==="temas" ? "block" : "none";
      document.getElementById("tab-resumen").style.display = tab==="resumen" ? "block" : "none";
      if(tab==="evolucion") renderEvolucion();
      if(tab==="temas") renderTemas();
      if(tab==="resumen") renderResumenDia();
    });
  });

  // ---------- Alertas inteligentes ----------
  function dailyRatio(dateStr){
    let earned=0, possible=0;
    state.habits.forEach(h=>{ if(habitActiveOn(h,dateStr)){ possible+=h.prioridad; earned+=puntuacionObtenida(h,dateStr); } });
    if(possible===0) return null;
    return earned/possible;
  }
  function rangeConsistency(startAgo, endAgo){
    let earned=0, possible=0;
    for(let i=startAgo;i<=endAgo;i++){
      const d = fmt(addDays(today,-i));
      state.habits.forEach(h=>{ if(habitActiveOn(h,d)){ possible+=h.prioridad; earned+=puntuacionObtenida(h,d); } });
    }
    if(possible===0) return null;
    return earned/possible;
  }
  function computeAlerts(){
    const alerts = [];
    const r0 = dailyRatio(fmt(addDays(today,-0)));
    const r1 = dailyRatio(fmt(addDays(today,-1)));
    if(r0!==null && r1!==null && r0<0.5 && r1<0.5){
      alerts.push({id:"low2", text:"Llevas 2 días con bajo cumplimiento. Hoy puede ser buen momento para pasar a modo supervivencia en vez de forzar el modo normal."});
    }
    const last3 = [0,1,2].map(i=>state.estados[fmt(addDays(today,-i))]).filter(Boolean);
    if(last3.length===3 && last3.every(e=> e.horas_sueno!==null && e.horas_sueno!==undefined && e.horas_sueno<6)){
      alerts.push({id:"sleep3", text:"3 días seguidos con sueño insuficiente. Prioriza descansar hoy antes de exigirte más en estudio."});
    }
    const activeProjects = state.projects.filter(p=>p.estado==="Activo").length;
    if(activeProjects>3){
      alerts.push({id:"proj3", text:`Tienes ${activeProjects} proyectos activos (tu límite es 3). Elige cuáles son prioritarios y pausa el resto.`});
    }
    const c1 = rangeConsistency(0,6), c2 = rangeConsistency(7,13);
    if(c1!==null && c2!==null && c1<0.5 && c2<0.5){
      alerts.push({id:"lowweeks", text:"Tu consistencia lleva dos semanas baja. Considera reducir el número de hábitos activos antes de añadir más."});
    }
    const wk = weekKeyFor(today);
    const weekday = today.getDay(); // 0=domingo
    if(!state.revisiones[wk] && (weekday===0 || weekday===5 || weekday===6)){
      alerts.push({id:"weeklyreview-"+wk, text:"Aún no has hecho tu revisión semanal. Cierra la semana con las 7 preguntas antes de que empiece la siguiente.", action:"openReview"});
    }
    const dismissedToday = state.dismissedAlerts[todayStr] || [];
    return alerts.filter(a=>!dismissedToday.includes(a.id));
  }
  function renderAlerts(){
    const wrap = document.getElementById("alerts-container");
    const alerts = computeAlerts();
    wrap.innerHTML = alerts.map(a=>`
      <div class="alert-banner">
        <div class="txt">${a.text}${a.action ? ` <button class="alert-action-link" data-action="${a.action}">Abrir revisión →</button>` : ""}</div>
        <button data-dismiss="${a.id}">✕</button>
      </div>
    `).join("");
    wrap.querySelectorAll("[data-dismiss]").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const id = btn.getAttribute("data-dismiss");
        if(!state.dismissedAlerts[todayStr]) state.dismissedAlerts[todayStr] = [];
        state.dismissedAlerts[todayStr].push(id);
        await persist();
        renderAlerts();
      });
    });
    wrap.querySelectorAll("[data-action='openReview']").forEach(btn=>{
      btn.addEventListener("click", ()=> openRevisionSheet());
    });
  }

  // ---------- Resumen del día ----------
  function temaMasAtrasado(){
    const temas = state.temas || [];
    if(!temas.length) return null;
    let peor = null, peorDias = -1;
    temas.forEach(t=>{
      const revs = t.revisiones || [];
      let dias;
      if(revs.length===0){
        dias = 99999; // nunca revisado = el más atrasado posible
      }else{
        const last = revs.reduce((a,b)=> a>b?a:b);
        dias = Math.round((new Date(todayStr+"T00:00:00") - new Date(last+"T00:00:00")) / 86400000);
      }
      if(dias>peorDias){ peorDias = dias; peor = t; }
    });
    if(!peor || peorDias<7) return null; // no vale la pena avisar si es muy reciente
    return {tema:peor, dias:peorDias};
  }
  function renderResumenDia(){
    const wrap = document.getElementById("resumen-dia-wrap");
    if(!wrap) return;

    // Hábitos pendientes hoy
    const pendientes = state.habits.filter(h=> habitActiveOn(h, todayStr) && logStatus(h.id, todayStr)==="no");
    const totalActivosHoy = state.habits.filter(h=> habitActiveOn(h, todayStr)).length;

    // Eventos de hoy
    const eventosHoy = eventsForDate(todayStr);

    // Preguntas de hoy
    const pregHoy = state.preguntasDiarias[todayStr];

    // Nudges
    const nudges = [];
    if(!state.estados[todayStr]){
      nudges.push(`<div class="rd-nudge">
        <span class="rd-nudge-icon">⚪</span>
        <div class="rd-nudge-text">Aún no registras tu <b>Estado</b> de hoy</div>
        <button class="rd-nudge-btn" id="rd-nudge-estado-btn">+ Estado</button>
      </div>`);
    }
    const atrasado = temaMasAtrasado();
    if(atrasado){
      const diasTxt = atrasado.dias>=99999 ? "nunca lo has repasado" : `hace ${atrasado.dias} días de tu último repaso`;
      nudges.push(`<div class="rd-nudge">
        <span class="rd-nudge-icon">📚</span>
        <div class="rd-nudge-text">Vas atrasado en <b>${escapeHtml(atrasado.tema.nombre)}</b> — ${diasTxt}</div>
      </div>`);
    }
    const alerts = computeAlerts();
    if(alerts.length){
      nudges.push(`<div class="rd-nudge warn">
        <span class="rd-nudge-icon">⚠️</span>
        <div class="rd-nudge-text">${alerts[0].text}</div>
      </div>`);
    }

    // Hábitos section
    let habitosHtml;
    if(totalActivosHoy===0){
      habitosHtml = "";
    }else if(pendientes.length===0){
      habitosHtml = `<div class="rd-section" style="${nudges.length===0?'border-top:none;padding-top:0;':''}">
        <div class="rd-section-head">
          <div class="rd-section-label">✅ Hábitos</div>
          <div class="rd-count ok">¡Todo hecho! 🎉</div>
        </div>
      </div>`;
    }else{
      habitosHtml = `<div class="rd-section" style="${nudges.length===0?'border-top:none;padding-top:0;':''}">
        <div class="rd-section-head">
          <div class="rd-section-label">✅ Hábitos</div>
          <div class="rd-count">${pendientes.length} de ${totalActivosHoy} pendientes</div>
        </div>
        <div class="rd-habit-list">
          ${pendientes.map(h=>`
            <div class="rd-item">
              <button class="rd-item-check" data-rd-habit="${h.id}"></button>
              <span class="rd-item-dot" style="background:${h.color}"></span>
              <div class="rd-item-text" data-rd-habit-text="${h.id}">${escapeHtml(h.nombre)}</div>
            </div>
          `).join("")}
        </div>
      </div>`;
    }

    // Eventos section (oculta si no hay)
    const eventosHtml = eventosHoy.length ? `<div class="rd-section">
      <div class="rd-section-head">
        <div class="rd-section-label">📅 Eventos de hoy</div>
        <div class="rd-count">${eventosHoy.length}</div>
      </div>
      <div class="rd-event-list">
        ${eventosHoy.map(ev=>`
          <div class="rd-item">
            ${ev.hora?`<span class="rd-item-time">${ev.hora}</span>`:""}
            <span class="rd-item-dot" style="background:${eventColor(ev)}"></span>
            <div class="rd-item-text">${escapeHtml(ev.titulo)}</div>
          </div>
        `).join("")}
      </div>
    </div>` : "";

    // Preguntas section (oculta si no hay registro hoy)
    const preguntasHtml = (pregHoy!==undefined && pregHoy!==null) ? `<div class="rd-section">
      <div class="rd-section-head">
        <div class="rd-section-label">📖 Preguntas ENARM</div>
      </div>
      <div class="rd-preg-row">
        <div>
          <div class="rd-preg-num">${pregHoy}</div>
          <div class="rd-preg-sub">registradas hoy</div>
        </div>
        <button class="rd-preg-btn" id="rd-preg-btn">+ Registrar</button>
      </div>
    </div>` : "";

    const hasAnyContent = nudges.length || habitosHtml || eventosHtml || preguntasHtml;
    if(!hasAnyContent){ wrap.innerHTML = ""; return; }

    wrap.innerHTML = `
      <div class="rd-card">
        <div class="rd-head">
          <div class="rd-title">Resumen de hoy</div>
          <div class="rd-date">${today.toLocaleDateString("es-MX",{weekday:"long", day:"numeric", month:"long"})}</div>
        </div>
        ${nudges.length ? `<div class="rd-nudges">${nudges.join("")}</div>` : ""}
        ${habitosHtml}
        ${eventosHtml}
        ${preguntasHtml}
      </div>
    `;

    const nudgeEstadoBtn = document.getElementById("rd-nudge-estado-btn");
    if(nudgeEstadoBtn) nudgeEstadoBtn.addEventListener("click", ()=> openEstadoSheet());
    wrap.querySelectorAll("[data-rd-habit]").forEach(el=>{
      el.addEventListener("click", ()=> openLogSheet(el.dataset.rdHabit, todayStr));
    });
    wrap.querySelectorAll("[data-rd-habit-text]").forEach(el=>{
      el.addEventListener("click", ()=> openLogSheet(el.dataset.rdHabitText, todayStr));
    });
    const pregBtn = document.getElementById("rd-preg-btn");
    if(pregBtn) pregBtn.addEventListener("click", openPreguntasSheet);
  }

