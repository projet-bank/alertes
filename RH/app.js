/* ═══════════════════════════════════════════════════════
   RH Dashboard — app.js
   Firebase · Excel · Charts · Gestion RH
═══════════════════════════════════════════════════════ */
'use strict';

// ── État global ───────────────────────────────────────
const TODAY = new Date(); TODAY.setHours(0,0,0,0);
let settings = { urgentDays: 30, warnDays: 90 };
let employees = [];        // Tous les employés (Feuil1)
let cadres    = [];        // Cadres (Feuil4)
let comptables= [];        // Comptabilité (Feuil2)
let divers    = [];        // Feuil3
let avecMat   = [];        // Avec Matricule (contrats)
let sansMat   = [];        // Sans Matricule
let notifications = [];
let currentUser = null;
let _currentPage = 'dashboard';

// Filtres et tri
let contratSort = { key: 'echeance', dir: 1 };
let employeSort = { key: 'nom', dir: 1 };
let searchContrats = '', searchEmployes = '', searchCadres = '';
let filterContratStatut = '', filterSexe = '', filterContratType = '';

// Palettes de couleurs pour graphiques
const PALETTE = [
  '#e8620a','#f97316','#fb923c','#fdba74','#c4500a',
  '#3b5bdb','#087f5b','#c2255c','#862e9c','#1098ad',
  '#2b8a3e','#a61e4d','#364fc7','#2f9e44','#1971c2'
];

