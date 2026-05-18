import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bell, Plus, Search, ChevronRight, AlertTriangle, CheckCircle, Clock,
  Circle, FileText, AlertCircle, Layers, Building2, BarChart2, User,
  Download, Upload, Link2, ExternalLink, X, Calendar, Map, Settings,
  PanelLeftClose, PanelLeftOpen, LogOut, MessageSquare, Send, Paperclip,
  AtSign, Hash, Users, UserPlus, Trash2, CheckSquare, Zap, Flame,
  Droplets, Radio, Leaf, ChevronDown, MoreVertical, Lock
} from "lucide-react";
import { useAuth } from './hooks/useAuth.jsx'
import { COMPANY } from './lib/constants.js'
import LoginPage from './pages/LoginPage.jsx'
import { listenProjects, updateProject, createProject, listenMessages, sendMessage as dbSendMsg, deleteMessage as dbDeleteMsg, deleteProject, checkAccess, initAccessControl, requestAccess, approveAccess, rejectAccess, listenPendingRequests, listenApprovedUsers, getSharedProject, listenNotes, createNote, deleteNote } from './lib/db.js'
import { sendMentionEmail, sendAccessRequestEmail } from './lib/emailService.js'
import { forceFirestoreSync } from './lib/firebase.js'

/* ─── THEME ─────────────────────────────────────────────────────────────────── */
const DARK = {
  bg:"#0d0f12",sidebar:"#111318",panel:"#161b22",panelHov:"#1c2230",
  border:"#21262d",borderLt:"#30363d",
  text:"#e6edf3",textMd:"#8b949e",textDim:"#484f58",
  accent:"#58a6ff",accentBg:"#58a6ff14",accentLt:"#79c0ff",
  green:"#3fb950",greenBg:"#3fb95014",
  amber:"#d29922",amberBg:"#d2992214",
  red:"#f85149",redBg:"#f8514914",
  blue:"#58a6ff",purple:"#bc8cff",
  shadow:"0 8px 32px rgba(0,0,0,.55)",shadowLg:"0 24px 64px rgba(0,0,0,.75)",
};
const LIGHT = {
  bg:"#f6f8fa",sidebar:"#ffffff",panel:"#ffffff",panelHov:"#f6f8fa",
  border:"#d0d7de",borderLt:"#c6cdd5",
  text:"#24292f",textMd:"#57606a",textDim:"#8c959f",
  accent:"#0969da",accentBg:"#0969da0f",accentLt:"#0550ae",
  green:"#1a7f37",greenBg:"#1a7f3710",
  amber:"#9a6700",amberBg:"#9a670010",
  red:"#cf222e",redBg:"#cf222e10",
  blue:"#0969da",purple:"#8250df",
  shadow:"0 4px 16px rgba(0,0,0,.10)",shadowLg:"0 16px 48px rgba(0,0,0,.16)",
};

/* ─── PROJECT TYPES ─────────────────────────────────────────────────────────── */
const PROJECT_TYPES = [
  { id: 'arhitectura', label: 'Arhitectură',    color: '#f85149' },
  { id: 'urbanism',    label: 'Urbanism',        color: '#3fb950' },
  { id: 'design',      label: 'Design Interior', color: '#bc8cff' },
]
const projTypeColor = (type) => PROJECT_TYPES.find(t=>t.id===type)?.color || '#58a6ff'
const projTypeLabel = (type) => PROJECT_TYPES.find(t=>t.id===type)?.label || 'Arhitectură'

/* ─── CONSTANTS ─────────────────────────────────────────────────────────────── */
const GC = {CU:"#d29922",Avize:"#58a6ff",PT:"#bc8cff",AC:"#3fb950"};
const STATUS_META = {
  pending:    {label:"WIP",         Icon:Circle,      color:"#484f58"},
  in_progress:{label:"În lucru",   Icon:Clock,       color:"#d29922"},
  submitted:  {label:"Depus",      Icon:FileText,    color:"#58a6ff"},
  approved:   {label:"Finalizat",  Icon:CheckCircle, color:"#3fb950"},
  rejected:   {label:"Respins",    Icon:AlertCircle, color:"#f85149"},
};
const AVIZ_STATUSES=[
  {id:'in_progress',label:'În lucru',        color:'#58a6ff'},
  {id:'blocked',    label:'Blocat',          color:'#f85149'},
  {id:'ready',      label:'Se poate ridica', color:'#d29922'},
  {id:'approved',   label:'Obținut',         color:'#3fb950'},
  {id:'picked_up',  label:'Ridicat',         color:'#bc8cff'},
];
const CHANNELS = [
  {id:"general",label:"General",   Icon:MessageSquare},
  {id:"cu",     label:"CU",        Icon:FileText},
  {id:"avize",  label:"Avize",     Icon:Building2},
  {id:"pt",     label:"PT",        Icon:Layers},
  {id:"ac",     label:"Dosar AC",  Icon:CheckCircle},
];
const AVATAR_COLORS = [
  "#58a6ff","#3fb950","#d29922","#bc8cff","#f0883e",
  "#39d353","#ff7b72","#79c0ff","#ffa657","#56d364",
];
const INST = [
  {id:"electrica",name:"Electrica / E.ON / CEZ",  short:"Electrică", Icon:Zap,      color:"#d29922", validity:24, info:"Aviz tehnic de racordare electrică. Documente: cerere tip, plan de situație, memoriu tehnic."},
  {id:"gaz",      name:"Distrigaz / E.ON Gaz",    short:"Gaz",       Icon:Flame,    color:"#f0883e", validity:24, info:"Aviz tehnic de racordare gaz. Documente: cerere tip, plan de situație, memoriu instalații."},
  {id:"apa",      name:"Apă-Canal (RAJAC)",        short:"Apă-Canal", Icon:Droplets, color:"#58a6ff", validity:12, info:"Aviz branșament apă-canal. Documente: cerere, plan cadastral, acte proprietate."},
  {id:"telecom",  name:"Telecom",                  short:"Telecom",   Icon:Radio,    color:"#bc8cff", validity:24, info:"Aviz infrastructură telecom. Documente: cerere, plan de situație."},
  {id:"mediu",    name:"APM — Mediu",              short:"Mediu",     Icon:Leaf,     color:"#3fb950", validity:12, info:"Aviz de mediu APM. Documente: memoriu de prezentare, fișă sintetică, plan de situație."},
  {id:"drumuri",  name:"DRDP / Drumuri",           short:"Drumuri",   Icon:Map,      color:"#8b949e", validity:12, info:"Aviz administrator drum. Documente: cerere, plan de situație, studiu de trafic dacă e cazul."},
];

/* ─── DEMO MEMBERS ───────────────────────────────────────────────────────────── */
const MEMBERS = [
  {id:"m1", name:"Ion Popescu",    email:"ion@studiokolectiv.ro",   role:"owner"},
  {id:"m2", name:"Maria Ionescu",  email:"maria@studiokolectiv.ro", role:"member"},
  {id:"m3", name:"Alexandru Mureșan", email:"alex.muresan@gmail.com", role:"member"},
  {id:"m4", name:"Oana Silaghi",   email:"oana@studiokolectiv.ro",  role:"member"},
];

/* ─── DEMO MESSAGES (per channel) ───────────────────────────────────────────── */
const makeMsgs = (channel) => {
  const base = {
    general: [
      {id:"g1",uid:"m1",text:"Am încărcat documentația CU finalizată. Vă rog să verificați.",attachments:[{id:"a1",name:"Documentatie_CU_v2.pdf",url:"#"}],ts:new Date("2025-01-05T09:15:00")},
      {id:"g2",uid:"m2",text:"Am verificat, arată bine! @Ion Popescu poți să depui la primărie azi?",attachments:[],ts:new Date("2025-01-05T09:32:00")},
      {id:"g3",uid:"m1",text:"Da, mă duc după-amiaza. @Alexandru Mureșan ai trimis planșele actualizate?",attachments:[],ts:new Date("2025-01-05T09:45:00")},
      {id:"g4",uid:"m3",text:"Da, linkul la Drive: https://drive.google.com/folder/floresti",attachments:[{id:"a2",name:"Planșe_PT_v3 — Drive",url:"https://drive.google.com",external:true}],ts:new Date("2025-01-05T10:02:00")},
      {id:"g5",uid:"m4",text:"Am primit avizul de la APM! 🟢 Îl urc în secțiunea Avize.",attachments:[{id:"a3",name:"Aviz_APM_CJ204.pdf",url:"#"}],ts:new Date("2025-01-05T11:20:00")},
    ],
    avize: [
      {id:"av1",uid:"m2",text:"Status avize actualizat: Electrică ✓, Gaz ✓, Apă-Canal în așteptare.",attachments:[],ts:new Date("2025-01-04T14:10:00")},
      {id:"av2",uid:"m3",text:"@Maria Ionescu am sunat la RAJAC, cer documentație suplimentară geotehnică.",attachments:[],ts:new Date("2025-01-04T15:30:00")},
      {id:"av3",uid:"m1",text:"Ok, trimiteți studiul geotehnic cât mai repede. @Alexandru Mureșan poți coordona?",attachments:[],ts:new Date("2025-01-05T08:00:00")},
    ],
    cu:[
      {id:"cu1",uid:"m1",text:"CU nr. 142/2024 a fost emis! Data de azi.",attachments:[{id:"a4",name:"CU_142_2024.pdf",url:"#"}],ts:new Date("2024-10-20T13:00:00")},
    ],
    pt:[],ac:[],
  };
  return (base[channel]||[]).map(m=>({...m,displayName:MEMBERS.find(mb=>mb.id===m.uid)?.name||"?"}));
};

/* ─── HELPERS ────────────────────────────────────────────────────────────────── */
const uid   = () => Math.random().toString(36).slice(2,8);
const TODAY = new Date().toISOString().slice(0,10);
const diffD = (a,b)=>Math.round((new Date(b)-new Date(a))/86400000);
const fmt   = d=>d?new Date(d).toLocaleDateString("ro-RO",{day:"2-digit",month:"short",year:"numeric"}):"—";
const fmtS  = d=>d?new Date(d).toLocaleDateString("ro-RO",{day:"2-digit",month:"short"}):"—";
const fmtT  = d=>d instanceof Date?d.toLocaleTimeString("ro-RO",{hour:"2-digit",minute:"2-digit"}):"—";
const pctOf = phases=>phases.length?Math.round(phases.filter(p=>p.status==="approved").length/phases.length*100):0;

const avatarColor = (str="")=>AVATAR_COLORS[str.split("").reduce((a,c)=>a+c.charCodeAt(0),0)%AVATAR_COLORS.length];

/* ─── PHASE CHAIN + CASCADE ──────────────────────────────────────────────────── */
const PHASE_CHAIN=[
  {phaseId:'ph_cu_doc', dur:14},
  {phaseId:'ph_cu_dep', dur:3},
  {phaseId:'ph_cu_emit',dur:30},
  {phaseId:'ph_av_doc', dur:21},
  {phaseId:'ph_av_dep', dur:7},
  {phaseId:'ph_av_obt', dur:45},
  {phaseId:'ph_pt_doc', dur:30},
  {phaseId:'ph_pt_ver', dur:14},
  {phaseId:'ph_ac_dep', dur:5},
  {phaseId:'ph_ac_emit',dur:30},
];

const addDays=(dateStr,n)=>{
  const d=new Date(dateStr);
  d.setDate(d.getDate()+n);
  return d.toISOString().slice(0,10);
};

// Cascade startDate/endDate forward from fromPhId through the chain.
// avize-driven phases (ph_av_dep, ph_av_obt) are overridden by real avize dates when present.
const cascadeForward=(phases,fromPhId,fromEndDate,avize=[])=>{
  const chainIdx=PHASE_CHAIN.findIndex(p=>p.phaseId===fromPhId);
  if(chainIdx<0||chainIdx>=PHASE_CHAIN.length-1||!fromEndDate) return phases;

  const subs=avize.filter(av=>av.submissionDate).map(av=>av.submissionDate).sort();
  const emOrEst=avize.filter(av=>av.emissionDate||av.estimatedDate)
                     .map(av=>av.emissionDate||av.estimatedDate).sort();

  let prevEnd=fromEndDate;
  const result=[...phases];

  for(let i=chainIdx+1;i<PHASE_CHAIN.length;i++){
    const {phaseId,dur}=PHASE_CHAIN[i];
    const idx=result.findIndex(p=>p.phaseId===phaseId);
    if(idx<0) continue;

    if(phaseId==='ph_av_dep'&&subs.length>0){
      result[idx]={...result[idx],startDate:subs[0],endDate:subs[subs.length-1]};
      prevEnd=subs[subs.length-1];
      continue;
    }
    if(phaseId==='ph_av_obt'&&emOrEst.length>0){
      const allDone=avize.every(av=>av.emissionDate||av.status==='approved'||av.status==='picked_up'||av.status==='ready');
      result[idx]={...result[idx],startDate:emOrEst[0],endDate:emOrEst[emOrEst.length-1],...(allDone?{status:'approved'}:{})};
      prevEnd=emOrEst[emOrEst.length-1];
      continue;
    }

    const newEnd=addDays(prevEnd,dur);
    result[idx]={...result[idx],startDate:prevEnd,endDate:newEnd};
    prevEnd=newEnd;
  }
  return result;
};

/* ─── DEMO PROJECTS ──────────────────────────────────────────────────────────── */
const mkPhases=(start,statuses)=>{
  const tpl=[
    {id:"cu_doc",  name:"Elaborare documentație CU",   group:"CU",   dur:14},
    {id:"cu_dep",  name:"Depunere cerere CU",          group:"CU",   dur:3},
    {id:"cu_emit", name:"Emitere CU",                  group:"CU",   dur:30},
    {id:"av_doc",  name:"Elaborare documentații avize",group:"Avize",dur:21},
    {id:"av_dep",  name:"Depunere avize instituții",   group:"Avize",dur:7},
    {id:"av_obt",  name:"Obținere avize",              group:"Avize",dur:45},
    {id:"pt_doc",  name:"Elaborare PT",                group:"PT",   dur:30},
    {id:"pt_ver",  name:"Verificare proiect",          group:"PT",   dur:14},
    {id:"ac_dep",  name:"Depunere dosar AC",           group:"AC",   dur:5},
    {id:"ac_emit", name:"Emitere AC",                  group:"AC",   dur:30},
  ];
  let cur=new Date(start);
  return tpl.map((t,i)=>{
    const s=cur.toISOString().slice(0,10);
    cur=new Date(cur.getTime()+t.dur*86400000);
    return{...t,phaseId:`ph_${t.id}`,status:statuses[i]||"pending",startDate:s,endDate:cur.toISOString().slice(0,10),attachments:[],dependsOn:i>0?`ph_${tpl[i-1].id}`:null};
  });
};
const mkAvize=(start,sts={})=>INST.map(inst=>({
  instId:inst.id,avizId:`av_${inst.id}`,status:sts[inst.id]||"pending",
  dosarNr:sts[inst.id]==="approved"?`${inst.short.slice(0,3).toUpperCase()}-2024-${Math.floor(Math.random()*900+100)}`:"",
  contactName:"",note:"",attachments:[],
  steps:inst.Icon?[
    {stepId:uid(),name:`Solicitare aviz ${inst.short.toLowerCase()}`,status:["approved","in_progress","submitted"].includes(sts[inst.id])?"approved":"pending",date:start},
    {stepId:uid(),name:"Depunere documentație",status:sts[inst.id]==="approved"?"approved":"pending",date:new Date(new Date(start).getTime()+14*86400000).toISOString().slice(0,10)},
    {stepId:uid(),name:`Obținere aviz`,status:sts[inst.id]==="approved"?"approved":"pending",date:new Date(new Date(start).getTime()+28*86400000).toISOString().slice(0,10)},
  ]:[],
}));

const INIT_PROJECTS=[
  {id:"p1",name:"Locuință P+1E — Florești",client:"Familia Mureșan Alexandru",location:"Florești, jud. Cluj",startDate:"2024-09-01",
    phases:mkPhases("2024-09-01",["approved","approved","approved","approved","approved","in_progress","pending","pending","pending","pending"]),
    avize:mkAvize("2024-11-20",{electrica:"approved",gaz:"approved",apa:"in_progress",telecom:"submitted",mediu:"approved",drumuri:"pending"}),
    members:[...MEMBERS],acAttachments:[]},
  {id:"p2",name:"Sediu firmă S+P+2E — Cluj",client:"SC Tehno Construct SRL",location:"Cluj-Napoca, Calea Turzii",startDate:"2024-11-15",
    phases:mkPhases("2024-11-15",["approved","approved","in_progress","pending","pending","pending","pending","pending","pending","pending"]),
    avize:mkAvize("2025-01-26",{}),
    members:[MEMBERS[0],MEMBERS[1]],acAttachments:[]},
  {id:"p3",name:"Amenajare mansardă — Turda",client:"Familia Oana Silaghi",location:"Turda, str. Avram Iancu",startDate:"2025-01-10",
    phases:mkPhases("2025-01-10",["in_progress","pending","pending","pending","pending","pending","pending","pending","pending","pending"]),
    avize:mkAvize("2025-03-23",{}),
    members:[MEMBERS[0],MEMBERS[3]],acAttachments:[]},
];

/* ─── MICRO ATOMS ────────────────────────────────────────────────────────────── */
const Avatar=({name="?",email="",size=28,style={}})=>{
  const initials=name.trim().split(/\s+/).filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join("");
  const bg=avatarColor(email||name);
  return(
    <div style={{width:size,height:size,borderRadius:"50%",background:bg,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*.36,fontWeight:700,flexShrink:0,letterSpacing:"-.5px",userSelect:"none",border:`2px solid ${bg}55`,...style}}>
      {initials||"?"}
    </div>
  );
};

const Chip=({label,color,T})=>(
  <span style={{fontSize:10,fontWeight:600,color,background:`${color}18`,border:`1px solid ${color}30`,borderRadius:4,padding:"1px 7px",whiteSpace:"nowrap",letterSpacing:.2}}>{label}</span>
);

const MiniProg=({val,color,w=56,T})=>(
  <div style={{display:"flex",alignItems:"center",gap:6}}>
    <div style={{width:w,height:3,background:T.border,borderRadius:2,overflow:"hidden"}}>
      <div style={{height:"100%",width:`${val}%`,background:color,borderRadius:2,transition:"width .5s"}}/>
    </div>
    <span style={{fontSize:11,color:T.textMd,fontWeight:600,minWidth:26}}>{val}%</span>
  </div>
);

const StatusDot=({status})=>{
  const s=STATUS_META[status]||STATUS_META.pending;
  return <s.Icon size={11} color={s.color}/>;
};

