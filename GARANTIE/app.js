/* ═══════════════════════════════════════════════════════
   GarantiesTrack — app.js
   Firebase · Excel · Charts · Suivi des Garanties
═══════════════════════════════════════════════════════ */
'use strict';

// ── Données statiques : étapes par type ──────────────
const ETAPES_DATA = {
  'HYPOTHÈQUES': {
    intro: "Saisine du notaire par la banque pour la rédaction de l'acte notarié et la formalisation de l'hypothèque après signature par les parties.",
    duree: '6 MOIS MAX',
    steps: [
      "Réquisition d'immatriculation",
      "Complétude du dossier (à certifier par le notaire)",
      "Bornage contradictoire (OTR)",
      "Sécurisation foncière (OTR)",
      "Bureau d'étude (OTR)",
      "Bureau de création (OTR)",
      "Bureau de lecture (OTR)",
      "Titre Foncier (OTR)",
      "Inscription hypothécaire (OTR)",
      "Transmission du TF et du CIH par le notaire"
    ]
  },
  'CAUTIONNEMENT PERSONNEL': {
    intro: "Engagement d'une personne physique ou morale à rembourser la dette en cas de défaillance du débiteur principal.",
    steps: [
      "Signature de la convention",
      "Signature de l'acte SSP",
      "Établissement de l'acte notarié (si requis)",
      "Entrée en vigueur"
    ]
  },
  'GARANTIES AUTONOMES': {
    intro: "Garantie indépendante du contrat de base, payable à première demande.",
    steps: [
      "Signature de la convention",
      "Signature de l'acte SSP",
      "Entrée en vigueur"
    ]
  },
  'GAGE DE STOCKS': {
    intro: "Mise en gage de stocks de marchandises ou matières premières au profit du créancier.",
    steps: [
      "Signature de la convention",
      "Signature de l'acte SSP",
      "Annexion de la liste des stocks",
      "Enregistrement de l'acte ou réalisation de la prestation complète par le notaire",
      "Inscription du gage",
      "Formalités au RCCM",
      "Entrée en vigueur"
    ]
  },
  'GAGE AUTOMOBILE': {
    intro: "Mise en gage d'un véhicule automobile avec inscription sur la carte grise.",
    steps: [
      "Signature de la convention",
      "Signature de l'acte SSP",
      "Inscription du gage sur la carte grise",
      "Entrée en vigueur"
    ]
  },
  'NANTISSEMENT DE FONDS DE COMMERCE': {
    intro: "Nantissement portant sur les éléments incorporels et corporels du fonds de commerce.",
    steps: [
      "Signature de la convention",
      "Signature de l'acte SSP",
      "Annexion de la liste des éléments du fonds de commerce",
      "Enregistrement de l'acte ou réalisation de la prestation complète par le notaire",
      "Inscription du gage",
      "Formalités au RCCM",
      "Entrée en vigueur"
    ]
  },
  'NANTISSEMENT DE CRÉANCES': {
    intro: "Affectation de créances du débiteur en garantie du remboursement.",
    steps: [
      "Signature de la convention",
      "Signature de l'acte SSP",
      "Annexion de la liste des créances avec leurs caractéristiques",
      "Enregistrement de l'acte ou réalisation de la prestation complète par le notaire",
      "Inscription du nantissement",
      "Formalités au RCCM",
      "Entrée en vigueur"
    ]
  },
  'NANTISSEMENT DE COMPTE': {
    intro: "Nantissement portant sur un compte bancaire ou d'épargne.",
    steps: [
      "Signature de la convention",
      "Signature de l'acte SSP",
      "Enregistrement de l'acte ou réalisation de la prestation complète par le notaire",
      "Inscription du nantissement",
      "Formalités au RCCM",
      "Entrée en vigueur"
    ]
  },
  'NANTISSEMENT DE MATERIELS': {
    intro: "Mise en nantissement de matériels et équipements industriels.",
    steps: [
      "Signature de la convention",
      "Signature de l'acte SSP",
      "Annexion de la liste des matériels avec leurs caractéristiques",
      "Inscription du nantissement",
      "Formalités au RCCM",
      "Entrée en vigueur"
    ]
  },
  'NANTISSEMENT DE PARTS SOCIALES': {
    intro: "Nantissement portant sur les parts sociales ou actions d'une société.",
    steps: [
      "Signature de la convention",
      "Signature de l'acte SSP",
      "Annexion des certificats d'action",
      "Inscription du nantissement"
    ]
  },
  'HYPOTÈQUE CONVENTIONNELLE': {
    intro: "Hypothèque constituée par accord entre les parties, portant sur un bien immeuble.",
    steps: [
      "Signature de la convention",
      "Acte notarié de constitution",
      "Enregistrement de l'acte",
      "Publication foncière",
      "Inscription hypothécaire (OTR)",
      "Remise du CIH"
    ]
  },
  'HYPOTHÈQUE JUDICIAIRE': {
    intro: "Hypothèque résultant d'un jugement ou d'une ordonnance judiciaire.",
    steps: [
      "Obtention du titre exécutoire",
      "Signification au débiteur",
      "Publication foncière",
      "Inscription hypothécaire (OTR)",
      "Remise du CIH"
    ]
  }
};