// ── Firebase Auth ─────────────────────────────────────
window.addEventListener('firebase-ready', () => {
  const footer = document.getElementById('login-footer-status');
  if(footer) footer.textContent = 'RH Dashboard v1.0 · Sécurisé par Firebase';
  const btn = document.getElementById('btn-login');
  if(btn && btn.textContent === 'Chargement…') {
    btn.textContent = 'Se connecter'; btn.disabled = false;
  }
  window._firebaseOnAuthStateChanged(window._firebaseAuth, async (user) => {
    if (user) {
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
  if(!window._firebaseSignIn || !window._firebaseAuth){
    btn.textContent='Chargement…'; btn.disabled=true;
    await new Promise(r => window.addEventListener('firebase-ready', r, {once:true}));
  }
  btn.textContent='Connexion…'; btn.disabled=true;
  try {
    await window._firebaseSignIn(window._firebaseAuth, email, pwd);
  } catch(err) {
    btn.textContent='Se connecter'; btn.disabled=false;
    const msgs = {
      'auth/user-not-found':    'Aucun compte avec cet email.',
      'auth/wrong-password':    'Mot de passe incorrect.',
      'auth/invalid-email':     'Adresse email invalide.',
      'auth/too-many-requests': 'Trop de tentatives. Réessayez plus tard.',
      'auth/invalid-credential':'Email ou mot de passe incorrect.'
    };
    showLoginError(msgs[err.code] || 'Erreur : ' + err.message);
  }
}

function showLoginError(msg) {
  const el = document.getElementById('login-error');
  el.textContent = msg; el.style.display = '';
}

async function doLogout() { await window._firebaseSignOut(window._firebaseAuth); }

document.addEventListener('keydown', e => {
  if(e.key==='Enter' && document.getElementById('login-screen').style.display!=='none'){
    const btn = document.getElementById('btn-login');
    if(!btn.disabled) doLogin();
  }
});

// ── Firestore ─────────────────────────────────────────
async function loadUserData() {
  if(!currentUser) return;
  const db = window._firebaseDb, uid = currentUser.uid;
  try {
    const sDoc = await window._firestoreGetDoc(
      window._firestoreDoc(db, 'users', uid, 'data', 'settings')
    );
    if(sDoc.exists()){
      const d = sDoc.data();
      if(d.settings)  settings   = {...settings, ...d.settings};
      if(d.employees) employees  = d.employees;
      if(d.cadres)    cadres     = d.cadres;
      if(d.comptables)comptables = d.comptables;
      if(d.divers)    divers     = d.divers;
      if(d.avecMat)   avecMat   = d.avecMat;
      if(d.notifications) notifications = d.notifications;
    }
  } catch(err){ console.warn('Erreur chargement:', err); }
  // User info
  const ui = document.getElementById('user-info');
  if(ui) ui.textContent = '👤 ' + (currentUser.email || 'Utilisateur');
}

async function saveToFirestore() {
  if(!currentUser) return;
  const db = window._firebaseDb, uid = currentUser.uid;
  try {
    await window._firestoreSetDoc(
      window._firestoreDoc(db, 'users', uid, 'data', 'settings'),
      { settings, employees, cadres, comptables, divers, avecMat, notifications },
      { merge: true }
    );
  } catch(err){ console.warn('Erreur sauvegarde:', err); }
}

// ── Initialisation ───────────────────────────────────
function initApp() {
  renderAll();
  scheduleAlertCheck();
}

function renderAll() {
  updateKPIs();
  renderDashCards();
  renderContrats();
  renderEmployes();
  renderCadres();
  renderProjets();
  renderAnalyse();
  updateBadges();
  renderNotifications();
}

// ── Horloge ───────────────────────────────────────────
function startClock() {
  function tick(){
    const now = new Date();
    const el = document.getElementById('live-clock');
    if(el) el.textContent = now.toLocaleDateString('fr-FR') + ' ' +
      now.toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit', second:'2-digit'});
  }
  tick(); setInterval(tick, 1000);
}

// ── KPIs ──────────────────────────────────────────────
function updateKPIs() {
  const allEmp = getAllContrats();
  const urgent  = allEmp.filter(e => getStatut(e) === 'urgent').length;
  const expires = allEmp.filter(e => getStatut(e) === 'expire').length;
  const projets = new Set(getAllEmployes().map(e => e.projet).filter(Boolean)).size;

  setEl('kpi-total',   getAllEmployes().length);
  setEl('kpi-urgent',  urgent);
  setEl('kpi-cadres',  cadres.length);
  setEl('kpi-projets', projets);
  setEl('kpi-expires', expires);

  // Alertes dashboard
  const az = document.getElementById('alert-zone');
  let html = '';
  if(urgent > 0)
    html += `<div class="alert-banner alert-danger">⚠️ ${urgent} contrat(s) expirant dans les ${settings.urgentDays} prochains jours — Action requise!</div>`;
  if(expires > 0)
    html += `<div class="alert-banner alert-warning">📋 ${expires} contrat(s) déjà expirés à traiter.</div>`;
  if(!urgent && !expires)
    html += `<div class="alert-banner alert-success">✅ Aucun contrat en situation critique.</div>`;
  if(az) az.innerHTML = html;
}

function updateBadges() {
  const allC = getAllContrats();
  const urg = allC.filter(e => getStatut(e) === 'urgent').length;
  setEl('tb-dash', getAllEmployes().length);
  setEl('tb-contrats', urg);
  setEl('tb-employes', getAllEmployes().length);
  setEl('tb-cadres', cadres.length);
  const badge = document.getElementById('notif-badge');
  if(badge){
    if(notifications.length > 0){ badge.textContent=notifications.length; badge.style.display=''; }
    else badge.style.display='none';
  }
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if(el) el.textContent = val;
}

// ── Données combinées ────────────────────────────────
function getAllEmployes() {
  return [...employees, ...comptables, ...divers];
}

function getAllContrats() {
  return [...avecMat, ...employees.filter(e => e.echeance)];
}

// ── Statut contrat ───────────────────────────────────
function getStatut(emp) {
  if(!emp.echeance) return 'ot'; // Autres (FT, terme imprécis…)
  const d = parseDate(emp.echeance);
  if(!d) return 'ot';
  const diff = Math.ceil((d - TODAY) / 86400000);
  if(diff < 0)                       return 'expire';
  if(diff <= settings.urgentDays)    return 'urgent';
  if(diff <= settings.warnDays)      return 'warn';
  return 'ok';
}

function getDaysLeft(emp) {
  if(!emp.echeance) return null;
  const d = parseDate(emp.echeance);
  if(!d) return null;
  return Math.ceil((d - TODAY) / 86400000);
}

function parseDate(val) {
  if(!val) return null;
  if(val instanceof Date) return val;
  if(typeof val === 'string'){
    // Try common formats
    const d = new Date(val);
    if(!isNaN(d)) return d;
    return null;
  }
  if(typeof val === 'number'){ // Excel serial
    const d = new Date((val - 25569) * 86400000);
    return d;
  }
  return null;
}

function formatDate(val) {
  const d = parseDate(val);
  if(!d) return val || '—';
  return d.toLocaleDateString('fr-FR');
}

function statusLabel(statut) {
  const map = {
    urgent: ['⚠️ Urgent', 'status-urgent'],
    warn:   ['⏳ Proche',  'status-warn'],
    ok:     ['✅ OK',      'status-ok'],
    expire: ['❌ Expiré',  'status-expire'],
    ot:     ['ℹ️ Autre',   'status-ot'],
  };
  return map[statut] || ['—', ''];
}

// ── Dashboard Cards ───────────────────────────────────
function renderDashCards() {
  const container = document.getElementById('dash-cards');
  if(!container) return;

  const urgent = getAllContrats()
    .filter(e => getStatut(e) === 'urgent')
    .sort((a,b) => {
      const da = parseDate(a.echeance), db_ = parseDate(b.echeance);
      return (da||0) - (db_||0);
    })
    .slice(0, 12);

  if(urgent.length === 0){
    container.innerHTML = '<div class="empty"><div class="e-ico">✅</div><h3>Aucun contrat urgent</h3><p>Tous les contrats sont en bon état.</p></div>';
    return;
  }

  container.innerHTML = urgent.map(e => empCard(e)).join('');

  // Charts dashboard
  renderChartProjets();
}

function empCard(e) {
  const statut = getStatut(e);
  const days   = getDaysLeft(e);
  const [slabel, sclass] = statusLabel(statut);
  const cardClass = statut === 'urgent' ? 'card-urgent' : statut === 'warn' ? 'card-warn' : statut === 'ok' ? 'card-ok' : '';
  let daysText = '';
  if(days !== null){
    if(days < 0) daysText = `Expiré il y a ${Math.abs(days)}j`;
    else if(days === 0) daysText = 'Expire aujourd\'hui!';
    else daysText = `Dans ${days} jour${days>1?'s':''}`;
  } else daysText = e.echeance || 'Sans échéance';

  return `<div class="emp-card ${cardClass}" onclick="showDetail(${JSON.stringify(e).replace(/"/g,'&quot;')})">
    <div class="card-header">
      <div class="card-nom">${e.nom || '—'}</div>
      <span class="card-badge badge-${statut}">${slabel}</span>
    </div>
    <div class="card-row"><span>Matricule</span><span>${e.matricule || '—'}</span></div>
    <div class="card-row"><span>Projet</span><span>${e.projet || '—'}</span></div>
    <div class="card-row"><span>Fonction</span><span>${e.fonction || '—'}</span></div>
    <div class="card-echeance">
      <span>📅 Échéance : ${formatDate(e.echeance)}</span>
      <span style="font-weight:700;color:var(--${statut==='urgent'?'urgent':statut==='warn'?'warn':statut==='ok'?'ok':'text2'})">${daysText}</span>
    </div>
  </div>`;
}

// ── Table Contrats ────────────────────────────────────
function renderContrats() {
  const tbody = document.getElementById('tbody-contrats');
  if(!tbody) return;

  let data = getAllContrats().filter(e => {
    const q = searchContrats.toLowerCase();
    if(q && !(`${e.nom} ${e.projet} ${e.fonction} ${e.matricule}`).toLowerCase().includes(q)) return false;
    if(filterContratStatut && getStatut(e) !== filterContratStatut) return false;
    return true;
  });

  data.sort((a,b) => {
    let va = a[contratSort.key] || '', vb = b[contratSort.key] || '';
    if(contratSort.key === 'echeance' || contratSort.key === 'dateRecrutement'){
      va = parseDate(va)||0; vb = parseDate(vb)||0;
    }
    if(va < vb) return -contratSort.dir;
    if(va > vb) return contratSort.dir;
    return 0;
  });

  const empty = document.getElementById('contrats-empty');
  if(data.length === 0){
    tbody.innerHTML = '';
    if(empty) empty.style.display = '';
    return;
  }
  if(empty) empty.style.display = 'none';

  tbody.innerHTML = data.map(e => {
    const statut = getStatut(e);
    const [slabel, sclass] = statusLabel(statut);
    return `<tr onclick="showDetail(${JSON.stringify(e).replace(/"/g,'&quot;')})">
      <td class="td-mat">${e.matricule || '—'}</td>
      <td class="td-nom">${e.nom || '—'}</td>
      <td>${e.projet || '—'}</td>
      <td>${e.fonction || '—'}</td>
      <td>${formatDate(e.dateRecrutement)}</td>
      <td>${formatDate(e.echeance)}</td>
      <td><span class="status-badge ${sclass}">${slabel}</span></td>
      <td>
        <button class="btn-action" title="Voir" onclick="event.stopPropagation();showDetail(${JSON.stringify(e).replace(/"/g,'&quot;')})">👁️</button>
        <button class="btn-action" title="Modifier" onclick="event.stopPropagation();editEmployee(${JSON.stringify(e).replace(/"/g,'&quot;')})">✏️</button>
      </td>
    </tr>`;
  }).join('');
}

function filterContrats() {
  searchContrats = document.getElementById('search-contrats')?.value || '';
  filterContratStatut = document.getElementById('filter-contrat-statut')?.value || '';
  renderContrats();
}

// ── Table Employés ────────────────────────────────────
function renderEmployes() {
  const tbody = document.getElementById('tbody-employes');
  if(!tbody) return;

  let data = getAllEmployes().filter(e => {
    const q = searchEmployes.toLowerCase();
    if(q && !(`${e.nom} ${e.projet} ${e.fonction} ${e.matricule}`).toLowerCase().includes(q)) return false;
    if(filterSexe && e.sexe !== filterSexe) return false;
    if(filterContratType && e.typeContrat !== filterContratType) return false;
    return true;
  });

  data.sort((a,b) => {
    let va = a[employeSort.key]||'', vb = b[employeSort.key]||'';
    return va < vb ? -employeSort.dir : va > vb ? employeSort.dir : 0;
  });

  const empty = document.getElementById('employes-empty');
  if(data.length === 0){
    tbody.innerHTML = '';
    if(empty) empty.style.display = '';
    return;
  }
  if(empty) empty.style.display = 'none';

  tbody.innerHTML = data.map(e => {
    const statut = getStatut(e);
    const [slabel, sclass] = statusLabel(statut);
    return `<tr onclick="showDetail(${JSON.stringify(e).replace(/"/g,'&quot;')})">
      <td class="td-mat">${e.matricule||'—'}</td>
      <td class="td-nom">${e.nom||'—'}</td>
      <td>${e.sexe||'—'}</td>
      <td>${e.typeContrat||'—'}</td>
      <td>${e.projet||'—'}</td>
      <td>${formatDate(e.dateRecrutement)}</td>
      <td>${formatDate(e.echeance)}</td>
      <td>${e.fonction||'—'}</td>
      <td>${e.categorie||'—'}</td>
      <td>
        <button class="btn-action" title="Modifier" onclick="event.stopPropagation();editEmployee(${JSON.stringify(e).replace(/"/g,'&quot;')})">✏️</button>
        <button class="btn-action" title="Supprimer" onclick="event.stopPropagation();deleteEmployee(${JSON.stringify(e).replace(/"/g,'&quot;')})">🗑️</button>
      </td>
    </tr>`;
  }).join('');
}

function filterEmployes() {
  searchEmployes = document.getElementById('search-employes')?.value || '';
  filterSexe = document.getElementById('filter-sexe')?.value || '';
  filterContratType = document.getElementById('filter-contrat-type')?.value || '';
  renderEmployes();
}

// ── Table Cadres ──────────────────────────────────────
function renderCadres() {
  const tbody = document.getElementById('tbody-cadres');
  if(!tbody) return;

  let data = cadres.filter(e => {
    const q = searchCadres.toLowerCase();
    return !q || (`${e.nom} ${e.projet} ${e.fonction}`).toLowerCase().includes(q);
  });

  const empty = document.getElementById('cadres-empty');
  if(data.length === 0){
    tbody.innerHTML = '';
    if(empty) empty.style.display = '';
    return;
  }
  if(empty) empty.style.display = 'none';

  tbody.innerHTML = data.map(e => `<tr onclick="showDetail(${JSON.stringify(e).replace(/"/g,'&quot;')})">
    <td class="td-mat">${e.matricule||'—'}</td>
    <td class="td-nom">${e.nom||'—'}</td>
    <td>${e.projet||'—'}</td>
    <td>${e.fonction||'—'}</td>
    <td>${formatDate(e.dateRecrutement)}</td>
    <td>${e.anciennete||'—'}</td>
    <td>${e.age||'—'}</td>
  </tr>`).join('');
}

function filterCadres() {
  searchCadres = document.getElementById('search-cadres')?.value || '';
  renderCadres();
}

// ── Projets ───────────────────────────────────────────
function renderProjets() {
  const container = document.getElementById('projet-grid');
  if(!container) return;

  const all = getAllEmployes();
  const counts = {};
  all.forEach(e => {
    const p = String(e.projet || 'Non défini').trim();
    counts[p] = (counts[p]||0) + 1;
  });

  const sorted = Object.entries(counts).sort((a,b) => b[1] - a[1]);
  if(sorted.length === 0){
    container.innerHTML = '<div class="empty"><div class="e-ico">🏗️</div><h3>Aucun projet</h3></div>';
    return;
  }

  const colors = ['#e8620a','#f97316','#3b5bdb','#087f5b','#c2255c','#862e9c','#1098ad','#2b8a3e','#a61e4d','#364fc7','#2f9e44','#1971c2'];
  container.innerHTML = sorted.map(([proj, count], i) => `
    <div class="projet-card" style="border-top-color:${colors[i%colors.length]}">
      <div class="projet-name">📁 Projet ${proj}</div>
      <div class="projet-count">${count}</div>
      <div class="projet-label">employé${count>1?'s':''}</div>
    </div>
  `).join('');
}

// ── Analyse / Graphiques ──────────────────────────────
let charts = {};

function renderAnalyse() {
  renderChartSexe();
  renderChartContrats();
  renderChartTopProjets();
  renderChartFonctions();
}

function renderChartProjets() {
  const canvas = document.getElementById('chart-projets');
  if(!canvas) return;
  const all = getAllEmployes();
  const counts = {};
  all.forEach(e => {
    const p = String(e.projet||'Non défini').trim();
    counts[p] = (counts[p]||0) + 1;
  });
  const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8);
  if(charts['projets']) charts['projets'].destroy();
  charts['projets'] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: sorted.map(([k])=>k),
      datasets:[{ label:'Effectif', data: sorted.map(([,v])=>v), backgroundColor: PALETTE }]
    },
    options: { responsive:true, maintainAspectRatio:true, plugins:{legend:{display:false}}, scales:{y:{beginAtZero:true}} }
  });
}

