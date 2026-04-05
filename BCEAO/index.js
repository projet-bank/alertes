/**
 * ═══════════════════════════════════════════════════════════════
 *  RégAlert BCEAO — Firebase Cloud Functions
 *  functions/index.js
 *
 *  FONCTIONS :
 *  1. sendDailyAlerts  → Planifiée chaque jour à 7h00 GMT (CRON)
 *  2. sendAlertsManual → Déclenchement HTTP manuel depuis l'app
 *
 *  PRÉREQUIS (plan Blaze obligatoire) :
 *  ─────────────────────────────────────────────────────────────
 *  1. firebase login
 *  2. firebase use app-bceao
 *  3. cd functions && npm install
 *  4. firebase functions:config:set \
 *       gmail.user="votre.adresse@gmail.com" \
 *       gmail.pass="votre_app_password_gmail"
 *  5. firebase deploy --only functions
 *
 *  GMAIL APP PASSWORD :
 *  ─────────────────────────────────────────────────────────────
 *  Compte Google → Sécurité → Validation en 2 étapes → Mots de
 *  passe des applications → Générer un mot de passe pour "Mail"
 * ═══════════════════════════════════════════════════════════════
 */

'use strict';

const functions   = require('firebase-functions');
const admin       = require('firebase-admin');
const nodemailer  = require('nodemailer');

admin.initializeApp();
const db = admin.firestore();

/* ──────────────────────────────────────────────────────────────
   CONFIGURATION GMAIL (via firebase functions:config:set)
────────────────────────────────────────────────────────────── */
function getTransporter() {
  const gmailUser = functions.config().gmail.user;
  const gmailPass = functions.config().gmail.pass;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: gmailUser, pass: gmailPass },
  });
}

/* ──────────────────────────────────────────────────────────────
   UTILITAIRES DATE
────────────────────────────────────────────────────────────── */
function parseDate(s) {
  if (!s || s === 'Quotidien' || s === 'Hebdomadaire' || s === '—') return null;
  const d = new Date(s);
  d.setUTCHours(0, 0, 0, 0);
  return isNaN(d.getTime()) ? null : d;
}

function daysUntil(dateStr) {
  const d = parseDate(dateStr);
  if (!d) return null;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function fmtDate(s) {
  const d = parseDate(s);
  if (!d) return s || '—';
  return d.toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}

function statusLabel(days) {
  if (days === null) return '';
  if (days < 0)  return `⚫ ${Math.abs(days)} jour(s) de retard`;
  if (days === 0) return "🔴 AUJOURD'HUI !";
  if (days <= 7)  return `🔴 URGENT — ${days} jour(s)`;
  if (days <= 30) return `🟡 Dans ${days} jours`;
  return `🟢 Dans ${days} jours`;
}

/* ──────────────────────────────────────────────────────────────
   LOGIQUE PRINCIPALE : récupérer et filtrer les échéances d'un user
────────────────────────────────────────────────────────────── */
async function getUserAlerts(uid) {
  // 1. Charger les paramètres utilisateur
  const settingsDoc = await db.doc(`users/${uid}/data/settings`).get();
  if (!settingsDoc.exists) return { emails: [], docs: [], userName: uid };

  const data       = settingsDoc.data();
  const emails     = data.notifEmails || [];
  const settings   = data.settings   || {};
  const customDL   = data.customDL   || [];
  const csvData    = data.csvData    || [];
  const urgentDays = settings.urgentDays || 7;

  // 2. Charger les documents "transmis" (à exclure)
  const transmittedDoc = await db.doc(`users/${uid}/data/transmitted`).get();
  const transmittedIds = new Set(
    transmittedDoc.exists ? (transmittedDoc.data().ids || []) : []
  );

  // 3. Construire la liste de tous les documents
  const BASE_DOCS = getBaseDocuments(); // données statiques intégrées
  const allDocs   = [...BASE_DOCS, ...customDL, ...csvData];

  // 4. Filtrer ceux qui sont urgents et non transmis
  const today    = new Date(); today.setUTCHours(0,0,0,0);
  const todayKey = today.toISOString().split('T')[0];

  const alertDocs = allDocs
    .map((d, i) => {
      const days = daysUntil(d.dl || d.deadline);
      return {
        id:       i,
        title:    d.t  || d.title,
        entity:   d.e  || d.entity,
        period:   d.p  || d.period,
        arrete:   d.a  || d.arrete,
        deadline: d.dl || d.deadline,
        days,
        key: `${d.t||d.title}|${d.dl||d.deadline}`,
      };
    })
    .filter(d => {
      if (d.days === null) return false;
      if (d.days < 0 || d.days > urgentDays) return false;
      if (transmittedIds.has(d.id)) return false;
      return true;
    })
    .sort((a, b) => (a.days ?? 99) - (b.days ?? 99));

  return { emails, docs: alertDocs };
}

/* ──────────────────────────────────────────────────────────────
   CONSTRUCTION DE L'EMAIL HTML
────────────────────────────────────────────────────────────── */
function buildEmailHtml(docs, userName) {
  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: '2-digit', month: 'long', year: 'numeric',
  });

  const rows = docs.map(d => `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e6ef;font-weight:600;color:#1a2235;max-width:260px">${d.title}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e6ef">
        <span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:12px;background:${entityBg(d.entity)};color:${entityColor(d.entity)};font-family:monospace;letter-spacing:0.5px">${d.entity}</span>
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e6ef;font-family:monospace;font-size:12px;color:#4a5568">${fmtDate(d.deadline)}</td>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e6ef">
        <span style="font-size:11px;font-weight:700;padding:4px 10px;border-radius:12px;background:${d.days<=0?'#fde8e7':d.days<=3?'#fde8e7':'#fef0e2'};color:${d.days<=3?'#d93025':'#e07b2a'};font-family:monospace">${statusLabel(d.days)}</span>
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #e2e6ef;font-size:12px;color:#8896a8">${d.period}</td>
    </tr>`).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<title>RégAlert — Rappel d'échéances</title></head>