// Catégories
const CATEGORIES = {
  'SÛRETÉS PERSONNELLES': ['CAUTIONNEMENT PERSONNEL', 'GARANTIES AUTONOMES'],
  'SÛRETÉS RÉELLES — MEUBLES': ['GAGE DE STOCKS','GAGE AUTOMOBILE','NANTISSEMENT DE FONDS DE COMMERCE','NANTISSEMENT DE CRÉANCES','NANTISSEMENT DE COMPTE','NANTISSEMENT DE MATERIELS','NANTISSEMENT DE PARTS SOCIALES'],
  'SÛRETÉS RÉELLES — IMMEUBLES': ['HYPOTÈQUE CONVENTIONNELLE','HYPOTHÈQUE JUDICIAIRE']
};

const PALETTE = ['#e8620a','#f97316','#fb923c','#c4500a','#3b5bdb','#087f5b','#c2255c','#862e9c','#1098ad','#2b8a3e','#a61e4d','#1971c2','#fdba74','#6741d9'];

// ── État global ───────────────────────────────────────
const TODAY = new Date(); TODAY.setHours(0,0,0,0);
let settings = { urgentDays: 30, warnDays: 90 };
let garanties = [];
let currentUser = null;
let _currentPage = 'dashboard';

let sortState = {
  echeances: { key: 'dateLimite', dir: 1 },
  garanties:  { key: 'dateLimite', dir: 1 }
};

let searchEch = '', searchAll = '';
let filterEchStatut = '', filterEchType = '', filterAllType = '', filterAllEtape = '';

let charts = {};

// ── Firebase Auth ─────────────────────────────────────
window.addEventListener('firebase-ready', () => {
  const footer = document.getElementById('login-footer-status');
  if(footer) footer.textContent = 'GarantiesTrack v1.0 · Sécurisé par Firebase';
  const btn = document.getElementById('btn-login');
  if(btn && btn.textContent === 'Chargement…') { btn.textContent='Se connecter'; btn.disabled=false; }

  window._firebaseOnAuthStateChanged(window._firebaseAuth, async user => {
    if(user){
      currentUser = user;
      document.getElementById('login-screen').style.display = 'none';
      document.getElementById('app-screen').style.display = '';
      await loadUserData();
      initApp();
      startClock();
    } else {
      currentUser = null;
      document.getElementById('login-screen').style.display = '';
      document.getElementById('app-screen').style.display = 'none';
    }
  });
});

async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pwd   = document.getElementById('login-password').value;
  const btn   = document.getElementById('btn-login');
  if(!email||!pwd){ showLoginError('Veuillez remplir tous les champs.'); return; }
  if(!window._firebaseSignIn){
    btn.textContent='Chargement…'; btn.disabled=true;
    await new Promise(r=>window.addEventListener('firebase-ready',r,{once:true}));
  }
  btn.textContent='Connexion…'; btn.disabled=true;
  try { await window._firebaseSignIn(window._firebaseAuth, email, pwd); }
  catch(err) {
    btn.textContent='Se connecter'; btn.disabled=false;
    const msgs = {
      'auth/user-not-found':'Aucun compte avec cet email.',
      'auth/wrong-password':'Mot de passe incorrect.',
      'auth/invalid-email':'Adresse email invalide.',
      'auth/too-many-requests':'Trop de tentatives. Réessayez plus tard.',
      'auth/invalid-credential':'Email ou mot de passe incorrect.'
    };
    showLoginError(msgs[err.code]||'Erreur : '+err.message);
  }
}
function showLoginError(msg){ const el=document.getElementById('login-error'); el.textContent=msg; el.style.display=''; }
async function doLogout(){ await window._firebaseSignOut(window._firebaseAuth); }
document.addEventListener('keydown', e=>{
  if(e.key==='Enter' && document.getElementById('login-screen').style.display!=='none'){
    const btn=document.getElementById('btn-login');
    if(!btn.disabled) doLogin();
  }
});

// ── Firestore ─────────────────────────────────────────
async function loadUserData() {
  if(!currentUser) return;
  const db=window._firebaseDb, uid=currentUser.uid;
  try {
    const snap = await window._firestoreGetDoc(window._firestoreDoc(db,'users',uid,'data','garanties'));
    if(snap.exists()){
      const d = snap.data();
      if(d.garanties) garanties = d.garanties;
      if(d.settings)  settings  = {...settings, ...d.settings};
    }
  } catch(err){ console.warn('Erreur chargement:',err); }
  const ui = document.getElementById('user-info');
  if(ui) ui.textContent = '👤 ' + (currentUser.email||'Utilisateur');
}

async function saveToFirestore() {
  if(!currentUser) return;
  const db=window._firebaseDb, uid=currentUser.uid;
  try {
    await window._firestoreSetDoc(
      window._firestoreDoc(db,'users',uid,'data','garanties'),
      { garanties, settings }, { merge:true }
    );
  } catch(err){ console.warn('Erreur sauvegarde:',err); }
}

// ── Init ──────────────────────────────────────────────
function initApp() {
  populateTypeFilters();
  renderEtapes();
  renderAll();
  scheduleAlerts();
}

function renderAll() {
  updateKPIs();
  renderDashboard();
  renderEcheances();
  renderGaranties();
  renderTypes();
  renderAnalyse();
  updateBadges();
  renderNotifications();
}

// ── Horloge ───────────────────────────────────────────
function startClock() {
  function tick(){
    const now=new Date();
    const el=document.getElementById('live-clock');
    if(el) el.textContent=now.toLocaleDateString('fr-FR')+' '+now.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }
  tick(); setInterval(tick,1000);
}