function renderChartSexe() {
  const canvas = document.getElementById('chart-sexe');
  if(!canvas) return;
  const all = getAllEmployes();
  const m = all.filter(e=>e.sexe==='M').length;
  const f = all.filter(e=>e.sexe==='F').length;
  const autre = all.length - m - f;
  if(charts['sexe']) charts['sexe'].destroy();
  charts['sexe'] = new Chart(canvas, {
    type:'doughnut',
    data:{
      labels:['Hommes','Femmes','Non défini'],
      datasets:[{data:[m,f,autre], backgroundColor:['#3b5bdb','#e8620a','#9ca3af'], borderWidth:2}]
    },
    options:{responsive:true, maintainAspectRatio:true, plugins:{legend:{position:'bottom'}}}
  });
}

function renderChartContrats() {
  const canvas = document.getElementById('chart-contrats');
  if(!canvas) return;
  const allC = getAllContrats();
  const counts = {urgent:0, warn:0, ok:0, expire:0, ot:0};
  allC.forEach(e => counts[getStatut(e)]++);
  if(charts['contrats']) charts['contrats'].destroy();
  charts['contrats'] = new Chart(canvas, {
    type:'pie',
    data:{
      labels:['Urgents','Proches','OK','Expirés','Autres'],
      datasets:[{data:[counts.urgent,counts.warn,counts.ok,counts.expire,counts.ot],
        backgroundColor:['#dc2626','#d97706','#16a34a','#9ca3af','#3b5bdb'], borderWidth:2}]
    },
    options:{responsive:true, maintainAspectRatio:true, plugins:{legend:{position:'bottom'}}}
  });
}