<body style="margin:0;padding:0;background:#f4f6fa;font-family:'Segoe UI',Arial,sans-serif">

<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:30px 0">
<tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%">

  <!-- EN-TÊTE -->
  <tr><td style="background:#0f1d3a;border-radius:14px 14px 0 0;padding:28px 36px;display:block">
    <table width="100%" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <div style="font-size:20px;font-weight:800;color:#ffffff;letter-spacing:-0.5px">RégAlert — BCEAO</div>
          <div style="font-size:12px;color:rgba(255,255,255,0.5);font-family:monospace;letter-spacing:1px;margin-top:3px">RAPPEL AUTOMATIQUE D'ÉCHÉANCES</div>
        </td>
        <td align="right">
          <div style="background:rgba(200,146,42,0.15);border:1px solid rgba(200,146,42,0.4);border-radius:8px;padding:8px 14px;display:inline-block">
            <div style="font-size:11px;color:rgba(255,255,255,0.5);margin-bottom:2px">Envoyé le</div>
            <div style="font-size:13px;font-weight:700;color:#e8b84b">${today}</div>
          </div>
        </td>
      </tr>
    </table>
  </td></tr>

  <!-- ALERTE PRINCIPALE -->
  <tr><td style="background:#fde8e7;border-left:5px solid #d93025;padding:16px 36px">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:22px;width:36px">🚨</td>
      <td style="padding-left:10px">
        <div style="font-size:15px;font-weight:700;color:#d93025">
          ${docs.length} échéance${docs.length > 1 ? 's' : ''} réglementaire${docs.length > 1 ? 's' : ''} nécessite${docs.length > 1 ? 'nt' : ''} votre attention
        </div>
        <div style="font-size:13px;color:#6b7280;margin-top:4px">
          Ces rappels s'arrêtent automatiquement dès que vous cliquez sur <strong>« Transmis »</strong> dans l'application.
        </div>
      </td>
    </tr></table>
  </td></tr>

  <!-- TABLEAU DES ÉCHÉANCES -->
  <tr><td style="background:#ffffff;padding:0">
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
      <thead>
        <tr style="background:#0f1d3a">
          <th style="padding:12px 16px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.8);font-family:monospace">Document</th>
          <th style="padding:12px 16px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.8);font-family:monospace">Entité</th>
          <th style="padding:12px 16px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.8);font-family:monospace">Date limite</th>
          <th style="padding:12px 16px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.8);font-family:monospace">Délai</th>
          <th style="padding:12px 16px;text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1px;color:rgba(255,255,255,0.8);font-family:monospace">Périodicité</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </td></tr>

  <!-- CTA -->
  <tr><td style="background:#ffffff;padding:24px 36px;text-align:center;border-top:1px solid #e2e6ef">
    <a href="https://app-bceao.web.app" style="display:inline-block;background:#0f1d3a;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:10px;font-size:14px;font-weight:700;letter-spacing:0.3px">
      🔗 Ouvrir RégAlert &amp; Marquer comme Transmis
    </a>
  </td></tr>

  <!-- PIED DE PAGE -->
  <tr><td style="background:#f9fafc;border-radius:0 0 14px 14px;padding:20px 36px;border-top:1px solid #e2e6ef">
    <table width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:11px;color:#8896a8">
        <strong style="color:#4a5568">RégAlert BCEAO</strong> · Système de suivi des échéances réglementaires<br>
        Cet email est envoyé chaque jour à <strong>7h00 GMT</strong> tant que des échéances urgentes sont en attente.
      </td>
      <td align="right" style="font-size:11px;color:#8896a8;font-family:monospace">
        ${new Date().toISOString().split('T')[0]}
      </td>
    </tr></table>
  </td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function buildEmailText(docs) {
  const lines = docs.map(d =>
    `• ${d.title}\n  Entité: ${d.entity} | Échéance: ${fmtDate(d.deadline)} | ${statusLabel(d.days)} | ${d.period}`
  ).join('\n\n');
  return `REGALERT BCEAO — Rappel d'échéances réglementaires\n${'═'.repeat(55)}\n\nBonjour,\n\nVoici les échéances nécessitant votre attention :\n\n${lines}\n\n${'─'.repeat(55)}\nCes rappels s'arrêtent dès que vous cliquez sur "Transmis".\nOuvrir l'application : https://app-bceao.web.app\n\nRégAlert BCEAO · Envoyé automatiquement à 7h00 GMT`;
}