// ── Helpers dates ─────────────────────────────────────
function parseDate(val) {
  if(!val) return null;
  if(val instanceof Date) return isNaN(val)?null:val;
  if(typeof val==='string'){ const d=new Date(val); return isNaN(d)?null:d; }
  if(typeof val==='number'){ return new Date((val-25569)*86400000); }
  return null;
}
function formatDate(val) {
  const d=parseDate(val); if(!d) return val||'—';
  return d.toLocaleDateString('fr-FR');
}
function getDaysLeft(g) {
  if(!g.dateLimite) return null;
  const d=parseDate(g.dateLimite); if(!d) return null;
  return Math.ceil((d-TODAY)/86400000);
}
function getStatut(g) {
  const days=getDaysLeft(g);
  if(days===null) return 'none';
  if(days<0)                      return 'expire';
  if(days<=settings.urgentDays)  return 'urgent';
  if(days<=settings.warnDays)    return 'warn';
  return 'ok';
}
function statusLabel(statut) {
  return {
    urgent: ['⚠️ Urgent',    'status-urgent'],
    warn:   ['⏳ À surveiller','status-warn'],
    ok:     ['✅ Valide',     'status-ok'],
    expire: ['❌ Expirée',    'status-expire'],
    none:   ['ℹ️ Sans échéance','status-none'],
  }[statut]||['—',''];
}
function formatMontant(val) {
  if(!val) return '—';
  const n=Number(val); if(isNaN(n)) return val;
  return n.toLocaleString('fr-FR')+' FCFA';
}

// ── KPIs ──────────────────────────────────────────────
function updateKPIs() {
  const total   = garanties.length;
  const urgent  = garanties.filter(g=>getStatut(g)==='urgent').length;
  const warn    = garanties.filter(g=>getStatut(g)==='warn').length;
  const ok      = garanties.filter(g=>getStatut(g)==='ok').length;
  const expire  = garanties.filter(g=>getStatut(g)==='expire').length;

  setEl('kpi-total', total);
  setEl('kpi-urgent', urgent);
  setEl('kpi-warn', warn);
  setEl('kpi-ok', ok);
  setEl('kpi-expire', expire);

  const az=document.getElementById('alert-zone');
  let html='';
  if(urgent>0) html+=`<div class="alert-banner alert-danger">⚠️ ${urgent} garantie(s) expirant dans les ${settings.urgentDays} prochains jours — Action immédiate requise!</div>`;
  if(expire>0) html+=`<div class="alert-banner alert-warning">📋 ${expire} garantie(s) expirée(s) à renouveler.</div>`;
  if(!urgent&&!expire&&total>0) html+=`<div class="alert-banner alert-success">✅ Toutes vos garanties sont en bon état.</div>`;
  if(total===0) html+=`<div class="alert-banner alert-warning">ℹ️ Aucune garantie enregistrée. Importez un fichier Excel ou ajoutez-en une manuellement.</div>`;
  if(az) az.innerHTML=html;
}

function updateBadges() {
  const urgEch = garanties.filter(g=>['urgent','warn','expire'].includes(getStatut(g))).length;
  setEl('tb-dash', garanties.length);
  setEl('tb-ech', urgEch);
  setEl('tb-all', garanties.length);
  const badge=document.getElementById('notif-badge');
  if(badge){
    const u=garanties.filter(g=>getStatut(g)==='urgent').length;
    if(u>0){badge.textContent=u;badge.style.display='';}else badge.style.display='none';
  }
}

function setEl(id,val){ const el=document.getElementById(id); if(el) el.textContent=val; }

// ── Dashboard ─────────────────────────────────────────
function renderDashboard() {
  const container=document.getElementById('dash-urgent-cards');
  if(!container) return;

  const urgent=garanties
    .filter(g=>getStatut(g)==='urgent')
    .sort((a,b)=>(parseDate(a.dateLimite)||0)-(parseDate(b.dateLimite)||0))
    .slice(0,6);

  if(urgent.length===0){
    container.innerHTML='<div class="empty"><div class="e-ico">✅</div><h3>Aucune urgence</h3><p>Aucune garantie n\'expire dans les '+settings.urgentDays+' prochains jours.</p></div>';
  } else {
    container.innerHTML=urgent.map(g=>gCard(g)).join('');
  }
  renderChartTypesDash();
}

function gCard(g) {
  const statut=getStatut(g);
  const days=getDaysLeft(g);
  const [slabel]=statusLabel(statut);
  let daysText='';
  if(days!==null){
    if(days<0) daysText=`Expirée il y a ${Math.abs(days)}j`;
    else if(days===0) daysText='Expire aujourd\'hui!';
    else daysText=`Dans ${days} jour${days>1?'s':''}`;
  }
  return `<div class="g-card card-${statut}" onclick="showDetail(${JSON.stringify(g).replace(/"/g,'&quot;')})">
    <div class="card-header">
      <span class="card-type">${g.typeGarantie||'—'}</span>
      <span class="card-badge badge-${statut}">${slabel}</span>
    </div>
    <div class="card-debiteur">${g.debiteur||'—'}</div>
    <div class="card-row"><span>Montant garanti</span><span>${formatMontant(g.montantGaranti)}</span></div>
    <div class="card-row"><span>Responsable</span><span>${g.responsable||'—'}</span></div>
    <div class="card-row"><span>Étape en cours</span><span>${g.etapes||'—'}</span></div>
    <div class="card-footer">
      <span>📅 Limite : ${formatDate(g.dateLimite)}</span>
      <span style="font-weight:700;color:var(--${statut==='urgent'?'urgent':statut==='warn'?'warn':statut==='ok'?'ok':'text2'})">${daysText}</span>
    </div>
  </div>`;
}