function renderChartTopProjets() {
  const canvas = document.getElementById('chart-top-projets');
  if(!canvas) return;
  const all = getAllEmployes();
  const counts = {};
  all.forEach(e => {
    const p = String(e.projet||'Non défini').trim();
    counts[p] = (counts[p]||0) + 1;
  });
  const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,10);
  if(charts['topprojets']) charts['topprojets'].destroy();
  charts['topprojets'] = new Chart(canvas, {
    type:'bar',
    data:{
      labels: sorted.map(([k])=>k),
      datasets:[{label:'Effectif', data: sorted.map(([,v])=>v), backgroundColor: PALETTE, borderRadius:4}]
    },
    options:{responsive:true, maintainAspectRatio:true, plugins:{legend:{display:false}}, scales:{x:{ticks:{font:{size:10}}},y:{beginAtZero:true}}}
  });
}

function renderChartFonctions() {
  const canvas = document.getElementById('chart-fonctions');
  if(!canvas) return;
  const all = getAllEmployes();
  const counts = {};
  all.forEach(e => {
    const f = (e.fonction||'Non défini').trim();
    counts[f] = (counts[f]||0) + 1;
  });
  const sorted = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8);
  if(charts['fonctions']) charts['fonctions'].destroy();
  charts['fonctions'] = new Chart(canvas, {
    type:'bar',
    data:{
      labels: sorted.map(([k])=>k.length>20?k.substring(0,18)+'…':k),
      datasets:[{label:'Nb', data: sorted.map(([,v])=>v), backgroundColor: PALETTE, borderRadius:4}]
    },
    options:{responsive:true, maintainAspectRatio:true, plugins:{legend:{display:false}}, scales:{x:{ticks:{font:{size:9}}},y:{beginAtZero:true}}}
  });
}