/* Couleurs entités pour l'email */
const ENTITY_COLORS = {
  'COMPTA': ['#3b5bdb','#eef2ff'],
  'RISQUE': ['#c2255c','#fff0f6'],
  'CONTRÔLE DE GESTION': ['#087f5b','#e6fcf5'],
  'AUDIT': ['#e67700','#fff9db'],
  'DRC': ['#862e9c','#f8f0fc'],
  'CONFORMITE': ['#1098ad','#e3fafc'],
  'TRESORERIE': ['#2b8a3e','#ebfbee'],
  'D.FINANCIERE': ['#a61e4d','#fff0f6'],
  'DJRC': ['#364fc7','#edf2ff'],
  'DRHA': ['#5c7cfa','#edf2ff'],
  'MARKETING': ['#f76707','#fff4e6'],
  'ENGAGEMENTS': ['#0c8599','#e3fafc'],
};
function entityColor(e) { return (ENTITY_COLORS[e] || ['#6b7280','#f0f1f4'])[0]; }
function entityBg(e)    { return (ENTITY_COLORS[e] || ['#6b7280','#f0f1f4'])[1]; }

/* ──────────────────────────────────────────────────────────────
   DONNÉES DE BASE (miroir de app.js — BASE array)
   Seules les entrées avec une date future sont pertinentes pour
   le cron, les autres sont ignorées par le filtre daysUntil.
────────────────────────────────────────────────────────────── */
function getBaseDocuments() {
  // ── Données officielles BCEAO (mise à jour depuis fichier Excel)
  // Ces données sont utilisées comme référence pour le CRON email.
  // Le client peut uploader son propre Excel depuis l'application
  // pour mettre à jour csvData dans Firestore.
  return [
  {t:"États de synthèse périodiques du PCB révisé",a:"Décembre 2024",dl:"2025-01-15",p:"Mensuelle",e:"COMPTA"},
  {t:"États de synthèse périodiques du PCB révisé",a:"",dl:"2025-01-15",p:"Trimestrielle",e:"COMPTA"},
  {t:"États de synthèse périodiques du PCB révisé",a:"",dl:"2025-01-15",p:"Annuelle",e:"COMPTA"},
  {t:"États de synthèse périodiques du PCB révisé",a:"Décembre 2024 (Bilan et compte de résultat sur base sociale)",dl:"2025-02-28",p:"Semestrielle",e:"COMPTA"},
  {t:"États de synthèse périodiques du PCB révisé",a:"2025-01-01",dl:"2025-02-15",p:"Mensuelle",e:"COMPTA"},
  {t:"États de synthèse périodiques du PCB révisé",a:"2025-02-01",dl:"2025-03-15",p:"Mensuelle",e:"COMPTA"},
  {t:"États de synthèse périodiques du PCB révisé",a:"2025-03-01",dl:"2025-04-15",p:"Mensuelle",e:"COMPTA"},
  {t:"États de synthèse périodiques du PCB révisé",a:"",dl:"2025-04-15",p:"Trimestrielle",e:"COMPTA"},
  {t:"États de synthèse périodiques du PCB révisé",a:"2025-04-01",dl:"2025-05-15",p:"Mensuelle",e:"COMPTA"},
  {t:"États de synthèse périodiques du PCB révisé",a:"2025-05-01",dl:"2025-06-15",p:"Mensuelle",e:"COMPTA"},
  {t:"États de synthèse périodiques du PCB révisé",a:"2025-06-01",dl:"2025-07-15",p:"Mensuelle",e:"COMPTA"},
  {t:"États de synthèse périodiques du PCB révisé",a:"",dl:"2025-07-15",p:"Trimestrielle",e:"COMPTA"},
  {t:"États de synthèse périodiques du PCB révisé",a:"Juin 2025 (Bilan et compte de résultat sur base sociale)",dl:"2025-08-31",p:"Semestrielle",e:"COMPTA"},
  {t:"États de synthèse périodiques du PCB révisé",a:"2025-07-01",dl:"2025-08-15",p:"Mensuelle",e:"COMPTA"},
  {t:"États de synthèse périodiques du PCB révisé",a:"2025-08-01",dl:"2025-09-15",p:"Mensuelle",e:"COMPTA"},
  {t:"États de synthèse périodiques du PCB révisé",a:"2025-09-01",dl:"2025-10-15",p:"Mensuelle",e:"COMPTA"},
  {t:"États de synthèse périodiques du PCB révisé",a:"",dl:"2025-10-15",p:"Trimestrielle",e:"COMPTA"},
  {t:"États de synthèse périodiques du PCB révisé",a:"2025-10-01",dl:"2025-11-15",p:"Mensuelle",e:"COMPTA"},
  {t:"États de synthèse périodiques du PCB révisé",a:"2025-11-01",dl:"2025-12-15",p:"Mensuelle",e:"COMPTA"},
  {t:"États de synthèse périodiques du PCB révisé",a:"2025-12-01",dl:"2026-01-15",p:"Mensuelle",e:"COMPTA"},
  {t:"États de synthèse périodiques du PCB révisé",a:"",dl:"2026-01-15",p:"Trimestrielle",e:"COMPTA"},
  {t:"États de synthèse périodiques du PCB révisé",a:"",dl:"2026-01-15",p:"Annuelle",e:"COMPTA"},
  {t:"Formulaire de Déclaration Prudentielle (FODEP)",a:"2024-12-01",dl:"2025-04-30",p:"Semestrielle",e:"COMPTA"},
  {t:"Formulaire de Déclaration Prudentielle (FODEP)",a:"2025-06-01",dl:"2025-10-31",p:"Semestrielle",e:"COMPTA"},
  {t:"État de déclaration des expositions relevant de l\'exemption relative aux emprunteurs souv",a:"2024-12-01",dl:"2025-03-31",p:"Semestrielle",e:"RISQUE"},
  {t:"État de déclaration des expositions relevant de l\'exemption relative aux emprunteurs souv",a:"2025-06-01",dl:"2025-09-30",p:"Semestrielle",e:"RISQUE"},
  {t:"FODEP Infra-semestriel",a:"2024-12-31",dl:"2025-01-31",p:"Mensuelle",e:"CONTRÔLE DE GESTION"},
  {t:"FODEP Infra-semestriel",a:"",dl:"2025-01-31",p:"Trimestrielle",e:"CONTRÔLE DE GESTION"},
  {t:"FODEP Infra-semestriel",a:"2025-01-31",dl:"2025-02-28",p:"Mensuelle",e:"CONTRÔLE DE GESTION"},
  {t:"FODEP Infra-semestriel",a:"2025-02-28",dl:"2025-03-31",p:"Mensuelle",e:"CONTRÔLE DE GESTION"},
  {t:"FODEP Infra-semestriel",a:"2025-03-31",dl:"2025-04-30",p:"Mensuelle",e:"CONTRÔLE DE GESTION"},
  {t:"FODEP Infra-semestriel",a:"",dl:"2025-04-30",p:"Trimestrielle",e:"CONTRÔLE DE GESTION"},
  {t:"FODEP Infra-semestriel",a:"2025-04-30",dl:"2025-05-31",p:"Mensuelle",e:"CONTRÔLE DE GESTION"},
  {t:"FODEP Infra-semestriel",a:"2025-05-31",dl:"2025-06-30",p:"Mensuelle",e:"CONTRÔLE DE GESTION"},
  {t:"FODEP Infra-semestriel",a:"2025-06-30",dl:"2025-07-31",p:"Mensuelle",e:"CONTRÔLE DE GESTION"},
  {t:"FODEP Infra-semestriel",a:"",dl:"2025-07-31",p:"Trimestrielle",e:"CONTRÔLE DE GESTION"},
  {t:"FODEP Infra-semestriel",a:"2025-07-31",dl:"2025-08-31",p:"Mensuelle",e:"CONTRÔLE DE GESTION"},
  {t:"FODEP Infra-semestriel",a:"2025-08-31",dl:"2025-09-30",p:"Mensuelle",e:"CONTRÔLE DE GESTION"},
  {t:"FODEP Infra-semestriel",a:"2025-09-30",dl:"2025-10-30",p:"Mensuelle",e:"CONTRÔLE DE GESTION"},
  {t:"FODEP Infra-semestriel",a:"",dl:"2025-10-31",p:"Trimestrielle",e:"CONTRÔLE DE GESTION"},
  {t:"FODEP Infra-semestriel",a:"2025-10-31",dl:"2025-11-30",p:"Mensuelle",e:"CONTRÔLE DE GESTION"},
  {t:"FODEP Infra-semestriel",a:"2025-11-30",dl:"2025-12-31",p:"Mensuelle",e:"CONTRÔLE DE GESTION"},
  {t:"FODEP Infra-semestriel",a:"2025-12-31",dl:"2026-01-31",p:"Mensuelle",e:"CONTRÔLE DE GESTION"},
  {t:"FODEP Infra-semestriel",a:"",dl:"2026-01-31",p:"Trimestrielle",e:"CONTRÔLE DE GESTION"},
  {t:"Dispositif provisoire de de suivi de la liquidation (DEC 2062 et 2063)",a:"2024-12-31",dl:"2025-01-31",p:"Mensuelle",e:"CONTRÔLE DE GESTION"},
  {t:"Dispositif provisoire de de suivi de la liquidation (DEC 2062 et 2063)",a:"",dl:"2025-01-31",p:"Trimestrielle",e:"CONTRÔLE DE GESTION"},
  {t:"Dispositif provisoire de de suivi de la liquidation (DEC 2062 et 2063)",a:"2025-01-31",dl:"2025-02-28",p:"Mensuelle",e:"CONTRÔLE DE GESTION"},
  {t:"Dispositif provisoire de de suivi de la liquidation (DEC 2062 et 2063)",a:"2025-02-28",dl:"2025-03-31",p:"Mensuelle",e:"CONTRÔLE DE GESTION"},
  {t:"Dispositif provisoire de de suivi de la liquidation (DEC 2062 et 2063)",a:"2025-03-31",dl:"2025-04-30",p:"Mensuelle",e:"CONTRÔLE DE GESTION"},
  {t:"Dispositif provisoire de de suivi de la liquidation (DEC 2062 et 2063)",a:"",dl:"2025-04-30",p:"Trimestrielle",e:"CONTRÔLE DE GESTION"},
  {t:"Dispositif provisoire de de suivi de la liquidation (DEC 2062 et 2063)",a:"2025-04-30",dl:"2025-05-31",p:"Mensuelle",e:"CONTRÔLE DE GESTION"},
  {t:"Dispositif provisoire de de suivi de la liquidation (DEC 2062 et 2063)",a:"2025-05-31",dl:"2025-06-30",p:"Mensuelle",e:"CONTRÔLE DE GESTION"},
  {t:"Dispositif provisoire de de suivi de la liquidation (DEC 2062 et 2063)",a:"2025-06-30",dl:"2025-07-31",p:"Mensuelle",e:"CONTRÔLE DE GESTION"},
  {t:"Dispositif provisoire de de suivi de la liquidation (DEC 2062 et 2063)",a:"",dl:"2025-07-31",p:"Trimestrielle",e:"CONTRÔLE DE GESTION"},
  {t:"Dispositif provisoire de de suivi de la liquidation (DEC 2062 et 2063)",a:"2025-07-31",dl:"2025-08-31",p:"Mensuelle",e:"CONTRÔLE DE GESTION"},
  {t:"Dispositif provisoire de de suivi de la liquidation (DEC 2062 et 2063)",a:"2025-08-31",dl:"2025-09-30",p:"Mensuelle",e:"CONTRÔLE DE GESTION"},
  {t:"Dispositif provisoire de de suivi de la liquidation (DEC 2062 et 2063)",a:"2025-09-30",dl:"2025-10-31",p:"Mensuelle",e:"CONTRÔLE DE GESTION"},
  {t:"Dispositif provisoire de de suivi de la liquidation (DEC 2062 et 2063)",a:"",dl:"2025-10-31",p:"Trimestrielle",e:"CONTRÔLE DE GESTION"},
  {t:"Dispositif provisoire de de suivi de la liquidation (DEC 2062 et 2063)",a:"2025-10-31",dl:"2025-11-30",p:"Mensuelle",e:"CONTRÔLE DE GESTION"},
  {t:"Dispositif provisoire de de suivi de la liquidation (DEC 2062 et 2063)",a:"2025-11-30",dl:"2025-12-31",p:"Mensuelle",e:"CONTRÔLE DE GESTION"},
  {t:"Dispositif provisoire de de suivi de la liquidation (DEC 2062 et 2063)",a:"2025-12-31",dl:"2026-01-31",p:"Mensuelle",e:"CONTRÔLE DE GESTION"},
  {t:"Dispositif provisoire de de suivi de la liquidation (DEC 2062 et 2063)",a:"",dl:"2026-01-31",p:"Trimestrielle",e:"CONTRÔLE DE GESTION"},
  {t:"État financiers individuels annuels certifiés (documents de fin d\'exercice)",a:"2024-12-31",dl:"2025-06-30",p:"Annuelle",e:"CONTRÔLE DE GESTION"},
  {t:"États financiers individuels de fin de premier semestre certifiés sur base sociale (bilan ",a:"2025-06-01",dl:"2025-08-31",p:"Semestrielle",e:"CONTRÔLE DE GESTION"},
  {t:"Reporting au Fonds de Garantie des Dépôts et de Résolution dans l\'UMOA (FGDR-UMOA)",a:"2024-12-31",dl:"2025-01-15",p:"Trimestrielle",e:"CONTRÔLE DE GESTION"},
  {t:"Reporting au Fonds de Garantie des Dépôts et de Résolution dans l\'UMOA (FGDR-UMOA)",a:"",dl:"2025-07-15",p:"Annuelle",e:"CONTRÔLE DE GESTION"},
  {t:"Reporting au Fonds de Garantie des Dépôts et de Résolution dans l\'UMOA (FGDR-UMOA)",a:"2025-03-31",dl:"2025-04-15",p:"Trimestrielle",e:"CONTRÔLE DE GESTION"},
  {t:"Reporting au Fonds de Garantie des Dépôts et de Résolution dans l\'UMOA (FGDR-UMOA)",a:"2025-06-30",dl:"2025-07-15",p:"Trimestrielle",e:"CONTRÔLE DE GESTION"},
  {t:"Reporting au Fonds de Garantie des Dépôts et de Résolution dans l\'UMOA (FGDR-UMOA)",a:"2025-09-30",dl:"2025-10-15",p:"Trimestrielle",e:"CONTRÔLE DE GESTION"},
  {t:"Reporting au Fonds de Garantie des Dépôts et de Résolution dans l\'UMOA (FGDR-UMOA)",a:"2025-12-31",dl:"2026-01-15",p:"Trimestrielle",e:"CONTRÔLE DE GESTION"},
  {t:"Rapport sur la situation financière",a:"2024-12-31",dl:"2025-01-31",p:"Trimestrielle",e:"CONTRÔLE DE GESTION"},
  {t:"Rapport sur la situation financière",a:"2025-03-31",dl:"2025-04-30",p:"Trimestrielle",e:"CONTRÔLE DE GESTION"},
  {t:"Rapport sur la situation financière",a:"2025-06-30",dl:"2025-07-31",p:"Trimestrielle",e:"CONTRÔLE DE GESTION"},
  {t:"Rapport sur la situation financière",a:"2025-09-30",dl:"2025-10-31",p:"Trimestrielle",e:"CONTRÔLE DE GESTION"},
  {t:"Rapport sur la situation financière",a:"2025-12-31",dl:"2026-01-31",p:"Trimestrielle",e:"CONTRÔLE DE GESTION"},
  {t:"Rapport semestriel sur le contrôle interne approuvé par l\'oraane délibérant (sW article 2",a:"2024-12-31",dl:"2025-02-28",p:"Semestrielle",e:"AUDIT"},
  {t:"Rapport semestriel sur le contrôle interne approuvé par l\'oraane délibérant (sW article 2",a:"2025-06-30",dl:"2025-08-31",p:"Semestrielle",e:"AUDIT"},
  {t:"Rapport sur la révision semestrielle du portefeuille",a:"2024-12-31",dl:"2025-02-28",p:"Semestrielle",e:"DRC"},
  {t:"Rapport sur la révision semestrielle du portefeuille",a:"2025-06-30",dl:"2025-08-31",p:"Semestrielle",e:"DRC"},
  {t:"Rapport semestriel sur l\'évaluation du risque de non-conformité",a:"2024-12-31",dl:"2025-01-31",p:"Semestrielle",e:"CONFORMITE"},
  {t:"Rapport semestriel sur l\'évaluation du risque de non-conformité",a:"2025-06-30",dl:"2025-07-31",p:"Semestrielle",e:"CONFORMITE"},
  {t:"Rapport annuel sur le dispositif global de gestion des risques approuvé par l\'organe déli",a:"2024-12-31",dl:"2025-04-30",p:"Annuelle",e:"DRC"},
  {t:"Lettre de mission des Commissaires aux comptes",a:"Au titre de l\'année 2025",dl:"2026-01-31",p:"Annuelle",e:"D.FINANCIERE"},
  {t:"Plan préventif de redressement (svt article 7 de la Circulaire n° 001-2020/CB/C relative a",a:"Au titre de l\'année 2024",dl:"2025-01-15",p:"Annuelle (pour les EBIS et les établissements de crédit maisons-mères)",e:"D.FINANCIERE"},
  {t:"Plan préventif de redressement (svt article 7 de la Circulaire n° 001-2020/CB/C relative a",a:"Au titre de l\'année 2024",dl:"2025-01-15",p:"Tous les deux ans (pour les banques, sauf EBIS)",e:"D.FINANCIERE"},
  {t:"Liste des Dirigeants, (svt article 11 de la circulaire n°02-2017/CB/C précisant les condit",a:"2025-01-01",dl:"2025-01-01",p:"Semestrielle",e:"DJRC"},
  {t:"les canevas additionnels de déclaration de la liste semestrielle actualisée des administra",a:"2025-07-01",dl:"2025-07-01",p:"Semestrielle",e:"DJRC"},
  {t:"État des conditions de banque",a:"2024-12-31",dl:"2025-01-05",p:"Semestrielle",e:"DJRC"},
  {t:"État des conditions de banque",a:"2025-06-30",dl:"2025-07-05",p:"Semestrielle",e:"DJRC"},
  {t:"État des conditions de banque",a:"2025-12-31",dl:"2026-01-05",p:"Semestrielle",e:"DJRC"},
  {t:"Publication des conditions de banque dans la presse",a:"2025-01-01",dl:"2025-01-31",p:"Semestrielle",e:"MARKETING"},
  {t:"Publication des conditions de banque dans la presse",a:"2025-07-01",dl:"2025-07-31",p:"Semestrielle",e:"MARKETING"},
  {t:"Annuaire des Établissements de Crédit",a:"2024-12-31",dl:"2026-01-15",p:"Annuelle",e:"DJRC"},
  {t:"Annuaire des Établissements de Crédit",a:"2025-12-31",dl:"2026-01-15",p:"Annuelle",e:"DJRC"},
  {t:"Dispositif de suivi du taux de bancarisation et de l\'accès aux services financiers",a:"2024-12-31",dl:"2025-10-15",p:"Trimestrielle",e:"MARKETING"},
  {t:"État de suivi du traitement en 2025, par les établissements de crédit, du stock de leurs c",a:"Le 15 et le 30 de chaque mois",dl:"2025-01-15",p:"Bimensuelle",e:"ENGAGEMENTS"},
  {t:"État du relevé quotidien de la position extérieure des banques",a:"Tous les jours",dl:"Quotidien",p:"Quotidienne",e:"TRESORERIE"},
  {t:"État de calcul des besoins courants et état MCCE",a:"Tous les jours",dl:"Quotidien",p:"Quotidienne",e:"TRESORERIE"},
  {t:"Etat des variations prévisionnelles des facteurs autonomes de la liquidité bancaire",a:"Tous les lundis",dl:"Hebdomadaire",p:"Hebdomadaire",e:"TRESORERIE"},
  {t:"État des opérations interbancaires",a:"Tous les lundis",dl:"Hebdomadaire",p:"Hebdomadaire",e:"TRESORERIE"}
  ];
}

