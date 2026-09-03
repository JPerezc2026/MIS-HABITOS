"use strict";

  // ---------- Calendario ----------
  function ensureEventCatOptions(){
    const sel = document.getElementById("ev-cat");
    if(sel.options.length) return;
    sel.innerHTML = `<option value="">Sin categoría</option>` +
      Object.keys(CATEGORIES).map(k=>`<option value="${k}">${CATEGORIES[k].emoji} ${CATEGORIES[k].name}</option>`).join("");
  }

  const EVENT_COLOR_PALETTE = [
    ...Object.values(CATEGORIES).map(c=>c.color),
    "#8B8FA3", "#E85D9C", "#3DDC97", "#FFD166"
  ];
  function ensureEventColorSwatches(){
    const row = document.getElementById("ev-color-row");
    if(row.children.length) return;
    row.innerHTML = `<button type="button" class="ev-color-swatch ev-color-auto" data-color="">auto</button>` +
      EVENT_COLOR_PALETTE.map(c=>`<button type="button" class="ev-color-swatch" data-color="${c}" style="background:${c}"></button>`).join("");
    row.querySelectorAll("button").forEach(b=>{
      b.addEventListener("click", ()=>{ f_ev_color = b.dataset.color; updateEvColorButtons(); });
    });
  }
  function updateEvColorButtons(){
    document.querySelectorAll("#ev-color-row button").forEach(b=> b.classList.toggle("active", b.dataset.color===f_ev_color));
  }

  function buildNotifRowHtml(){
    const notifSupported = typeof Notification !== "undefined";
    const notifGranted = notifSupported && Notification.permission === "granted";
    const notifDenied = notifSupported && Notification.permission === "denied";
    if(!notifSupported || notifGranted) return "";
    return `<div class="cal-notif-row">
      <span>${notifDenied ? "Notificaciones bloqueadas en el navegador." : "Activa avisos para tus recordatorios."}</span>
      ${notifDenied ? "" : `<button id="cal-enable-notif">Activar</button>`}
    </div>`;
  }

  function buildMonthGridHtml(year, month, selectedDate, compact){
    const first = new Date(year, month, 1);
    const last = new Date(year, month+1, 0);
    const startGrid = mondayOf(first);
    const endGrid = addDays(mondayOf(last), 6);
    const totalDays = Math.round((endGrid - startGrid)/86400000) + 1;
    const monthLabel = first.toLocaleDateString("es-MX", {month:"long", year:"numeric"});
    const maxStripes = compact ? 3 : 4;
    let cellsHtml = "";
    for(let i=0;i<totalDays;i++){
      const d = addDays(startGrid, i);
      const dStr = fmt(d);
      const inMonth = d.getMonth()===month;
      const occ = eventsForDate(dStr);
      const colors = [];
      occ.forEach(ev=>{
        const color = eventColor(ev);
        if(!colors.includes(color)) colors.push(color);
      });
      const shown = colors.slice(0, maxStripes);
      const fillHtml = shown.length ? `<div class="cal-day-fill">${shown.map(c=>`<span style="background:${c}"></span>`).join("")}</div>` : "";
      const inSelectMode = !compact && calSelectMode;
      const isPicked = inSelectMode && calMultiSelected.has(dStr);
      const checkHtml = inSelectMode ? `<span class="cal-day-check">${isPicked?"✓":""}</span>` : "";
      cellsHtml += `<div class="cal-day ${inMonth?"":"other-month"} ${dStr===todayStr?"today":""} ${(!compact && dStr===selectedDate)?"selected":""} ${shown.length?"has-events":""} ${isPicked?"multi-picked":""}" data-date="${dStr}">
        ${fillHtml}
        <span class="cal-daynum">${d.getDate()}</span>
        ${checkHtml}
      </div>`;
    }
    return {cellsHtml, monthLabel};
  }

  // ---------- Calendario: vista compacta (carrusel) ----------
  function renderCalendarCompact(){
    const wrap = document.getElementById("calendar-wrap");
    if(!wrap) return;
    const {cellsHtml, monthLabel} = buildMonthGridHtml(calViewYear, calViewMonth, calSelectedDate, true);
    const next = upcomingEvents(1, 210)[0];
    const nextHtml = next ? `<div class="cal-compact-next">
        <span class="cal-upc-dot" style="background:${eventColor(next.ev)}"></span>
        <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${calDateLabelShort(next.dateStr)} · ${escapeHtml(next.ev.titulo)}</span>
      </div>` : `<div class="cal-compact-next"><span style="color:var(--text-faint);">Sin próximos eventos</span></div>`;

    wrap.innerHTML = `
      <div class="cal-card cal-compact-wrap" id="cal-compact-tap">
        <div class="cal-compact-head">
          <div class="cal-month-label">${monthLabel}</div>
          <span class="cal-compact-hint">Toca para expandir ↗</span>
        </div>
        <div class="cal-weekdays">${DIAS_ES.map(d=>`<span>${d}</span>`).join("")}</div>
        <div class="cal-grid cal-grid-compact">${cellsHtml}</div>
        ${nextHtml}
      </div>
    `;
    document.getElementById("cal-compact-tap").addEventListener("click", (e)=>{
      const dayEl = e.target.closest(".cal-day");
      if(dayEl) calSelectedDate = dayEl.dataset.date;
      const d = new Date(calSelectedDate+"T00:00:00");
      calViewYear = d.getFullYear(); calViewMonth = d.getMonth();
      openCalendarExpanded();
    });
  }

  function refreshCalendarViews(){
    renderCalendarCompact();
    if(document.getElementById("calendar-fullscreen").classList.contains("open")) renderCalendarFull();
    requestAnimationFrame(updateCarouselHeight);
  }

  function openCalendarExpanded(){
    document.getElementById("calendar-fullscreen").classList.add("open");
    renderCalendarFull();
  }
  function closeCalendarExpanded(){
    document.getElementById("calendar-fullscreen").classList.remove("open");
    renderCalendarCompact();
  }

  // ---------- Calendario: vista completa (pantalla expandida) ----------
  function renderCalendarFull(){
    const body = document.getElementById("calendar-fullscreen-body");
    if(!body) return;

    const {cellsHtml, monthLabel} = buildMonthGridHtml(calViewYear, calViewMonth, calSelectedDate, false);

    const selDayEvents = eventsForDate(calSelectedDate);
    const selDayLabel = new Date(calSelectedDate+"T00:00:00").toLocaleDateString("es-MX",{weekday:"long", day:"numeric", month:"long"});
    const dayItemsHtml = selDayEvents.length ? selDayEvents.map(ev=>{
      const color = eventColor(ev);
      const rl = repeatLabel(ev);
      const metaParts = [];
      if(ev.hora) metaParts.push(ev.hora);
      if(rl) metaParts.push(rl);
      if(ev.recordatorio) metaParts.push("🔔");
      return `<div class="cal-event-item">
        <div class="cei-left" data-edit-event="${ev.id}">
          <span class="cei-dot" style="background:${color}"></span>
          <div class="cei-text">
            <div class="cei-title">${escapeHtml(ev.titulo)}</div>
            <div class="cei-meta">${metaParts.join(" · ")}</div>
          </div>
        </div>
        <button class="cei-del" data-del-event="${ev.id}" data-del-date="${calSelectedDate}">✕</button>
      </div>`;
    }).join("") : `<div class="chart-empty-note" style="padding:16px 6px;">Sin eventos este día.</div>`;

    const upcoming = upcomingEvents(8, 210);
    const upcomingHtml = upcoming.length ? upcoming.map(({ev,dateStr})=>{
      const color = eventColor(ev);
      return `<div class="cal-upc-item" data-goto-date="${dateStr}">
        <span class="cal-upc-date">${calDateLabelShort(dateStr)}</span>
        <span class="cal-upc-dot" style="background:${color}"></span>
        <span class="cal-upc-title">${escapeHtml(ev.titulo)}</span>
        <span class="cal-upc-time">${ev.hora||""}</span>
      </div>`;
    }).join("") : `<div class="chart-empty-note" style="padding:10px 6px;">No hay próximos eventos.</div>`;

    const multiBarHtml = calSelectMode ? `<div class="cal-multi-bar">
        <span class="cal-multi-count">${calMultiSelected.size} día${calMultiSelected.size!==1?"s":""} seleccionado${calMultiSelected.size!==1?"s":""}</span>
        <div class="cal-multi-actions">
          <button id="cal-multi-sueltos" ${calMultiSelected.size<1?"disabled":""}>Mismo evento en cada día</button>
          <button id="cal-multi-rango" ${calMultiSelected.size<2?"disabled":""}>Un rango continuo</button>
          <button id="cal-multi-cancel">Cancelar</button>
        </div>
      </div>` : "";

    body.innerHTML = `
      ${buildNotifRowHtml()}
      <div class="cal-nav">
        <div class="cal-month-label">${monthLabel}</div>
        <div class="cal-nav-btns">
          <button id="cal-today-btn" class="cal-nav-today">hoy</button>
          <button id="cal-prev-month">‹</button>
          <button id="cal-next-month">›</button>
        </div>
      </div>
      <div class="cal-weekdays">${DIAS_ES.map(d=>`<span>${d}</span>`).join("")}</div>
      <div class="cal-grid">${cellsHtml}</div>
      ${multiBarHtml}
      <div class="cal-day-panel">
        <div class="cal-day-panel-head">
          <span class="cdp-date">${selDayLabel}</span>
          <div class="cdp-actions">
            <button id="cal-select-toggle" class="${calSelectMode?"active":""}">${calSelectMode?"✕ Salir":"☐ Seleccionar"}</button>
            <button id="cal-add-event-btn">+ Agregar</button>
          </div>
        </div>
        <div id="cal-day-events-list">${dayItemsHtml}</div>
      </div>
      <div class="cal-upcoming">
        <div class="cal-upcoming-title">PRÓXIMOS EVENTOS</div>
        <div>${upcomingHtml}</div>
      </div>
    `;
    attachCalendarHandlers();
  }

  function attachCalendarHandlers(){
    const prevBtn = document.getElementById("cal-prev-month");
    const nextBtn = document.getElementById("cal-next-month");
    const todayBtn = document.getElementById("cal-today-btn");
    if(prevBtn) prevBtn.addEventListener("click", ()=>{
      calViewMonth--; if(calViewMonth<0){calViewMonth=11; calViewYear--;}
      renderCalendarFull();
    });
    if(nextBtn) nextBtn.addEventListener("click", ()=>{
      calViewMonth++; if(calViewMonth>11){calViewMonth=0; calViewYear++;}
      renderCalendarFull();
    });
    if(todayBtn) todayBtn.addEventListener("click", ()=>{
      calViewYear = today.getFullYear(); calViewMonth = today.getMonth(); calSelectedDate = todayStr;
      renderCalendarFull();
    });
    document.querySelectorAll("#calendar-fullscreen-body .cal-day").forEach(el=>{
      el.addEventListener("click", ()=>{
        const dStr = el.dataset.date;
        if(calSelectMode){
          if(calMultiSelected.has(dStr)) calMultiSelected.delete(dStr); else calMultiSelected.add(dStr);
          renderCalendarFull();
          return;
        }
        calSelectedDate = dStr;
        const d = new Date(dStr+"T00:00:00");
        calViewYear = d.getFullYear(); calViewMonth = d.getMonth();
        renderCalendarFull();
      });
    });
    const selToggle = document.getElementById("cal-select-toggle");
    if(selToggle) selToggle.addEventListener("click", ()=>{
      calSelectMode = !calSelectMode;
      if(!calSelectMode) calMultiSelected.clear();
      renderCalendarFull();
    });
    const mSueltos = document.getElementById("cal-multi-sueltos");
    if(mSueltos) mSueltos.addEventListener("click", ()=>{
      if(calMultiSelected.size<1) return;
      openEventSheet(null, null, {multiDates: Array.from(calMultiSelected).sort()});
    });
    const mRango = document.getElementById("cal-multi-rango");
    if(mRango) mRango.addEventListener("click", ()=>{
      if(calMultiSelected.size<2) return;
      const dates = Array.from(calMultiSelected).sort();
      openEventSheet(dates[0], null, {rangoEnd: dates[dates.length-1]});
    });
    const mCancel = document.getElementById("cal-multi-cancel");
    if(mCancel) mCancel.addEventListener("click", ()=>{
      calSelectMode = false; calMultiSelected.clear(); renderCalendarFull();
    });
    const addBtn = document.getElementById("cal-add-event-btn");
    if(addBtn) addBtn.addEventListener("click", ()=> openEventSheet(calSelectedDate, null));
    document.querySelectorAll("[data-edit-event]").forEach(el=>{
      el.addEventListener("click", ()=> openEventSheet(calSelectedDate, el.dataset.editEvent));
    });
    document.querySelectorAll("[data-del-event]").forEach(el=>{
      el.addEventListener("click", async (e)=>{
        e.stopPropagation();
        const id = el.dataset.delEvent;
        const dStr = el.dataset.delDate;
        const ev = state.eventos.find(x=>x.id===id);
        if(!ev) return;
        if(ev.repeticion === "ninguna"){
          if(!confirm("¿Eliminar este evento?")) return;
          state.eventos = state.eventos.filter(x=>x.id!==id);
        }else{
          if(!confirm("¿Eliminar solo esta repetición? Las demás fechas se mantendrán.")) return;
          if(!ev.excepciones) ev.excepciones = [];
          ev.excepciones.push(dStr);
        }
        await persist();
        renderCalendarFull();
      });
    });
    document.querySelectorAll("[data-goto-date]").forEach(el=>{
      el.addEventListener("click", ()=>{
        calSelectedDate = el.dataset.gotoDate;
        const d = new Date(calSelectedDate+"T00:00:00");
        calViewYear = d.getFullYear(); calViewMonth = d.getMonth();
        renderCalendarFull();
      });
    });
    const enableNotifBtn = document.getElementById("cal-enable-notif");
    if(enableNotifBtn) enableNotifBtn.addEventListener("click", async ()=>{
      try{
        const perm = await Notification.requestPermission();
        if(perm==="granted") toast("Recordatorios activados");
        else toast("No se activaron las notificaciones");
      }catch(e){ console.error(e); }
      renderCalendarFull();
    });
  }
  document.getElementById("cal-fs-close").addEventListener("click", closeCalendarExpanded);

  function openEventSheet(dateStr, id, opts){
    opts = opts || {};
    editingEventId = id;
    editingMultiDates = opts.multiDates || null;
    ensureEventCatOptions();
    ensureEventColorSwatches();
    const ev = id ? state.eventos.find(x=>x.id===id) : null;
    document.getElementById("event-sheet-title").textContent = ev ? "Editar evento" : "Nuevo evento";
    document.getElementById("ev-title").value = ev ? ev.titulo : "";
    document.getElementById("ev-time").value = ev && ev.hora ? ev.hora : "";
    document.getElementById("ev-cat").value = ev && ev.categoria ? ev.categoria : "";
    document.getElementById("ev-until").value = ev && ev.repeticionHasta ? ev.repeticionHasta : "";
    document.getElementById("ev-note").value = ev && ev.nota ? ev.nota : "";
    f_ev_repeat = ev ? (ev.repeticion||"ninguna") : "ninguna";
    f_ev_reminder = ev && ev.recordatorio ? 1 : 0;
    f_ev_color = ev && ev.color ? ev.color : "";
    updateEvColorButtons();

    if(editingMultiDates){
      document.getElementById("ev-date-field").style.display = "none";
      document.getElementById("ev-repeat-field").style.display = "none";
      document.getElementById("ev-multi-summary-field").style.display = "block";
      document.getElementById("ev-multi-summary-text").textContent = editingMultiDates.map(calDateLabelShort).join(", ");
      document.getElementById("ev-date").value = "";
      document.getElementById("ev-end-date").value = "";
    }else{
      document.getElementById("ev-date-field").style.display = "block";
      document.getElementById("ev-repeat-field").style.display = "block";
      document.getElementById("ev-multi-summary-field").style.display = "none";
      document.getElementById("ev-date").value = ev ? ev.fecha : dateStr;
      document.getElementById("ev-end-date").value = opts.rangoEnd ? opts.rangoEnd : (ev && ev.fechaFin ? ev.fechaFin : "");
    }
    updateEvRepeatButtons();
    updateEvReminderButtons();
    document.getElementById("event-delete").style.display = ev ? "block" : "none";
    document.getElementById("event-backdrop").classList.add("open");
  }
  function closeEventSheet(){
    document.getElementById("event-backdrop").classList.remove("open");
    editingEventId = null;
    editingMultiDates = null;
  }
  function updateEvRepeatButtons(){
    document.querySelectorAll("#ev-repeat-row button").forEach(b=> b.classList.toggle("active", b.dataset.r===f_ev_repeat));
    document.getElementById("ev-until-field").style.display = (f_ev_repeat==="ninguna") ? "none" : "block";
    document.getElementById("ev-end-date-field").style.display = (f_ev_repeat==="ninguna" && !editingMultiDates) ? "block" : "none";
  }
  function updateEvReminderButtons(){
    document.querySelectorAll("#ev-reminder-row button").forEach(b=> b.classList.toggle("active", Number(b.dataset.rem)===f_ev_reminder));
  }
  document.querySelectorAll("#ev-repeat-row button").forEach(b=>{
    b.addEventListener("click", ()=>{ f_ev_repeat = b.dataset.r; updateEvRepeatButtons(); });
  });
  document.querySelectorAll("#ev-reminder-row button").forEach(b=>{
    b.addEventListener("click", async ()=>{
      f_ev_reminder = Number(b.dataset.rem);
      if(f_ev_reminder===1 && typeof Notification!=="undefined" && Notification.permission==="default"){
        try{ await Notification.requestPermission(); }catch(e){ console.error(e); }
      }
      updateEvReminderButtons();
    });
  });
  document.getElementById("event-cancel").addEventListener("click", closeEventSheet);
  document.getElementById("event-backdrop").addEventListener("click", (e)=>{ if(e.target.id==="event-backdrop") closeEventSheet(); });
  document.getElementById("event-save").addEventListener("click", async ()=>{
    const titulo = document.getElementById("ev-title").value.trim();
    if(!titulo){ toast("Ponle un título al evento"); return; }
    const hora = document.getElementById("ev-time").value || null;
    const categoria = document.getElementById("ev-cat").value || null;
    const nota = document.getElementById("ev-note").value.trim() || null;

    if(editingMultiDates && editingMultiDates.length){
      editingMultiDates.forEach(dateStr=>{
        state.eventos.push({id:uid(), titulo, fecha:dateStr, hora, categoria, color: f_ev_color||null, repeticion:"ninguna", repeticionHasta:null, fechaFin:null, recordatorio: f_ev_reminder===1, nota, excepciones:[], notificados:{}, createdAt:new Date().toISOString()});
      });
      await persist();
      const firstDate = editingMultiDates[0];
      const count = editingMultiDates.length;
      closeEventSheet();
      calSelectMode = false; calMultiSelected.clear();
      calSelectedDate = firstDate;
      const d = new Date(firstDate+"T00:00:00");
      calViewYear = d.getFullYear(); calViewMonth = d.getMonth();
      refreshCalendarViews();
      toast(`Evento creado en ${count} día${count!==1?"s":""}`);
      return;
    }

    const fecha = document.getElementById("ev-date").value;
    if(!fecha){ toast("Elige una fecha"); return; }
    const repeticionHasta = document.getElementById("ev-until").value || null;
    const fechaFin = document.getElementById("ev-end-date").value || null;
    if(editingEventId){
      const ev = state.eventos.find(x=>x.id===editingEventId);
      Object.assign(ev, {titulo, fecha, hora, categoria, color: f_ev_color||null, repeticion:f_ev_repeat, repeticionHasta: f_ev_repeat==="ninguna"?null:repeticionHasta, fechaFin: f_ev_repeat==="ninguna"?fechaFin:null, recordatorio: f_ev_reminder===1, nota});
    }else{
      state.eventos.push({id:uid(), titulo, fecha, hora, categoria, color: f_ev_color||null, repeticion:f_ev_repeat, repeticionHasta: f_ev_repeat==="ninguna"?null:repeticionHasta, fechaFin: f_ev_repeat==="ninguna"?fechaFin:null, recordatorio: f_ev_reminder===1, nota, excepciones:[], notificados:{}, createdAt:new Date().toISOString()});
    }
    await persist();
    closeEventSheet();
    calSelectMode = false; calMultiSelected.clear();
    calSelectedDate = fecha;
    const d = new Date(fecha+"T00:00:00");
    calViewYear = d.getFullYear(); calViewMonth = d.getMonth();
    refreshCalendarViews();
    toast("Evento guardado");
  });
  document.getElementById("event-delete").addEventListener("click", async ()=>{
    if(!editingEventId) return;
    if(!confirm("¿Eliminar este evento y todas sus repeticiones?")) return;
    state.eventos = state.eventos.filter(x=>x.id!==editingEventId);
    await persist();
    closeEventSheet();
    refreshCalendarViews();
    toast("Evento eliminado");
  });

  function checkEventReminders(){
    if(typeof Notification==="undefined" || Notification.permission!=="granted") return;
    const now = new Date();
    const dateStr = fmt(now);
    const hhmm = String(now.getHours()).padStart(2,"0")+":"+String(now.getMinutes()).padStart(2,"0");
    let changed = false;
    eventsForDate(dateStr).forEach(ev=>{
      if(!ev.recordatorio || !ev.hora || ev.hora!==hhmm) return;
      if(!ev.notificados) ev.notificados = {};
      if(ev.notificados[dateStr]) return;
      ev.notificados[dateStr] = true;
      changed = true;
      try{
        new Notification("📅 " + ev.titulo, { body: ev.hora + (ev.nota ? " · "+ev.nota : ""), icon:"icon.png" });
      }catch(e){ console.error(e); }
    });
    if(changed) persist();
    checkPassiveReminder(dateStr, hhmm);
  }

  function checkPassiveReminder(dateStr, hhmm){
    if(typeof Notification==="undefined" || Notification.permission!=="granted") return;
    const horaConfigurada = state.perfilFisico.hora_recordatorio || "21:00";
    if(hhmm !== horaConfigurada) return;
    if(state.perfilFisico.ultimoRecordatorioPasivo === dateStr) return;
    const hayEstado = !!state.estados[dateStr];
    const hayHabito = state.habits.some(h=> habitActiveOn(h,dateStr) && logStatus(h.id,dateStr)!=="no");
    if(hayEstado || hayHabito) return;
    state.perfilFisico.ultimoRecordatorioPasivo = dateStr;
    try{
      new Notification("⚪ Aún no registras nada hoy", { body: "Captura tu Estado o marca un hábito antes de que se te pase el día.", icon:"icon.png" });
    }catch(e){ console.error(e); }
    persist();
  }

  document.getElementById("rd-reminder-hora").value = state.perfilFisico.hora_recordatorio || "21:00";
  document.getElementById("rd-reminder-save").addEventListener("click", async ()=>{
    state.perfilFisico.hora_recordatorio = document.getElementById("rd-reminder-hora").value || "21:00";
    await persist();
    toast("Hora de recordatorio guardada");
  });