// ── Tri tables ─────────────────────────────────────────
function sortTable(table, key) {
  if(table === 'contrats'){
    if(contratSort.key === key) contratSort.dir *= -1;
    else { contratSort.key = key; contratSort.dir = 1; }
    renderContrats();
  } else if(table === 'employes'){
    if(employeSort.key === key) employeSort.dir *= -1;
    else { employeSort.key = key; employeSort.dir = 1; }
    renderEmployes();
  }
}

// ── Import Excel ──────────────────────────────────────
function importExcel(input) {
  const file = input.files[0];
  if(!file) return;
  const status = document.getElementById('import-status');
  if(status) status.textContent = '⏳ Lecture du fichier…';

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const wb = XLSX.read(e.target.result, {type:'array', cellDates:true});
      let total = 0;

      // Feuil1 → employees
      if(wb.SheetNames.includes('Feuil1')){
        const ws = wb.Sheets['Feuil1'];
        const rows = XLSX.utils.sheet_to_json(ws, {defval:null});
        employees = rows.map(r => ({
          matricule:      r['N°Matricule'],
          nom:            r['Nom et Prénoms'],
          sexe:           r['Sexe'],
          typeContrat:    r['Type de contrat '] || r['Type de contrat'],
          projet:         r[' Projet'] || r['Projet'],
          dateRecrutement:r['Date de recrutement/ Nomination'],
          echeance:       r['Echéance du Contrat'],
          fonction:       r['Fonction'],
          categorie:      r['Catégorie'],
        })).filter(r=>r.nom);
        total += employees.length;
      }

      // Feuil4 → cadres
      if(wb.SheetNames.includes('Feuil4')){
        const ws = wb.Sheets['Feuil4'];
        const rows = XLSX.utils.sheet_to_json(ws, {defval:null});
        cadres = rows.map(r => ({
          matricule:      r['N°Matricule'],
          nom:            r['Nom et Prénoms'],
          projet:         r[' Projet'] || r['Projet'],
          dateRecrutement:r['Date de recrutement/ Nomination'],
          fonction:       r['Fonction'],
          anciennete:     r['Ancienneté'],
          age:            r['Date de naissance'],
        })).filter(r=>r.nom);
        total += cadres.length;
      }

      // Feuil2 → comptables
      if(wb.SheetNames.includes('Feuil2')){
        const ws = wb.Sheets['Feuil2'];
        const rows = XLSX.utils.sheet_to_json(ws, {defval:null});
        comptables = rows.map(r => ({
          matricule: r['N°Matricule'],
          nom:       r['Noms et Prénoms'] || r['Nom et Prénoms'],
          projet:    r['PROJET'] || r[' Projet'],
          fonction:  r['Fonctions'] || r['Fonction'],
        })).filter(r=>r.nom);
        total += comptables.length;
      }

      // Feuil3 → divers
      if(wb.SheetNames.includes('Feuil3')){
        const ws = wb.Sheets['Feuil3'];
        const rows = XLSX.utils.sheet_to_json(ws, {defval:null});
        divers = rows.map(r => ({
          matricule:      r['N°Matricule'],
          nom:            r['Nom et Prénoms'],
          sexe:           r['Sexe'],
          projet:         r[' Projet'] || r['Projet'],
          dateRecrutement:r['Date de recrutement/ Nomination'],
          fonction:       r['Fonction'],
          categorie:      r['Catégorie'],
        })).filter(r=>r.nom);
        total += divers.length;
      }

      // Avec Matricule → avecMat (contrats)
      if(wb.SheetNames.includes('Avec Matricule')){
        const ws = wb.Sheets['Avec Matricule'];
        const rows = XLSX.utils.sheet_to_json(ws, {defval:null});
        avecMat = rows.map(r => ({
          matricule:      r['N°Matricule'],
          nom:            r['Nom et Prénoms'],
          projet:         r[' Projet'] || r['Projet'],
          dateRecrutement:r['Date de recrutement/ Nomination'],
          echeance:       r['Echéance du Contrat'],
          fonction:       r['Fonction'],
        })).filter(r=>r.nom);
        total += avecMat.length;
      }

      // Sans Matricule
      if(wb.SheetNames.includes('Sans Matricule')){
        const ws = wb.Sheets['Sans Matricule'];
        const rows = XLSX.utils.sheet_to_json(ws, {defval:null});
        sansMat = rows.map(r => ({
          nom:      r['Nom et Prénoms'],
          projet:   r[' Projet'] || r['Projet'],
          echeance: r['Echéance du Contrat'],
          fonction: r['Fonction'],
          avis:     r['Avis du Supérieur Hiérarchique direct'],
          avisDGAO: r['Avis du DGAO'],
        })).filter(r=>r.nom);
      }

      if(status) status.textContent = `✅ ${total} enregistrements importés avec succès!`;
      showToast(`✅ ${total} employés importés`);
      saveToFirestore();
      renderAll();
    } catch(err) {
      console.error(err);
      if(status) status.textContent = '❌ Erreur lors de la lecture du fichier.';
      showToast('❌ Erreur import: ' + err.message);
    }
  };
  reader.readAsArrayBuffer(file);
  input.value = '';
}