// ── Table Échéances ───────────────────────────────────
function renderEcheances() {
  const tbody=document.getElementById('tbody-echeances');
  if(!tbody) return;
  let data=[...garanties].filter(g=>{
    const q=searchEch.toLowerCase();
    if(q&&!(`${g.typeGarantie} ${g.debiteur} ${g.references} ${g.tiers}`).toLowerCase().includes(q)) return false;
    if(filterEchStatut&&getStatut(g)!==filterEchStatut) return false;
    if(filterEchType&&g.typeGarantie!==filterEchType) return false;
    // Seules les garanties avec échéance ou expirées
    const s=getStatut(g);
    if(!filterEchStatut&&s==='none') return false;
    return true;
  });
  const sk=sortState.echeances;
  data.sort((a,b)=>{
    let va=a[sk.key]||'', vb=b[sk.key]||'';
    if(['dateLimite','dateInscription','dateConvention'].includes(sk.key)){ va=parseDate(va)||0; vb=parseDate(vb)||0; }
    else if(['montantCreance','montantGaranti'].includes(sk.key)){ va=Number(va)||0; vb=Number(vb)||0; }
    return va<vb?-sk.dir:va>vb?sk.dir:0;
  });
  const empty=document.getElementById('echeances-empty');
  if(data.length===0){ tbody.innerHTML=''; if(empty)empty.style.display=''; return; }
  if(empty)empty.style.display='none';
  tbody.innerHTML=data.map(g=>{
    const s=getStatut(g); const[sl,sc]=statusLabel(s);
    return `<tr onclick="showDetail(${JSON.stringify(g).replace(/"/g,'&quot;')})">
      <td class="td-type">${g.typeGarantie||'—'}</td>
      <td class="td-debiteur">${g.debiteur||'—'}</td>
      <td class="td-montant">${formatMontant(g.montantGaranti)}</td>
      <td>${formatDate(g.dateInscription)}</td>
      <td>${formatDate(g.dateLimite)}</td>
      <td>${g.dureeValidite||'—'}</td>
      <td><span class="status-badge ${sc}">${sl}</span></td>
      <td>
        <button class="btn-action" title="Voir" onclick="event.stopPropagation();showDetail(${JSON.stringify(g).replace(/"/g,'&quot;')})">👁️</button>
        <button class="btn-action" title="Modifier" onclick="event.stopPropagation();editGarantie(${JSON.stringify(g).replace(/"/g,'&quot;')})">✏️</button>
      </td>
    </tr>`;
  }).join('');
}

function filterEcheances() {
  searchEch=document.getElementById('search-ech')?.value||'';
  filterEchStatut=document.getElementById('filter-ech-statut')?.value||'';
  filterEchType=document.getElementById('filter-ech-type')?.value||'';
  renderEcheances();
}