/* ──────────────────────────────────────────────────────────────
   ENVOI D'EMAILS POUR UN UTILISATEUR
────────────────────────────────────────────────────────────── */
async function sendAlertsForUser(uid) {
  const { emails, docs } = await getUserAlerts(uid);

  if (docs.length === 0) {
    console.log(`[${uid}] Aucune échéance urgente — pas d'email envoyé.`);
    return { sent: false, reason: 'no_alerts' };
  }
  if (emails.length === 0) {
    console.log(`[${uid}] Aucun destinataire configuré.`);
    return { sent: false, reason: 'no_recipients' };
  }

  const transporter = getTransporter();
  const subject = `🔔 RégAlert — ${docs.length} échéance${docs.length > 1 ? 's' : ''} urgente${docs.length > 1 ? 's' : ''} BCEAO`;

  await transporter.sendMail({
    from:    `"RégAlert BCEAO" <${functions.config().gmail.user}>`,
    to:      emails.join(', '),
    subject,
    text:    buildEmailText(docs),
    html:    buildEmailHtml(docs),
  });

  // Enregistrer le log d'envoi dans Firestore
  const todayStr = new Date().toISOString().split('T')[0];
  await db.doc(`users/${uid}/data/emailLog`).set({
    lastSent:     admin.firestore.FieldValue.serverTimestamp(),
    lastSentDate: todayStr,
    lastCount:    docs.length,
    lastRecipients: emails,
  }, { merge: true });

  console.log(`[${uid}] ✅ Email envoyé à ${emails.join(', ')} — ${docs.length} échéance(s)`);
  return { sent: true, count: docs.length, recipients: emails };
}