// ── Alertes périodiques ────────────────────────────────
function scheduleAlertCheck() {
  checkAlerts();
  setInterval(checkAlerts, 3600000); // toutes les heures
}

function checkAlerts() {
  const urgent = getAllContrats().filter(e => {
    const d = getDaysLeft(e);
    return d !== null && d >= 0 && d <= settings.urgentDays;
  });
  if(urgent.length > 0 && Notification.permission === 'granted'){
    new Notification('RH Dashboard', {
      body: `⚠️ ${urgent.length} contrat(s) expirent dans ${settings.urgentDays} jours.`,
      icon: 'assets/icon-192.png'
    });
  }
  if(Notification.permission === 'default'){
    Notification.requestPermission();
  }
}

// ── Modal Ajout/Édition ───────────────────────────────
let _editTarget = null; // 'employees', 'cadres', etc.
let _editIndex  = null;

function openAddModal() {
  _editTarget = 'employees';
  _editIndex  = null;
  document.getElementById('modal-title').textContent = 'Ajouter un employé';
  document.getElementById('modal-id').value = '';
  clearModalFields();
  document.getElementById('modal-overlay').style.display = 'flex';
}

function editEmployee(emp) {
  _editTarget = 'employees';
  _editIndex  = employees.findIndex(e => e.nom === emp.nom && String(e.matricule) === String(emp.matricule));
  document.getElementById('modal-title').textContent = 'Modifier l\'employé';
  document.getElementById('m-matricule').value = emp.matricule || '';
  document.getElementById('m-nom').value = emp.nom || '';
  document.getElementById('m-sexe').value = emp.sexe || 'M';
  document.getElementById('m-typecontrat').value = emp.typeContrat || 'CDD';
  document.getElementById('m-projet').value = emp.projet || '';
  document.getElementById('m-fonction').value = emp.fonction || '';
  document.getElementById('m-categorie').value = emp.categorie || '';
  document.getElementById('m-daterecrutement').value = toDateInput(emp.dateRecrutement);
  document.getElementById('m-echeance').value = toDateInput(emp.echeance);
  document.getElementById('m-anciennete').value = emp.anciennete || '';
  document.getElementById('m-age').value = emp.age || '';
  document.getElementById('modal-overlay').style.display = 'flex';
}