// ── Table Toutes Garanties ────────────────────────────
function renderGaranties() {
  const tbody=document.getElementById('tbody-garanties');
  if(!tbody) return;
  let data=[...garanties].filter(g=>{
    const q=searchAll.toLowerCase();
    if(q&&!(`${g.typeGarantie} ${g.debiteur} ${g.tiers} ${g.references} ${g.responsable} ${g.caract}`).toLowerCase().includes(q)) return false;
    if(filterAllType&&g.typeGarantie!==filterAllType) return false;
    if(filterAllEtape&&g.etapes!==filterAllEtape) return false;
    return true;
  });
  const sk=sortState.garanties;
  data.sort((a,b)=>{
    let va=a[sk.key]||'', vb=b[sk.key]||'';
    if(['dateLimite','dateInscription','dateConvention','dateSaisine','debutForm','dateSaisie'].includes(sk.key)){ va=parseDate(va)||0; vb=parseDate(vb)||0; }
    else if(['montantCreance','montantGaranti'].includes(sk.key)){ va=Number(va)||0; vb=Number(vb)||0; }
    return va<vb?-sk.dir:va>vb?sk.dir:0;
  });
  const empty=document.getElementById('garanties-empty');
  if(data.length===0){ tbody.innerHTML=''; if(empty)empty.style.display=''; return; }
  if(empty)empty.style.display='none';
  tbody.innerHTML=data.map((g,i)=>{
    const s=getStatut(g); const[sl,sc]=statusLabel(s);
    return `<tr onclick="showDetail(${JSON.stringify(g).replace(/"/g,'&quot;')})">
      <td class="td-type" style="min-width:160px">${g.typeGarantie||'—'}</td>
      <td>${formatDate(g.dateConvention)}</td>
      <td class="td-debiteur">${g.debiteur||'—'}</td>
      <td>${g.tiers||'—'}</td>
      <td class="td-wrap" style="min-width:140px;max-width:180px">${g.caract||'—'}</td>
      <td class="td-montant">${formatMontant(g.montantCreance)}</td>
      <td class="td-montant">${formatMontant(g.montantGaranti)}</td>
      <td>${g.responsable||'—'}</td>
      <td>${formatDate(g.dateSaisine)}</td>
      <td>${formatDate(g.debutForm)}</td>
      <td>${g.etapes||'—'}</td>
      <td>${g.relances||'—'}</td>
      <td>${formatDate(g.dateInscription)}</td>
      <td>${g.references||'—'}</td>
      <td>${formatDate(g.dateSaisie)}</td>
      <td>${g.dureeValidite||'—'}</td>
      <td>${formatDate(g.dateLimite)}</td>
      <td><span class="status-badge ${sc}">${sl}</span></td>
      <td>
        <button class="btn-action" title="Modifier" onclick="event.stopPropagation();editGarantie(${JSON.stringify(g).replace(/"/g,'&quot;')})">✏️</button>
        <button class="btn-action" title="Supprimer" onclick="event.stopPropagation();deleteGarantie(${i})">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

function filterGaranties() {
  searchAll=document.getElementById('search-all')?.value||'';
  filterAllType=document.getElementById('filter-all-type')?.value||'';
  filterAllEtape=document.getElementById('filter-all-etape')?.value||'';
  renderGaranties();
}

function sortTable(table, key) {
  const s=sortState[table];
  if(s.key===key) s.dir*=-1; else { s.key=key; s.dir=1; }
  if(table==='echeances') renderEcheances();
  else renderGaranties();
}

// ── Répartition par type ──────────────────────────────
function renderTypes() {
  const container=document.getElementById('types-grid');
  if(!container) return;
  const counts={};
  garanties.forEach(g=>{
    const t=g.typeGarantie||'Non défini';
    if(!counts[t]) counts[t]={total:0,urgent:0,warn:0,ok:0,expire:0,none:0};
    counts[t].total++; counts[t][getStatut(g)]++;
  });
  if(Object.keys(counts).length===0){
    container.innerHTML='<div class="empty"><div class="e-ico">🗂️</div><h3>Aucune donnée</h3></div>';
    return;
  }
  const sorted=Object.entries(counts).sort((a,b)=>b[1].total-a[1].total);
  container.innerHTML=sorted.map(([type,c],i)=>`
    <div class="type-card" style="border-left-color:${PALETTE[i%PALETTE.length]}">
      <div class="type-name">${type}</div>
      <div class="type-count">${c.total}</div>
      <div class="type-label">garantie${c.total>1?'s':''}</div>
      <div class="type-breakdown">
        ${c.urgent?`<span class="type-chip badge-urgent">⚠️ ${c.urgent} urgent${c.urgent>1?'s':''}</span>`:''}
        ${c.warn?`<span class="type-chip badge-warn">⏳ ${c.warn}</span>`:''}
        ${c.ok?`<span class="type-chip badge-ok">✅ ${c.ok}</span>`:''}
        ${c.expire?`<span class="type-chip badge-expire">❌ ${c.expire}</span>`:''}
      </div>
    </div>
  `).join('');
}

// ── Étapes d'inscription ──────────────────────────────
function renderEtapes() {
  const container=document.getElementById('etapes-container');
  if(!container) return;
  container.innerHTML=Object.entries(ETAPES_DATA).map(([type,data])=>`
    <div class="etape-section">
      <div class="etape-header" onclick="toggleEtape(this)">
        <div class="etape-title">🔖 ${type}</div>
        <span class="etape-toggle">▼</span>
      </div>
      <div class="etape-body" style="display:none">
        <p style="font-size:.83rem;color:var(--text2);margin-top:.8rem">${data.intro||''}</p>
        ${data.duree?`<div class="etape-duree">⏱️ Durée estimée : ${data.duree}</div>`:''}
        <div class="etape-steps">
          ${data.steps.map((s,i)=>`
            <div class="etape-step">
              <span class="step-num">${i+1}</span>
              <span class="etape-step-text">${s}</span>
            </div>
          `).join('')}
        </div>
      </div>
    </div>
  `).join('');
}

function toggleEtape(header) {
  const body=header.nextElementSibling;
  const toggle=header.querySelector('.etape-toggle');
  const open=body.style.display==='none';
  body.style.display=open?'':'none';
  toggle.style.transform=open?'rotate(180deg)':'';
}

// ── Graphiques ────────────────────────────────────────
function renderChartTypesDash() {
  const canvas=document.getElementById('chart-types-dash');
  if(!canvas) return;
  const counts={}; garanties.forEach(g=>{ const t=g.typeGarantie||'Autre'; counts[t]=(counts[t]||0)+1; });
  const sorted=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8);
  if(charts['dash']) charts['dash'].destroy();
  charts['dash']=new Chart(canvas,{
    type:'doughnut',
    data:{labels:sorted.map(([k])=>k),datasets:[{data:sorted.map(([,v])=>v),backgroundColor:PALETTE,borderWidth:2}]},
    options:{responsive:true,maintainAspectRatio:true,plugins:{legend:{position:'bottom',labels:{font:{size:10}}}}}
  });
}

function renderAnalyse() {
  renderChartTypes();
  renderChartStatuts();
  renderChartMontants();
  renderChartEtapesProg();
}

function renderChartTypes() {
  const canvas=document.getElementById('chart-types');
  if(!canvas) return;
  const counts={}; garanties.forEach(g=>{ const t=g.typeGarantie||'Autre'; counts[t]=(counts[t]||0)+1; });
  const sorted=Object.entries(counts).sort((a,b)=>b[1]-a[1]);
  if(charts['types']) charts['types'].destroy();
  charts['types']=new Chart(canvas,{
    type:'bar',
    data:{labels:sorted.map(([k])=>k.length>22?k.substring(0,20)+'…':k),datasets:[{label:'Nb',data:sorted.map(([,v])=>v),backgroundColor:PALETTE,borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:true,plugins:{legend:{display:false}},scales:{x:{ticks:{font:{size:9}}},y:{beginAtZero:true}}}
  });
}

function renderChartStatuts() {
  const canvas=document.getElementById('chart-statuts');
  if(!canvas) return;
  const counts={urgent:0,warn:0,ok:0,expire:0,none:0};
  garanties.forEach(g=>counts[getStatut(g)]++);
  if(charts['statuts']) charts['statuts'].destroy();
  charts['statuts']=new Chart(canvas,{
    type:'pie',
    data:{
      labels:['Urgentes','À surveiller','Valides','Expirées','Sans échéance'],
      datasets:[{data:[counts.urgent,counts.warn,counts.ok,counts.expire,counts.none],
        backgroundColor:['#dc2626','#d97706','#16a34a','#9ca3af','#3b5bdb'],borderWidth:2}]
    },
    options:{responsive:true,maintainAspectRatio:true,plugins:{legend:{position:'bottom',labels:{font:{size:10}}}}}
  });
}

function renderChartMontants() {
  const canvas=document.getElementById('chart-montants');
  if(!canvas) return;
  const sums={}; garanties.forEach(g=>{ const t=g.typeGarantie||'Autre'; sums[t]=(sums[t]||0)+(Number(g.montantGaranti)||0); });
  const sorted=Object.entries(sums).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,8);
  if(!sorted.length){ if(charts['montants']) charts['montants'].destroy(); return; }
  if(charts['montants']) charts['montants'].destroy();
  charts['montants']=new Chart(canvas,{
    type:'bar',
    data:{labels:sorted.map(([k])=>k.length>20?k.substring(0,18)+'…':k),datasets:[{label:'Montant garanti',data:sorted.map(([,v])=>v),backgroundColor:PALETTE,borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:true,plugins:{legend:{display:false}},scales:{x:{ticks:{font:{size:9}}},y:{beginAtZero:true,ticks:{callback:v=>v>=1e6?v/1e6+'M':v>=1e3?v/1e3+'K':v}}}}
  });
}

function renderChartEtapesProg() {
  const canvas=document.getElementById('chart-etapes-prog');
  if(!canvas) return;
  const counts={}; garanties.forEach(g=>{ const e=g.etapes||'Non défini'; counts[e]=(counts[e]||0)+1; });
  const sorted=Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,7);
  if(charts['etapesProg']) charts['etapesProg'].destroy();
  charts['etapesProg']=new Chart(canvas,{
    type:'horizontalBar'||'bar',
    data:{labels:sorted.map(([k])=>k.length>25?k.substring(0,23)+'…':k),datasets:[{label:'Nb garanties',data:sorted.map(([,v])=>v),backgroundColor:PALETTE,borderRadius:4}]},
    options:{responsive:true,maintainAspectRatio:true,indexAxis:'y',plugins:{legend:{display:false}},scales:{x:{beginAtZero:true},y:{ticks:{font:{size:9}}}}}
  });
}

// ── Notifications / Alertes ────────────────────────────
function toggleNotifPanel() {
  const panel=document.getElementById('notif-panel');
  if(panel) panel.style.display=panel.style.display==='none'?'':'none';
}

function renderNotifications() {
  const list=document.getElementById('notif-list');
  if(!list) return;
  const urgent=garanties.filter(g=>getStatut(g)==='urgent')
    .sort((a,b)=>(parseDate(a.dateLimite)||0)-(parseDate(b.dateLimite)||0));
  if(!urgent.length){
    list.innerHTML='<div class="notif-item" style="color:rgba(255,255,255,.4)">Aucune alerte active</div>';
  } else {
    list.innerHTML=urgent.slice(0,10).map(g=>{
      const d=getDaysLeft(g);
      return `<div class="notif-item">⚠️ <strong>${g.debiteur||'—'}</strong> [${g.typeGarantie||'—'}]<br><small>${d===0?'Expire aujourd\'hui':d===1?'Demain':`Dans ${d} jours`} — ${formatDate(g.dateLimite)}</small></div>`;
    }).join('');
  }
  const badge=document.getElementById('notif-badge');
  if(badge){
    if(urgent.length>0){badge.textContent=urgent.length;badge.style.display='';}
    else badge.style.display='none';
  }
}

function scheduleAlerts() {
  checkAlerts(); setInterval(checkAlerts,3600000);
}

function checkAlerts() {
  const urgent=garanties.filter(g=>{ const d=getDaysLeft(g); return d!==null&&d>=0&&d<=settings.urgentDays; });
  if(urgent.length>0&&Notification.permission==='granted'){
    new Notification('GarantiesTrack',{body:`⚠️ ${urgent.length} garantie(s) expirent dans ${settings.urgentDays} jours.`});
  }
  if(Notification.permission==='default') Notification.requestPermission();
}

// ── Import Excel ──────────────────────────────────────
function importExcel(input) {
  const file=input.files[0]; if(!file) return;
  const status=document.getElementById('import-status');
  if(status) status.textContent='⏳ Lecture du fichier…';
  const reader=new FileReader();
  reader.onload=e=>{
    try {
      const wb=XLSX.read(e.target.result,{type:'array',cellDates:true});
      let imported=0;

      // Feuille TABLEAU
      const sheetName=wb.SheetNames.find(s=>s.includes('TABLEAU'))||wb.SheetNames[1];
      if(sheetName){
        const ws=wb.Sheets[sheetName];
        const rows=XLSX.utils.sheet_to_json(ws,{defval:null,raw:false});
        rows.forEach(r=>{
          const type=r['TYPES DE GARANTIE'];
          // Ignorer les lignes catégorie ou vides
          if(!type||['SÛRETÉS PERSONNELLES','SÛRETÉS RÉELLES'].includes(type)) return;
          const g={
            typeGarantie:    type,
            dateConvention:  r['DATE DE LA CONVENTION'],
            debiteur:        r['DÉBITEUR PRINCIPAL']||r['DEBITEUR PRINCIPAL'],
            tiers:           r['TIERS CONSTITUANT'],
            caract:          r['CARACTERISITIQUES DE LA GARANTIE']||r['CARACTERISTIQUES DE LA GARANTIE'],
            montantCreance:  r['MONTANT DE LA CREANCE']||r['MONTANT DE LA CRÉANCE'],
            montantGaranti:  r['MONTANT GARANTI'],
            responsable:     r['RESPONSABLE DES FORMALITES']||r['RESPONSABLE DES FORMALITÉS'],
            dateSaisine:     r['DATE DE SAISINE DU PRESTATAIRE'],
            debutForm:       r['DEBUT DES FORMALITES']||r['DÉBUT DES FORMALITÉS'],
            etapes:          r['ETAPES DES FORMALITES']||r['ÉTAPES DES FORMALITÉS'],
            relances:        r['RELANCES DU PRESTATAIRE'],
            dateInscription: r["DATE D'INSCRIPTION DE LA GARANTIE"],
            references:      r['REFERENCES DE LA GARANTIE']||r['RÉFÉRENCES DE LA GARANTIE'],
            dateSaisie:      r['DATE DE SAISIE DE LA GARANTIE'],
            dureeValidite:   r['DUREE DE VALIDITE']||r['DURÉE DE VALIDITÉ'],
            dateLimite:      r['DATE LIMITE DE VALIDITE']||r['DATE LIMITE DE VALIDITÉ'],
          };
          if(g.debiteur||g.references) { garanties.push(g); imported++; }
        });
      }

      if(status) status.textContent=`✅ ${imported} garantie(s) importée(s) depuis le fichier Excel.`;
      showToast(`✅ ${imported} garanties importées`);
      populateTypeFilters();
      saveToFirestore();
      renderAll();
    } catch(err) {
      console.error(err);
      if(status) status.textContent='❌ Erreur lors de la lecture.';
      showToast('❌ Erreur import: '+err.message);
    }
  };
  reader.readAsArrayBuffer(file);
  input.value='';
}

// ── Filtres dynamiques ────────────────────────────────
function populateTypeFilters() {
  const types=[...new Set(garanties.map(g=>g.typeGarantie).filter(Boolean))].sort();
  const etapesUniq=[...new Set(garanties.map(g=>g.etapes).filter(Boolean))].sort();
  ['filter-ech-type','filter-all-type'].forEach(id=>{
    const sel=document.getElementById(id);
    if(!sel) return;
    const val=sel.value;
    while(sel.options.length>1) sel.remove(1);
    types.forEach(t=>sel.add(new Option(t,t)));
    sel.value=val;
  });
  const selEtape=document.getElementById('filter-all-etape');
  if(selEtape){
    while(selEtape.options.length>1) selEtape.remove(1);
    etapesUniq.forEach(e=>selEtape.add(new Option(e,e)));
  }
}

// ── Export ────────────────────────────────────────────
function exportData() {
  const data={garanties,settings,exportDate:new Date().toISOString()};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=`garanties-export-${new Date().toISOString().split('T')[0]}.json`; a.click();
  showToast('⬇️ Export téléchargé');
}

// ── Modal Ajout / Édition ─────────────────────────────
let _editIdx=null;

function openAddModal() {
  _editIdx=null;
  document.getElementById('modal-title').textContent='Nouvelle garantie';
  document.getElementById('modal-edit-idx').value='';
  clearModalFields();
  document.getElementById('modal-overlay').style.display='flex';
}

function editGarantie(g) {
  _editIdx=garanties.findIndex(x=>x.debiteur===g.debiteur&&x.typeGarantie===g.typeGarantie&&x.references===g.references);
  document.getElementById('modal-title').textContent='Modifier la garantie';
  document.getElementById('m-type').value=g.typeGarantie||'';
  document.getElementById('m-date-convention').value=toDateInput(g.dateConvention);
  document.getElementById('m-date-saisine').value=toDateInput(g.dateSaisine);
  document.getElementById('m-debiteur').value=g.debiteur||'';
  document.getElementById('m-tiers').value=g.tiers||'';
  document.getElementById('m-caract').value=g.caract||'';
  document.getElementById('m-montant-creance').value=g.montantCreance||'';
  document.getElementById('m-montant-garanti').value=g.montantGaranti||'';
  document.getElementById('m-responsable').value=g.responsable||'';
  document.getElementById('m-debut-form').value=toDateInput(g.debutForm);
  document.getElementById('m-etapes').value=g.etapes||'';
  document.getElementById('m-relances').value=g.relances||'';
  document.getElementById('m-date-inscription').value=toDateInput(g.dateInscription);
  document.getElementById('m-references').value=g.references||'';
  document.getElementById('m-date-saisie').value=toDateInput(g.dateSaisie);
  document.getElementById('m-duree').value=g.dureeValidite||'';
  document.getElementById('m-date-limite').value=toDateInput(g.dateLimite);
  document.getElementById('modal-overlay').style.display='flex';
}

function clearModalFields() {
  ['m-type','m-debiteur','m-tiers','m-caract','m-responsable','m-relances','m-references','m-duree'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  ['m-date-convention','m-date-saisine','m-debut-form','m-date-inscription','m-date-saisie','m-date-limite'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  ['m-montant-creance','m-montant-garanti'].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=''; });
}

function toDateInput(val) {
  const d=parseDate(val); if(!d) return '';
  return d.toISOString().split('T')[0];
}

function saveGarantie() {
  const type=document.getElementById('m-type').value;
  const debiteur=document.getElementById('m-debiteur').value.trim();
  if(!type){ showToast('❌ Le type de garantie est requis.'); return; }
  if(!debiteur){ showToast('❌ Le débiteur principal est requis.'); return; }

  const g={
    typeGarantie:   type,
    dateConvention: document.getElementById('m-date-convention').value||null,
    debiteur:       debiteur,
    tiers:          document.getElementById('m-tiers').value.trim()||null,
    caract:         document.getElementById('m-caract').value.trim()||null,
    montantCreance: document.getElementById('m-montant-creance').value||null,
    montantGaranti: document.getElementById('m-montant-garanti').value||null,
    responsable:    document.getElementById('m-responsable').value.trim()||null,
    dateSaisine:    document.getElementById('m-date-saisine').value||null,
    debutForm:      document.getElementById('m-debut-form').value||null,
    etapes:         document.getElementById('m-etapes').value||null,
    relances:       document.getElementById('m-relances').value.trim()||null,
    dateInscription:document.getElementById('m-date-inscription').value||null,
    references:     document.getElementById('m-references').value.trim()||null,
    dateSaisie:     document.getElementById('m-date-saisie').value||null,
    dureeValidite:  document.getElementById('m-duree').value.trim()||null,
    dateLimite:     document.getElementById('m-date-limite').value||null,
  };

  if(_editIdx!==null&&_editIdx>=0){ garanties[_editIdx]=g; showToast('✅ Garantie modifiée'); }
  else { garanties.push(g); showToast('✅ Garantie ajoutée'); }

  closeModal(); populateTypeFilters(); saveToFirestore(); renderAll();
}

function deleteGarantie(idx) {
  if(!confirm('Supprimer cette garantie ?')) return;
  garanties.splice(idx,1);
  saveToFirestore(); renderAll(); showToast('🗑️ Garantie supprimée');
}

function closeModal() { document.getElementById('modal-overlay').style.display='none'; }

// ── Modal Détail ──────────────────────────────────────
function showDetail(g) {
  document.getElementById('detail-title').textContent=`${g.typeGarantie||'Garantie'} — ${g.debiteur||'—'}`;
  const s=getStatut(g); const[sl]=statusLabel(s);
  const days=getDaysLeft(g);
  let daysText='';
  if(days!==null){ if(days<0)daysText=`Expirée il y a ${Math.abs(days)}j`; else if(days===0)daysText='Expire aujourd\'hui!'; else daysText=`Dans ${days} jour${days>1?'s':''}`; }

  const fields=[
    ['Type de garantie',g.typeGarantie],
    ['Débiteur principal',g.debiteur],
    ['Tiers constituant',g.tiers],
    ['Caractéristiques',g.caract],
    ['Date de la convention',formatDate(g.dateConvention)],
    ['Montant de la créance',formatMontant(g.montantCreance)],
    ['Montant garanti',formatMontant(g.montantGaranti)],
    ['Responsable des formalités',g.responsable],
    ['Date de saisine du prestataire',formatDate(g.dateSaisine)],
    ['Début des formalités',formatDate(g.debutForm)],
    ['Étapes des formalités',g.etapes],
    ['Relances prestataire',g.relances],
    ["Date d'inscription",formatDate(g.dateInscription)],
    ['Références',g.references],
    ['Date de saisie',formatDate(g.dateSaisie)],
    ['Durée de validité',g.dureeValidite],
    ['Date limite de validité',formatDate(g.dateLimite)],
    ['Statut',`${sl}${daysText?' — '+daysText:''}`],
  ].filter(([,v])=>v&&v!=='—'&&v!=='—');

  document.getElementById('detail-body').innerHTML=fields.map(([label,val])=>
    `<div class="detail-field"><span class="df-label">${label}</span><span class="df-value">${val}</span></div>`
  ).join('');
  document.getElementById('detail-edit-btn').onclick=()=>{ closeDetail(); editGarantie(g); };
  document.getElementById('detail-overlay').style.display='flex';
}
function closeDetail(){ document.getElementById('detail-overlay').style.display='none'; }

// ── Navigation ────────────────────────────────────────
function goPage(page,btn) {
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.main-tab').forEach(t=>t.classList.remove('active'));
  const pg=document.getElementById('page-'+page);
  if(pg){ pg.classList.add('active'); pg.classList.remove('fade-up'); void pg.offsetWidth; pg.classList.add('fade-up'); }
  if(btn) btn.classList.add('active');
  _currentPage=page;
  if(page==='analyse') setTimeout(renderAnalyse,50);
}
function goPageById(page){ goPage(page,document.querySelector(`[data-page="${page}"]`)); }

// ── Paramètres ────────────────────────────────────────
function saveSettings() {
  settings.urgentDays=parseInt(document.getElementById('set-urgent')?.value)||30;
  settings.warnDays=parseInt(document.getElementById('set-warn')?.value)||90;
  saveToFirestore(); renderAll(); showToast('✅ Paramètres enregistrés');
}

// ── Toast ─────────────────────────────────────────────
function showToast(msg,duration=3000) {
  const t=document.createElement('div'); t.className='toast'; t.textContent=msg;
  document.body.appendChild(t); setTimeout(()=>t.remove(),duration);
}

// ── Service Worker ────────────────────────────────────
if('serviceWorker' in navigator){ navigator.serviceWorker.register('./sw.js').catch(()=>{}); }

// Fermer notif panel au clic extérieur
document.addEventListener('click',e=>{
  const panel=document.getElementById('notif-panel');
  const btn=document.getElementById('notif-bell-btn');
  if(panel&&!panel.contains(e.target)&&btn&&!btn.contains(e.target)) panel.style.display='none';
});
