"use strict";


  const CATEGORIES = {
    sueno:        {name:"Sueño",                emoji:"😴", color:"#5B9BD9"},
    estudio:      {name:"Estudio",               emoji:"📚", color:"#E8A33D"},
    clinica:      {name:"Clínica",                emoji:"🩺", color:"#D96C93"},
    fisico:       {name:"Físico",                 emoji:"🏃", color:"#4FBDB0"},
    nutricion:    {name:"Nutrición",              emoji:"🥗", color:"#7FA65C"},
    organizacion: {name:"Organización",           emoji:"🗂️", color:"#9B8CD9"},
    tecnologia:   {name:"Tecnología y atención",  emoji:"📵", color:"#C9A876"},
    vida:         {name:"Vida personal",          emoji:"❤️", color:"#E8735A"},
  };
  const SALUD_CATS = ["sueno","fisico","nutricion"];
  const ESTUDIO_CATS = ["estudio","clinica"];
  const ORG_CATS = ["organizacion"];
  const MAX_ACTIVE = 10;

  const STORAGE_KEY = "nucleo-habitos-data";
  const MONTHS_ES = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  const DIAS_ES = ["L","M","X","J","V","S","D"];

  let today = new Date();
  let todayStr = fmt(today);
  let YEAR = today.getFullYear();
  let yearStart = new Date(YEAR,0,1);
  let yearEnd = new Date(YEAR,11,31);
  let timelineViewDate = todayStr;

  let state = { habits: [], logs: {}, estados: {}, revisiones: {}, projects: [], ciclosEstudio: [], dismissedAlerts: {}, cierres: {}, reflexionesClinicas: [], snapshots: {}, eventos: [], medidas: {}, perfilFisico: {talla_cm:null}, temas: [], preguntasDiarias: {} };
  let editingHabitId = null;
  let editingProjectId = null;
  let currentLogCtx = null;
  let f_categoria = "sueno";
  let f_prioridad = 3;
  let f_frecuencia = 5;
  let f_tipo = "resultado";
  let e_guardia = 0;
  let e_enfermedad = 0;
  let e_metilfenidato = 0;
  let p_prioridad = 3;
  let p_estado = "Activo";
  let cycleIdx = 0;
  let cycleNotes = ["","","","","",""];
  let closureIdx = 0;
  let closureNotes = ["","",""];
  let calViewYear = today.getFullYear();
  let calViewMonth = today.getMonth();
  let calSelectedDate = todayStr;
  let editingEventId = null;
  let editingMultiDates = null;
  let calSelectMode = false;
  let calMultiSelected = new Set();
  let f_ev_repeat = "ninguna";
  let f_ev_reminder = 0;
  let f_ev_color = "";
  const CLOSURE_STEPS = [
    {title:"Qué hice hoy", ph:"Resumen breve del día"},
    {title:"Qué quedó pendiente", ph:"¿Qué no alcanzaste a terminar?"},
    {title:"Primera tarea de mañana", ph:"07:30 - abrir Harrison - insuficiencia cardiaca - 25 min"}
  ];
  const STUDY_STEPS = [
    {title:"Estudiar concepto", ph:"¿Qué tema estudiaste?"},
    {title:"Resolver preguntas", ph:"¿Cuántas preguntas y de qué tema?"},
    {title:"Identificar errores", ph:"¿Qué preguntas fallaste?"},
    {title:"Explicar el error", ph:"¿Qué pensaste vs qué era correcto?"},
    {title:"Convertir el error en flashcard o nota", ph:"Escribe la flashcard o nota"},
    {title:"Repasar posteriormente", ph:"¿Cuándo vas a repasar esto?"}
  ];

  function fmt(d){ return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0"); }
  function uid(){ return Math.random().toString(36).slice(2,10); }
  function hexToRgb(hex){ const v=hex.replace("#",""); return [parseInt(v.slice(0,2),16),parseInt(v.slice(2,4),16),parseInt(v.slice(4,6),16)]; }
  function toast(msg){ const t=document.getElementById("toast"); t.textContent=msg; t.classList.add("show"); setTimeout(()=>t.classList.remove("show"),2200); }
  function escapeHtml(s){ return (s||"").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function addDays(d,n){ const r=new Date(d); r.setDate(r.getDate()+n); return r; }
  function mondayOf(d){ const r=new Date(d); const wd=(r.getDay()+6)%7; r.setDate(r.getDate()-wd); return r; }
  function weekKeyFor(d){ return fmt(mondayOf(d)); }
  function weekRangeLabel(mondayStr){
    const m = new Date(mondayStr+"T00:00:00");
    const s = addDays(m,6);
    const fmtOpt = {day:"numeric", month:"short"};
    return m.toLocaleDateString("es-MX",fmtOpt)+" – "+s.toLocaleDateString("es-MX",fmtOpt);
  }