function clearModalFields() {
  ['m-matricule','m-nom','m-projet','m-fonction','m-categorie','m-daterecrutement','m-echeance','m-anciennete','m-age']
    .forEach(id => { const el = document.getElementById(id); if(el) el.value=''; });
  document.getElementById('m-sexe').value = 'M';
  document.getElementById('m-typecontrat').value = 'CDD';
}

function toDateInput(val) {
  const d = parseDate(val);
  if(!d) return '';
  return d.toISOString().split('T')[0];
}

function saveEmployee() {
  const nom = document.getElementById('m-nom').value.trim();
  if(!nom){ showToast('❌ Le nom est requis.'); return; }

  const emp = {
    matricule:      document.getElementById('m-matricule').value.trim() || null,
    nom:            nom,
    sexe:           document.getElementById('m-sexe').value,
    typeContrat:    document.getElementById('m-typecontrat').value,
    projet:         document.getElementById('m-projet').value.trim() || null,
    fonction:       document.getElementById('m-fonction').value.trim() || null,
    categorie:      document.getElementById('m-categorie').value.trim() || null,
    dateRecrutement:document.getElementById('m-daterecrutement').value || null,
    echeance:       document.getElementById('m-echeance').value || null,
    anciennete:     document.getElementById('m-anciennete').value.trim() || null,
    age:            document.getElementById('m-age').value.trim() || null,
  };

  if(_editIndex !== null && _editIndex >= 0){
    employees[_editIndex] = emp;
    showToast('✅ Employé modifié');
  } else {
    employees.push(emp);
    showToast('✅ Employé ajouté');
  }

  closeModal();
  saveToFirestore();
  renderAll();
}