/* ─── MESSAGE TEXT with @mention highlight ───────────────────────────────────── */
const MsgText=({text,T})=>{
  const parts=text.split(/(@[\w][\w\s]*?)(?=\s@|\s[^@]|$)/g);
  return(
    <span>
      {parts.map((p,i)=>p.startsWith("@")
        ?<span key={i} style={{color:T.accent,fontWeight:600,background:`${T.accent}18`,borderRadius:3,padding:"0 3px"}}>{p}</span>
        :<span key={i}>{p}</span>
      )}
    </span>
  );
};
/* ─── GANTT ──────────────────────────────────────────────────────────────────── */
const Gantt=({phases,T})=>{
  if(!phases||phases.length===0) return null;
  const total=Math.max(1,diffD(phases[0].startDate,phases[phases.length-1].endDate));
  const tp=Math.min(100,Math.max(0,diffD(phases[0].startDate,TODAY)/total*100));
  return(
    <div style={{overflowX:"auto"}}>
      <div style={{minWidth:560}}>
        <div style={{display:"flex",paddingLeft:192,paddingRight:76,marginBottom:6}}>
          <span style={{fontSize:10,color:T.textDim,flex:1}}>{fmt(phases[0].startDate)}</span>
          <span style={{fontSize:10,color:T.textDim}}>{fmt(phases[phases.length-1].endDate)}</span>
        </div>
        {phases.map(ph=>{
          const l=diffD(phases[0].startDate,ph.startDate)/total*100;
          const w=Math.max(.5,diffD(ph.startDate,ph.endDate)/total*100);
          const c=GC[ph.group]||T.accent;
          const done=ph.status==="approved";
          return(
            <div key={ph.phaseId} style={{display:"flex",alignItems:"center",marginBottom:6}}>
              <div style={{width:192,flexShrink:0,paddingRight:10}}>
                <div style={{fontSize:11,color:T.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{ph.name}</div>
                <div style={{display:'flex',gap:4,alignItems:'center',marginTop:1}}>
                  <Chip label={ph.group} color={c} T={T}/>
                  {ph.dependsOn&&phases.find(p=>p.phaseId===ph.dependsOn)&&(
                    <span style={{fontSize:9,color:T.textDim}}>↳{phases.find(p=>p.phaseId===ph.dependsOn).name.slice(0,14)}</span>
                  )}
                </div>
              </div>
              <div style={{flex:1,height:26,background:T.border,borderRadius:4,position:"relative",overflow:"visible"}}>
                {/* Phase bar */}
                <div style={{
                  position:"absolute",left:`${l}%`,width:`${w}%`,height:"100%",
                  background:done?c:`${c}55`,border:`1px solid ${done?c:c+'88'}`,
                  borderRadius:4,overflow:"hidden",minWidth:2,
                  display:"flex",alignItems:"center",
                }}>
                  {w>=14&&(
                    <div style={{display:"flex",width:"100%",alignItems:"center",
                      justifyContent:w>=26?"space-between":"flex-end",padding:"0 5px",gap:3}}>
                      {w>=26&&<span style={{fontSize:8,color:done?"#ffffffcc":c,fontWeight:600,whiteSpace:"nowrap",lineHeight:1}}>{fmtS(ph.startDate)}</span>}
                      <span style={{fontSize:8,color:done?"#ffffffcc":c,fontWeight:600,whiteSpace:"nowrap",lineHeight:1}}>{fmtS(ph.endDate)}</span>
                    </div>
                  )}
                </div>
                {/* Today line */}
                <div style={{position:"absolute",left:`${tp}%`,top:-3,bottom:-3,width:1.5,background:T.red,zIndex:3,borderRadius:1}}/>
              </div>
              {/* Dates column */}
              <div style={{width:72,paddingLeft:8,flexShrink:0}}>
                {done?(
                  <div style={{display:"flex",alignItems:"center",gap:4,justifyContent:"flex-end"}}>
                    <CheckCircle size={11} color={T.green}/>
                    <span style={{fontSize:10,color:T.green,fontWeight:600}}>Gata</span>
                  </div>
                ):(
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:9,color:T.textDim}}>{fmtS(ph.startDate)}</div>
                    <div style={{fontSize:10,fontWeight:600,color:diffD(TODAY,ph.endDate)<0?T.red:diffD(TODAY,ph.endDate)<=7?T.amber:T.text}}>{fmtS(ph.endDate)}</div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div style={{paddingLeft:192,paddingRight:76,marginTop:4,display:'flex',alignItems:'center',gap:6}}>
          <div style={{height:1.5,background:T.red,width:16}}/>
          <span style={{fontSize:9,color:T.textDim}}>Azi — {fmt(TODAY)}</span>
        </div>
      </div>
    </div>
  );
};

/* ─── MULTI PROGRESS ─────────────────────────────────────────────────────────── */
const MultiProg=({phases,T})=>{
  const groups=["CU","Avize","PT","AC"];
  const pct=pctOf(phases);
  return(
    <div style={{display:"flex",alignItems:"center",gap:14}}>
      {groups.map(g=>{
        const gp=phases.filter(p=>p.group===g),gd=gp.filter(p=>p.status==="approved").length;
        return(
          <div key={g} style={{flex:1}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
              <span style={{fontSize:9,fontWeight:700,color:GC[g],letterSpacing:.8,textTransform:"uppercase"}}>{g}</span>
              <span style={{fontSize:9,color:T.textDim}}>{gd}/{gp.length}</span>
            </div>
            <div style={{height:4,background:T.border,borderRadius:2,overflow:"hidden"}}>
              <div style={{height:"100%",width:`${gp.length?gd/gp.length*100:0}%`,background:GC[g],borderRadius:2,transition:"width .6s"}}/>
            </div>
          </div>
        );
      })}
      <div style={{minWidth:42,textAlign:"right"}}>
        <span style={{fontSize:22,fontWeight:800,color:T.text,lineHeight:1}}>{pct}</span>
        <span style={{fontSize:11,color:T.textDim}}>%</span>
      </div>
    </div>
  );
};

/* ─── SHARED PROJECT VIEW ────────────────────────────────────────────────────── */
const SharedView = ({ token }) => {
  const [data, setData] = useState(null)
  const [err,  setErr]  = useState(null)
  const T = DARK

  useEffect(() => {
    // b64_ prefix = base64 fallback
    if(token.startsWith('b64_')) {
      try {
        const b64 = token.slice(4)
        const decoded = JSON.parse(decodeURIComponent(escape(atob(b64))))
        setData({ project: { name: decoded.n, client: decoded.c, location: decoded.l, startDate: decoded.s, phases: decoded.ph||[], avize: decoded.av||[], type: decoded.t||'arhitectura', clientNote: decoded.note||'' }, config: decoded.cfg || {faze:true,avize:true} })
      } catch(e) { setErr(true) }
    } else if(token.length > 80) {
      // Long token without prefix = legacy base64
      try {
        const decoded = JSON.parse(decodeURIComponent(escape(atob(token))))
        setData({ project: { name: decoded.n, client: decoded.c, location: decoded.l, startDate: decoded.s, phases: decoded.ph||[], avize: decoded.av||[], type: decoded.t||'arhitectura', clientNote: decoded.note||'' }, config: decoded.cfg || {faze:true,avize:true} })
      } catch(e) { setErr(true) }
    } else {
      // Short token = Firestore stored share — retry up to 3 times
      const tryLoad=(attempt=0)=>{
        getSharedProject(token)
          .then(r=>{ if(r) setData(r); else if(attempt<2) setTimeout(()=>tryLoad(attempt+1),1500); else setErr('Link invalid sau expirat.'); })
          .catch(e=>{ if(attempt<2) setTimeout(()=>tryLoad(attempt+1),1500); else setErr(`Eroare: ${e.code||e.message||'necunoscut'}`); });
      };
      tryLoad();
    }
  }, [token])

  if (err) return (
    <div style={{minHeight:'100vh',background:T.bg,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:12}}>
      <div style={{color:T.red,fontSize:14,fontWeight:600}}>{err}</div>
      <div style={{fontSize:11,color:T.textDim}}>Dacă ai primit acest link, roagă expeditorul să genereze unul nou.</div>
    </div>
  )
  if (!data) return (
    <div style={{minHeight:'100vh',background:T.bg,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{color:T.textDim,fontSize:13}}>Se încarcă…</div>
    </div>
  )
  const { project: p, config } = data
  const phases = p.phases || []
  const avize  = p.avize  || []
  const pct = phases.length ? Math.round(phases.filter(ph=>ph.status==='approved').length/phases.length*100) : 0
  const avizDone = avize.filter(av=>av.status==='approved').length
  const typeColor = PROJECT_TYPES.find(t=>t.id===p.type)?.color || '#58a6ff'

  return (
    <div style={{minHeight:'100vh',background:T.bg,color:T.text,fontFamily:"'Geist','Helvetica Neue',sans-serif",padding:'0 0 40px'}}>
      <style>{`*{box-sizing:border-box;}body{margin:0;}`}</style>
      <header style={{background:T.sidebar,borderBottom:`1px solid ${T.border}`,padding:'14px 28px',display:'flex',alignItems:'center',gap:12}}>
        <div style={{width:26,height:26,borderRadius:7,background:`linear-gradient(135deg,#58a6ff,#bc8cff)`,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
        </div>
        <span style={{fontSize:14,fontWeight:700,color:T.text}}>ArchPlan</span>
        <span style={{fontSize:11,color:T.textDim,marginLeft:4}}>— Vizualizare proiect</span>
      </header>
      <div style={{maxWidth:960,margin:'32px auto',padding:'0 20px'}}>
        {/* Header card */}
        <div style={{background:T.panel,border:`1px solid ${T.border}`,borderRadius:12,padding:24,marginBottom:16,borderTop:`3px solid ${typeColor}`}}>
          <div style={{display:'flex',alignItems:'flex-start',gap:16,flexWrap:'wrap'}}>
            <div style={{flex:1}}>
              <h1 style={{fontSize:22,fontWeight:800,color:T.text,margin:'0 0 6px'}}>{p.name}</h1>
              <div style={{fontSize:12,color:T.textDim,display:'flex',gap:16,flexWrap:'wrap'}}>
                {p.client&&<span>Client: <strong style={{color:T.text}}>{p.client}</strong></span>}
                {p.location&&<span>Locație: <strong style={{color:T.text}}>{p.location}</strong></span>}
              </div>
            </div>
            <div style={{textAlign:'right',flexShrink:0}}>
              <div style={{fontSize:36,fontWeight:800,color:typeColor,lineHeight:1}}>{pct}%</div>
              <div style={{fontSize:11,color:T.textDim}}>progres general</div>
            </div>
          </div>
          {/* Progress bar */}
          <div style={{height:6,background:T.border,borderRadius:3,overflow:'hidden',marginTop:16}}>
            <div style={{height:'100%',width:`${pct}%`,background:typeColor,borderRadius:3,transition:'width .6s'}}/>
          </div>
          {/* Summary chips */}
          <div style={{display:'flex',gap:10,marginTop:14,flexWrap:'wrap'}}>
            <div style={{background:`${typeColor}14`,border:`1px solid ${typeColor}33`,borderRadius:7,padding:'6px 12px',fontSize:11}}>
              <span style={{color:T.textDim}}>Faze finalizate: </span>
              <strong style={{color:typeColor}}>{phases.filter(ph=>ph.status==='approved').length}/{phases.length}</strong>
            </div>
            <div style={{background:'#3fb95014',border:'1px solid #3fb95033',borderRadius:7,padding:'6px 12px',fontSize:11}}>
              <span style={{color:T.textDim}}>Avize obținute: </span>
              <strong style={{color:'#3fb950'}}>{avizDone}/{avize.length}</strong>
            </div>
            {avize.filter(av=>av.emissionDate&&av.expiryDate).length>0&&(
              <div style={{background:'#d2992214',border:'1px solid #d2992233',borderRadius:7,padding:'6px 12px',fontSize:11}}>
                <span style={{color:T.textDim}}>Avize cu valabilitate: </span>
                <strong style={{color:'#d29922'}}>{avize.filter(av=>av.emissionDate&&av.expiryDate).length}</strong>
              </div>
            )}
          </div>
        </div>

        {config.faze && phases.length>0 && (
          <div style={{background:T.panel,border:`1px solid ${T.border}`,borderRadius:10,padding:20,marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:700,color:T.textMd,textTransform:'uppercase',letterSpacing:.8,marginBottom:14}}>Faze proiect</div>
            {phases.map(ph => {
              const c = {CU:'#d29922',Avize:'#58a6ff',PT:'#bc8cff',AC:'#3fb950'}[ph.group]||'#58a6ff'
              const sm = {pending:{l:'WIP',c:'#484f58'},in_progress:{l:'În lucru',c:'#d29922'},submitted:{l:'Depus',c:'#58a6ff'},approved:{l:'Finalizat',c:'#3fb950'},rejected:{l:'Respins',c:'#f85149'}}
              const s = sm[ph.status]||sm.pending
              return (
                <div key={ph.phaseId} style={{display:'flex',alignItems:'center',gap:10,padding:'9px 0',borderBottom:`1px solid ${T.border}`}}>
                  <div style={{width:8,height:8,borderRadius:'50%',background:s.c,flexShrink:0}}/>
                  <div style={{flex:1,fontSize:13,color:T.text}}>{ph.name}</div>
                  <div style={{fontSize:10,color:T.textDim}}>{ph.startDate} → {ph.endDate}</div>
                  <div style={{fontSize:11,fontWeight:600,color:s.c,background:`${s.c}14`,border:`1px solid ${s.c}33`,borderRadius:4,padding:'2px 8px'}}>{s.l}</div>
                </div>
              )
            })}
          </div>
        )}

        {p.clientNote&&(
          <div style={{background:`${typeColor}0a`,border:`1px solid ${typeColor}33`,borderRadius:10,padding:18,marginBottom:16}}>
            <div style={{fontSize:10,fontWeight:700,color:typeColor,textTransform:'uppercase',letterSpacing:.8,marginBottom:8}}>Notă pentru client</div>
            <div style={{fontSize:13,color:T.text,lineHeight:1.7,whiteSpace:'pre-wrap'}}>{p.clientNote}</div>
          </div>
        )}

        {config.avize && avize.length>0 && (
          <div style={{background:T.panel,border:`1px solid ${T.border}`,borderRadius:10,padding:20,marginBottom:16}}>
            <div style={{fontSize:12,fontWeight:700,color:T.textMd,textTransform:'uppercase',letterSpacing:.8,marginBottom:14}}>Avize</div>
            {avize.map(av => {
              const inst = INST.find(i=>i.id===av.instId)
              const sm = {pending:{l:'WIP',c:'#484f58'},in_progress:{l:'În lucru',c:'#d29922'},submitted:{l:'Depus',c:'#58a6ff'},approved:{l:'Obținut ✓',c:'#3fb950'},rejected:{l:'Respins',c:'#f85149'}}
              const s = sm[av.status]||sm.pending
              const daysLeft = av.expiryDate ? Math.round((new Date(av.expiryDate)-new Date())/86400000) : null
              return (
                <div key={av.avizId} style={{padding:'12px 0',borderBottom:`1px solid ${T.border}`}}>
                  <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                    {inst&&<inst.Icon size={14} color={inst.color}/>}
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,color:T.text,fontWeight:500}}>{inst?.name||av.instId}</div>
                      {av.dosarNr&&<div style={{fontSize:10,color:T.textDim,marginTop:1}}>Nr. dosar: <strong>{av.dosarNr}</strong></div>}
                    </div>
                    <div style={{fontSize:11,fontWeight:600,color:s.c,background:`${s.c}14`,border:`1px solid ${s.c}33`,borderRadius:4,padding:'2px 8px',flexShrink:0}}>{s.l}</div>
                  </div>
                  <div style={{display:'flex',gap:16,flexWrap:'wrap',paddingLeft:22}}>
                    {av.submissionDate&&<div style={{fontSize:10}}><span style={{color:T.textDim}}>Depus: </span><strong style={{color:T.text}}>{av.submissionDate}</strong></div>}
                    {av.estimatedDate&&<div style={{fontSize:10}}><span style={{color:T.textDim}}>Estimat emitere: </span><strong style={{color:T.text}}>{av.estimatedDate}</strong></div>}
                    {av.emissionDate&&<div style={{fontSize:10}}><span style={{color:T.textDim}}>Emis: </span><strong style={{color:'#3fb950'}}>{av.emissionDate}</strong></div>}
                    {av.expiryDate&&<div style={{fontSize:10}}>
                      <span style={{color:T.textDim}}>Expiră: </span>
                      <strong style={{color:daysLeft!==null&&daysLeft<=30?'#f85149':T.text}}>{av.expiryDate}</strong>
                      {daysLeft!==null&&daysLeft<=30&&daysLeft>=0&&<span style={{color:'#f85149',fontWeight:700}}> ⚠ {daysLeft}z rămase</span>}
                      {daysLeft!==null&&daysLeft<0&&<span style={{color:'#f85149',fontWeight:700}}> EXPIRAT</span>}
                      {daysLeft!==null&&daysLeft>30&&<span style={{color:'#3fb950'}}> ({daysLeft}z)</span>}
                    </div>}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── CHAT COMPONENT ─────────────────────────────────────────────────────────── */
const Chat=({project,T,currentUser,showToast,approvedUsers=[]})=>{
  const [channel,   setChannel]   = useState("general");
  const [messages,  setMessages]  = useState([]);
  const [text,      setText]      = useState("");
  const [mentionQ,  setMentionQ]  = useState(null);
  const [mentionPos,setMentionPos]= useState(0);
  const [pendingAtt,setPendingAtt]= useState([]);
  const [showLink,  setShowLink]  = useState(false);
  const [extUrl,    setExtUrl]    = useState("");
  const [extName,   setExtName]   = useState("");
  const [showMems,  setShowMems]  = useState(false);
  const [newMemName,setNewMemName]= useState("");
  const [newMemEmail,setNewMemEmail]=useState("");
  const [showNewMem,setShowNewMem]= useState(false);
  const [members,   setMembers]   = useState(project.members||[]);
  const { user } = useAuth();
  const bottomRef = useRef();
  const inputRef  = useRef();

  useEffect(()=>{
    setMembers(project.members||[]);
  },[project.members]);

  useEffect(()=>{
    if (!user) return;
    const unsub = listenMessages(user.uid, project.id, channel, (msgs)=>{
      setMessages(msgs.map(m=>({...m, ts: m.createdAt?.toDate?.() ?? m.ts})));
    });
    return unsub;
  },[user, project.id, channel]);

  useEffect(()=>{
    bottomRef.current?.scrollIntoView({behavior:"smooth"});
  },[messages]);

  const handleTextChange=(e)=>{
    const val=e.target.value;setText(val);
    const cursor=e.target.selectionStart;
    const before=val.slice(0,cursor);
    const m=before.match(/@([\w][\w\s]*)$/);
    if(m){setMentionQ(m[1]);setMentionPos(before.lastIndexOf("@"));}
    else setMentionQ(null);
  };

  const selectMention=(member)=>{
    const before=text.slice(0,mentionPos);
    const after=text.slice(inputRef.current?.selectionStart||text.length);
    setText(`${before}@${member.name} ${after}`);
    setMentionQ(null);inputRef.current?.focus();
  };

  const handleSend=()=>{
    if(!text.trim()&&!pendingAtt.length) return;
    if(!user) return;
    dbSendMsg(user.uid, project.id, channel, {
      uid: currentUser.id,
      displayName: currentUser.name,
      text: text.trim(),
      attachments: [...pendingAtt],
    });
    const mentioned=[...new Set((text.match(/@([\w][\w\s]*)/g)||[]).map(m=>m.slice(1).trim()))];
    mentioned.forEach(name=>{
      const m=members.find(mb=>mb.name.toLowerCase()===name.toLowerCase());
      if(m&&m.email!==currentUser.email){
        sendMentionEmail({toEmail:m.email,toName:m.name,mentionedBy:currentUser.name,projectName:project.name,channel,messageText:text.trim(),projectId:project.id});
        showToast(`📧 Email trimis la ${m.email} — @menționare`,T.green);
      }
    });
    setText("");setPendingAtt([]);
  };

  const deleteMsg=(msgId)=>{
    if(!user) return;
    dbDeleteMsg(user.uid, project.id, channel, msgId);
  };

  const addExtLink=()=>{
    if(!extUrl.trim()) return;
    setPendingAtt(a=>[...a,{id:uid(),name:extName||extUrl,url:extUrl,external:true}]);
    setExtUrl("");setExtName("");setShowLink(false);
  };

  const addMember=()=>{
    if(!newMemName.trim()||!newMemEmail.trim()||!user) return;
    const newMem={id:uid(),name:newMemName.trim(),email:newMemEmail.trim(),role:"member"};
    const updatedMems=[...members,newMem];
    setMembers(updatedMems);
    updateProject(user.uid, project.id, {members:updatedMems});
    setNewMemName("");setNewMemEmail("");setShowNewMem(false);
    showToast(`👤 ${newMemName} adăugat în proiect`,T.green);
  };

  const filteredMembers=mentionQ!==null?members.filter(m=>m.name.toLowerCase().includes(mentionQ.toLowerCase())).slice(0,5):[];
  const ChanIcon=CHANNELS.find(c=>c.id===channel)?.Icon||Hash;
  const chanLabel=CHANNELS.find(c=>c.id===channel)?.label||channel;

  const inp={background:T.bg,border:`1px solid ${T.borderLt}`,borderRadius:7,padding:"7px 10px",color:T.text,fontSize:12,outline:"none",fontFamily:"inherit"};

  return(
    <div style={{display:"flex",height:"calc(100vh - 260px)",minHeight:480,border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden",background:T.panel}}>

      {/* Channel sidebar */}
      <div style={{width:176,background:T.sidebar,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"12px 12px 8px",borderBottom:`1px solid ${T.border}`}}>
          <div style={{fontSize:9,fontWeight:700,color:T.textDim,textTransform:"uppercase",letterSpacing:.9}}>Canale</div>
        </div>
        <div style={{flex:1,padding:"6px"}}>
          {CHANNELS.map(ch=>{
            const unread=0;
            return(
              <button key={ch.id} onClick={()=>setChannel(ch.id)}
                style={{width:"100%",display:"flex",alignItems:"center",gap:7,padding:"7px 10px",borderRadius:7,
                  background:channel===ch.id?`${T.accent}14`:"transparent",
                  color:channel===ch.id?T.text:T.textMd,
                  border:`1px solid ${channel===ch.id?T.accent+"33":"transparent"}`,
                  cursor:"pointer",fontFamily:"inherit",fontSize:12,fontWeight:channel===ch.id?600:400,
                  textAlign:"left",transition:"all .12s",justifyContent:"space-between"}}
                onMouseEnter={e=>{if(channel!==ch.id)e.currentTarget.style.background=T.panelHov}}
                onMouseLeave={e=>{if(channel!==ch.id)e.currentTarget.style.background="transparent"}}>
                <span style={{display:"flex",alignItems:"center",gap:7}}><ch.Icon size={12}/>{ch.label}</span>
                {unread>0&&<span style={{width:6,height:6,borderRadius:"50%",background:T.accent,flexShrink:0}}/>}
              </button>
            );
          })}
        </div>
        {/* Members toggle */}
        <div style={{padding:"6px",borderTop:`1px solid ${T.border}`}}>
          <button onClick={()=>setShowMems(s=>!s)}
            style={{width:"100%",display:"flex",alignItems:"center",gap:7,padding:"7px 10px",borderRadius:7,
              background:showMems?T.accentBg:"transparent",color:showMems?T.accentLt:T.textMd,
              border:`1px solid ${showMems?T.accent+"33":"transparent"}`,
              cursor:"pointer",fontFamily:"inherit",fontSize:12,justifyContent:"space-between"}}>
            <span style={{display:"flex",alignItems:"center",gap:6}}><Users size={12}/>Membrii</span>
            <span style={{fontSize:10,color:T.textDim,background:T.border,borderRadius:8,padding:"1px 5px"}}>{members.length}</span>
          </button>
        </div>
      </div>

      {/* Main area */}
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>
        {showMems?(
          /* Members panel */
          <div style={{flex:1,overflowY:"auto"}}>
            {/* header */}
            <div style={{padding:"11px 16px",borderBottom:`1px solid ${T.border}`,background:T.sidebar,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
              <div style={{display:"flex",alignItems:"center",gap:7}}>
                <Users size={13} color={T.textMd}/>
                <span style={{fontSize:13,fontWeight:700,color:T.text}}>Membrii proiectului</span>
                <span style={{fontSize:10,color:T.textDim,background:T.border,borderRadius:10,padding:"1px 6px"}}>{members.length}</span>
              </div>
              <button onClick={()=>setShowNewMem(s=>!s)}
                style={{display:"flex",alignItems:"center",gap:4,background:T.accentBg,border:`1px solid ${T.accent}44`,color:T.accentLt,borderRadius:6,padding:"5px 11px",cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"inherit"}}>
                <UserPlus size={11}/>Adaugă
              </button>
            </div>
            {showNewMem&&(
              <div style={{padding:"12px 16px",borderBottom:`1px solid ${T.border}`,background:T.bg}}>
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  <input value={newMemName} onChange={e=>setNewMemName(e.target.value)} placeholder="Nume complet" style={{flex:1,minWidth:120,...inp,boxSizing:"border-box"}}/>
                  <input type="email" value={newMemEmail} onChange={e=>setNewMemEmail(e.target.value)} placeholder="Email" style={{flex:2,minWidth:160,...inp,boxSizing:"border-box"}} onKeyDown={e=>e.key==="Enter"&&addMember()}/>
                  <button onClick={addMember} style={{background:T.accent,border:"none",borderRadius:7,padding:"7px 14px",color:"#fff",fontWeight:600,cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>Adaugă</button>
                  <button onClick={()=>setShowNewMem(false)} style={{background:"transparent",border:`1px solid ${T.border}`,borderRadius:7,padding:"7px 9px",color:T.textDim,cursor:"pointer",display:"flex"}}><X size={13}/></button>
                </div>
                <div style={{fontSize:10,color:T.textDim,marginTop:5}}>Membrul va primi email când este @menționat în chat.</div>
              </div>
            )}
            <div style={{padding:"8px"}}>
              {members.map(m=>(
                <div key={m.id} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",borderRadius:8,transition:"background .1s"}}
                  onMouseEnter={e=>e.currentTarget.style.background=T.panelHov}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <Avatar name={m.name} email={m.email} size={36}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:12,fontWeight:600,color:T.text}}>{m.name}</div>
                    <div style={{fontSize:10,color:T.textDim}}>{m.email}</div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    {m.role==="owner"&&<Chip label="Owner" color={T.amber} T={T}/>}
                    <div style={{display:"flex",gap:-4}}>
                      {/* Avatar color preview */}
                      <div style={{width:10,height:10,borderRadius:"50%",background:avatarColor(m.email)}}/>
                    </div>
                  </div>
                </div>
              ))}
              {approvedUsers.filter(u=>!members.some(m=>m.email===u.email)).length>0&&(
                <div style={{marginTop:8,paddingTop:8,borderTop:`1px solid ${T.border}`}}>
                  <div style={{fontSize:9,fontWeight:700,color:T.textDim,textTransform:'uppercase',letterSpacing:.8,padding:'0 12px 6px'}}>Utilizatori platformă (neadăugați)</div>
                  {approvedUsers.filter(u=>!members.some(m=>m.email===u.email)).map(u=>(
                    <div key={u.id} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',borderRadius:8}}
                      onMouseEnter={e=>e.currentTarget.style.background=T.panelHov}
                      onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                      <Avatar name={u.name||u.email} email={u.email} size={32}/>
                      <div style={{flex:1}}>
                        <div style={{fontSize:12,fontWeight:600,color:T.text}}>{u.name||u.email.split('@')[0]}</div>
                        <div style={{fontSize:10,color:T.textDim}}>{u.email}</div>
                      </div>
                      <button onClick={()=>{
                        const newMem={id:u.id||uid(),name:u.name||u.email.split('@')[0],email:u.email,role:'member'}
                        const updatedMems=[...members,newMem]
                        setMembers(updatedMems)
                        updateProject(user.uid,project.id,{members:updatedMems})
                        showToast(`${newMem.name} adăugat în proiect`,T.green)
                      }} style={{background:T.accentBg,border:`1px solid ${T.accent}44`,borderRadius:6,padding:'4px 10px',color:T.accent,fontSize:10,cursor:'pointer',fontFamily:'inherit',fontWeight:600,flexShrink:0}}>
                        + Adaugă
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ):(
          <>
            {/* Channel header */}
            <div style={{padding:"10px 16px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:8,background:T.sidebar,flexShrink:0}}>
              <ChanIcon size={13} color={T.textMd}/>
              <span style={{fontSize:13,fontWeight:700,color:T.text}}>{chanLabel}</span>
              <span style={{fontSize:11,color:T.textDim,marginLeft:2}}>— {project.name}</span>
              {/* Member avatars in header */}
              <div style={{marginLeft:"auto",display:"flex",alignItems:"center"}}>
                {members.slice(0,4).map((m,i)=>(
                  <Avatar key={m.id} name={m.name} email={m.email} size={22}
                    style={{marginLeft:i===0?0:-6,border:`2px solid ${T.sidebar}`,zIndex:4-i}}/>
                ))}
                {members.length>4&&<span style={{fontSize:10,color:T.textDim,marginLeft:4}}>+{members.length-4}</span>}
              </div>
            </div>

            {/* Messages */}
            <div style={{flex:1,overflowY:"auto",padding:"12px 16px"}}>
              {messages.length===0&&(
                <div style={{textAlign:"center",padding:"40px 0",color:T.textDim}}>
                  <MessageSquare size={26} color={T.borderLt} style={{display:"block",margin:"0 auto 10px"}}/>
                  <div style={{fontSize:13,marginBottom:3}}>Niciun mesaj în #{chanLabel}</div>
                  <div style={{fontSize:11}}>Fii primul care scrie ceva</div>
                </div>
              )}
              {messages.map((msg,i)=>{
                const member=members.find(m=>m.id===msg.uid);
                const name=member?.name||msg.displayName||"?";
                const email=member?.email||"";
                const isMine=msg.uid===currentUser.id;
                const [showDel,setShowDel]=useState(false);
                return(
                  <div key={msg.id} style={{display:"flex",gap:10,padding:"5px 0",position:"relative",alignItems:"flex-start"}}
                    onMouseEnter={()=>setShowDel(true)} onMouseLeave={()=>setShowDel(false)}>
                    <Avatar name={name} email={email} size={30}/>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:3}}>
                        <span style={{fontSize:12,fontWeight:700,color:T.text}}>{name}</span>
                        <span style={{fontSize:10,color:T.textDim}}>{fmtT(msg.ts)}</span>
                        {isMine&&<Chip label="tu" color={T.textDim} T={T}/>}
                      </div>
                      {msg.text&&(
                        <div style={{fontSize:13,color:T.textMd,lineHeight:1.55,wordBreak:"break-word"}}>
                          <MsgText text={msg.text} T={T}/>
                        </div>
                      )}
                      {(msg.attachments||[]).map(att=>(
                        <div key={att.id} style={{display:"inline-flex",alignItems:"center",gap:6,marginTop:5,background:T.panelHov,border:`1px solid ${T.border}`,borderRadius:7,padding:"5px 10px",maxWidth:300}}>
                          {att.external?<Link2 size={12} color={T.textMd}/>:<FileText size={12} color={T.textMd}/>}
                          <a href={att.url} target="_blank" rel="noreferrer" style={{fontSize:11,color:T.blue,textDecoration:"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",flex:1}}>{att.name}</a>
                          {att.external&&<Chip label="link" color={T.amber} T={T}/>}
                          <ExternalLink size={10} color={T.textDim}/>
                        </div>
                      ))}
                    </div>
                    {isMine&&showDel&&(
                      <button onClick={()=>deleteMsg(msg.id)}
                        style={{position:"absolute",right:0,top:4,background:T.redBg,border:`1px solid ${T.red}44`,borderRadius:5,padding:"3px 7px",cursor:"pointer",display:"flex",alignItems:"center",gap:3,color:T.red,fontSize:10,fontFamily:"inherit"}}>
                        <Trash2 size={10}/>Șterge
                      </button>
                    )}
                  </div>
                );
              })}
              <div ref={bottomRef}/>
            </div>

            {/* Pending attachments */}
            {pendingAtt.length>0&&(
              <div style={{padding:"6px 16px",borderTop:`1px solid ${T.border}`,display:"flex",gap:6,flexWrap:"wrap",background:T.panelHov}}>
                {pendingAtt.map(att=>(
                  <div key={att.id} style={{display:"inline-flex",alignItems:"center",gap:5,background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:"4px 8px",fontSize:11,color:T.textMd}}>
                    {att.external?<Link2 size={11}/>:<FileText size={11}/>}
                    <span style={{maxWidth:120,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{att.name}</span>
                    <button onClick={()=>setPendingAtt(a=>a.filter(x=>x.id!==att.id))} style={{background:"transparent",border:"none",color:T.textDim,cursor:"pointer",padding:0,display:"flex"}}><X size={11}/></button>
                  </div>
                ))}
              </div>
            )}

            {/* Link form */}
            {showLink&&(
              <div style={{padding:"8px 16px",borderTop:`1px solid ${T.border}`,background:T.bg,display:"flex",gap:6,flexWrap:"wrap",alignItems:"flex-end"}}>
                <div style={{flex:2,minWidth:180}}>
                  <div style={{fontSize:9,color:T.textDim,marginBottom:3,textTransform:"uppercase",letterSpacing:.6}}>URL (Drive / Dropbox)</div>
                  <input value={extUrl} onChange={e=>setExtUrl(e.target.value)} placeholder="https://drive.google.com/…" style={{...inp,width:"100%",boxSizing:"border-box"}}/>
                </div>
                <div style={{flex:1,minWidth:110}}>
                  <div style={{fontSize:9,color:T.textDim,marginBottom:3,textTransform:"uppercase",letterSpacing:.6}}>Denumire</div>
                  <input value={extName} onChange={e=>setExtName(e.target.value)} placeholder="Document…" style={{...inp,width:"100%",boxSizing:"border-box"}}/>
                </div>
                <button onClick={addExtLink} style={{background:T.accent,border:"none",borderRadius:7,padding:"7px 14px",color:"#fff",fontWeight:600,cursor:"pointer",fontSize:12,fontFamily:"inherit",flexShrink:0}}>Adaugă</button>
                <button onClick={()=>setShowLink(false)} style={{background:"transparent",border:`1px solid ${T.border}`,borderRadius:7,padding:"7px 9px",color:T.textDim,cursor:"pointer",display:"flex",flexShrink:0}}><X size={13}/></button>
              </div>
            )}

            {/* Input */}
            <div style={{padding:"10px 16px",borderTop:`1px solid ${T.border}`,flexShrink:0,position:"relative"}}>
              {/* @mention dropdown */}
              {mentionQ!==null&&filteredMembers.length>0&&(
                <div style={{position:"absolute",bottom:"100%",left:16,right:16,background:T.panel,border:`1px solid ${T.borderLt}`,borderRadius:9,padding:4,marginBottom:4,boxShadow:T.shadowLg,zIndex:50}}>
                  <div style={{fontSize:9,fontWeight:700,color:T.textDim,textTransform:"uppercase",letterSpacing:.8,padding:"4px 8px 6px"}}>Menționează</div>
                  {filteredMembers.map(m=>(
                    <div key={m.id} onClick={()=>selectMention(m)}
                      style={{display:"flex",alignItems:"center",gap:8,padding:"7px 10px",borderRadius:7,cursor:"pointer"}}
                      onMouseEnter={e=>e.currentTarget.style.background=T.panelHov}
                      onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                      <Avatar name={m.name} email={m.email} size={24}/>
                      <div>
                        <div style={{fontSize:12,fontWeight:600,color:T.text}}>{m.name}</div>
                        <div style={{fontSize:10,color:T.textDim}}>{m.email}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{display:"flex",alignItems:"flex-end",gap:8,background:T.bg,border:`1px solid ${T.borderLt}`,borderRadius:9,padding:"8px 10px"}}>
                {/* Action buttons */}
                <div style={{display:"flex",gap:2,alignSelf:"flex-end",paddingBottom:1}}>
                  <button onClick={()=>{ setPendingAtt(a=>[...a,{id:uid(),name:`Fisier_demo_${uid()}.pdf`,url:"#"}]); showToast("📎 Fișier atașat (demo)",T.textMd); }}
                    title="Upload fișier" style={{background:"transparent",border:"none",color:T.textMd,cursor:"pointer",padding:"3px",borderRadius:5,display:"flex"}}>
                    <Paperclip size={15}/>
                  </button>
                  <button onClick={()=>setShowLink(s=>!s)} title="Link Drive/Dropbox"
                    style={{background:"transparent",border:"none",color:showLink?T.accent:T.textMd,cursor:"pointer",padding:"3px",borderRadius:5,display:"flex"}}>
                    <Link2 size={15}/>
                  </button>
                  <button onClick={()=>{setText(t=>t+"@");setTimeout(()=>inputRef.current?.focus(),0);}} title="Menționează"
                    style={{background:"transparent",border:"none",color:T.textMd,cursor:"pointer",padding:"3px",borderRadius:5,display:"flex"}}>
                    <AtSign size={15}/>
                  </button>
                </div>
                <textarea ref={inputRef} value={text} onChange={handleTextChange}
                  onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey&&mentionQ===null){e.preventDefault();handleSend();}}}
                  placeholder={`Scrie în #${chanLabel}… Enter trimite · @ menționează`}
                  rows={1} style={{flex:1,background:"transparent",border:"none",color:T.text,fontSize:13,outline:"none",resize:"none",fontFamily:"inherit",lineHeight:1.5,maxHeight:100,overflowY:"auto"}}
                  onInput={e=>{e.target.style.height="auto";e.target.style.height=e.target.scrollHeight+"px";}}/>
                <button onClick={handleSend} disabled={!text.trim()&&!pendingAtt.length}
                  style={{background:(text.trim()||pendingAtt.length)?T.accent:T.border,border:"none",borderRadius:7,padding:"6px 10px",color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",flexShrink:0,transition:"background .15s"}}>
                  <Send size={14}/>
                </button>
              </div>
              <div style={{fontSize:10,color:T.textDim,marginTop:4,paddingLeft:2}}>Enter = trimite · Shift+Enter = linie nouă · @ = menționează · notificare email automată</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/* ─── PHASES VIEW ────────────────────────────────────────────────────────────── */
const PhasesView=({project,onUpdate,T})=>{
  const [openPh,setOpenPh]=useState(null);
  const [addingLink,setAddingLink]=useState(null);
  const [linkUrl,setLinkUrl]=useState('');
  const [linkName,setLinkName]=useState('');
  const inp={width:'100%',background:T.bg,border:`1px solid ${T.borderLt}`,borderRadius:6,padding:'4px 8px',color:T.text,fontSize:11,outline:'none',fontFamily:'inherit',boxSizing:'border-box'};
  const cols="12px 1fr 76px 76px 130px 62px 44px";
  return(
    <div style={{border:`1px solid ${T.border}`,borderRadius:10,overflow:"hidden"}}>
      <div style={{display:"grid",gridTemplateColumns:cols,gap:8,padding:"8px 16px",background:T.sidebar,borderBottom:`1px solid ${T.border}`}}>
        {["","Fază","Start","Termen","Status","Avans","Zile"].map(h=><div key={h} style={{fontSize:10,fontWeight:600,color:T.textDim,textTransform:"uppercase",letterSpacing:.7}}>{h}</div>)}
      </div>
      {project.phases.map((ph,i)=>{
        const dl=diffD(TODAY,ph.endDate),ov=dl<0&&ph.status!=="approved";
        const c=GC[ph.group]||T.accent;
        const pv={approved:100,submitted:75,in_progress:40,pending:0}[ph.status]||0;
        const isOpen=openPh===ph.phaseId;
        const depPhase=ph.dependsOn?project.phases.find(p=>p.phaseId===ph.dependsOn):null;
        return(
          <div key={ph.phaseId}>
            <div onClick={()=>setOpenPh(isOpen?null:ph.phaseId)}
              style={{display:"grid",gridTemplateColumns:cols,gap:8,alignItems:"center",padding:"9px 16px",borderBottom:`1px solid ${T.border}`,cursor:"pointer",background:ov?`${T.red}06`:"transparent",transition:"background .12s"}}
              onMouseEnter={e=>e.currentTarget.style.background=ov?`${T.red}0c`:T.panelHov}
              onMouseLeave={e=>e.currentTarget.style.background=ov?`${T.red}06`:"transparent"}>
              <div style={{width:8,height:8,borderRadius:"50%",background:STATUS_META[ph.status]?.color||T.textDim,flexShrink:0}}/>
              <div>
                <div style={{fontSize:12,color:T.text,fontWeight:500}}>{ph.name}</div>
                {ph.note&&<div style={{fontSize:10,color:T.textDim,marginTop:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ph.note}</div>}
                {depPhase&&<div style={{display:"flex",alignItems:"center",gap:3,marginTop:1}}>
                  <ChevronRight size={9} color={T.textDim}/><span style={{fontSize:9,color:T.textDim,fontStyle:'italic'}}>dep: {depPhase.name}</span>
                </div>}
                {ov&&<div style={{display:"flex",alignItems:"center",gap:3,marginTop:2}}><AlertTriangle size={10} color={T.red}/><span style={{fontSize:10,color:T.red}}>{-dl}z întârziat</span></div>}
              </div>
              <span style={{fontSize:11,color:T.textDim}}>{fmtS(ph.startDate)}</span>
              <span style={{fontSize:11,color:ov?T.red:dl<7?T.amber:T.textDim}}>{fmtS(ph.endDate)}</span>
              <div style={{display:"flex",alignItems:"center",gap:5}} onClick={e=>e.stopPropagation()}>
                <StatusDot status={ph.status}/>
                <select value={ph.status} onChange={e=>onUpdate(ph.phaseId,{status:e.target.value})}
                  style={{background:"transparent",border:"none",color:STATUS_META[ph.status]?.color||T.text,fontSize:11,fontWeight:500,cursor:"pointer",outline:"none",fontFamily:"inherit"}}>
                  {Object.entries(STATUS_META).map(([k,v])=><option key={k} value={k} style={{background:T.panel,color:v.color}}>{v.label}</option>)}
                </select>
              </div>
              <MiniProg val={pv} color={c} T={T}/>
              <div style={{fontSize:11,fontWeight:600,textAlign:"right",color:ph.status==="approved"?T.green:ov?T.red:dl<7?T.amber:T.textDim}}>
                {ph.status==="approved"?<CheckCircle size={12} color={T.green}/>:`${dl}z`}
              </div>
            </div>
            {isOpen&&(
              <div style={{padding:"12px 36px 14px",borderBottom:`1px solid ${T.border}`,background:T.panelHov}}>
                {/* Edit phase fields */}
                <div style={{marginBottom:12,paddingBottom:12,borderBottom:`1px solid ${T.border}`}}>
                  <div style={{fontSize:10,fontWeight:600,color:T.textDim,textTransform:"uppercase",letterSpacing:.7,marginBottom:8}}>Editează faza</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
                    <div style={{gridColumn:'1/-1'}}>
                      <div style={{fontSize:9,color:T.textDim,marginBottom:2,textTransform:'uppercase',letterSpacing:.5}}>Nume fază</div>
                      <input value={ph.name} onChange={e=>onUpdate(ph.phaseId,{name:e.target.value})} style={inp}/>
                    </div>
                    <div>
                      <div style={{fontSize:9,color:T.textDim,marginBottom:2,textTransform:'uppercase',letterSpacing:.5}}>Dată start</div>
                      <input type="date" value={ph.startDate||''} onChange={e=>onUpdate(ph.phaseId,{startDate:e.target.value})} style={inp}/>
                    </div>
                    <div>
                      <div style={{fontSize:9,color:T.textDim,marginBottom:2,textTransform:'uppercase',letterSpacing:.5}}>Termen</div>
                      <input type="date" value={ph.endDate||''} onChange={e=>onUpdate(ph.phaseId,{endDate:e.target.value})} style={inp}/>
                    </div>
                    <div>
                      <div style={{fontSize:9,color:T.textDim,marginBottom:2,textTransform:'uppercase',letterSpacing:.5}}>Depinde de</div>
                      <select value={ph.dependsOn||''} onChange={e=>onUpdate(ph.phaseId,{dependsOn:e.target.value})}
                        style={{...inp,cursor:'pointer'}}>
                        <option value="">Fără dependință</option>
                        {project.phases.filter(p=>p.phaseId!==ph.phaseId).map(p=>(
                          <option key={p.phaseId} value={p.phaseId}>{p.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <div style={{fontSize:9,color:T.textDim,marginBottom:2,textTransform:'uppercase',letterSpacing:.5}}>Nr. înregistrare / Notă</div>
                      <input value={ph.note||''} onChange={e=>onUpdate(ph.phaseId,{note:e.target.value})}
                        placeholder="ex: CU nr. 142/2024..." style={inp}/>
                    </div>
                  </div>
                </div>
                {/* Document links */}
                <div style={{fontSize:10,fontWeight:600,color:T.textDim,textTransform:"uppercase",letterSpacing:.7,marginBottom:7,display:"flex",alignItems:"center",gap:5}}><Link2 size={11}/>Documente (linkuri cloud)</div>
                {(ph.attachments||[]).map(att=>(
                  <div key={att.id} style={{display:"flex",alignItems:"center",gap:8,padding:"5px 10px",background:T.bg,borderRadius:6,border:`1px solid ${T.border}`,marginBottom:4}}>
                    <FileText size={12} color={T.textMd}/>
                    <a href={att.url} target="_blank" rel="noreferrer" style={{flex:1,fontSize:11,color:T.blue,textDecoration:"none",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{att.name||att.url}</a>
                    <button onClick={()=>onUpdate(ph.phaseId,{attachments:(ph.attachments||[]).filter(a=>a.id!==att.id)})}
                      style={{background:"transparent",border:"none",color:T.textDim,cursor:"pointer",padding:2,display:"flex",alignItems:"center",flexShrink:0}}>
                      <X size={12}/>
                    </button>
                  </div>
                ))}
                {addingLink===ph.phaseId?(
                  <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:6}}>
                    <input value={linkName} onChange={e=>setLinkName(e.target.value)} placeholder="Nume document (ex: Plan parter v2)"
                      style={{background:T.bg,border:`1px solid ${T.borderLt}`,borderRadius:6,padding:"5px 9px",color:T.text,fontSize:11,outline:"none",fontFamily:"inherit"}}/>
                    <input value={linkUrl} onChange={e=>setLinkUrl(e.target.value)} placeholder="Link Google Drive / Dropbox / OneDrive…"
                      style={{background:T.bg,border:`1px solid ${T.borderLt}`,borderRadius:6,padding:"5px 9px",color:T.text,fontSize:11,outline:"none",fontFamily:"inherit"}}/>
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>{
                        if(!linkUrl.trim()) return
                        onUpdate(ph.phaseId,{attachments:[...(ph.attachments||[]),{id:uid(),name:linkName.trim()||linkUrl,url:linkUrl.trim(),addedAt:TODAY}]})
                        setLinkUrl('');setLinkName('');setAddingLink(null)
                      }} style={{background:T.accent,border:"none",borderRadius:6,padding:"5px 12px",color:"#fff",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>Salvează</button>
                      <button onClick={()=>{setAddingLink(null);setLinkUrl('');setLinkName('');}}
                        style={{background:"transparent",border:`1px solid ${T.border}`,borderRadius:6,padding:"5px 10px",color:T.textMd,fontSize:11,cursor:"pointer",fontFamily:"inherit"}}>Anulează</button>
                    </div>
                  </div>
                ):(
                  <button onClick={()=>setAddingLink(ph.phaseId)}
                    style={{display:"inline-flex",alignItems:"center",gap:5,background:T.accentBg,border:`1px solid ${T.accent}44`,color:T.accentLt,borderRadius:7,padding:"5px 11px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginTop:4}}>
                    <Plus size={11}/>Adaugă link document
                  </button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ─── AVIZE VIEW ─────────────────────────────────────────────────────────────── */
const AvizeView=({project,onUpdate,T,autoOpenAviz})=>{
  const [open,setOpen]=useState(null);
  const [statusMenu,setStatusMenu]=useState(null);
  useEffect(()=>{if(autoOpenAviz) setOpen(autoOpenAviz);},[autoOpenAviz]);
  useEffect(()=>{
    if(!statusMenu) return;
    const close=()=>setStatusMenu(null);
    document.addEventListener('click',close);
    return()=>document.removeEventListener('click',close);
  },[statusMenu]);
  const avizStatusInfo=(s)=>AVIZ_STATUSES.find(x=>x.id===s)||{label:'De obținut',color:'#484f58'};
  return(
    <div style={{display:"flex",flexDirection:"column",gap:6}}>
      {project.avize.map(av=>{
        const inst=INST.find(i=>i.id===av.instId);if(!inst)return null;
        const ds=av.steps.filter(s=>s.status==="approved").length;
        const pv=Math.round(ds/av.steps.length*100);
        const isOpen=open===av.avizId;
        const isApproved=av.status==='approved'||av.status==='picked_up';
        return(
          <div key={av.avizId} style={{border:`1px solid ${isApproved?T.green+'44':isOpen?inst.color+'44':T.border}`,borderRadius:10,background:T.panel,transition:"border-color .2s"}}>
            <div onClick={()=>setOpen(isOpen?null:av.avizId)}
              style={{display:"grid",gridTemplateColumns:"36px 1fr 120px 90px 150px 28px",gap:8,alignItems:"center",padding:"11px 16px",cursor:"pointer"}}
              onMouseEnter={e=>e.currentTarget.style.background=T.panelHov}
              onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
              <div style={{width:32,height:32,borderRadius:8,background:`${isApproved?T.green:inst.color}18`,border:`1px solid ${isApproved?T.green:inst.color}30`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                {isApproved?<CheckCircle size={16} color={T.green}/>:<inst.Icon size={16} color={inst.color}/>}
              </div>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:T.text}}>{inst.name}</div>
                <div style={{display:"flex",gap:6,marginTop:3,flexWrap:"wrap",alignItems:"center"}}>
                  {av.dosarNr&&<Chip label={`Nr. ${av.dosarNr}`} color={T.blue} T={T}/>}
                  {(av.attachments||[]).length>0&&<Chip label={`${av.attachments.length} fișier${av.attachments.length>1?"e":""}`} color={T.green} T={T}/>}
                  {av.emissionDate&&<Chip label={`Emis ${av.emissionDate}`} color={T.green} T={T}/>}
                </div>
              </div>
              <MiniProg val={pv} color={isApproved?T.green:inst.color} w={70} T={T}/>
              <span style={{fontSize:11,color:T.textDim}}>{ds}/{av.steps.length} pași</span>
              {/* Multi-state status dropdown */}
              <div onClick={e=>e.stopPropagation()} style={{position:'relative',display:'flex',alignItems:'center'}}>
                <button onClick={()=>setStatusMenu(statusMenu===av.avizId?null:av.avizId)} style={{
                  display:'flex',alignItems:'center',gap:5,
                  background:`${avizStatusInfo(av.status).color}18`,
                  border:`1px solid ${avizStatusInfo(av.status).color}44`,
                  borderRadius:6,padding:'5px 10px',
                  color:avizStatusInfo(av.status).color,
                  cursor:'pointer',fontSize:11,fontWeight:700,fontFamily:'inherit',whiteSpace:'nowrap',
                }}>
                  <div style={{width:7,height:7,borderRadius:'50%',background:avizStatusInfo(av.status).color,flexShrink:0}}/>
                  {avizStatusInfo(av.status).label}
                  <ChevronDown size={10}/>
                </button>
                {statusMenu===av.avizId&&(
                  <div onClick={e=>e.stopPropagation()} style={{
                    position:'absolute',top:'calc(100% + 4px)',right:0,zIndex:9999,
                    background:T.panel,border:`1px solid ${T.borderLt}`,borderRadius:8,
                    boxShadow:T.shadowLg,minWidth:170,overflow:'hidden',
                  }}>
                    {AVIZ_STATUSES.map(s=>{
                      const isCur=av.status===s.id;
                      return(
                        <div key={s.id} onClick={()=>{
                          const upd={status:s.id};
                          if(s.id==='ready'||s.id==='approved'||s.id==='picked_up'){if(!av.emissionDate) upd.emissionDate=TODAY;}
                          else{upd.emissionDate=null;}
                          onUpdate(av.avizId,upd);
                          setStatusMenu(null);
                        }} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 12px',cursor:'pointer',fontSize:12,
                          background:isCur?`${s.color}15`:'transparent',color:isCur?s.color:T.text,transition:'background .1s'}}
                          onMouseEnter={e=>e.currentTarget.style.background=`${s.color}20`}
                          onMouseLeave={e=>e.currentTarget.style.background=isCur?`${s.color}15`:'transparent'}>
                          <div style={{width:8,height:8,borderRadius:'50%',background:s.color,flexShrink:0}}/>
                          <span style={{flex:1}}>{s.label}</span>
                          {isCur&&<CheckCircle size={11} color={s.color}/>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
              {isOpen?<ChevronDown size={14} color={T.textDim}/>:<ChevronRight size={14} color={T.textDim}/>}
            </div>
            {isOpen&&(
              <div style={{borderTop:`1px solid ${T.border}`,padding:"12px 16px 14px"}}>
                {/* Date tracking */}
                <div style={{borderBottom:`1px solid ${T.border}`,marginBottom:12,paddingBottom:12}}>
                  <div style={{fontSize:10,fontWeight:700,color:T.textDim,textTransform:'uppercase',letterSpacing:.7,marginBottom:8}}>Depunere & emitere</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    <div>
                      <div style={{fontSize:9,color:T.textDim,marginBottom:3,textTransform:'uppercase',letterSpacing:.5}}>Data depunere documentație</div>
                      <input type="date" value={av.submissionDate||''} onChange={e=>{
                        const sd=e.target.value
                        const updates={submissionDate:sd}
                        if(sd&&!av.estimatedDate){const d=new Date(sd);d.setDate(d.getDate()+30);updates.estimatedDate=d.toISOString().slice(0,10)}
                        onUpdate(av.avizId,updates)
                      }} style={{width:'100%',background:T.bg,border:`1px solid ${T.borderLt}`,borderRadius:6,padding:'5px 8px',color:T.text,fontSize:11,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
                    </div>
                    <div>
                      <div style={{fontSize:9,color:T.textDim,marginBottom:3,textTransform:'uppercase',letterSpacing:.5}}>Estimare emitere (≈30 zile)</div>
                      <input type="date" value={av.estimatedDate||''} onChange={e=>onUpdate(av.avizId,{estimatedDate:e.target.value})}
                        style={{width:'100%',background:T.bg,border:`1px solid ${T.borderLt}`,borderRadius:6,padding:'5px 8px',color:T.text,fontSize:11,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
                      {av.submissionDate&&!av.estimatedDate&&(
                        <button onClick={()=>{const d=new Date(av.submissionDate);d.setDate(d.getDate()+30);onUpdate(av.avizId,{estimatedDate:d.toISOString().slice(0,10)})}}
                          style={{marginTop:4,fontSize:9,background:T.accentBg,border:`1px solid ${T.accent}33`,color:T.accentLt,borderRadius:4,padding:'2px 6px',cursor:'pointer',fontFamily:'inherit'}}>+ 30 zile auto</button>
                      )}
                    </div>
                  </div>
                </div>
                <div style={{borderBottom:`1px solid ${T.border}`,marginBottom:12,paddingBottom:12}}>
                  <div style={{fontSize:10,fontWeight:700,color:T.textDim,textTransform:'uppercase',letterSpacing:.7,marginBottom:8}}>Valabilitate aviz</div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                    <div>
                      <div style={{fontSize:9,color:T.textDim,marginBottom:3,textTransform:'uppercase',letterSpacing:.5}}>Data emitere aviz</div>
                      <input type="date" value={av.emissionDate||''} onChange={e=>onUpdate(av.avizId,{emissionDate:e.target.value})}
                        style={{width:'100%',background:T.bg,border:`1px solid ${T.borderLt}`,borderRadius:6,padding:'5px 8px',color:T.text,fontSize:11,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
                    </div>
                    <div>
                      <div style={{display:'flex',alignItems:'center',gap:4,marginBottom:3}}>
                        <span style={{fontSize:9,color:T.textDim,textTransform:'uppercase',letterSpacing:.5}}>Data expirare</span>
                        {av.expiryDate&&(()=>{const dl=Math.round((new Date(av.expiryDate)-new Date())/86400000);return dl<=30&&dl>=0?<span style={{fontSize:9,fontWeight:700,color:T.red}}>⚠ {dl}z</span>:dl<0?<span style={{fontSize:9,fontWeight:700,color:T.red}}>EXPIRAT</span>:null})()}
                      </div>
                      <input type="date" value={av.expiryDate||''} onChange={e=>{
                          if(av.emissionDate&&e.target.value&&e.target.value<av.emissionDate) return;
                          onUpdate(av.avizId,{expiryDate:e.target.value});
                        }}
                        min={av.emissionDate||undefined}
                        style={{width:'100%',background:T.bg,border:`1px solid ${(()=>{const dl=av.expiryDate?Math.round((new Date(av.expiryDate)-new Date())/86400000):null;return dl!==null&&dl<=30?T.red:T.borderLt})()}`,borderRadius:6,padding:'5px 8px',color:T.text,fontSize:11,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
                      {av.emissionDate&&(
                        <div style={{display:'flex',gap:4,marginTop:4}}>
                          {[12,24].map(m=>(
                            <button key={m} onClick={()=>{const b=new Date(av.emissionDate);b.setMonth(b.getMonth()+m);onUpdate(av.avizId,{expiryDate:b.toISOString().slice(0,10)})}}
                              style={{flex:1,background:T.accentBg,border:`1px solid ${T.accent}33`,borderRadius:5,padding:'3px 0',color:T.accentLt,fontSize:10,cursor:'pointer',fontFamily:'inherit',fontWeight:600}}>
                              +{m} luni
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {/* Steps */}
                {av.steps.map((step,si)=>{
                  const dl=step.date?diffD(TODAY,step.date):null;
                  return(
                    <div key={step.stepId} style={{display:"grid",gridTemplateColumns:"20px 1fr 110px 46px",gap:8,alignItems:"center",padding:"7px 0",borderBottom:si<av.steps.length-1?`1px solid ${T.border}`:"none"}}>
                      <div onClick={()=>{
                        const ns=av.steps.map(s=>s.stepId===step.stepId?{...s,status:s.status==="approved"?"pending":"approved"}:s);
                        onUpdate(av.avizId,{steps:ns,status:ns.every(s=>s.status==="approved")?"approved":av.status});
                      }} style={{width:16,height:16,borderRadius:4,border:`1.5px solid ${step.status==="approved"?inst.color:T.borderLt}`,background:step.status==="approved"?inst.color:"transparent",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s",flexShrink:0}}>
                        {step.status==="approved"&&<CheckCircle size={10} color="#fff"/>}
                      </div>
                      <span style={{fontSize:12,color:step.status==="approved"?T.textDim:T.text,textDecoration:step.status==="approved"?"line-through":"none"}}>{step.name}</span>
                      <span style={{fontSize:10,color:T.textDim}}>{fmt(step.date)}</span>
                      <span style={{fontSize:10,fontWeight:600,textAlign:"right",color:step.status==="approved"?T.green:dl===null?T.textDim:dl<0?T.red:dl<5?T.amber:T.textDim}}>
                        {step.status==="approved"?<CheckCircle size={11} color={T.green}/>:dl===null?"—":`${dl}z`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ─── TABS ───────────────────────────────────────────────────────────────────── */
const TABS=[
  {id:"faze",     label:"Faze",     I:Layers},
  {id:"avize",    label:"Avize",    I:Building2},
  {id:"gantt",    label:"Timeline", I:BarChart2},
  {id:"chat",     label:"Chat",     I:MessageSquare},
  {id:"contract", label:"Contract", I:FileText,    locked:true},
];
const PROTECTED_NAV=['financiar'];
const ADMIN_PIN_KEY='archplan_admin_pin';
const getStoredPin=()=>localStorage.getItem(ADMIN_PIN_KEY)||'1234';

/* ─── PIN MODAL ──────────────────────────────────────────────────────────────── */
const PinModal=({T,onSuccess,onCancel,hint})=>{
  const [val,setVal]=useState('');
  const [err,setErr]=useState(false);
  const check=()=>{
    if(val===getStoredPin()){setErr(false);onSuccess();}
    else{setErr(true);setVal('');}
  };
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300}} onClick={onCancel}>
      <div style={{background:T.panel,border:`1px solid ${T.borderLt}`,borderRadius:14,padding:28,width:300,boxShadow:T.shadowLg}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
          <Lock size={15} color={T.amber}/><span style={{fontSize:15,fontWeight:700,color:T.text}}>Zonă restricționată</span>
        </div>
        <div style={{fontSize:12,color:T.textDim,marginBottom:18}}>{hint||'Introduceți PIN-ul pentru a accesa.'}</div>
        <input autoFocus type="password" maxLength={8} value={val}
          onChange={e=>{setVal(e.target.value);setErr(false);}}
          onKeyDown={e=>e.key==='Enter'&&check()}
          placeholder="PIN"
          style={{width:'100%',boxSizing:'border-box',background:T.bg,border:`1.5px solid ${err?T.red:T.borderLt}`,borderRadius:8,padding:'10px 14px',color:T.text,fontSize:20,letterSpacing:8,outline:'none',fontFamily:'inherit',textAlign:'center',marginBottom:err?4:14}}/>
        {err&&<div style={{fontSize:11,color:T.red,textAlign:'center',marginBottom:10}}>PIN incorect</div>}
        <div style={{display:'flex',gap:8}}>
          <button onClick={onCancel} style={{flex:1,background:'transparent',border:`1px solid ${T.border}`,borderRadius:7,padding:'8px',color:T.textMd,cursor:'pointer',fontFamily:'inherit',fontSize:12}}>Anulează</button>
          <button onClick={check} style={{flex:1,background:T.accent,border:'none',borderRadius:7,padding:'8px',color:'#fff',fontWeight:600,cursor:'pointer',fontFamily:'inherit',fontSize:12}}>Accesează</button>
        </div>
      </div>
    </div>
  );
};

/* ─── CHANGE PIN MODAL ───────────────────────────────────────────────────────── */
const ChangePinModal=({T,onClose,onChanged})=>{
  const [cur,setCur]=useState('');
  const [next,setNext]=useState('');
  const [confirm,setConfirm]=useState('');
  const [err,setErr]=useState(null);
  const [step,setStep]=useState(1); // 1=verify current, 2=set new

  const pinInp=(value,onChange,placeholder,autoFocus=false)=>(
    <input autoFocus={autoFocus} type="password" maxLength={8} value={value}
      onChange={e=>{onChange(e.target.value);setErr(null);}}
      placeholder={placeholder}
      style={{width:'100%',boxSizing:'border-box',background:T.bg,border:`1.5px solid ${err?T.red:T.borderLt}`,
        borderRadius:8,padding:'10px 14px',color:T.text,fontSize:18,letterSpacing:6,outline:'none',
        fontFamily:'inherit',textAlign:'center'}}/>
  );

  const verifyCurrent=()=>{
    if(cur===getStoredPin()) setStep(2);
    else{setErr('PIN curent incorect');setCur('');}
  };
  const saveNew=()=>{
    if(next.length<4){setErr('PIN-ul trebuie să aibă minim 4 caractere');return;}
    if(next!==confirm){setErr('PIN-urile noi nu coincid');setConfirm('');return;}
    localStorage.setItem(ADMIN_PIN_KEY,next);
    onChanged();
    onClose();
  };

  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:300}} onClick={onClose}>
      <div style={{background:T.panel,border:`1px solid ${T.borderLt}`,borderRadius:14,padding:28,width:320,boxShadow:T.shadowLg}} onClick={e=>e.stopPropagation()}>
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
          <Lock size={15} color={T.accent}/><span style={{fontSize:15,fontWeight:700,color:T.text}}>Schimbare PIN</span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:20}}>
          {[1,2].map(s=>(
            <div key={s} style={{display:'flex',alignItems:'center',gap:6}}>
              <div style={{width:20,height:20,borderRadius:'50%',background:step>=s?T.accent:T.border,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:step>=s?'#fff':T.textDim}}>{s}</div>
              <span style={{fontSize:11,color:step===s?T.text:T.textDim}}>{s===1?'Verificare PIN curent':'PIN nou'}</span>
              {s===1&&<div style={{width:20,height:1,background:T.border}}/>}
            </div>
          ))}
        </div>

        {step===1&&(
          <>
            <div style={{fontSize:12,color:T.textDim,marginBottom:12}}>Introduceți PIN-ul curent pentru a continua.</div>
            {pinInp(cur,setCur,'PIN curent',true)}
            {err&&<div style={{fontSize:11,color:T.red,textAlign:'center',marginTop:6}}>{err}</div>}
            <div style={{display:'flex',gap:8,marginTop:16}}>
              <button onClick={onClose} style={{flex:1,background:'transparent',border:`1px solid ${T.border}`,borderRadius:7,padding:'8px',color:T.textMd,cursor:'pointer',fontFamily:'inherit',fontSize:12}}>Anulează</button>
              <button onClick={verifyCurrent} style={{flex:1,background:T.accent,border:'none',borderRadius:7,padding:'8px',color:'#fff',fontWeight:600,cursor:'pointer',fontFamily:'inherit',fontSize:12}}>Continuă</button>
            </div>
          </>
        )}

        {step===2&&(
          <>
            <div style={{fontSize:12,color:T.textDim,marginBottom:12}}>Introduceți noul PIN (minim 4 caractere).</div>
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {pinInp(next,setNext,'PIN nou',true)}
              {pinInp(confirm,setConfirm,'Confirmă PIN nou')}
            </div>
            {err&&<div style={{fontSize:11,color:T.red,textAlign:'center',marginTop:6}}>{err}</div>}
            <div style={{display:'flex',gap:8,marginTop:16}}>
              <button onClick={()=>{setStep(1);setNext('');setConfirm('');setErr(null);}} style={{flex:1,background:'transparent',border:`1px solid ${T.border}`,borderRadius:7,padding:'8px',color:T.textMd,cursor:'pointer',fontFamily:'inherit',fontSize:12}}>Înapoi</button>
              <button onClick={saveNew} style={{flex:1,background:T.green,border:'none',borderRadius:7,padding:'8px',color:'#fff',fontWeight:600,cursor:'pointer',fontFamily:'inherit',fontSize:12}}>Salvează PIN</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

/* ─── CONTRACT VIEW ─────────────────────────────────────────────────────────── */
const ContractView = ({project, onUpdate, T}) => {
  const c = project.contract || {}
  const facturi = project.facturi || []
  const [showAddF, setShowAddF] = useState(false)
  const [newF, setNewF] = useState({nr:'',data:'',suma:'',status:'emisa'})
  const inp = {background:T.bg,border:`1px solid ${T.borderLt}`,borderRadius:7,padding:'7px 10px',color:T.text,fontSize:12,outline:'none',fontFamily:'inherit',width:'100%',boxSizing:'border-box'}
  const upd = (field, val) => onUpdate({contract:{...c,[field]:val}})
  const addFactura = () => {
    if(!newF.nr||!newF.suma) return
    onUpdate({facturi:[...facturi,{...newF,id:Math.random().toString(36).slice(2)}]})
    setNewF({nr:'',data:'',suma:'',status:'emisa'})
    setShowAddF(false)
  }
  const delFactura = (id) => onUpdate({facturi:facturi.filter(f=>f.id!==id)})
  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
      {/* Contract info */}
      <div style={{background:T.panel,border:`1px solid ${T.border}`,borderRadius:10,padding:20}}>
        <div style={{fontSize:11,fontWeight:700,color:T.textMd,textTransform:'uppercase',letterSpacing:.8,marginBottom:16}}>Date contract</div>
        {[['Nr. contract','nr'],['Data contract','dataContract'],['Valoare totală (RON)','valoare'],['Termen plată','termenPlata'],['Observații','obs']].map(([label,field])=>(
          <div key={field} style={{marginBottom:12}}>
            <div style={{fontSize:10,color:T.textDim,marginBottom:4,textTransform:'uppercase',letterSpacing:.5}}>{label}</div>
            {field==='obs'
              ? <textarea value={c[field]||''} onChange={e=>upd(field,e.target.value)} rows={3} style={{...inp,resize:'vertical'}}/>
              : <input value={c[field]||''} onChange={e=>upd(field,e.target.value)} style={inp}/>
            }
          </div>
        ))}
      </div>
      {/* Invoices */}
      <div style={{background:T.panel,border:`1px solid ${T.border}`,borderRadius:10,padding:20}}>
        <div style={{display:'flex',alignItems:'center',marginBottom:16}}>
          <div style={{fontSize:11,fontWeight:700,color:T.textMd,textTransform:'uppercase',letterSpacing:.8,flex:1}}>Facturi</div>
          <button onClick={()=>setShowAddF(s=>!s)} style={{background:T.accentBg,border:`1px solid ${T.accent}44`,borderRadius:6,padding:'4px 10px',color:T.accent,fontSize:11,cursor:'pointer',fontFamily:'inherit',display:'flex',alignItems:'center',gap:5}}>
            <Plus size={11}/>Adaugă
          </button>
        </div>
        {showAddF&&(
          <div style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:8,padding:12,marginBottom:12}}>
            {[['Nr. factură','nr'],['Data','data'],['Sumă (RON)','suma']].map(([label,field])=>(
              <div key={field} style={{marginBottom:8}}>
                <div style={{fontSize:9,color:T.textDim,marginBottom:3,textTransform:'uppercase',letterSpacing:.5}}>{label}</div>
                <input value={newF[field]} onChange={e=>setNewF(f=>({...f,[field]:e.target.value}))} style={inp}/>
              </div>
            ))}
            <div style={{marginBottom:8}}>
              <div style={{fontSize:9,color:T.textDim,marginBottom:3,textTransform:'uppercase',letterSpacing:.5}}>Status</div>
              <select value={newF.status} onChange={e=>setNewF(f=>({...f,status:e.target.value}))} style={inp}>
                <option value="emisa">Emisă</option>
                <option value="incasata">Încasată</option>
                <option value="restanta">Restantă</option>
              </select>
            </div>
            <div style={{display:'flex',gap:6}}>
              <button onClick={addFactura} style={{flex:1,background:T.accent,border:'none',borderRadius:6,padding:'6px',color:'#fff',fontSize:11,cursor:'pointer',fontFamily:'inherit',fontWeight:600}}>Salvează</button>
              <button onClick={()=>setShowAddF(false)} style={{background:'transparent',border:`1px solid ${T.border}`,borderRadius:6,padding:'6px 10px',color:T.textMd,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>Anulează</button>
            </div>
          </div>
        )}
        {facturi.length===0&&!showAddF&&<div style={{fontSize:12,color:T.textDim,textAlign:'center',padding:'20px 0'}}>Nicio factură adăugată</div>}
        {facturi.map(f=>(
          <div key={f.id} style={{display:'flex',alignItems:'center',gap:8,padding:'8px 0',borderBottom:`1px solid ${T.border}`}}>
            <div style={{flex:1}}>
              <div style={{fontSize:12,fontWeight:600,color:T.text}}>Factura #{f.nr}</div>
              <div style={{fontSize:10,color:T.textDim}}>{f.data} · {f.suma} RON</div>
            </div>
            <div style={{fontSize:10,fontWeight:600,color:f.status==='incasata'?T.green:f.status==='restanta'?T.red:T.amber,background:f.status==='incasata'?T.greenBg:f.status==='restanta'?T.redBg:T.amberBg,borderRadius:4,padding:'2px 7px'}}>
              {f.status==='incasata'?'Încasată':f.status==='restanta'?'Restantă':'Emisă'}
            </div>
            <button onClick={()=>delFactura(f.id)} style={{background:'transparent',border:'none',color:T.textDim,cursor:'pointer',padding:2,display:'flex',alignItems:'center'}}>
              <Trash2 size={12}/>
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ─── CALENDAR ──────────────────────────────────────────────────────────────── */
const CalendarWidget = ({projects, T, month, onPrev, onNext, notes=[], onAddNote, onDeleteNote}) => {
  const year  = month.getFullYear()
  const mon   = month.getMonth()
  const first = new Date(year, mon, 1).getDay()
  const days  = new Date(year, mon+1, 0).getDate()
  const start = first === 0 ? 6 : first - 1

  const events = {}
  const addEv = (dateStr, label, color, projName, type='event') => {
    if(!dateStr) return
    const d = dateStr.slice(8,10).replace(/^0/,'')
    const m = parseInt(dateStr.slice(5,7))-1
    const y = parseInt(dateStr.slice(0,4))
    if(y===year && m===mon) {
      if(!events[d]) events[d]=[]
      events[d].push({label, color, projName, type})
    }
  }
  projects.forEach(p=>{
    (p.phases||[]).forEach(ph=>{
      if(ph.status!=='approved') addEv(ph.endDate, ph.name, '#d29922', p.name)
    });
    (p.avize||[]).forEach(av=>{
      if(av.status!=='approved')(av.steps||[]).forEach(s=>{
        if(s.status!=='approved') addEv(s.date, `Aviz`, '#58a6ff', p.name)
      })
      if(av.expiryDate) addEv(av.expiryDate, `Exp. aviz`, '#f85149', p.name)
    })
  })
  notes.forEach(n=>{
    if(!n.date) return
    const d = n.date.slice(8,10).replace(/^0/,'')
    const m = parseInt(n.date.slice(5,7))-1
    const y = parseInt(n.date.slice(0,4))
    if(y===year && m===mon) {
      if(!events[d]) events[d]=[]
      events[d].push({label:n.text, color:'#bc8cff', projName:'Notă', type:'note', noteId:n.id})
    }
  })

  const todayD  = new Date().getDate()
  const todayM  = new Date().getMonth()
  const todayY  = new Date().getFullYear()
  const isToday = (d) => d==todayD && mon==todayM && year==todayY

  const mNames = ['Ianuarie','Februarie','Martie','Aprilie','Mai','Iunie','Iulie','August','Septembrie','Octombrie','Noiembrie','Decembrie']
  const dNames = ['Lu','Ma','Mi','Jo','Vi','Sâ','Du']

  const [selDay, setSelDay] = useState(null)
  const [newNote, setNewNote] = useState('')
  const [addingNote, setAddingNote] = useState(false)

  const selDateStr = selDay ? `${year}-${String(mon+1).padStart(2,'0')}-${String(selDay).padStart(2,'0')}` : null
  const selEvs = selDay ? (events[String(selDay)]||[]) : []

  return (
    <div style={{background:T.panel,border:`1px solid ${T.border}`,borderRadius:10,padding:16}}>
      <div style={{display:'flex',alignItems:'center',marginBottom:12}}>
        <button onClick={onPrev} style={{background:'transparent',border:`1px solid ${T.border}`,borderRadius:6,width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:T.textMd,flexShrink:0}}>‹</button>
        <div style={{flex:1,textAlign:'center',fontSize:13,fontWeight:700,color:T.text}}>{mNames[mon]} {year}</div>
        <button onClick={onNext} style={{background:'transparent',border:`1px solid ${T.border}`,borderRadius:6,width:28,height:28,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:T.textMd,flexShrink:0}}>›</button>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2,marginBottom:4}}>
        {dNames.map(d=><div key={d} style={{textAlign:'center',fontSize:9,fontWeight:700,color:T.textDim,textTransform:'uppercase',padding:'4px 0'}}>{d}</div>)}
      </div>
      <div style={{display:'grid',gridTemplateColumns:'repeat(7,1fr)',gap:2}}>
        {Array.from({length:start}).map((_,i)=><div key={`e${i}`}/>)}
        {Array.from({length:days}).map((_,i)=>{
          const d = i+1
          const evs = events[String(d)]||[]
          const today = isToday(d)
          const sel = selDay===d
          return (
            <div key={d} onClick={()=>{setSelDay(sel?null:d);setAddingNote(false);setNewNote('');}}
              style={{borderRadius:6,padding:'4px 2px',minHeight:36,cursor:'pointer',background:today?`${T.accent}18`:sel?T.panelHov:'transparent',border:`1px solid ${today?T.accent:sel?T.borderLt:'transparent'}`,position:'relative'}}>
              <div style={{textAlign:'center',fontSize:11,fontWeight:today?700:400,color:today?T.accent:T.text,marginBottom:2}}>{d}</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:1,justifyContent:'center'}}>
                {evs.slice(0,3).map((ev,j)=>(
                  <div key={j} style={{width:5,height:5,borderRadius:'50%',background:ev.color}}/>
                ))}
                {evs.length>3&&<div style={{width:5,height:5,borderRadius:'50%',background:T.textDim}}/>}
              </div>
            </div>
          )
        })}
      </div>
      {selDay && (
        <div style={{marginTop:12,background:T.bg,borderRadius:8,padding:10,border:`1px solid ${T.border}`}}>
          <div style={{display:'flex',alignItems:'center',marginBottom:6}}>
            <div style={{fontSize:10,fontWeight:700,color:T.textDim,textTransform:'uppercase',letterSpacing:.6,flex:1}}>{selDay} {mNames[mon]}</div>
            {onAddNote&&<button onClick={()=>setAddingNote(s=>!s)}
              style={{background:addingNote?T.accentBg:'transparent',border:`1px solid ${addingNote?T.accent:T.border}`,borderRadius:5,padding:'2px 8px',color:addingNote?T.accent:T.textDim,fontSize:10,cursor:'pointer',fontFamily:'inherit'}}>
              + Notă
            </button>}
          </div>
          {addingNote&&(
            <div style={{display:'flex',gap:5,marginBottom:8}}>
              <input value={newNote} onChange={e=>setNewNote(e.target.value)}
                onKeyDown={e=>{if(e.key==='Enter'&&newNote.trim()){onAddNote(selDateStr,newNote.trim());setNewNote('');setAddingNote(false);}}}
                placeholder="Adaugă notă sau reminder…"
                autoFocus
                style={{flex:1,background:T.panel,border:`1px solid ${T.borderLt}`,borderRadius:6,padding:'5px 8px',color:T.text,fontSize:11,outline:'none',fontFamily:'inherit'}}/>
              <button onClick={()=>{if(newNote.trim()){onAddNote(selDateStr,newNote.trim());setNewNote('');setAddingNote(false);}}}
                style={{background:T.accent,border:'none',borderRadius:6,padding:'5px 10px',color:'#fff',fontSize:11,cursor:'pointer',fontFamily:'inherit',fontWeight:600}}>Sal.</button>
            </div>
          )}
          {selEvs.length===0&&!addingNote&&<div style={{fontSize:11,color:T.textDim}}>Niciun eveniment. Adaugă o notă.</div>}
          {selEvs.map((ev,i)=>(
            <div key={i} style={{display:'flex',alignItems:'center',gap:7,padding:'4px 0',borderBottom:i<selEvs.length-1?`1px solid ${T.border}`:'none'}}>
              <div style={{width:7,height:7,borderRadius:'50%',background:ev.color,flexShrink:0}}/>
              <div style={{fontSize:11,color:T.text,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ev.label}</div>
              {ev.type!=='note'&&<div style={{fontSize:10,color:T.textDim,flexShrink:0}}>{ev.projName}</div>}
              {ev.type==='note'&&onDeleteNote&&(
                <button onClick={()=>onDeleteNote(ev.noteId)}
                  style={{background:'transparent',border:'none',color:T.textDim,cursor:'pointer',padding:0,display:'flex',alignItems:'center',flexShrink:0}}>
                  <X size={11}/>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ─── AVIZE DASHBOARD ────────────────────────────────────────────────────────── */
const AvizeDashboard = ({projects, T, onNavigate}) => {
  const [statusF, setStatusF] = useState('all')
  const [validityF, setValidityF] = useState('all')
  const [sortBy, setSortBy] = useState('project')
  const [selInst, setSelInst] = useState(null)

  const allAvize = projects.flatMap(p=>
    (p.avize||[]).map(av=>({...av, projId:p.id, projName:p.name, projType:p.type||'arhitectura'}))
  )

  const filtered = allAvize.filter(av=>{
    if(statusF==='wip' && (av.status==='approved'||av.status==='picked_up')) return false
    else if(statusF!=='all' && statusF!=='wip' && av.status!==statusF) return false
    if(validityF!=='all') {
      const dl = av.expiryDate ? Math.round((new Date(av.expiryDate)-new Date())/86400000) : null
      if(validityF==='expiring' && !(dl!==null&&dl>=0&&dl<=30)) return false
      if(validityF==='expired' && !(dl!==null&&dl<0)) return false
      if(validityF==='valid' && !(dl!==null&&dl>30)) return false
      if(validityF==='no_date' && dl!==null) return false
    }
    if(selInst && av.instId!==selInst) return false
    return true
  }).sort((a,b)=>{
    if(sortBy==='project') return a.projName.localeCompare(b.projName)
    if(sortBy==='expiry') {
      const da = a.expiryDate?new Date(a.expiryDate):new Date('2099-01-01')
      const db2= b.expiryDate?new Date(b.expiryDate):new Date('2099-01-01')
      return da-db2
    }
    if(sortBy==='estimated') {
      const da = a.estimatedDate?new Date(a.estimatedDate):new Date('2099-01-01')
      const db2= b.estimatedDate?new Date(b.estimatedDate):new Date('2099-01-01')
      return da-db2
    }
    return 0
  })

  const sel = selInst ? INST.find(i=>i.id===selInst) : null
  const selF = {background:T.accentBg,border:`1px solid ${T.accent}44`,borderRadius:6,padding:'4px 10px',color:T.accent,cursor:'pointer',fontSize:11,fontWeight:600,fontFamily:'inherit'}
  const normF = {background:'transparent',border:`1px solid ${T.border}`,borderRadius:6,padding:'4px 10px',color:T.textDim,cursor:'pointer',fontSize:11,fontFamily:'inherit'}

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:16,flexWrap:'wrap'}}>
        <div style={{fontSize:13,fontWeight:700,color:T.text}}>Tracking avize</div>
        <div style={{marginLeft:'auto',display:'flex',gap:6,flexWrap:'wrap'}}>
          {/* Status filter */}
          <select value={statusF} onChange={e=>setStatusF(e.target.value)}
            style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:'4px 10px',color:T.textMd,fontSize:11,outline:'none',fontFamily:'inherit',cursor:'pointer'}}>
            <option value="all">Toate statusurile</option>
            <option value="wip">WIP (neconfirmate)</option>
            <option value="approved">Obținut</option>
            <option value="picked_up">Ridicat</option>
          </select>
          {/* Validity filter */}
          <select value={validityF} onChange={e=>setValidityF(e.target.value)}
            style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:'4px 10px',color:T.textMd,fontSize:11,outline:'none',fontFamily:'inherit',cursor:'pointer'}}>
            <option value="all">Toate valabilitățile</option>
            <option value="expiring">Expiră curând (&lt;30z)</option>
            <option value="expired">Expirate</option>
            <option value="valid">Valide</option>
            <option value="no_date">Fără dată expirare</option>
          </select>
          {/* Sort */}
          <select value={sortBy} onChange={e=>setSortBy(e.target.value)}
            style={{background:T.bg,border:`1px solid ${T.border}`,borderRadius:6,padding:'4px 10px',color:T.textMd,fontSize:11,outline:'none',fontFamily:'inherit',cursor:'pointer'}}>
            <option value="project">Sort: Proiect</option>
            <option value="expiry">Sort: Expirare</option>
            <option value="estimated">Sort: Estimare emitere</option>
          </select>
        </div>
      </div>

      {/* Institution filter chips */}
      <div style={{display:'flex',gap:6,flexWrap:'wrap',marginBottom:16}}>
        <button onClick={()=>setSelInst(null)} style={selInst===null?selF:normF}>Toate instituțiile</button>
        {INST.map(inst=>{
          const count = allAvize.filter(av=>av.instId===inst.id).length
          return (
            <button key={inst.id} onClick={()=>setSelInst(selInst===inst.id?null:inst.id)}
              style={selInst===inst.id?{...selF,color:inst.color,background:`${inst.color}14`,borderColor:`${inst.color}44`}:normF}>
              <span style={{display:'flex',alignItems:'center',gap:5}}>
                <inst.Icon size={11} color={selInst===inst.id?inst.color:T.textDim}/>
                {inst.short}
                <span style={{fontSize:9,background:T.border,borderRadius:8,padding:'0 4px'}}>{count}</span>
              </span>
            </button>
          )
        })}
      </div>

      {/* Institution info card when selected */}
      {sel&&(
        <div style={{background:`${sel.color}0a`,border:`1px solid ${sel.color}33`,borderRadius:10,padding:14,marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
            <div style={{width:32,height:32,borderRadius:8,background:`${sel.color}18`,border:`1px solid ${sel.color}44`,display:'flex',alignItems:'center',justifyContent:'center'}}>
              <sel.Icon size={16} color={sel.color}/>
            </div>
            <div>
              <div style={{fontSize:13,fontWeight:700,color:T.text}}>{sel.name}</div>
              <div style={{fontSize:10,color:T.textDim}}>Valabilitate standard: {sel.validity} luni</div>
            </div>
          </div>
          <div style={{fontSize:11,color:T.textMd,lineHeight:1.6}}>{sel.info}</div>
        </div>
      )}

      {/* Aviz list */}
      {filtered.length===0&&(
        <div style={{fontSize:12,color:T.textDim,textAlign:'center',padding:'30px 0'}}>Niciun aviz corespunde filtrelor selectate</div>
      )}
      {filtered.length>0&&(()=>{
        const sm={approved:{l:'Obținut',c:'#3fb950'},picked_up:{l:'Ridicat',c:'#bc8cff'}}
        const renderCard=(av,idx,hideProj=false)=>{
          const inst=INST.find(x=>x.id===av.instId)
          const dl=av.expiryDate?Math.round((new Date(av.expiryDate)-new Date())/86400000):null
          const estDl=av.estimatedDate?Math.round((new Date(av.estimatedDate)-new Date())/86400000):null
          const s=sm[av.status]||{l:'WIP',c:'#484f58'}
          const tc=PROJECT_TYPES.find(pt=>pt.id===av.projType)?.color||'#58a6ff'
          return (
            <div key={`${av.projId}-${av.instId}-${idx}`} onClick={()=>onNavigate(av.projId,'avize',av.avizId)}
              style={{display:'grid',gridTemplateColumns:'36px 1fr 160px 130px 100px',gap:10,alignItems:'center',padding:'11px 14px',background:T.panel,border:`1px solid ${T.border}`,borderRadius:9,cursor:'pointer',transition:'border-color .15s,box-shadow .15s'}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=inst?.color||T.accent;e.currentTarget.style.boxShadow=T.shadow;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.boxShadow='none';}}>
              <div style={{width:32,height:32,borderRadius:8,background:`${inst?.color||T.accent}18`,border:`1px solid ${inst?.color||T.accent}30`,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                {inst&&<inst.Icon size={15} color={inst.color}/>}
              </div>
              <div>
                <div style={{fontSize:12,fontWeight:600,color:T.text}}>{inst?.name||av.instId}</div>
                {!hideProj&&<div style={{display:'flex',alignItems:'center',gap:5,marginTop:2}}>
                  <div style={{width:6,height:6,borderRadius:'50%',background:tc,flexShrink:0}}/>
                  <span style={{fontSize:10,color:T.textDim,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{av.projName}</span>
                </div>}
              </div>
              <div style={{fontSize:10,color:T.textDim}}>
                {av.submissionDate&&<div>Depus: <strong style={{color:T.text}}>{av.submissionDate}</strong></div>}
                {av.estimatedDate&&<div style={{color:estDl!==null&&estDl>=0&&estDl<=7?T.amber:T.textDim}}>
                  Estimat: <strong>{av.estimatedDate}</strong>{estDl!==null&&estDl>=0&&estDl<=7?` (${estDl}z)`:''}</div>}
              </div>
              <div style={{fontSize:10}}>
                {av.emissionDate&&<div style={{color:T.textDim}}>Emis: <strong style={{color:T.text}}>{av.emissionDate}</strong></div>}
                {av.expiryDate&&<div style={{color:dl!==null&&dl<=30?T.red:T.textDim}}>
                  Expiră: <strong style={{color:dl!==null&&dl<=30?T.red:T.text}}>{av.expiryDate}</strong>
                  {dl!==null&&dl<=30&&dl>=0?<span style={{color:T.red,fontWeight:700}}> ⚠{dl}z</span>:''}
                  {dl!==null&&dl<0?<span style={{color:T.red,fontWeight:700}}> EXPIRAT</span>:''}
                </div>}
              </div>
              <div style={{textAlign:'right'}}>
                <span style={{fontSize:10,fontWeight:600,color:s.c,background:`${s.c}14`,border:`1px solid ${s.c}33`,borderRadius:5,padding:'3px 8px'}}>{s.l}</span>
              </div>
            </div>
          )
        }
        if(sortBy==='project'){
          const byProj={}
          filtered.forEach(av=>{
            if(!byProj[av.projId]) byProj[av.projId]={name:av.projName,type:av.projType,avize:[]}
            byProj[av.projId].avize.push(av)
          })
          return Object.entries(byProj).map(([projId,proj])=>{
            const tc=PROJECT_TYPES.find(pt=>pt.id===proj.type)?.color||T.accent
            return (
              <div key={projId} style={{marginBottom:20}}>
                <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:8,paddingBottom:7,borderBottom:`1px solid ${T.border}`}}>
                  <div style={{width:9,height:9,borderRadius:'50%',background:tc,flexShrink:0}}/>
                  <span style={{fontSize:12,fontWeight:700,color:tc}}>{proj.name}</span>
                  <span style={{fontSize:10,color:T.textDim}}>({proj.avize.length} avize)</span>
                  <button onClick={e=>{e.stopPropagation();onNavigate(projId,'avize',null)}}
                    style={{marginLeft:'auto',background:'transparent',border:`1px solid ${T.border}`,borderRadius:5,padding:'2px 8px',color:T.textDim,fontSize:10,cursor:'pointer',fontFamily:'inherit'}}>
                    Deschide →
                  </button>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:5}}>
                  {proj.avize.map((av,i)=>renderCard(av,i,true))}
                </div>
              </div>
            )
          })
        }
        return <div style={{display:'flex',flexDirection:'column',gap:6}}>{filtered.map((av,i)=>renderCard(av,i,false))}</div>
      })()}
    </div>
  )
}

/* ─── MAIN APP ───────────────────────────────────────────────────────────────── */
export default function App(){
  const { user, loading, logout } = useAuth();
  const [accessStatus, setAccessStatus] = useState('approved')
  const [pendingRequests, setPendingRequests] = useState([])
  const [showRequests, setShowRequests] = useState(false)
  const [themeMode,setThemeMode]=useState("auto");
  const sysDark=window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const T=themeMode==="dark"||(themeMode==="auto"&&sysDark)?DARK:LIGHT;

  const CURRENT_USER = user ? {
    id: user.uid,
    name: user.displayName || user.email.split('@')[0],
    email: user.email,
    role: 'owner',
  } : null;

  const [projects,setProjects]=useState([]);
  const [selId,setSelId]=useState(null);
  const [tab,setTab]=useState("faze");
  const [showRem,setShowRem]=useState(false);
  const [search,setSearch]=useState("");
  const [coll,setColl]=useState(false);
  const [toast,setToast]=useState(null);
  const [uMenu,setUMenu]=useState(false);
  const [showNewProj,setShowNewProj]=useState(false);
  const [newProjName,setNewProjName]=useState("");
  const [newProjClient,setNewProjClient]=useState("");
  const [newProjLoc,setNewProjLoc]=useState("");
  const [newProjStart,setNewProjStart]=useState(TODAY);
  const [newProjType,setNewProjType]=useState('arhitectura');
  const [navSection, setNavSection] = useState('toate')
  const [showEditProj, setShowEditProj] = useState(false)
  const [editProjData, setEditProjData] = useState(null)
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareTargetProj, setShareTargetProj] = useState(null)
  const [shareConfig, setShareConfig] = useState({faze:true,avize:true,gantt:false})
  const [shareToken, setShareToken] = useState(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteTargetProj, setDeleteTargetProj] = useState(null)
  const [projMenuId, setProjMenuId] = useState(null)
  const [calMonth, setCalMonth] = useState(()=>new Date())
  const [notes, setNotes] = useState([])
  const [approvedUsers, setApprovedUsers] = useState([])
  const [chatSeenProjects, setChatSeenProjects] = useState(new Set())
  const [autoOpenAviz, setAutoOpenAviz] = useState(null)
  const [adminUnlocked, setAdminUnlocked] = useState(false)
  const [pinModal, setPinModal] = useState(null) // {onSuccess:fn, hint:str}
  const [showChangePinModal, setShowChangePinModal] = useState(false)
  const ganttRef = useRef(null)

  const requirePin=(onSuccess,hint)=>{
    if(adminUnlocked){ onSuccess(); return; }
    setPinModal({onSuccess:()=>{setAdminUnlocked(true);setPinModal(null);onSuccess();},hint});
  };

  // Browser back/forward support
  useEffect(()=>{
    const onPop=(e)=>{
      const s=e.state;
      if(s?.selId){setSelId(s.selId);setTab(s.tab||'faze');}
      else{setSelId(null);}
    };
    window.addEventListener('popstate',onPop);
    return()=>window.removeEventListener('popstate',onPop);
  },[]);

  const navTo=(projId,t='faze',avizId=null)=>{
    history.pushState({selId:projId,tab:t},'');
    setSelId(projId);setTab(t);setShowRem(false);
    if(avizId){setAutoOpenAviz(avizId);}else{setAutoOpenAviz(null);}
  };

  const [projectsReady,setProjectsReady]=useState(false);
  const [projectsError,setProjectsError]=useState(null);
  useEffect(()=>{
    if(!user){setProjectsReady(false);setProjectsError(null);return;}
    setProjectsReady(false);setProjectsError(null);
    const unsub=listenProjects(
      user.uid,
      (ps)=>{setProjects(ps);setProjectsReady(true);setProjectsError(null);},
      (err)=>{setProjectsError(err.code||err.message);}
    );
    return unsub;
  },[user]);

  useEffect(()=>{
    if(!user) return;
    const unsub=listenNotes(user.uid, setNotes);
    return unsub;
  },[user]);

  useEffect(()=>{
    if(!user) return;
    const unsub = listenApprovedUsers(setApprovedUsers);
    return unsub;
  },[user]);

  useEffect(()=>{
    if(tab==='chat'&&selId) setChatSeenProjects(s=>new Set([...s,selId]))
  },[tab,selId])

  // Track Firestore online/offline state
  const [fsOnline, setFsOnline] = useState(true)
  useEffect(()=>{
    const onOnline=()=>setFsOnline(true);
    const onOffline=()=>setFsOnline(false);
    window.addEventListener('online',onOnline);
    window.addEventListener('offline',onOffline);
    setFsOnline(navigator.onLine);
    return()=>{window.removeEventListener('online',onOnline);window.removeEventListener('offline',onOffline);};
  },[])

  useEffect(()=>{
    const onVisible=()=>{ if(document.visibilityState==='visible') forceFirestoreSync() }
    document.addEventListener('visibilitychange',onVisible)
    return()=>document.removeEventListener('visibilitychange',onVisible)
  },[])

  useEffect(()=>{
    if(!user) return;
    const timeout = setTimeout(()=>setAccessStatus('approved'), 5000)
    const withTimeout = Promise.race([
      checkAccess(user.email),
      new Promise((_,rej)=>setTimeout(()=>rej(new Error('timeout')),4500))
    ])
    withTimeout.then(async status => {
      clearTimeout(timeout)
      if(status === 'first_user') {
        try { await initAccessControl(user.email) } catch(e) { console.error('initAccessControl:', e) }
        setAccessStatus('approved')
      } else if(status === 'approved') {
        setAccessStatus('approved')
      } else {
        const requesterName = user.displayName||user.email.split('@')[0]
        requestAccess(user.email, requesterName).catch(()=>{})
        sendAccessRequestEmail({ requesterName, requesterEmail: user.email })
        setAccessStatus('not_approved')
      }
    }).catch(err => {
      clearTimeout(timeout)
      console.error('checkAccess error:', err.message)
      setAccessStatus('approved')
    })
    return ()=>clearTimeout(timeout)
  },[user])

  const pendingCountRef = useRef(-1)
  useEffect(()=>{
    if(accessStatus !== 'approved' || !user) return
    const unsub = listenPendingRequests((reqs)=>{
      if(pendingCountRef.current >= 0 && reqs.length > pendingCountRef.current){
        const newest = reqs[0]
        showToast(`Cerere acces nouă: ${newest?.name||newest?.email||'utilizator nou'}`, '#0969da')
      }
      pendingCountRef.current = reqs.length
      setPendingRequests(reqs)
    })
    return ()=>{ pendingCountRef.current=-1; unsub(); }
  },[accessStatus, user])

  useEffect(()=>{
    const close = ()=>{ setProjMenuId(null); setUMenu(false); setShowAlertMenu(false); }
    document.addEventListener('click', close)
    return ()=>document.removeEventListener('click', close)
  },[])

  const showToast=useCallback((msg,c)=>{setToast({msg,c:c||T.green});setTimeout(()=>setToast(null),3500);},[T]);

  const sel=projects.find(p=>p.id===selId);
  const filt=projects.filter(p=>!search||p.name.toLowerCase().includes(search.toLowerCase())||(p.client||"").toLowerCase().includes(search.toLowerCase()));
  const alerts=projects.flatMap(p=>(p.phases||[]).filter(ph=>ph.status!=="approved"&&ph.status!=="rejected"&&diffD(TODAY,ph.endDate)>=0&&diffD(TODAY,ph.endDate)<=7).map(ph=>({projId:p.id,pn:p.name,ph:ph.name,d:diffD(TODAY,ph.endDate)})));
  const [showAlertMenu,setShowAlertMenu]=useState(false);

  const updPhase=(projId,phId,data)=>{
    const proj=projects.find(p=>p.id===projId);
    if(!proj||!user) return;
    let newPhases=(proj.phases||[]).map(ph=>ph.phaseId!==phId?ph:{...ph,...data});
    if(data.endDate) newPhases=cascadeForward(newPhases,phId,data.endDate,proj.avize||[]);
    setProjects(ps=>ps.map(p=>p.id!==projId?p:{...p,phases:newPhases}));
    updateProject(user.uid,projId,{phases:newPhases}).catch(e=>{
      console.error('updPhase write failed:',e);
      showToast('Eroare salvare faze — verifică conexiunea',T.red);
    });
  };
  const updAviz=(projId,avId,data)=>{
    const proj=projects.find(p=>p.id===projId);
    if(!proj||!user) return;
    const newAvize=(proj.avize||[]).map(av=>av.avizId!==avId?av:{...av,...data});
    const avDocEnd=(proj.phases||[]).find(p=>p.phaseId==='ph_av_doc')?.endDate;
    const newPhases=avDocEnd
      ?cascadeForward(proj.phases||[],'ph_av_doc',avDocEnd,newAvize)
      :[...(proj.phases||[])];
    setProjects(ps=>ps.map(p=>p.id!==projId?p:{...p,avize:newAvize,phases:newPhases}));
    updateProject(user.uid,projId,{avize:newAvize,phases:newPhases}).catch(e=>{
      console.error('updAviz write failed:',e);
      showToast('Eroare salvare avize — verifică conexiunea',T.red);
    });
  };

  const handleNewProject=async()=>{
    if(!newProjName.trim()||!user) return;
    const start=newProjStart||TODAY;
    const projName=newProjName.trim();
    const newProj={
      name:projName,
      client:newProjClient.trim(),
      location:newProjLoc.trim(),
      startDate:start,
      type:newProjType,
      phases:mkPhases(start,Array(10).fill("pending")),
      avize:mkAvize(start),
      members:[{id:user.uid,name:CURRENT_USER.name,email:CURRENT_USER.email,role:"owner"}],
      acAttachments:[],
    };
    setShowNewProj(false);
    setNewProjName("");setNewProjClient("");setNewProjLoc("");setNewProjStart(TODAY);setNewProjType('arhitectura');
    try {
      await createProject(user.uid,newProj);
      showToast(`Proiect "${projName}" salvat în cloud ✓`,T.green);
    } catch(e) {
      console.error('createProject failed:',e);
      showToast(`Eroare: proiectul nu a putut fi salvat — ${e.message||'verifică conexiunea'}`,T.red);
    }
  };

  const handleEditProject = async () => {
    if(!editProjData||!user) return
    setShowEditProj(false)
    try {
      await updateProject(user.uid, editProjData.id, {
        name: editProjData.name,
        client: editProjData.client,
        location: editProjData.location,
        startDate: editProjData.startDate,
        type: editProjData.type,
      })
      showToast('Proiect actualizat ✓', T.green)
    } catch(e) {
      console.error('handleEditProject failed:',e);
      showToast('Eroare la salvare — verifică conexiunea',T.red);
    }
  }

  const handleDeleteProject = async () => {
    if(!deleteTargetProj||!user) return
    await deleteProject(user.uid, deleteTargetProj.id)
    if(selId === deleteTargetProj.id) setSelId(null)
    setShowDeleteConfirm(false)
    setDeleteTargetProj(null)
    showToast('Proiect șters', T.red)
  }

  // Remove Firestore Timestamps so data is safe to re-write or JSON-encode
  const cleanForShare = (v) => {
    if(v===null||v===undefined) return null
    if(typeof v==='string'||typeof v==='number'||typeof v==='boolean') return v
    if(Array.isArray(v)) return v.map(cleanForShare)
    if(v && typeof v==='object') {
      if(typeof v.toDate==='function') return v.toDate().toISOString()
      return Object.fromEntries(
        Object.entries(v)
          .filter(([k])=>k!=='createdAt'&&k!=='updatedAt')
          .map(([k,val])=>[k,cleanForShare(val)])
      )
    }
    return v
  }

  const handleGenerateShare = async () => {
    if(!shareTargetProj || !user) return
    setShareLoading(true)
    try {
      const stripAttachments = (arr) => (arr||[]).map(x=>({...x,attachments:[]}))
      const data = {
        n: shareTargetProj.name, c: shareTargetProj.client, l: shareTargetProj.location,
        s: shareTargetProj.startDate, t: shareTargetProj.type,
        note: shareConfig.clientNote||'',
        ph: shareConfig.faze ? stripAttachments(cleanForShare(shareTargetProj.phases||[])) : [],
        av: shareConfig.avize ? stripAttachments(cleanForShare(shareTargetProj.avize||[])) : [],
        cfg: shareConfig,
      }
      const token = 'b64_' + btoa(unescape(encodeURIComponent(JSON.stringify(data))))
      setShareToken(token)
      const url = `${window.location.origin}/?share=${encodeURIComponent(token)}`
      navigator.clipboard.writeText(url).catch(()=>{})
      showToast('Link copiat! ✓', T.green)
    } catch(e) {
      console.error('Share generation error:', e)
      showToast('Eroare la generarea linkului', T.red)
    }
    setShareLoading(false)
  }

  const themeIcon=themeMode==="dark"?<svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>:themeMode==="light"?<svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>:<svg width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><rect x="2" y="3" width="20" height="14" rx="2"/><polyline points="8 21 12 17 16 21"/></svg>;

  const css=`
    @import url('https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700;800&display=swap');
    *{box-sizing:border-box;}
    body{margin:0;font-family:'Geist','Helvetica Neue',sans-serif;}
    ::-webkit-scrollbar{width:4px;height:4px;}
    ::-webkit-scrollbar-track{background:transparent;}
    ::-webkit-scrollbar-thumb{background:${T.borderLt};border-radius:2px;}
    select option{background:${T.panel};}
    input[type=date]::-webkit-calendar-picker-indicator{filter:${T===DARK?"invert(.4)":"invert(.5)"};cursor:pointer;}
    @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
    .fade-up{animation:fadeUp .18s ease;}
    .fade-in{animation:fadeIn .15s ease;}
    textarea{scrollbar-width:thin;}
  `;

  const urlShare = new URLSearchParams(window.location.search).get('share')
  if(urlShare) return <SharedView token={urlShare}/>

  if(loading) return(
    <div style={{minHeight:"100vh",background:DARK.bg,display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{color:DARK.textDim,fontSize:13}}>Se încarcă…</div>
    </div>
  );

  if(!user) return <LoginPage T={T} />;

  if(accessStatus === 'not_approved') return (
    <div style={{minHeight:'100vh',background:DARK.bg,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column',gap:16,padding:24}}>
      <div style={{width:56,height:56,borderRadius:16,background:'linear-gradient(135deg,#0969da,#8250df)',display:'flex',alignItems:'center',justifyContent:'center'}}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
      </div>
      <div style={{textAlign:'center'}}>
        <div style={{fontSize:18,fontWeight:700,color:DARK.text,marginBottom:8}}>Acces în așteptare</div>
        <div style={{fontSize:13,color:DARK.textDim,maxWidth:380,lineHeight:1.6}}>
          Cererea ta de acces a fost trimisă automat proprietarului.<br/>
          Vei putea intra în aplicație după ce ești aprobat.<br/><br/>
          Cont: <strong style={{color:DARK.text}}>{user.email}</strong>
        </div>
      </div>
      <div style={{display:'flex',alignItems:'center',gap:8,background:`${DARK.green}14`,border:`1px solid ${DARK.green}44`,borderRadius:8,padding:'10px 18px',fontSize:12,color:DARK.green}}>
        <CheckCircle size={14}/>Cerere trimisă — așteptați aprobarea
      </div>
      <button onClick={logout} style={{background:'transparent',border:`1px solid ${DARK.border}`,borderRadius:8,padding:'8px 18px',color:DARK.textMd,cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>
        Deconectare
      </button>
    </div>
  );

  return(
    <div style={{fontFamily:"'Geist','Helvetica Neue',sans-serif",background:T.bg,height:"100vh",color:T.text,display:"flex",flexDirection:"column",overflow:"hidden"}}>
      <style>{css}</style>

      {/* ── TOP BAR ── */}
      <header style={{height:46,background:T.sidebar,borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",padding:"0 16px",gap:10,flexShrink:0,zIndex:20}}>
        <button onClick={()=>{setSelId(null);setShowRem(false);}} style={{display:"flex",alignItems:"center",gap:8,flexShrink:0,background:"none",border:"none",cursor:"pointer",padding:0}}>
          <div style={{width:26,height:26,borderRadius:7,background:`linear-gradient(135deg,${T.accent},${T.purple})`,display:"flex",alignItems:"center",justifyContent:"center",boxShadow:`0 2px 8px ${T.accent}44`}}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          </div>
          <span style={{fontSize:14,fontWeight:700,color:T.text,letterSpacing:"-.3px"}}>ArchPlan</span>
        </button>
        <div style={{width:1,height:18,background:T.border}}/>
        <div style={{flex:1,display:"flex",alignItems:"center",gap:4,minWidth:0,overflowX:'auto'}}>
          {sel&&!showRem ? (
            <>
              <button onClick={()=>{history.pushState(null,'');setSelId(null);setShowRem(false);}}
                style={{display:'flex',alignItems:'center',gap:4,background:T.accentBg,border:`1px solid ${T.accent}33`,borderRadius:6,padding:'3px 9px',cursor:"pointer",fontSize:11,color:T.accent,fontFamily:"inherit",flexShrink:0,fontWeight:600}}>
                ← Proiecte
              </button>
              <ChevronRight size={12} color={T.textDim}/>
              <span style={{fontSize:12,color:T.text,fontWeight:500,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{sel.name}</span>
            </>
          ) : showRem ? (
            <>
              <button onClick={()=>{setSelId(null);setShowRem(false);}} style={{background:"none",border:"none",padding:0,cursor:"pointer",fontSize:12,color:T.textDim,fontFamily:"inherit",flexShrink:0}}>Proiecte</button>
              <ChevronRight size={12} color={T.textDim}/>
              <span style={{fontSize:12,color:T.text,fontWeight:500}}>Remindere</span>
            </>
          ) : (
            <div style={{display:'flex',gap:3}}>
              {[
                {id:'toate',    label:'Toate'},
                {id:'arhitectura', label:'Arhitectură', color:'#f85149'},
                {id:'urbanism',    label:'Urbanism',    color:'#3fb950'},
                {id:'avize',       label:'Avize',       color:'#58a6ff'},
                {id:'financiar',   label:'Financiar',   color:'#d29922', locked:true},
              ].map(s=>(
                <button key={s.id} onClick={()=>s.locked?requirePin(()=>setNavSection(s.id),'Secțiunea financiară este protejată.'):setNavSection(s.id)}
                  style={{background:navSection===s.id?(s.color?`${s.color}18`:T.accentBg):'transparent',
                    border:`1px solid ${navSection===s.id?(s.color||T.accent)+'44':'transparent'}`,
                    borderRadius:6,padding:'4px 10px',
                    color:navSection===s.id?(s.color||T.accent):T.textDim,
                    cursor:'pointer',fontSize:11,fontWeight:navSection===s.id?600:400,
                    fontFamily:'inherit',transition:'all .12s',whiteSpace:'nowrap'}}>
                  {s.locked&&!adminUnlocked&&<Lock size={9} style={{marginRight:3,verticalAlign:'middle'}}/>}{s.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {alerts.length>0&&(
          <div style={{position:'relative',flexShrink:0}}>
            <button onClick={e=>{e.stopPropagation();setShowAlertMenu(v=>!v);}} style={{
              display:"flex",alignItems:"center",gap:5,background:T.amberBg,border:`1px solid ${T.amber}44`,
              borderRadius:6,padding:"3px 10px",cursor:'pointer',fontFamily:'inherit',
            }}>
              <AlertTriangle size={11} color={T.amber}/>
              <span style={{fontSize:11,color:T.amber,fontWeight:600}}>{alerts.length} termen{alerts.length>1?"e":""}</span>
            </button>
            {showAlertMenu&&(
              <div onClick={e=>e.stopPropagation()} style={{
                position:'absolute',top:'calc(100% + 6px)',right:0,zIndex:100,
                background:T.panel,border:`1px solid ${T.borderLt}`,borderRadius:8,
                boxShadow:T.shadowLg,minWidth:240,overflow:'hidden',
              }}>
                <div style={{padding:'8px 12px',fontSize:10,fontWeight:700,color:T.textDim,textTransform:'uppercase',letterSpacing:.7,borderBottom:`1px solid ${T.border}`}}>Termene aproape</div>
                {alerts.map((a,i)=>(
                  <div key={i} onClick={()=>{navTo(a.projId,'faze');setShowAlertMenu(false);}} style={{
                    padding:'9px 12px',cursor:'pointer',display:'flex',alignItems:'center',gap:8,
                    borderBottom:i<alerts.length-1?`1px solid ${T.border}`:'none',
                  }}
                    onMouseEnter={e=>e.currentTarget.style.background=T.panelHov}
                    onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:11,fontWeight:600,color:T.text,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{a.pn}</div>
                      <div style={{fontSize:10,color:T.textDim,whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{a.ph}</div>
                    </div>
                    <span style={{fontSize:11,fontWeight:700,color:a.d===0?T.red:T.amber,flexShrink:0}}>{a.d===0?'Azi':`${a.d}z`}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <button onClick={()=>{if(sel){setTab('chat')}else{showToast('Selectează un proiect pentru chat',T.amber)}}}
          style={{display:"flex",alignItems:"center",justifyContent:"center",position:'relative',background:sel&&tab==='chat'?T.accentBg:"transparent",border:`1px solid ${sel&&tab==='chat'?T.accent:T.border}`,borderRadius:7,width:32,height:32,color:sel&&tab==='chat'?T.accent:T.textMd,cursor:"pointer"}}
          title="Chat proiect">
          <MessageSquare size={14}/>
          {sel&&tab!=='chat'&&!chatSeenProjects.has(selId)&&(
            <span style={{position:'absolute',top:4,right:4,width:7,height:7,borderRadius:'50%',background:T.accent,border:`1.5px solid ${T.sidebar}`}}/>
          )}
        </button>
        <button onClick={()=>setThemeMode(m=>m==="dark"?"light":m==="light"?"auto":"dark")}
          style={{display:"flex",alignItems:"center",justifyContent:"center",background:"transparent",border:`1px solid ${T.border}`,borderRadius:7,width:32,height:32,color:T.textMd,cursor:"pointer"}}
          title={`Temă: ${themeMode}`}>{themeIcon}</button>
        <button onClick={()=>setShowNewProj(true)} style={{display:"flex",alignItems:"center",gap:5,background:T.accent,border:"none",borderRadius:7,padding:"6px 13px",color:"#fff",fontWeight:600,cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>
          <Plus size={13}/>Proiect nou
        </button>
        {pendingRequests.length>0&&(
          <button onClick={()=>setShowRequests(true)}
            style={{position:'relative',background:T.amberBg,border:`1px solid ${T.amber}44`,borderRadius:7,padding:'5px 10px',color:T.amber,cursor:'pointer',fontSize:11,fontWeight:600,display:'flex',alignItems:'center',gap:5,fontFamily:'inherit'}}>
            <Users size={12}/>
            {pendingRequests.length} cerere{pendingRequests.length>1?'i':''}
            <span style={{position:'absolute',top:-4,right:-4,width:8,height:8,borderRadius:'50%',background:T.red}}/>
          </button>
        )}
        {/* User avatar */}
        <div style={{position:"relative",flexShrink:0}}>
          <div onClick={e=>{e.stopPropagation();setUMenu(s=>!s);}} style={{cursor:"pointer"}}>
            <Avatar name={CURRENT_USER.name} email={CURRENT_USER.email} size={30}/>
          </div>
          {uMenu&&(
            <div className="fade-up" onClick={e=>e.stopPropagation()} style={{position:"absolute",top:38,right:0,background:T.panel,border:`1px solid ${T.borderLt}`,borderRadius:12,padding:0,minWidth:260,boxShadow:T.shadowLg,zIndex:100,overflow:"hidden"}}>
              {/* Header profil */}
              <div style={{padding:"16px 16px 12px",background:`linear-gradient(135deg,${T.accent}18,${T.purple}18)`,borderBottom:`1px solid ${T.border}`}}>
                <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:12}}>
                  <Avatar name={CURRENT_USER.name} email={CURRENT_USER.email} size={44}/>
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:T.text}}>{CURRENT_USER.name}</div>
                    <div style={{fontSize:11,color:T.textDim,marginTop:2}}>{CURRENT_USER.email}</div>
                    <div style={{fontSize:9,color:T.textDim,marginTop:1,fontFamily:'monospace'}}>uid: {user.uid.slice(-8)}</div>
                    <div style={{display:"inline-flex",alignItems:"center",gap:4,marginTop:5,background:`${T.green}18`,border:`1px solid ${T.green}30`,borderRadius:4,padding:"1px 7px"}}>
                      <div style={{width:5,height:5,borderRadius:"50%",background:T.green}}/>
                      <span style={{fontSize:10,fontWeight:600,color:T.green}}>Owner · Activ</span>
                    </div>
                  </div>
                </div>
                {/* Statistici rapide */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                  {[
                    {l:"Proiecte",v:projects.length},
                    {l:"Active",v:projects.filter(p=>pctOf(p.phases)<100).length},
                    {l:"Avize",v:projects.reduce((s,p)=>(p.avize||[]).filter(a=>a.status==="approved"||a.status==="picked_up").length+s,0)},
                  ].map(s=>(
                    <div key={s.l} style={{background:T.bg,borderRadius:7,padding:"7px 8px",textAlign:"center",border:`1px solid ${T.border}`}}>
                      <div style={{fontSize:16,fontWeight:800,color:T.accent}}>{s.v}</div>
                      <div style={{fontSize:9,color:T.textDim,textTransform:"uppercase",letterSpacing:.5}}>{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Actiuni */}
              <div style={{padding:6}}>
                <div style={{padding:"7px 12px",fontSize:11,color:T.textDim,display:"flex",alignItems:"center",gap:6}}>
                  <Settings size={11}/>{COMPANY.name}
                </div>
                <button onClick={()=>{setUMenu(false);setShowChangePinModal(true);}} style={{width:"100%",background:"transparent",border:"none",padding:"8px 12px",color:T.textMd,cursor:"pointer",fontSize:12,textAlign:"left",borderRadius:7,fontFamily:"inherit",display:"flex",alignItems:"center",gap:7}}>
                  <Lock size={13}/>Schimbă PIN financiar
                </button>
                <button onClick={()=>{setUMenu(false);logout();}} style={{width:"100%",background:"transparent",border:"none",padding:"8px 12px",color:T.red,cursor:"pointer",fontSize:12,textAlign:"left",borderRadius:7,fontFamily:"inherit",display:"flex",alignItems:"center",gap:7}}>
                  <LogOut size={13}/>Deconectare
                </button>
              </div>
            </div>
          )}
        </div>
      </header>

      <div style={{display:"flex",flex:1,overflow:"hidden"}}>
        {/* ── SIDEBAR ── */}
        <aside style={{width:coll?48:252,background:T.sidebar,borderRight:`1px solid ${T.border}`,display:"flex",flexDirection:"column",flexShrink:0,transition:"width .2s",overflow:"hidden"}}>
          <div style={{padding:"8px",borderBottom:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:6}}>
            {!coll&&(
              <div style={{flex:1,display:"flex",alignItems:"center",gap:7,background:T.panel,border:`1px solid ${T.border}`,borderRadius:7,padding:"5px 10px"}}>
                <Search size={12} color={T.textDim}/>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Caută…"
                  style={{flex:1,background:"transparent",border:"none",color:T.text,fontSize:12,outline:"none",fontFamily:"inherit"}}/>
              </div>
            )}
            <button onClick={()=>setColl(s=>!s)} style={{background:"transparent",border:"none",color:T.textDim,cursor:"pointer",padding:4,borderRadius:5,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {coll?<PanelLeftOpen size={15}/>:<PanelLeftClose size={15}/>}
            </button>
          </div>
          {!coll&&<div style={{padding:"8px 14px 2px",fontSize:9,fontWeight:700,color:T.textDim,textTransform:"uppercase",letterSpacing:1}}>Proiecte ({filt.length})</div>}
          <div style={{overflowY:"auto",flex:1,paddingBottom:8}}>
            {!projectsReady&&!projectsError&&user&&(
              <div style={{padding:'20px 14px',textAlign:'center'}}>
                <div style={{width:16,height:16,borderRadius:'50%',border:`2px solid ${T.accent}`,borderTopColor:'transparent',animation:'spin .8s linear infinite',margin:'0 auto 8px'}}/>
                <div style={{fontSize:11,color:T.textDim}}>Se sincronizează…</div>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            )}
            {projectsError&&(
              <div style={{padding:'16px 14px',textAlign:'center'}}>
                <div style={{fontSize:11,color:T.red,marginBottom:8}}>Eroare conexiune Firestore</div>
                <div style={{fontSize:10,color:T.textDim,marginBottom:10,wordBreak:'break-all'}}>{projectsError}</div>
                <button onClick={()=>{setProjectsReady(false);setProjectsError(null);}} style={{fontSize:11,background:T.accentBg,border:`1px solid ${T.accent}44`,borderRadius:6,padding:'4px 12px',color:T.accent,cursor:'pointer',fontFamily:'inherit'}}>Reîncearcă</button>
              </div>
            )}
            {filt.map(p=>{
              const pc=pctOf(p.phases),next=p.phases.find(ph=>ph.status!=="approved"&&ph.status!=="rejected"),ov=next&&diffD(TODAY,next.endDate)<0;
              const avDone=(p.avize||[]).filter(av=>av.status==="approved"||av.status==="picked_up").length;
              if(coll) return(
                <div key={p.id} onClick={()=>navTo(p.id,'faze')} title={p.name}
                  style={{padding:8,display:"flex",justifyContent:"center",cursor:"pointer",borderRadius:7,margin:"2px 6px",background:selId===p.id&&!showRem?`${T.accent}14`:"transparent"}}>
                  <div style={{width:28,height:28,borderRadius:7,background:T.panel,border:`1px solid ${selId===p.id?T.accent:T.border}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:T.textMd,fontWeight:700}}>
                    {p.name.slice(0,2).toUpperCase()}
                  </div>
                </div>
              );
              return(
                <div key={p.id} onClick={()=>navTo(p.id,'faze')}
                  style={{padding:"10px 12px",borderRadius:8,margin:"1px 6px",cursor:"pointer",background:selId===p.id&&!showRem?`${T.accent}14`:"transparent",borderLeft:`2px solid ${selId===p.id&&!showRem?T.accent:"transparent"}`,transition:"background .12s",position:'relative'}}
                  onMouseEnter={e=>{if(!(selId===p.id&&!showRem))e.currentTarget.style.background=T.panelHov}}
                  onMouseLeave={e=>{e.currentTarget.style.background=selId===p.id&&!showRem?`${T.accent}14`:"transparent"}}>
                  <div style={{display:"flex",justifyContent:"space-between",marginBottom:4,alignItems:"center"}}>
                    <div style={{display:'flex',alignItems:'center',gap:5,flex:1,minWidth:0,paddingRight:6}}>
                      <div style={{width:6,height:6,borderRadius:'50%',background:projTypeColor(p.type),flexShrink:0}}/>
                      <div style={{fontSize:12,fontWeight:700,color:T.text,flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.name}</div>
                    </div>
                    <span style={{fontSize:10,fontWeight:700,color:ov?T.red:pc===100?T.green:T.textDim,flexShrink:0}}>{pc}%</span>
                    <button onClick={e=>{e.stopPropagation();setProjMenuId(projMenuId===p.id?null:p.id);}}
                      style={{background:'transparent',border:'none',color:T.textDim,cursor:'pointer',padding:2,display:'flex',alignItems:'center',flexShrink:0,borderRadius:4,opacity:.6}}
                      onMouseEnter={e=>e.currentTarget.style.opacity='1'} onMouseLeave={e=>e.currentTarget.style.opacity='.6'}>
                      <MoreVertical size={13}/>
                    </button>
                  </div>
                  {projMenuId===p.id&&(
                    <div style={{position:'absolute',right:8,top:36,background:T.panel,border:`1px solid ${T.borderLt}`,borderRadius:8,padding:4,minWidth:160,boxShadow:T.shadowLg,zIndex:200}} onClick={e=>e.stopPropagation()}>
                      <button onClick={()=>{setEditProjData({...p});setShowEditProj(true);setProjMenuId(null);}}
                        style={{width:'100%',background:'transparent',border:'none',padding:'7px 10px',color:T.text,cursor:'pointer',fontSize:12,textAlign:'left',borderRadius:5,fontFamily:'inherit',display:'flex',alignItems:'center',gap:7}}>
                        <Settings size={12}/>Editează proiect
                      </button>
                      <button onClick={()=>{setShareTargetProj(p);setShareToken(null);setShareConfig({faze:true,avize:true,gantt:false});setShowShareModal(true);setProjMenuId(null);}}
                        style={{width:'100%',background:'transparent',border:'none',padding:'7px 10px',color:T.text,cursor:'pointer',fontSize:12,textAlign:'left',borderRadius:5,fontFamily:'inherit',display:'flex',alignItems:'center',gap:7}}>
                        <Link2 size={12}/>Link share client
                      </button>
                      <button onClick={()=>{setDeleteTargetProj(p);setShowDeleteConfirm(true);setProjMenuId(null);}}
                        style={{width:'100%',background:'transparent',border:'none',padding:'7px 10px',color:T.red,cursor:'pointer',fontSize:12,textAlign:'left',borderRadius:5,fontFamily:'inherit',display:'flex',alignItems:'center',gap:7}}>
                        <Trash2 size={12}/>Șterge proiect
                      </button>
                    </div>
                  )}
                  {p.client&&<div style={{fontSize:10,color:T.textDim,marginBottom:3,display:"flex",alignItems:"center",gap:4,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}><User size={9}/>{p.client}</div>}
                  {/* Member avatars */}
                  <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:5}}>
                    <div style={{display:"flex",alignItems:"center"}}>
                      {(p.members||[]).slice(0,3).map((m,i)=>(
                        <Avatar key={m.id} name={m.name} email={m.email} size={16} style={{marginLeft:i===0?0:-4,border:`1.5px solid ${T.sidebar}`}}/>
                      ))}
                    </div>
                    <span style={{flex:1}}/>
                    <Chip label={`${avDone}/${(p.avize||[]).length}`} color={avDone===(p.avize||[]).length&&p.avize.length>0?T.green:T.blue} T={T}/>
                  </div>
                  <div style={{height:2,background:T.border,borderRadius:1,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pc}%`,background:ov?T.red:pc===100?T.green:T.accent,borderRadius:1,transition:"width .4s"}}/>
                  </div>
                </div>
              );
            })}
          </div>
          {!coll&&<div style={{padding:"8px 14px",borderTop:`1px solid ${T.border}`,display:"flex",alignItems:"center",gap:6}}>
            <Calendar size={11} color={T.textDim}/><span style={{fontSize:10,color:T.textDim}}>{fmt(TODAY)}</span>
          </div>}
        </aside>

        {/* ── MAIN ── */}
        <main style={{flex:1,overflowY:"auto",background:T.bg,padding:20}} className="fade-in">
          {!sel?(
            /* Dashboard */
            <div className="fade-in">
              <div style={{marginBottom:20}}>
                <div style={{fontSize:21,fontWeight:800,color:T.text,marginBottom:4,letterSpacing:"-.4px"}}>Dashboard</div>
                <div style={{fontSize:13,color:T.textDim}}>Studio Office Kolectiv — {fmt(TODAY)}</div>
              </div>
              {/* KPIs */}
              <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10,marginBottom:20}}>
                {[
                  {l:"Total proiecte", v:projects.length,                                          c:T.accent, I:Layers,       ns:'toate'},
                  {l:"Active",         v:projects.filter(p=>pctOf(p.phases)<100).length,           c:T.amber,  I:Clock,        ns:'active'},
                  {l:"Finalizate",     v:projects.filter(p=>pctOf(p.phases)===100).length,         c:T.green,  I:CheckCircle,  ns:'finalizate'},
                  {l:"Întârziate",     v:projects.filter(p=>(p.phases||[]).some(ph=>ph.status!=='approved'&&ph.status!=='rejected'&&diffD(TODAY,ph.endDate)<0)).length, c:T.red, I:AlertTriangle, ns:'intarziate'},
                ].map(k=>(
                  <div key={k.l} onClick={()=>setNavSection(k.ns)}
                    style={{background:T.panel,border:`1px solid ${navSection===k.ns?k.c:T.border}`,borderRadius:10,padding:"15px 18px",display:"flex",alignItems:"flex-start",gap:12,cursor:'pointer',transition:'border-color .15s'}}
                    onMouseEnter={e=>e.currentTarget.style.borderColor=k.c}
                    onMouseLeave={e=>e.currentTarget.style.borderColor=navSection===k.ns?k.c:T.border}>
                    <div style={{width:36,height:36,borderRadius:9,background:`${k.c}14`,border:`1px solid ${k.c}28`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}><k.I size={17} color={k.c}/></div>
                    <div><div style={{fontSize:26,fontWeight:800,color:k.c,lineHeight:1}}>{k.v}</div><div style={{fontSize:11,color:T.textDim,marginTop:3}}>{k.l}</div></div>
                  </div>
                ))}
              </div>
              {(()=>{
                const dashProjects = navSection==='toate' ? projects
                  : navSection==='arhitectura' ? projects.filter(p=>p.type==='arhitectura')
                  : navSection==='urbanism' ? projects.filter(p=>p.type==='urbanism')
                  : navSection==='active' ? projects.filter(p=>pctOf(p.phases)<100)
                  : navSection==='finalizate' ? projects.filter(p=>pctOf(p.phases)===100)
                  : navSection==='intarziate' ? projects.filter(p=>(p.phases||[]).some(ph=>ph.status!=='approved'&&ph.status!=='rejected'&&diffD(TODAY,ph.endDate)<0))
                  : projects
                return navSection==='avize' ? (
                  <AvizeDashboard projects={projects} T={T} onNavigate={(projId,tab,avizId)=>navTo(projId,tab,avizId||null)}/>
                ) : navSection==='financiar' ? (
                  <div>
                    <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:12}}>Situație financiară</div>
                    {projects.map(p=>{
                      const facturi=p.facturi||[]
                      const total=facturi.reduce((s,f)=>s+(parseFloat(f.suma)||0),0)
                      const incasat=facturi.filter(f=>f.status==='incasata').reduce((s,f)=>s+(parseFloat(f.suma)||0),0)
                      return (
                        <div key={p.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 14px',background:T.panel,border:`1px solid ${T.border}`,borderRadius:8,marginBottom:8}}>
                          <div style={{flex:1}}>
                            <div style={{fontSize:13,fontWeight:600,color:T.text}}>{p.name}</div>
                            <div style={{fontSize:11,color:T.textDim}}>{facturi.length} facturi</div>
                          </div>
                          <div style={{textAlign:'right'}}>
                            <div style={{fontSize:13,fontWeight:700,color:T.accent}}>{total.toLocaleString()} RON total</div>
                            <div style={{fontSize:11,color:T.green}}>{incasat.toLocaleString()} RON încasat</div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (()=>{
                  const grouped = PROJECT_TYPES.map(pt=>({
                    ...pt,
                    items: dashProjects.filter(p=>p.type===pt.id||((!p.type)&&pt.id==='arhitectura'))
                  })).filter(g=>g.items.length>0)
                  if(grouped.length===0) return <div style={{fontSize:12,color:T.textDim,textAlign:'center',padding:'40px 0'}}>Niciun proiect în această categorie</div>
                  return grouped.map(g=>(
                    <div key={g.id} style={{marginBottom:24}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
                        <div style={{width:10,height:10,borderRadius:'50%',background:g.color}}/>
                        <span style={{fontSize:12,fontWeight:700,color:g.color,textTransform:'uppercase',letterSpacing:.8}}>{g.label}</span>
                        <span style={{fontSize:11,color:T.textDim}}>({g.items.length})</span>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
                        {g.items.map(p=>{
                          const pc=pctOf(p.phases),next=(p.phases||[]).find(ph=>ph.status!=="approved"&&ph.status!=="rejected"),ov=next&&diffD(TODAY,next.endDate)<0;
                          const tc=projTypeColor(p.type)
                          return(
                            <div key={p.id} onClick={()=>navTo(p.id,'faze')}
                              style={{background:T.panel,border:`1px solid ${T.border}`,borderRadius:10,padding:16,cursor:"pointer",transition:"border-color .15s,box-shadow .15s",borderTop:`3px solid ${tc}`}}
                              onMouseEnter={e=>{e.currentTarget.style.borderColor=`${tc}88`;e.currentTarget.style.boxShadow=T.shadow;}}
                              onMouseLeave={e=>{e.currentTarget.style.borderColor=T.border;e.currentTarget.style.borderTopColor=tc;e.currentTarget.style.boxShadow="none";}}>
                              <div style={{display:"flex",justifyContent:"space-between",marginBottom:7}}>
                                <div style={{fontSize:13,fontWeight:700,color:T.text,flex:1,paddingRight:8,lineHeight:1.3}}>{p.name}</div>
                                <span style={{fontSize:14,fontWeight:800,color:ov?T.red:pc===100?T.green:tc,flexShrink:0}}>{pc}%</span>
                              </div>
                              <div style={{fontSize:11,color:T.textDim,marginBottom:6,display:"flex",alignItems:"center",gap:4}}><User size={11}/>{p.client}</div>
                              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
                                {(p.members||[]).slice(0,4).map((m,i)=>(<Avatar key={m.id} name={m.name} email={m.email} size={20} style={{marginLeft:i===0?0:-4}}/>))}
                              </div>
                              <div style={{height:3,background:T.border,borderRadius:2,overflow:"hidden"}}>
                                <div style={{height:"100%",width:`${pc}%`,background:ov?T.red:pc===100?T.green:tc,borderRadius:2,transition:"width .5s"}}/>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ))
                })()
              })()}
              {navSection==='toate'&&<div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:16,marginTop:20}}>
                {/* Today's events */}
                <div style={{background:T.panel,border:`1px solid ${T.border}`,borderRadius:10,padding:16}}>
                  <div style={{fontSize:11,fontWeight:700,color:T.textMd,textTransform:'uppercase',letterSpacing:.8,marginBottom:12}}>Azi — {fmt(TODAY)}</div>
                  {(()=>{
                    const projEvs={}
                    projects.forEach(p=>{
                      const evs=[]
                      ;(p.phases||[]).forEach(ph=>{
                        if(ph.status!=='approved'&&ph.status!=='rejected'){
                          const d=diffD(TODAY,ph.endDate)
                          const recs={
                            CU:'Pregătiți documentele: schiță amplasament, dovada proprietății, cerere tip.',
                            Avize:'Contactați instituțiile și solicitați lista exactă de documente necesare.',
                            PT:'Verificați că toți specialiștii au livrat piesele scrise și desenate.',
                            AC:'Verificați completitudinea dosarului conform listei de la biroul de urbanism.',
                          }
                          if(d>=0&&d<=7) evs.push({type:'faza',label:ph.name,d,color:'#d29922',rec:recs[ph.group]||'Verificați statusul și pregătiți documentele necesare.'})
                        }
                      });
                      ;(p.avize||[]).forEach(av=>{
                        if(av.status!=='approved'){
                          const inst=INST.find(i=>i.id===av.instId)
                          ;(av.steps||[]).forEach(s=>{
                            if(s.status!=='approved'&&s.date){
                              const d=diffD(TODAY,s.date)
                              if(d>=0&&d<=7) evs.push({type:'aviz',label:`Aviz ${inst?.short||av.instId}`,d,color:'#58a6ff',rec:inst?.info||'Pregătiți documentele și depuneți dosarul la instituție.'})
                            }
                          })
                        }
                      })
                      if(evs.length>0) projEvs[p.id]={name:p.name,color:projTypeColor(p.type),evs:evs.sort((a,b)=>a.d-b.d)}
                    })
                    const projIds=Object.keys(projEvs)
                    if(projIds.length===0) return <div style={{fontSize:12,color:T.textDim,textAlign:'center',padding:'20px 0'}}>Niciun termen în următoarele 7 zile 🎉</div>
                    return projIds.map((pid,pi)=>(
                      <div key={pid} style={{marginBottom:pi<projIds.length-1?10:0}}>
                        <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:4,paddingBottom:4,borderBottom:`1px solid ${T.border}`}}>
                          <div style={{width:7,height:7,borderRadius:'50%',background:projEvs[pid].color,flexShrink:0}}/>
                          <span style={{fontSize:11,fontWeight:700,color:projEvs[pid].color,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{projEvs[pid].name}</span>
                        </div>
                        {projEvs[pid].evs.map((ev,i)=>(
                          <div key={i} style={{padding:'5px 0 5px 14px',borderBottom:i<projEvs[pid].evs.length-1?`1px solid ${T.border}33`:'none'}}>
                            <div style={{display:'flex',alignItems:'center',gap:8}}>
                              <div style={{width:5,height:5,borderRadius:'50%',background:ev.color,flexShrink:0}}/>
                              <div style={{flex:1,fontSize:12,color:T.text,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{ev.label}</div>
                              <div style={{fontSize:10,fontWeight:600,color:ev.d===0?T.red:ev.d<=2?T.amber:T.textMd,flexShrink:0}}>
                                {ev.d===0?'Azi':ev.d===1?'Mâine':`${ev.d}z`}
                              </div>
                            </div>
                            {ev.rec&&<div style={{fontSize:10,color:T.textDim,marginTop:2,paddingLeft:13,lineHeight:1.4}}>{ev.rec}</div>}
                          </div>
                        ))}
                      </div>
                    ))
                  })()}
                </div>
                <CalendarWidget projects={projects} T={T} month={calMonth}
                  onPrev={()=>setCalMonth(m=>new Date(m.getFullYear(),m.getMonth()-1,1))}
                  onNext={()=>setCalMonth(m=>new Date(m.getFullYear(),m.getMonth()+1,1))}
                  notes={notes}
                  onAddNote={(date, text)=>{ if(user) createNote(user.uid, {date, text, type:'note'}) }}
                  onDeleteNote={(noteId)=>{ if(user) deleteNote(user.uid, noteId) }}/>
              </div>}
            </div>
          ):(
            /* Project detail */
            <div className="fade-in">
              <div style={{marginBottom:16}}>
                <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,marginBottom:12,flexWrap:"wrap"}}>
                  <div>
                    <h1 style={{margin:"0 0 6px",fontSize:21,fontWeight:800,color:T.text,letterSpacing:"-.4px"}}>{sel.name}</h1>
                    <div style={{display:"flex",gap:10,flexWrap:"wrap",alignItems:"center"}}>
                      {sel.client&&<span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,color:T.textDim}}><User size={11}/>{sel.client}</span>}
                      {sel.location&&<span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,color:T.textDim}}><Map size={11}/>{sel.location}</span>}
                      <span style={{display:"inline-flex",alignItems:"center",gap:4,fontSize:11,color:T.textDim}}><Calendar size={11}/>{fmt(sel.startDate)}</span>
                      {/* member avatars in header */}
                      <div style={{display:"flex",alignItems:"center",marginLeft:4}}>
                        {(sel.members||[]).slice(0,5).map((m,i)=>(
                          <Avatar key={m.id} name={m.name} email={m.email} size={20} style={{marginLeft:i===0?0:-5,border:`1.5px solid ${T.bg}`}} title={m.name}/>
                        ))}
                        {sel.members?.length>5&&<span style={{fontSize:10,color:T.textDim,marginLeft:4}}>+{sel.members.length-5}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{display:"flex",background:T.sidebar,borderRadius:8,padding:3,border:`1px solid ${T.border}`,gap:2}}>
                    {TABS.map(t=>(
                      <button key={t.id} onClick={()=>t.locked?requirePin(()=>setTab(t.id),`Tabul "${t.label}" este protejat.`):setTab(t.id)}
                        style={{display:"flex",alignItems:"center",gap:5,background:tab===t.id?T.panel:"transparent",border:`1px solid ${tab===t.id?T.border:"transparent"}`,borderRadius:6,padding:"5px 11px",color:tab===t.id?T.text:T.textDim,cursor:"pointer",fontSize:11,fontWeight:tab===t.id?600:400,fontFamily:"inherit",transition:"all .12s"}}>
                        {t.locked&&!adminUnlocked?<Lock size={11}/>:<t.I size={12}/>}{t.label}
                        {t.id==="chat"&&<span style={{width:6,height:6,borderRadius:"50%",background:T.accent,display:"block"}}/>}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{background:T.panel,borderRadius:9,padding:"12px 18px",border:`1px solid ${T.border}`}}>
                  <MultiProg phases={sel.phases} T={T}/>
                </div>
              </div>

              {tab==="faze"&&<PhasesView project={sel} onUpdate={(phId,data)=>updPhase(sel.id,phId,data)} T={T}/>}
              {tab==="avize"&&<AvizeView project={sel} onUpdate={(avId,data)=>updAviz(sel.id,avId,data)} T={T} autoOpenAviz={autoOpenAviz}/>}
              {tab==="gantt"&&(
                <div style={{background:T.panel,borderRadius:10,padding:20,border:`1px solid ${T.border}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:16}}>
                    <BarChart2 size={14} color={T.textDim}/>
                    <span style={{fontSize:11,fontWeight:600,color:T.textDim,textTransform:"uppercase",letterSpacing:.8}}>Timeline — Faze principale</span>
                    <button onClick={async()=>{
                      if(!ganttRef.current) return
                      showToast('Se generează PDF…', T.textMd)
                      try {
                        const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
                          import('html2canvas'),
                          import('jspdf'),
                        ])
                        const canvas = await html2canvas(ganttRef.current, {
                          backgroundColor: T===DARK?'#161b22':'#ffffff',
                          scale: 2,
                          useCORS: true,
                        })
                        const pdf = new jsPDF({orientation:'landscape',unit:'mm',format:'a3'})
                        const pw = pdf.internal.pageSize.getWidth()
                        const ph = pdf.internal.pageSize.getHeight()
                        const ratio = Math.min(pw/canvas.width, ph/canvas.height)
                        const iw = canvas.width*ratio
                        const ih = canvas.height*ratio
                        const mx = (pw-iw)/2
                        const my = (ph-ih)/2
                        pdf.addImage(canvas.toDataURL('image/png'),'PNG',mx,my,iw,ih)
                        pdf.save(`${sel.name.replace(/[^a-zA-Z0-9]/g,'_')}_Gantt.pdf`)
                        showToast('PDF exportat!', T.green)
                      } catch(e) {
                        console.error(e)
                        showToast('Eroare la export PDF', T.red)
                      }
                    }} style={{marginLeft:"auto",display:"inline-flex",alignItems:"center",gap:5,background:T.greenBg,border:`1px solid ${T.green}44`,color:T.green,borderRadius:7,padding:"5px 11px",fontSize:11,fontWeight:600,cursor:"pointer",fontFamily:"inherit"}}>
                      <Download size={11}/>Export PDF A3
                    </button>
                  </div>
                  <div ref={ganttRef} style={{background:T.panel,padding:8,borderRadius:8}}>
                    <div style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:12,padding:'0 4px'}}>{sel.name} — Timeline</div>
                    <Gantt phases={sel.phases} T={T}/>
                  </div>
                </div>
              )}
              {tab==="chat"&&<Chat project={sel} T={T} currentUser={CURRENT_USER} showToast={showToast} approvedUsers={approvedUsers}/>}
              {tab==="contract"&&<ContractView project={sel} T={T} onUpdate={(data)=>{
                if(!user) return
                updateProject(user.uid,sel.id,data)
                setProjects(ps=>ps.map(p=>p.id!==sel.id?p:{...p,...data}))
              }}/>}
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer style={{height:36,background:T.sidebar,borderTop:`1px solid ${T.border}`,display:"flex",alignItems:"center",padding:"0 20px",gap:14,flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{width:18,height:18,borderRadius:4,background:`linear-gradient(135deg,${T.accent},${T.purple})`,display:"flex",alignItems:"center",justifyContent:"center"}}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
          </div>
          <span style={{fontSize:11,fontWeight:700,color:T.text}}>Studio Office Kolectiv</span>
          <span style={{fontSize:10,color:T.textDim}}>CUI 32238680</span>
        </div>
        <div style={{height:12,width:1,background:T.border}}/>
        <span style={{fontSize:10,color:T.textDim}}>Arhitectură · Urbanism · Design</span>
        <div style={{marginLeft:"auto",display:"flex",gap:14,alignItems:"center"}}>
          {/* Firestore sync indicator */}
          <div style={{display:'flex',alignItems:'center',gap:4}}>
            <div style={{width:6,height:6,borderRadius:'50%',background:fsOnline?T.green:T.red,flexShrink:0}}/>
            <span style={{fontSize:10,color:fsOnline?T.green:T.red,fontWeight:600}}>
              {fsOnline?'Sincronizat':'Offline'}
            </span>
          </div>
          <div style={{height:10,width:1,background:T.border}}/>
          <span style={{fontSize:10,color:T.textDim,fontFamily:'monospace'}}>v{__BUILD_DATE__}</span>
          <a href="https://www.studiokolectiv.ro" target="_blank" rel="noreferrer" style={{fontSize:10,color:T.blue,textDecoration:"none",fontWeight:500}}>studiokolectiv.ro</a>
          <span style={{fontSize:10,color:T.textDim}}>© 2025 ArchPlan</span>
        </div>
      </footer>

      {/* Modal editare proiect */}
      {showEditProj&&editProjData&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200}} onClick={()=>setShowEditProj(false)}>
          <div style={{background:T.panel,border:`1px solid ${T.borderLt}`,borderRadius:14,padding:28,width:420,boxShadow:T.shadowLg}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:18}}>Editează proiect</div>
            {[['Nume proiect','name'],['Client','client'],['Locație','location']].map(([label,field])=>(
              <div key={field} style={{marginBottom:12}}>
                <div style={{fontSize:10,color:T.textDim,marginBottom:4,textTransform:'uppercase',letterSpacing:.6}}>{label}</div>
                <input value={editProjData[field]||''} onChange={e=>setEditProjData(d=>({...d,[field]:e.target.value}))}
                  style={{width:'100%',background:T.bg,border:`1px solid ${T.borderLt}`,borderRadius:7,padding:'8px 11px',color:T.text,fontSize:12,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
              </div>
            ))}
            <div style={{marginBottom:14}}>
              <div style={{fontSize:10,color:T.textDim,marginBottom:4,textTransform:'uppercase',letterSpacing:.6}}>Dată start</div>
              <input type="date" value={editProjData.startDate||''} onChange={e=>setEditProjData(d=>({...d,startDate:e.target.value}))}
                style={{width:'100%',background:T.bg,border:`1px solid ${T.borderLt}`,borderRadius:7,padding:'8px 11px',color:T.text,fontSize:12,outline:'none',fontFamily:'inherit',boxSizing:'border-box'}}/>
            </div>
            <div style={{marginBottom:18}}>
              <label style={{fontSize:10,color:T.textDim,display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:.6}}>Tip proiect</label>
              <div style={{display:'flex',gap:6}}>
                {PROJECT_TYPES.map(pt=>(
                  <button key={pt.id} onClick={()=>setEditProjData(d=>({...d,type:pt.id}))}
                    style={{flex:1,background:(editProjData.type||'arhitectura')===pt.id?`${pt.color}20`:'transparent',border:`1.5px solid ${(editProjData.type||'arhitectura')===pt.id?pt.color:T.border}`,borderRadius:7,padding:'6px 4px',color:(editProjData.type||'arhitectura')===pt.id?pt.color:T.textDim,cursor:'pointer',fontSize:11,fontWeight:(editProjData.type||'arhitectura')===pt.id?700:400,fontFamily:'inherit',transition:'all .12s'}}>
                    {pt.label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setShowEditProj(false)} style={{background:'transparent',border:`1px solid ${T.border}`,borderRadius:7,padding:'7px 16px',color:T.textMd,cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>Anulează</button>
              <button onClick={handleEditProject} style={{background:T.accent,border:'none',borderRadius:7,padding:'7px 18px',color:'#fff',fontWeight:600,cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>Salvează</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal share link */}
      {showShareModal&&shareTargetProj&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200}} onClick={()=>{setShowShareModal(false);setShareToken(null);}}>
          <div style={{background:T.panel,border:`1px solid ${T.borderLt}`,borderRadius:14,padding:28,width:440,boxShadow:T.shadowLg}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:4}}>Link share client</div>
            <div style={{fontSize:12,color:T.textDim,marginBottom:18}}>{shareTargetProj.name}</div>
            {!shareToken?(
              <>
                <div style={{fontSize:11,fontWeight:600,color:T.textMd,marginBottom:10}}>Selectează ce vede clientul:</div>
                {[['faze','Faze proiect'],['avize','Avize']].map(([key,label])=>(
                  <label key={key} style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,cursor:'pointer'}}>
                    <input type="checkbox" checked={!!shareConfig[key]} onChange={e=>setShareConfig(c=>({...c,[key]:e.target.checked}))}/>
                    <span style={{fontSize:12,color:T.text}}>{label}</span>
                  </label>
                ))}
                <div style={{marginTop:12,marginBottom:6}}>
                  <div style={{fontSize:10,color:T.textDim,marginBottom:4,textTransform:'uppercase',letterSpacing:.5}}>Notă pentru client (opțional)</div>
                  <textarea value={shareConfig.clientNote||''} onChange={e=>setShareConfig(c=>({...c,clientNote:e.target.value}))}
                    rows={3} placeholder="Scrie un mesaj pentru client ce va apărea în fruntea pagii share…"
                    style={{width:'100%',background:T.bg,border:`1px solid ${T.borderLt}`,borderRadius:7,padding:'7px 10px',color:T.text,fontSize:11,outline:'none',fontFamily:'inherit',resize:'vertical',boxSizing:'border-box'}}/>
                </div>
                <div style={{display:'flex',gap:8,justifyContent:'flex-end',marginTop:12}}>
                  <button onClick={()=>setShowShareModal(false)} style={{background:'transparent',border:`1px solid ${T.border}`,borderRadius:7,padding:'7px 16px',color:T.textMd,cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>Anulează</button>
                  <button onClick={handleGenerateShare} disabled={shareLoading} style={{background:T.accent,border:'none',borderRadius:7,padding:'7px 18px',color:'#fff',fontWeight:600,cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>
                    {shareLoading?'Se generează…':'Generează link'}
                  </button>
                </div>
              </>
            ):(
              <>
                <div style={{fontSize:11,color:T.green,fontWeight:600,marginBottom:10,display:'flex',alignItems:'center',gap:6}}>
                  <CheckCircle size={14}/>
                  Link generat și copiat în clipboard
                </div>
                <div style={{background:T.bg,border:`1px solid ${T.accent}55`,borderRadius:7,padding:'10px 12px',fontSize:11,color:T.accent,wordBreak:'break-all',marginBottom:6,userSelect:'all',cursor:'text'}}>
                  {window.location.origin}/?share={shareToken}
                </div>
                <div style={{fontSize:10,color:T.textDim,marginBottom:14}}>
                  Trimite acest link clientului. Nu necesită cont sau autentificare.
                </div>
                <div style={{display:'flex',gap:8,justifyContent:'flex-end',flexWrap:'wrap'}}>
                  <button onClick={()=>window.open(`${window.location.origin}/?share=${encodeURIComponent(shareToken)}`,'_blank')}
                    style={{background:'transparent',border:`1px solid ${T.border}`,borderRadius:7,padding:'7px 12px',color:T.textMd,cursor:'pointer',fontSize:12,fontFamily:'inherit',display:'flex',alignItems:'center',gap:5}}>
                    <ExternalLink size={11}/>Testează
                  </button>
                  <button onClick={()=>{navigator.clipboard.writeText(`${window.location.origin}/?share=${encodeURIComponent(shareToken)}`);showToast('Link copiat din nou!',T.green);}}
                    style={{background:T.accentBg,border:`1px solid ${T.accent}44`,borderRadius:7,padding:'7px 14px',color:T.accent,cursor:'pointer',fontSize:12,fontFamily:'inherit',fontWeight:600}}>
                    Copiază din nou
                  </button>
                  <button onClick={()=>{setShowShareModal(false);setShareToken(null)}} style={{background:T.accent,border:'none',borderRadius:7,padding:'7px 16px',color:'#fff',fontWeight:600,cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>Gata</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal confirmare ștergere proiect */}
      {showDeleteConfirm&&deleteTargetProj&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200}} onClick={()=>setShowDeleteConfirm(false)}>
          <div style={{background:T.panel,border:`1px solid ${T.borderLt}`,borderRadius:14,padding:28,width:380,boxShadow:T.shadowLg}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:8}}>Șterge proiect</div>
            <div style={{fontSize:13,color:T.textDim,marginBottom:20}}>Ești sigur că vrei să ștergi <strong style={{color:T.text}}>{deleteTargetProj.name}</strong>? Această acțiune nu poate fi anulată.</div>
            <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
              <button onClick={()=>setShowDeleteConfirm(false)} style={{background:'transparent',border:`1px solid ${T.border}`,borderRadius:7,padding:'7px 16px',color:T.textMd,cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>Anulează</button>
              <button onClick={handleDeleteProject} style={{background:T.red,border:'none',borderRadius:7,padding:'7px 18px',color:'#fff',fontWeight:600,cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>Șterge</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal cereri de acces */}
      {showRequests&&(
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.55)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200}} onClick={()=>setShowRequests(false)}>
          <div style={{background:T.panel,border:`1px solid ${T.borderLt}`,borderRadius:14,padding:28,width:440,maxHeight:'80vh',overflow:'auto',boxShadow:T.shadowLg}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:18}}>Cereri de acces</div>
            {pendingRequests.length===0&&<div style={{fontSize:12,color:T.textDim,textAlign:'center',padding:'20px 0'}}>Nicio cerere în așteptare</div>}
            {pendingRequests.map(r=>(
              <div key={r.id} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 0',borderBottom:`1px solid ${T.border}`}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,fontWeight:600,color:T.text}}>{r.name||r.email}</div>
                  <div style={{fontSize:11,color:T.textDim}}>{r.email}</div>
                </div>
                <button onClick={()=>approveAccess(r.email).then(()=>showToast(`${r.email} aprobat`,T.green))}
                  style={{background:T.greenBg,border:`1px solid ${T.green}44`,borderRadius:6,padding:'5px 12px',color:T.green,fontSize:11,cursor:'pointer',fontFamily:'inherit',fontWeight:600}}>Aprobă</button>
                <button onClick={()=>rejectAccess(r.email).then(()=>showToast(`${r.email} respins`,T.red))}
                  style={{background:T.redBg,border:`1px solid ${T.red}44`,borderRadius:6,padding:'5px 12px',color:T.red,fontSize:11,cursor:'pointer',fontFamily:'inherit'}}>Respinge</button>
              </div>
            ))}
            <div style={{display:'flex',justifyContent:'flex-end',marginTop:16}}>
              <button onClick={()=>setShowRequests(false)} style={{background:T.accent,border:'none',borderRadius:7,padding:'7px 18px',color:'#fff',fontWeight:600,cursor:'pointer',fontSize:12,fontFamily:'inherit'}}>Închide</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal proiect nou */}
      {showNewProj&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200}} onClick={()=>setShowNewProj(false)}>
          <div style={{background:T.panel,border:`1px solid ${T.borderLt}`,borderRadius:14,padding:28,width:420,boxShadow:T.shadowLg}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:700,color:T.text,marginBottom:18}}>Proiect nou</div>
            <div style={{marginBottom:14}}>
              <label style={{fontSize:10,color:T.textDim,display:'block',marginBottom:6,textTransform:'uppercase',letterSpacing:.6}}>Tip proiect</label>
              <div style={{display:'flex',gap:6}}>
                {PROJECT_TYPES.map(pt=>(
                  <button key={pt.id} onClick={()=>setNewProjType(pt.id)}
                    style={{flex:1,background:newProjType===pt.id?`${pt.color}20`:'transparent',border:`1.5px solid ${newProjType===pt.id?pt.color:T.border}`,borderRadius:7,padding:'6px 4px',color:newProjType===pt.id?pt.color:T.textDim,cursor:'pointer',fontSize:11,fontWeight:newProjType===pt.id?700:400,fontFamily:'inherit',transition:'all .12s'}}>
                    {pt.label}
                  </button>
                ))}
              </div>
            </div>
            {[
              ["Nume proiect *","text",newProjName,setNewProjName,"ex: Locuință P+1E — Cluj"],
              ["Client","text",newProjClient,setNewProjClient,"ex: Familia Ionescu"],
              ["Locație","text",newProjLoc,setNewProjLoc,"ex: Cluj-Napoca, str. Memorandumului"],
            ].map(([label,type,val,set,ph])=>(
              <div key={label} style={{marginBottom:12}}>
                <div style={{fontSize:10,color:T.textDim,marginBottom:4,textTransform:"uppercase",letterSpacing:.6}}>{label}</div>
                <input type={type} value={val} onChange={e=>set(e.target.value)} placeholder={ph}
                  style={{width:"100%",background:T.bg,border:`1px solid ${T.borderLt}`,borderRadius:7,padding:"8px 11px",color:T.text,fontSize:12,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
              </div>
            ))}
            <div style={{marginBottom:18}}>
              <div style={{fontSize:10,color:T.textDim,marginBottom:4,textTransform:"uppercase",letterSpacing:.6}}>Dată start</div>
              <input type="date" value={newProjStart} onChange={e=>setNewProjStart(e.target.value)}
                style={{width:"100%",background:T.bg,border:`1px solid ${T.borderLt}`,borderRadius:7,padding:"8px 11px",color:T.text,fontSize:12,outline:"none",fontFamily:"inherit",boxSizing:"border-box"}}/>
            </div>
            <div style={{display:"flex",gap:8,justifyContent:"flex-end"}}>
              <button onClick={()=>setShowNewProj(false)} style={{background:"transparent",border:`1px solid ${T.border}`,borderRadius:7,padding:"7px 16px",color:T.textMd,cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>Anulează</button>
              <button onClick={handleNewProject} style={{background:T.accent,border:"none",borderRadius:7,padding:"7px 18px",color:"#fff",fontWeight:600,cursor:"pointer",fontSize:12,fontFamily:"inherit"}}>Creează</button>
            </div>
          </div>
        </div>
      )}

      {/* PIN access modal */}
      {pinModal&&<PinModal T={T} hint={pinModal.hint} onSuccess={pinModal.onSuccess} onCancel={()=>setPinModal(null)}/>}
      {/* Change PIN modal */}
      {showChangePinModal&&<ChangePinModal T={T} onClose={()=>setShowChangePinModal(false)} onChanged={()=>{setAdminUnlocked(false);showToast('PIN actualizat ✓',T.green);}}/>}

      {/* Toast */}
      {toast&&(
        <div className="fade-up" style={{position:"fixed",bottom:20,right:20,background:T.panel,border:`1px solid ${toast.c}44`,borderRadius:9,padding:"10px 16px",boxShadow:T.shadowLg,zIndex:999,display:"flex",alignItems:"center",gap:8,maxWidth:360}}>
          <div style={{width:6,height:6,borderRadius:"50%",background:toast.c,flexShrink:0}}/>
          <span style={{fontSize:12,color:T.text,fontWeight:500}}>{toast.msg}</span>
        </div>
      )}
    </div>
  );
}