/* ══════════════════════════════════════════════════════════════
   🕖 CLOUD FUNCTION 1 — CRON PLANIFIÉ : chaque jour à 7h00 GMT
══════════════════════════════════════════════════════════════ */
exports.sendDailyAlerts = functions
  .region('us-central1')
  .pubsub
  .schedule('0 7 * * *')       // ← 7h00 GMT chaque jour
  .timeZone('UTC')
  .onRun(async (context) => {
    console.log('🕖 sendDailyAlerts déclenché :', new Date().toISOString());

    // Récupérer tous les utilisateurs ayant des destinataires configurés
    const usersSnap = await db.collection('users').get();
    const promises  = [];

    for (const userDoc of usersSnap.docs) {
      const uid = userDoc.id;
      promises.push(
        sendAlertsForUser(uid).catch(err =>
          console.error(`[${uid}] Erreur :`, err.message)
        )
      );
    }

    const results = await Promise.all(promises);
    const sent    = results.filter(r => r && r.sent).length;
    console.log(`✅ Terminé — ${sent}/${usersSnap.size} utilisateur(s) notifié(s)`);
    return null;
  });

/* ══════════════════════════════════════════════════════════════
   ⚡ CLOUD FUNCTION 2 — HTTP MANUEL : déclenché depuis l'app
   POST https://us-central1-app-bceao.cloudfunctions.net/sendAlertsManual
   Header : Authorization: Bearer <idToken>
   Body   : { "uid": "<userId>" }
══════════════════════════════════════════════════════════════ */
exports.sendAlertsManual = functions
  .region('us-central1')
  .https
  .onRequest(async (req, res) => {
    // CORS
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') { res.status(204).send(''); return; }
    if (req.method !== 'POST')   { res.status(405).json({ error: 'Méthode non autorisée.' }); return; }

    // Vérification du token Firebase
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token manquant.' });
      return;
    }
    const idToken = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(idToken);
    } catch (e) {
      res.status(401).json({ error: 'Token invalide : ' + e.message });
      return;
    }

    // L'uid du token doit correspondre au uid du body
    const { uid } = req.body;
    if (!uid || uid !== decodedToken.uid) {
      res.status(403).json({ error: 'UID non autorisé.' });
      return;
    }

    try {
      const result = await sendAlertsForUser(uid);
      if (result.sent) {
        res.json({
          success: true,
          message: `Email envoyé à ${result.recipients.join(', ')} — ${result.count} échéance(s) urgente(s).`,
        });
      } else {
        const msgs = {
          no_alerts:     'Aucune échéance urgente en ce moment. Pas d\'email envoyé.',
          no_recipients: 'Aucun destinataire configuré. Ajoutez des adresses email dans les paramètres.',
        };
        res.json({ success: false, message: msgs[result.reason] || 'Rien à envoyer.' });
      }
    } catch (e) {
      console.error('[sendAlertsManual] Erreur :', e);
      res.status(500).json({ error: e.message });
    }
  });