function deleteEmployee(emp) {
  if(!confirm(`Supprimer ${emp.nom} ?`)) return;
  const idx = employees.findIndex(e => e.nom === emp.nom && String(e.matricule) === String(emp.matricule));
  if(idx >= 0) employees.splice(idx, 1);
  saveToFirestore();
  renderAll();
  showToast('🗑️ Employé supprimé');
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

// ── Modal Détail ──────────────────────────────────────
function showDetail(emp) {
  document.getElementById('detail-title').textContent = emp.nom || 'Détail';
  const statut = getStatut(emp);
  const [slabel] = statusLabel(statut);
  const days = getDaysLeft(emp);
  let daysText = '';
  if(days !== null){
    if(days < 0) daysText = `Expiré il y a ${Math.abs(days)} jours`;
    else if(days === 0) daysText = 'Expire aujourd\'hui!';
    else daysText = `Dans ${days} jour${days>1?'s':''}`;
  }

  const fields = [
    ['Matricule', emp.matricule],
    ['Nom et Prénoms', emp.nom],
    ['Sexe', emp.sexe === 'M' ? 'Masculin' : emp.sexe === 'F' ? 'Féminin' : emp.sexe],
    ['Type de contrat', emp.typeContrat],
    ['Projet', emp.projet],
    ['Fonction', emp.fonction],
    ['Catégorie', emp.categorie],
    ['Date de recrutement', formatDate(emp.dateRecrutement)],
    ['Échéance du contrat', formatDate(emp.echeance)],
    ['Ancienneté', emp.anciennete],
    ['Âge', emp.age],
    ['Statut', `${slabel}${daysText ? ' — ' + daysText : ''}`],
  ].filter(([,v]) => v != null && v !== '' && v !== '—');

  document.getElementById('detail-body').innerHTML = fields.map(([label, val]) =>
    `<div class="detail-field">
      <span class="df-label">${label}</span>
      <span class="df-value">${val}</span>
    </div>`
  ).join('');

  document.getElementById('detail-edit-btn').onclick = () => {
    closeDetail(); editEmployee(emp);
  };

  document.getElementById('detail-overlay').style.display = 'flex';
}

function closeDetail() {
  document.getElementById('detail-overlay').style.display = 'none';
}

// ── Navigation ────────────────────────────────────────
function goPage(page, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));

  const pg = document.getElementById('page-' + page);
  if(pg) { pg.classList.add('active'); pg.classList.remove('fade-up'); void pg.offsetWidth; pg.classList.add('fade-up'); }
  if(btn) btn.classList.add('active');
  _currentPage = page;

  // Re-render si besoin
  if(page === 'analyse') setTimeout(renderAnalyse, 50);
}

function goPageById(page) {
  const btn = document.querySelector(`[data-page="${page}"]`);
  goPage(page, btn);
}

// ── Notifications ─────────────────────────────────────
function toggleNotifPanel() {
  const panel = document.getElementById('notif-panel');
  if(panel) panel.style.display = panel.style.display === 'none' ? '' : 'none';
}

function renderNotifications() {
  const list = document.getElementById('notif-list');
  if(!list) return;

  // Générer les notifs depuis les contrats urgents
  const urgent = getAllContrats().filter(e => {
    const d = getDaysLeft(e);
    return d !== null && d >= 0 && d <= settings.urgentDays;
  });

  const items = urgent.slice(0, 10).map(e => {
    const d = getDaysLeft(e);
    return `<div class="notif-item">⚠️ <strong>${e.nom}</strong> — ${d === 0 ? 'Expire aujourd\'hui' : `Dans ${d} jour${d>1?'s':''}`}</div>`;
  });

  if(items.length === 0){
    list.innerHTML = '<div class="notif-item" style="color:rgba(255,255,255,0.4)">Aucune alerte active</div>';
  } else {
    list.innerHTML = items.join('');
  }

  const badge = document.getElementById('notif-badge');
  if(badge){
    if(urgent.length > 0){ badge.textContent = urgent.length; badge.style.display = ''; }
    else badge.style.display = 'none';
  }
}

function clearAllNotifs() {
  notifications = [];
  renderNotifications();
  saveToFirestore();
}

// ── Paramètres ────────────────────────────────────────
function saveSettings() {
  settings.urgentDays = parseInt(document.getElementById('set-urgent')?.value) || 30;
  settings.warnDays   = parseInt(document.getElementById('set-warn')?.value) || 90;
  saveToFirestore();
  renderAll();
  showToast('✅ Paramètres enregistrés');
}

function exportData() {
  const data = { employees, cadres, comptables, divers, avecMat, settings };
  const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `rh-export-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  showToast('⬇️ Export téléchargé');
}

// ── Toast ─────────────────────────────────────────────
function showToast(msg, duration=3000) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

// ── Service Worker ────────────────────────────────────
if('serviceWorker' in navigator){
  navigator.serviceWorker.register('./sw.js').catch(()=>{});
}

// Fermer le panel notif si clic ailleurs
document.addEventListener('click', e => {
  const panel = document.getElementById('notif-panel');
  const btn   = document.getElementById('notif-bell-btn');
  if(panel && !panel.contains(e.target) && btn && !btn.contains(e.target)){
    panel.style.display = 'none';
  }
});
