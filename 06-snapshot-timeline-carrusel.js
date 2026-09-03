"use strict";

  // ---------- Snapshot rápido ----------
  function nowTimeStr(){ const d=new Date(); return String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0"); }
  function minutesOf(hora){ const [h,m]=hora.split(":").map(Number); return h*60+m; }

  let snap_med = 0;
  document.getElementById("start-snapshot-btn").addEventListener("click", ()=>{
    document.getElementById("snap-hora").value = nowTimeStr();
    ["energia","estres","concentracion"].forEach(k=>{
      document.getElementById("snap-"+k).value = 5;
      document.getElementById("snap-"+k+"-val").textContent = 5;
    });
    snap_med = 0;
    setTogglePair("snap-med-toggle", snap_med, (v)=>snap_med=v);
    renderSnapshotListToday();
    document.getElementById("snapshot-backdrop").classList.add("open");
  });
  ["snap-energia","snap-estres","snap-concentracion"].forEach(id=>{
    document.getElementById(id).addEventListener("input", (e)=>{
      document.getElementById(id+"-val").textContent = e.target.value;
    });
  });
  document.getElementById("snapshot-cancel").addEventListener("click", ()=>{
    document.getElementById("snapshot-backdrop").classList.remove("open");
  });
  document.getElementById("snapshot-backdrop").addEventListener("click",(e)=>{ if(e.target.id==="snapshot-backdrop") document.getElementById("snapshot-backdrop").classList.remove("open"); });

  document.getElementById("snapshot-save").addEventListener("click", async ()=>{
    const hora = document.getElementById("snap-hora").value || nowTimeStr();
    if(!state.snapshots[todayStr]) state.snapshots[todayStr] = [];
    state.snapshots[todayStr].push({
      hora,
      energia: parseInt(document.getElementById("snap-energia").value),
      estres: parseInt(document.getElementById("snap-estres").value),
      concentracion: parseInt(document.getElementById("snap-concentracion").value),
      metilfenidato: !!snap_med,
      creadoEn: new Date().toISOString()
    });
    state.snapshots[todayStr].sort((a,b)=> minutesOf(a.hora)-minutesOf(b.hora));
    await persist();
    renderSnapshotListToday();
    renderTodayTimeline();
    toast("Snapshot guardado");
  });

  function renderSnapshotListToday(){
    const wrap = document.getElementById("snapshot-list-today");
    const list = state.snapshots[todayStr] || [];
    if(list.length===0){ wrap.innerHTML = ""; return; }
    wrap.innerHTML = list.map((s,i)=>`
      <div class="snap-row">
        <span><b>${s.hora}</b> — energía ${s.energia} · estrés ${s.estres} · concentración ${s.concentracion} ${s.metilfenidato?"💊":""}</span>
        <button data-del-snap="${i}">✕</button>
      </div>
    `).join("");
    wrap.querySelectorAll("[data-del-snap]").forEach(btn=>{
      btn.addEventListener("click", async ()=>{
        const i = parseInt(btn.getAttribute("data-del-snap"));
        state.snapshots[todayStr].splice(i,1);
        await persist();
        renderSnapshotListToday();
        renderTodayTimeline();
      });
    });
  }

  function renderTodayTimeline(){
    const wrap = document.getElementById("today-timeline-wrap");
    const viewDate = timelineViewDate;
    const list = state.snapshots[viewDate] || [];
    const isToday = viewDate === todayStr;
    const d = new Date(viewDate+"T00:00:00");
    const dateLabel = isToday ? "Hoy" : d.toLocaleDateString("es-MX",{weekday:"short", day:"numeric", month:"short"});
    const navHtml = `
      <div class="timeline-nav">
        <button id="timeline-prev-day">‹</button>
        <span class="timeline-date-label">${dateLabel}</span>
        <button id="timeline-next-day" ${isToday ? "disabled" : ""}>›</button>
      </div>
    `;

    if(list.length===0){
      wrap.innerHTML = `<div class="month-chart-card">
        ${navHtml}
        <div class="chart-empty-note">${isToday ? `Aún no hay snapshots de hoy.<br>Usa "🔄 Flujos ▾ → 📈 Snapshot rápido" para registrar el primero.` : "No hay snapshots registrados este día."}</div>
      </div>`;
      attachTimelineNav();
      syncCarouselCloneSlide();
    requestAnimationFrame(updateCarouselHeight);
      requestAnimationFrame(updateCarouselHeight);
      return;
    }

    const minutesArr = list.map(s=>minutesOf(s.hora));
    let minM = Math.max(0, Math.min(...minutesArr)-30);
    let maxM = Math.min(1440, Math.max(...minutesArr)+30);
    if(maxM-minM < 60){ maxM = minM+60; }

    const W=600, H=170, padL=8, padR=8, padT=14, padB=22;
    const innerW=W-padL-padR, innerH=H-padT-padB;
    const xFor = (m)=> padL + ((m-minM)/(maxM-minM))*innerW;
    const yFor = (v)=> padT + (1-(v/10))*innerH;

    function pathFor(key){
      return list.map((s,i)=> `${i===0?"M":"L"}${xFor(minutesOf(s.hora)).toFixed(1)},${yFor(s[key]).toFixed(1)}`).join(" ");
    }
    function dotsFor(key,color){
      return list.map(s=> `<circle cx="${xFor(minutesOf(s.hora)).toFixed(1)}" cy="${yFor(s[key]).toFixed(1)}" r="3" fill="${color}"/>`).join("");
    }
    const gridLines = [0,5,10].map(v=>`<line x1="${padL}" y1="${yFor(v).toFixed(1)}" x2="${W-padR}" y2="${yFor(v).toFixed(1)}" stroke="#333846" stroke-width="1" stroke-dasharray="2,3"/>`).join("");
    const timeLabels = list.map(s=>`<text x="${xFor(minutesOf(s.hora)).toFixed(1)}" y="${H-6}" font-size="8.5" fill="#5b6072" font-family="JetBrains Mono, monospace" text-anchor="middle">${s.hora}</text>`).join("");
    const medMarkers = list.filter(s=>s.metilfenidato).map(s=>{
      const x = xFor(minutesOf(s.hora)).toFixed(1);
      return `<line x1="${x}" y1="${padT}" x2="${x}" y2="${H-padB}" stroke="#C9A876" stroke-width="1.5" stroke-dasharray="3,3"/>
              <text x="${x}" y="${padT-3}" font-size="11" text-anchor="middle">💊</text>`;
    }).join("");

    wrap.innerHTML = `
      <div class="month-chart-card">
        ${navHtml}
        <div class="timeline-legend">
          <span class="li"><span class="dot" style="background:#E8A33D;"></span>Energía</span>
          <span class="li"><span class="dot" style="background:#E8735A;"></span>Estrés</span>
          <span class="li"><span class="dot" style="background:#5B9BD9;"></span>Concentración</span>
          <span class="li">💊 Metilfenidato</span>
        </div>
        <svg class="month-chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
          ${gridLines}
          ${medMarkers}
          <path d="${pathFor('energia')}" fill="none" stroke="#E8A33D" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="${pathFor('estres')}" fill="none" stroke="#E8735A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="${pathFor('concentracion')}" fill="none" stroke="#5B9BD9" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          ${dotsFor('energia','#E8A33D')}
          ${dotsFor('estres','#E8735A')}
          ${dotsFor('concentracion','#5B9BD9')}
          ${timeLabels}
        </svg>
      </div>
    `;
    attachTimelineNav();
    syncCarouselCloneSlide();
  }
  function attachTimelineNav(){
    const prevBtn = document.getElementById("timeline-prev-day");
    const nextBtn = document.getElementById("timeline-next-day");
    if(prevBtn) prevBtn.addEventListener("click", ()=>{
      timelineViewDate = fmt(addDays(new Date(timelineViewDate+"T00:00:00"), -1));
      renderTodayTimeline();
    });
    if(nextBtn) nextBtn.addEventListener("click", ()=>{
      if(nextBtn.disabled) return;
      timelineViewDate = fmt(addDays(new Date(timelineViewDate+"T00:00:00"), 1));
      renderTodayTimeline();
    });
  }

  // ---------- Carrusel de gráficas ----------
  const carouselEl = document.getElementById("charts-carousel");
  const REAL_SLIDE_COUNT = 5;
  let carouselSettleTimer = null;
  function updateCarouselHeight(){
    const idx = Math.min(Math.round(carouselEl.scrollLeft / carouselEl.clientWidth), REAL_SLIDE_COUNT-1);
    const slides = carouselEl.querySelectorAll(".chart-slide");
    const activeSlide = slides[idx];
    if(activeSlide) carouselEl.style.height = activeSlide.scrollHeight + "px";
  }
  carouselEl.addEventListener("scroll", ()=>{
    const idx = Math.round(carouselEl.scrollLeft / carouselEl.clientWidth);
    document.querySelectorAll("#carousel-dots .dot").forEach((d,i)=> d.classList.toggle("active", i===Math.min(idx, REAL_SLIDE_COUNT-1)));
    updateCarouselHeight();
    clearTimeout(carouselSettleTimer);
    carouselSettleTimer = setTimeout(()=>{
      const settledIdx = Math.round(carouselEl.scrollLeft / carouselEl.clientWidth);
      if(settledIdx >= REAL_SLIDE_COUNT){
        carouselEl.scrollLeft = 0;
        document.querySelectorAll("#carousel-dots .dot").forEach((d,i)=> d.classList.toggle("active", i===0));
      }
      updateCarouselHeight();
    }, 140);
  });
  function syncCarouselCloneSlide(){
    const src = document.getElementById("today-timeline-wrap");
    const clone = document.getElementById("today-timeline-wrap-clone");
    if(src && clone) clone.innerHTML = src.innerHTML;
  }
  window.addEventListener("resize", ()=> requestAnimationFrame(updateCarouselHeight));

  // ---------- Auto-actualización de gráficas (cada minuto) + detección de cambio de día ----------
  setInterval(()=>{
    const nowStr = fmt(new Date());
    if(nowStr !== todayStr){
      today = new Date();
      todayStr = nowStr;
      YEAR = today.getFullYear();
      yearStart = new Date(YEAR,0,1);
      yearEnd = new Date(YEAR,11,31);
      timelineViewDate = todayStr;
      render();
    } else {
      renderMonthChart();
      renderTodayTimeline();
      checkEventReminders();
    }
  }, 60000);

  // ---------- Historial de ciclos de estudio ----------
  document.getElementById("open-cycle-history-btn").addEventListener("click", ()=>{
    const wrap = document.getElementById("cycle-history-list");
    const items = [...(state.ciclosEstudio||[])].sort((a,b)=> b.fecha.localeCompare(a.fecha));
    wrap.innerHTML = items.length ? items.map(c=>`
      <div class="review-item"><div class="rd">${c.fecha}</div>
        ${c.pasos.filter(p=>p.nota).map(p=>`<div class="rq"><b>${p.titulo}:</b> ${escapeHtml(p.nota)}</div>`).join("")}
      </div>
    `).join("") : `<div class="chart-empty-note">Aún no has completado ningún ciclo de estudio.</div>`;
    document.getElementById("cycle-history-backdrop").classList.add("open");
  });
  document.getElementById("cycle-history-cancel").addEventListener("click", ()=>{
    document.getElementById("cycle-history-backdrop").classList.remove("open");
  });
  document.getElementById("cycle-history-backdrop").addEventListener("click",(e)=>{ if(e.target.id==="cycle-history-backdrop") document.getElementById("cycle-history-backdrop").classList.remove("open"); });

  // ---------- Historial de cierres del día ----------
  document.getElementById("open-closure-history-btn").addEventListener("click", ()=>{
    const wrap = document.getElementById("closure-history-list");
    const keys = Object.keys(state.cierres||{}).sort().reverse();
    wrap.innerHTML = keys.length ? keys.map(k=>{
      const c = state.cierres[k];
      return `<div class="review-item"><div class="rd">${k}</div>
        ${c.queHice ? `<div class="rq"><b>Qué hice:</b> ${escapeHtml(c.queHice)}</div>` : ""}
        ${c.quePendiente ? `<div class="rq"><b>Qué quedó pendiente:</b> ${escapeHtml(c.quePendiente)}</div>` : ""}
        ${c.primeraTareaManana ? `<div class="rq"><b>Primera tarea del día siguiente:</b> ${escapeHtml(c.primeraTareaManana)}</div>` : ""}
      </div>`;
    }).join("") : `<div class="chart-empty-note">Aún no has hecho ningún cierre del día.</div>`;
    document.getElementById("closure-history-backdrop").classList.add("open");
  });
  document.getElementById("closure-history-cancel").addEventListener("click", ()=>{
    document.getElementById("closure-history-backdrop").classList.remove("open");
  });
  document.getElementById("closure-history-backdrop").addEventListener("click",(e)=>{ if(e.target.id==="closure-history-backdrop") document.getElementById("closure-history-backdrop").classList.remove("open"); });

