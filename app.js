// =====================================================================
//  APPLI DE COURSE TDSL — logique
//  Étape 1 : Avant le départ, compte à rebours, correction d'heure.
//  Étape 2 : écrans Segment / Ressenti / Ravito, nutrition par heure,
//            flasques, fourchettes en direct, mode test simple.
//  Étape 3 : statut chrono, état (ressenti), conseils, alerte douleur
//            vive, recalage « Tu es à quel ravito ? ».
// =====================================================================

(function () {
  "use strict";

  const CLE_REELLE = "tdsl-course-etat-v1";     // données de la vraie course
  const CLE_TEST = "tdsl-course-etat-test";     // données du mode test (séparées)
  const CLE_MODE_TEST = "tdsl-course-mode-test";
  const app = document.getElementById("app");
  const NB_LIEUX = COURSE.lieux.length - 1;     // 5 arrivées de segment
  const IDX_SAINT_ROCH = COURSE.lieux.findIndex((l) => l.id === "saint-roch");
  const IDX_FERION = COURSE.lieux.findIndex((l) => l.id === "ferion");

  // ---------- Petits outils de stockage ----------
  function lireJSON(cle) {
    try { const b = localStorage.getItem(cle); return b ? JSON.parse(b) : null; } catch (e) { return null; }
  }
  function ecrireJSON(cle, val) {
    try {
      if (val === null) localStorage.removeItem(cle);
      else localStorage.setItem(cle, JSON.stringify(val));
    } catch (e) { /* stockage plein ou bloqué : on continue sans planter */ }
  }

  // ---------- Heure « maintenant » (décalée en mode test) ----------
  let modeTest = lireJSON(CLE_MODE_TEST);   // { decalageMs } ou null
  function maintenant() {
    return new Date(Date.now() + (modeTest ? modeTest.decalageMs : 0));
  }

  // ---------- Sauvegarde : tout est écrit à chaque appui ----------
  // passages[1..5] = { arrivee, depart, ressenti:{}, ressentiFini, ressentiPasse,
  //                    statut, margeBarriere, fenMin, fenMax, recale }
  function etatVide() {
    return {
      heureDepartCorrigee: null,
      compteAReboursLance: false,
      passages: {},
      preparees: { iso: [], sachets: [] },
      recalageIgnoreJusqua: null,
      evenements: [],              // { heure: ISO, type, detail }
    };
  }
  function charger() {
    const brut = lireJSON(modeTest ? CLE_TEST : CLE_REELLE);
    const e = Object.assign(etatVide(), brut || {});
    e.preparees = Object.assign({ iso: [], sachets: [] }, e.preparees || {});
    e.passages = e.passages || {};
    return e;
  }
  let etat = charger();

  function sauver() {
    ecrireJSON(modeTest ? CLE_TEST : CLE_REELLE, etat);
  }
  function noterEvenement(type, detail) {
    etat.evenements.push({ heure: maintenant().toISOString(), type: type, detail: detail || "" });
    sauver();
  }

  // ---------- Outils heures / nombres ----------
  function hhmmEnMinutes(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return h * 60 + m;
  }
  function minutesEnHhmm(min) {
    min = ((min % 1440) + 1440) % 1440;
    return String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0");
  }
  function joli(hhmm) {                       // "07:35" -> "7h35"
    const [h, m] = hhmm.split(":");
    return Number(h) + "h" + m;
  }
  function jolieDate(d) {                     // Date -> "7h35"
    return d.getHours() + "h" + String(d.getMinutes()).padStart(2, "0");
  }
  function jolieDuree(ms) {                   // 34920000 -> "9h42"
    const min = Math.max(0, Math.round(ms / 60000));
    return Math.floor(min / 60) + "h" + String(min % 60).padStart(2, "0");
  }
  function km(n) {
    return n.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  }
  function metres(n) {
    return n.toLocaleString("fr-FR");
  }
  function echapper(t) {
    return String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
  function capitaliser(t) {
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  function dateDuJour(hhmm) {                 // "HH:MM" le jour de la course -> Date
    const [a, mo, j] = COURSE.dateDepart.split("-").map(Number);
    const [h, mi] = hhmm.split(":").map(Number);
    return new Date(a, mo - 1, j, h, mi, 0, 0);
  }
  function heureDepartActuelle() {
    return etat.heureDepartCorrigee || COURSE.heureDepart;
  }
  function dateDepart() {
    return dateDuJour(heureDepartActuelle());
  }
  function dureeEnMs(hmm) {                   // "2:37" -> ms
    const [h, m] = hmm.split(":").map(Number);
    return (h * 60 + m) * 60000;
  }

  // ---------- Nutrition : dépend uniquement de l'heure de course ----------
  function heureDeCourse(d) {                 // départ 5h30 : à 8h50 -> H4
    const ms = d - dateDepart();
    if (ms < 0) return 1;
    return Math.floor(ms / 3600000) + 1;
  }
  function nutritionPour(h) {
    return COURSE.nutrition[h] || COURSE.nutritionReserve;
  }
  function debutHeure(h) {
    return new Date(dateDepart().getTime() + (h - 1) * 3600000);
  }

  // ---------- Où en est la course ? ----------
  function estPasse(p) {                      // lieu atteint (ou sauté lors d'un recalage)
    return p && (p.arrivee || p.recale);
  }
  function dernierLieuAtteint() {
    let k = 0;
    for (let i = 1; i <= NB_LIEUX; i++) if (estPasse(etat.passages[i])) k = i;
    return k;
  }
  function phase() {
    const k = dernierLieuAtteint();
    if (k === 0) {
      if (maintenant() < dateDepart()) return { ecran: "avant" };
      return { ecran: "segment", seg: 0 };
    }
    const p = etat.passages[k];
    if (k === NB_LIEUX && p.arrivee) return { ecran: "arrivee" };
    if (p.arrivee && !p.depart && !p.recale) {
      if (p.ressenti && p.ressenti.douleur === 3) return { ecran: "alerte", lieu: k };  // prioritaire sur tout
      return { ecran: p.ressentiFini ? "ravito" : "ressenti", lieu: k };
    }
    if (k === IDX_SAINT_ROCH && p.depart && !p.decision) return { ecran: "col", lieu: k };
    return { ecran: "segment", seg: k };
  }

  // ---------- Fourchette d'arrivée au ravito suivant ----------
  // En direct : heure de départ réelle + temps min/max du segment (+15 % si
  // « Plus lent que prévu » au ravito précédent). Jamais au-delà de la barrière.
  // Départ inconnu (ravito sauté) : on reprend le plan.
  function departDuSegment(i) {
    if (i === 0) return dateDepart();
    const p = etat.passages[i];
    if (!p) return maintenant();
    if (p.depart) return new Date(p.depart);
    if (p.recale) return null;
    return maintenant();                      // encore au ravito : « si tu repars maintenant »
  }
  function fenetreArrivee(i, depart, n) {
    const seg = COURSE.segments[i];
    const planMin = dateDuJour(seg.arriveeMin);
    const planMax = dateDuJour(seg.arriveeMax);
    const barriere = dateDuJour(seg.barriere);
    const precedent = i > 0 ? etat.passages[i] : null;
    const facteur = precedent && precedent.statut === "lent" ? 1.15 : 1;
    let min, max;
    if (depart) {
      min = new Date(depart.getTime() + dureeEnMs(seg.tempsMin) * facteur);
      max = new Date(depart.getTime() + dureeEnMs(seg.tempsMax) * facteur);
    } else {
      min = planMin; max = planMax;
    }
    if (max > barriere) max = barriere;
    if (min > max) min = max;
    const recalee = Math.abs(min - planMin) >= 60000 || Math.abs(max - planMax) >= 60000;
    return {
      min: min, max: max, recalee: recalee, barriere: barriere, plus15: facteur > 1,
      depassee: n > max,
      margeMin: Math.round((barriere - n) / 60000),
    };
  }

  // ---------- 4.1 Statut chrono (calculé à chaque arrivée) ----------
  function calculerStatut(k, arrivee) {
    const i = k - 1;
    const seg = COURSE.segments[i];
    const fen = fenetreArrivee(i, departDuSegment(i), arrivee);
    const marge = Math.round((dateDuJour(seg.barriere) - arrivee) / 60000);
    let statut;
    if (marge < COURSE.reglages.margeBarriereMin) statut = "barriere";
    else if (arrivee < fen.min) statut = "avance";
    else if (arrivee <= fen.max) statut = "plan";
    else statut = "lent";
    return { statut: statut, margeBarriere: marge, fenMin: fen.min.toISOString(), fenMax: fen.max.toISOString() };
  }
  function dureeArret(k) {
    const p = etat.passages[k];
    if (p.statut === "barriere") return 2;
    if (p.statut === "lent") return 10;
    return COURSE.segments[k - 1].arretPrevu;
  }

  // ---------- 4.2 État selon le ressenti ----------
  // 1 = vert, 2 = orange, 3 = rouge ; null si ressenti passé ou vide
  function niveauEtat(p) {
    if (!p || p.ressentiPasse || !p.ressenti) return null;
    const v = Object.values(p.ressenti).filter((x) => x);
    if (!v.length) return null;
    return Math.max.apply(null, v);
  }
  // Conseils ajoutés, dans l'ordre de priorité (ventre avant moral avant douleur légère)
  function conseilsRessenti(p) {
    const r = (p && !p.ressentiPasse && p.ressenti) || {};
    const liste = [];
    if (r.ventre >= 2) liste.push({ fort: r.ventre === 3, texte: "Eau plate, ralentis 15 min, pas de gel. Coca, soupe, salé au ravito." });
    if (r.moral === 3) liste.push({ texte: "Un gel + 20 min de marche. Objectif : le prochain ravito." });
    if (r.douleur === 2) liste.push({ texte: "Descentes plus lentes, surveille." });
    return liste;
  }

  // ---------- 4.3 Col Saint-Roch : objectif proposé ----------
  // Les heures du tableau sont prévues pour un départ à 5h30 : on les décale
  // si le départ réel a été décalé.
  function decalageDepartMs() {
    return dateDepart() - dateDuJour(COURSE.heureDepart);
  }
  function ligneObjectif(idx) {
    const table = COURSE.objectifsCol;
    const l = table[Math.min(idx, table.length - 1)];
    if (!l.duree) return { idx: idx, finir: true, objectif: l.objectif, texte: l.texte };
    const arrivee = new Date(dateDepart().getTime() + dureeEnMs(l.duree));
    const limite = new Date(arrivee.getTime() - COURSE.minutesFerionAvantArrivee * 60000);
    return {
      idx: idx, finir: false, objectif: l.objectif, texte: l.texte,
      arriveeVisee: arrivee.toISOString(), limiteFerion: limite.toISOString(),
    };
  }
  // Objectif suivant (+30 min) : première ligne avec un temps visé plus long
  function ligneSuivante(idx) {
    const table = COURSE.objectifsCol;
    const actuelle = table[idx].duree;
    for (let j = idx + 1; j < table.length; j++) {
      if (!table[j].duree || table[j].duree !== actuelle) return ligneObjectif(j);
    }
    return ligneObjectif(table.length - 1);
  }
  // 🟢 (ou ressenti passé) -> ligne du tableau ; 🟡 -> ligne suivante ; 🔴 -> finir
  function proposerObjectif(depart, niveau) {
    if (niveau === 3) return { finir: true, objectif: "Finir en contrôle", texte: "", raison: "etat" };
    const t = new Date(depart.getTime() - decalageDepartMs());
    const minutes = t.getHours() * 60 + t.getMinutes();
    let idx = COURSE.objectifsCol.findIndex((l) => minutes <= hhmmEnMinutes(l.jusqua));
    if (idx < 0) idx = COURSE.objectifsCol.length - 1;
    if (niveau === 2) idx = Math.min(idx + 1, COURSE.objectifsCol.length - 1);
    const o = ligneObjectif(idx);
    if (o.finir) o.raison = "chrono";
    return o;
  }
  function sub(o) {                           // "Sub 10h30" -> "sub 10h30"
    return o.objectif.replace(/^Sub/, "sub");
  }
  // Objectif choisi au col (null si refusé / finir / col sauté)
  function objectifChoisiAuCol() {
    const sr = etat.passages[IDX_SAINT_ROCH];
    return sr && sr.decision === "go" && sr.objectif && !sr.objectif.finir ? sr.objectif : null;
  }

  // ---------- Calcul des flasques et sachets au ravito ----------
  function prepareesAuDepart(impair) {
    const limite = dateDuJour(COURSE.segments[0].arriveeMax);
    const liste = [];
    for (let h = 1; h <= 12; h++) if ((h % 2 === 1) === impair && debutHeure(h) <= limite) liste.push(h);
    return liste;
  }
  function heuresAPreparer(impair, n, fin) {
    const deja = new Set(prepareesAuDepart(impair).concat(impair ? etat.preparees.iso : etat.preparees.sachets));
    const liste = [];
    for (let h = 1; h <= 12; h++) {
      if ((h % 2 === 1) !== impair || deja.has(h)) continue;
      const debut = debutHeure(h);
      if (debut <= fin && debut > new Date(n.getTime() - 3600000)) liste.push(h);
    }
    return liste;
  }
  function calculRavito(k) {
    const n = maintenant();
    const fin = fenetreArrivee(k, n, n).max;  // de maintenant à l'heure max d'arrivée au suivant
    const estFerion = COURSE.lieux[k].id === "ferion";
    const total = estFerion && !COURSE.reglages.reserveExigeeAuFerion ? 2 : COURSE.reglages.flasquesParDefaut;
    const iso = heuresAPreparer(true, n, fin).slice(0, total);
    const sachets = heuresAPreparer(false, n, fin);
    return { total: total, iso: iso, eau: total - iso.length, sachets: sachets };
  }

  // ---------- Recalage : l'appli n'a pas été ouverte à un ravito ? ----------
  function recalageSuspect() {
    const n = maintenant();
    if (etat.recalageIgnoreJusqua && n < new Date(etat.recalageIgnoreJusqua)) return false;
    const ph = phase();
    if (ph.ecran === "segment") {
      // 30 min après la fin de la fourchette : tu as sans doute passé le ravito sans ouvrir l'appli
      const fen = fenetreArrivee(ph.seg, departDuSegment(ph.seg), n);
      return n - fen.max > 30 * 60000;
    }
    if (ph.ecran === "ravito" || ph.ecran === "ressenti") {
      return n - new Date(etat.passages[ph.lieu].arrivee) > 30 * 60000;
    }
    return false;
  }
  function verifierRecalage() {
    if (!ecranForce && recalageSuspect()) ecranForce = "recalage";
  }

  // ---------- Morceaux d'écran réutilisables ----------
  function blocArrivee(seg, avecProfil, fen, labelDebut, extra) {
    const label = (labelDebut || seg.id) + " · Arrivée " + echapper(seg.a);
    const profil = avecProfil ? `<div class="info">${km(seg.distance)} km · +${metres(seg.dPlus)} m · −${metres(seg.dMoins)} m</div>` : "";
    const plan = `${joli(seg.arriveeMin)} – ${joli(seg.arriveeMax)}`;

    if (fen && fen.depassee) {
      const serre = fen.margeMin < COURSE.reglages.margeBarriereMin;
      const marge = fen.margeMin > 0 ? "Encore " + jolieDuree(fen.margeMin * 60000) : "Barrière passée";
      return `
        <section class="bloc">
          <div class="bloc-label">${label}</div>
          <div class="gros ${serre ? "rouge" : "orange"}">Barrière ${joli(seg.barriere)}</div>
          <div class="consigne">${marge}${serre ? " · cours les replats, mange en marchant" : " · avance régulièrement"}</div>
          <div class="info">Fourchette ${jolieDate(fen.min)} – ${jolieDate(fen.max)} dépassée</div>
          ${extra || ""}
          ${profil}
        </section>`;
    }
    const fourchette = fen ? `${jolieDate(fen.min)} – ${jolieDate(fen.max)}` : plan;
    const notes = [];
    if (fen && fen.plus15) notes.push("temps +15 %");
    if (fen && fen.recalee) notes.push("plan initial " + plan);
    return `
      <section class="bloc">
        <div class="bloc-label">${label}</div>
        <div class="gros vert">${fourchette}</div>
        <div class="info">Barrière ${joli(seg.barriere)}${notes.length ? " · " + notes.join(" · ") : ""}</div>
        ${extra || ""}
        ${profil}
      </section>`;
  }

  function blocConsignes(seg, tropVite, objectif) {
    let bpmAffiche = seg.bpmTexte ? "BPM " + seg.bpmTexte : "BPM " + seg.bpm;
    let note = seg.bpmNote;
    if (objectif && seg.bpmObjectif) {
      bpmAffiche = "BPM " + seg.bpmObjectif;
      note = "objectif " + sub(objectif);
    } else if (seg.bpmObjectif) {
      note = "";                              // pas d'objectif : on n'affiche pas le 172
    }
    if (tropVite && !seg.bpmTexte) {
      bpmAffiche = "BPM " + (seg.bpm - 5);
      note = "−5 : tu vas trop vite";
    }
    return `
      <section class="bloc">
        <div class="bloc-ligne">
          <div class="bloc-label">Consignes</div>
          <div>
            <div class="bpm">${echapper(bpmAffiche)}</div>
            ${note ? `<div class="bpm-note">${echapper(note)}</div>` : ""}
          </div>
        </div>
        ${seg.consignes.map((c) => `<div class="consigne">${echapper(c)}</div>`).join("")}
      </section>`;
  }

  function blocNutrition(h) {
    const texte = capitaliser(nutritionPour(h)).replace(/, /g, " · ");
    return `
      <section class="bloc">
        <div class="bloc-label">Nutrition</div>
        <div class="nutri-h">H${h}</div>
        <div class="nutri-txt">${echapper(texte)}</div>
      </section>`;
  }

  function bandeauTest() {
    return modeTest
      ? `<button class="bandeau-test" data-action="test">MODE TEST · <span id="horloge-test"></span> · régler</button>`
      : "";
  }

  // ---------- Écrans ----------
  let ecranForce = null;      // "correction", "test" ou "recalage"
  let minutesEnReglage = null;
  let signatureAffichee = null;
  let calculAffiche = null;   // flasques affichées, enregistrées au « Je repars »

  function dessinerAvant() {
    const seg = COURSE.segments[0];
    const lance = etat.compteAReboursLance;
    const jour = dateDepart().toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "2-digit" });
    return `
      <header class="entete">
        <div class="surtitre">Avant le départ</div>
        <h1 class="titre">Départ ${joli(heureDepartActuelle())}</h1>
        ${lance
          ? `<div class="sous-titre">La course démarre seule dans</div>
             <div class="compte" id="compte"></div>`
          : `<div class="sous-titre">${echapper(capitaliser(jour))} · dans <span id="compte"></span></div>`}
      </header>
      ${blocArrivee(seg, true, fenetreArrivee(0, dateDepart(), maintenant()))}
      ${blocConsignes(seg)}
      ${blocNutrition(1)}
      <div class="espace"></div>
      ${lance ? "" : `<button class="btn btn-principal" data-action="lancer">Départ dans 5 min</button>`}
      <button class="btn" data-action="corriger">Départ décalé ? Corriger l'heure</button>`;
  }

  function dessinerSegment(i) {
    const seg = COURSE.segments[i];
    const lieuFin = COURSE.lieux[i + 1];
    const n = maintenant();
    const correctionPossible = i === 0 && n - dateDepart() < 30 * 60000;
    // « Tu vas trop vite : BPM −5 » si en avance au ravito précédent (avant Saint-Roch)
    const precedent = i > 0 ? etat.passages[i] : null;
    const tropVite = !!(precedent && precedent.statut === "avance" && i < IDX_SAINT_ROCH);
    return `
      <header class="entete">
        <div class="entete-ligne">
          <h1 class="titre-seg">${seg.id} · ${echapper(seg.de)} → ${echapper(seg.a)}</h1>
          <div class="horloge" id="horloge"></div>
        </div>
      </header>
      ${blocSegmentArrivee(i, n)}
      ${blocConsignes(seg, tropVite, i === IDX_SAINT_ROCH ? objectifChoisiAuCol() : null)}
      ${blocNutrition(heureDeCourse(n))}
      <div class="espace"></div>
      <div class="noter">
        <div class="noter-label">Noter</div>
        <button class="btn-noter" data-action="noter" data-type="coup de mou">Coup de mou</button>
        <button class="btn-noter" data-action="noter" data-type="douleur">Douleur</button>
        <button class="btn-noter" data-action="noter" data-type="ventre">Ventre</button>
      </div>
      ${correctionPossible ? `<button class="btn" data-action="corriger">Départ décalé ? Corriger l'heure</button>` : ""}
      <button class="btn btn-principal" data-action="arrive">J'arrive ${echapper(lieuFin.au)}</button>`;
  }

  function blocSegmentArrivee(i, n) {
    const seg = COURSE.segments[i];
    const fen = fenetreArrivee(i, departDuSegment(i), n);
    // S4 avec objectif : l'heure-limite au Férion devient le gros chiffre
    const obj = i === IDX_SAINT_ROCH ? objectifChoisiAuCol() : null;
    if (obj) {
      const limite = new Date(obj.limiteFerion);
      const rate = n > limite;
      return `
        <section class="bloc">
          <div class="bloc-label">${seg.id} · Pour le ${echapper(sub(obj))} : Férion avant</div>
          <div class="gros ${rate ? "orange" : "violet"}">${jolieDate(limite)}</div>
          ${rate ? `<div class="consigne">Limite dépassée : continue, on fait le point au Férion</div>` : ""}
          <div class="info">Barrière ${joli(seg.barriere)}</div>
        </section>`;
    }
    // S5 : rappel de l'objectif décidé au Férion
    const fe = i === IDX_FERION ? etat.passages[IDX_FERION] : null;
    const extra = fe && fe.objectifFerion && !fe.objectifFerion.finir
      ? `<div class="ligne-objectif">Objectif ${echapper(sub(fe.objectifFerion))} : arrivée avant ${jolieDate(new Date(fe.objectifFerion.arriveeVisee))}</div>`
      : "";
    return blocArrivee(seg, false, fen, null, extra);
  }

  const QUESTIONS = [
    { cle: "jambes",  label: "Jambes",  choix: ["fraîches", "lourdes", "cramées"] },
    { cle: "ventre",  label: "Ventre",  choix: ["OK", "nausée", "bloqué"] },
    { cle: "douleur", label: "Douleur", choix: ["aucune", "légère", "vive"] },
    { cle: "moral",   label: "Moral",   choix: ["bon", "moyen", "au fond"] },
  ];

  function dessinerRessenti(k) {
    const p = etat.passages[k];
    const lieu = COURSE.lieux[k];
    return `
      <header class="entete">
        <div class="surtitre">J'arrive · ${echapper(lieu.nom)}</div>
        <h1 class="titre">Arrivé à ${jolieDate(new Date(p.arrivee))}</h1>
      </header>
      ${QUESTIONS.map((q) => `
        <div class="question">
          <div class="bloc-label">${q.label}</div>
          <div class="choix">
            ${q.choix.map((c, idx) => {
              const v = idx + 1;
              const actif = p.ressenti[q.cle] === v ? ` actif niveau-${v}` : "";
              return `<button class="btn-choix${actif}" data-action="choix" data-q="${q.cle}" data-v="${v}">${c}</button>`;
            }).join("")}
          </div>
        </div>`).join("")}
      <div class="espace"></div>
      <button class="btn btn-principal" data-action="plan">Voir mon plan</button>
      <button class="btn" data-action="passer">Passer, je n'ai pas le temps</button>`;
  }

  const STATUTS = {
    avance:   { titre: "En avance",                 classe: "statut-avance" },
    plan:     { titre: "Dans le plan",              classe: "statut-plan" },
    lent:     { titre: "Plus lent que prévu",       classe: "statut-lent" },
    barriere: { titre: "Course contre la barrière", classe: "statut-barriere" },
  };
  function sousTitreStatut(k, p) {
    if (p.statut === "avance") return k < IDX_SAINT_ROCH ? "Tu vas trop vite : BPM −5" : "";
    if (p.statut === "lent") return "Ravito de 10 min pour bien manger · temps visés +15 %";
    if (p.statut === "barriere") return "Ravito 2 min · mange en marchant · cours les replats";
    return "";
  }

  function dessinerRavito(k) {
    const p = etat.passages[k];
    const lieu = COURSE.lieux[k];
    const segSuivant = COURSE.segments[k];
    const arrivee = new Date(p.arrivee);
    const arret = dureeArret(k);
    const reparsAvant = new Date(arrivee.getTime() + arret * 60000);
    const c = calculRavito(k);
    calculAffiche = c;

    const st = STATUTS[p.statut] || STATUTS.plan;
    const sous = sousTitreStatut(k, p);
    const niveau = niveauEtat(p);
    const pastille = niveau ? ["", "🟢", "🟡", "🔴"][niveau] : "";

    const detailIso = c.iso.length
      ? `${c.iso.length} ISO (poudre ${c.iso.map((h) => "H" + h).join(" + ")})` + (c.eau ? ` + ${c.eau} eau` : "")
      : `${c.eau} eau`;
    const sachets = c.sachets.length === 0 ? ""
      : c.sachets.length === 1 ? `Sachet H${c.sachets[0]} devant`
      : `Sachets ${c.sachets.slice(0, -1).map((h) => "H" + h).join(", ")} et H${c.sachets[c.sachets.length - 1]} devant`;
    const vides = c.total >= 4 ? "" : c.total === 3 ? "La 4e reste vide" : "La 3e et la 4e restent vides";
    const conseils = conseilsRessenti(p);

    return `
      <header class="entete">
        <div class="entete-ligne">
          <div class="surtitre">Ravito · ${echapper(lieu.court)} · arrivé ${jolieDate(arrivee)}</div>
          <div class="horloge" id="horloge"></div>
        </div>
        <div class="statut ${st.classe}">
          <div class="statut-ligne"><span>${st.titre}</span><span>${pastille}</span></div>
          ${sous ? `<div class="statut-sous">${sous}</div>` : ""}
        </div>
        <h1 class="titre-moyen">Repars au plus tard à ${jolieDate(reparsAvant)}</h1>
      </header>
      <section class="bloc">
        <div class="bloc-label">Au ravito</div>
        <div class="flasques">Remplis ${c.total} flasques</div>
        <div class="flasques-detail">${echapper(detailIso)}</div>
        ${sachets ? `<div class="consigne">${sachets}</div>` : ""}
        ${vides ? `<div class="info">${vides}</div>` : ""}
        ${conseils.map((x) => `<div class="conseil${x.fort ? " fort" : ""}">${echapper(x.texte)}</div>`).join("")}
      </section>
      ${blocArrivee(segSuivant, true, fenetreArrivee(k, maintenant(), maintenant()), "Ensuite · " + segSuivant.id, bilanFerion(p))}
      <div class="espace"></div>
      <button class="btn btn-principal" data-action="repars">Je repars</button>`;
  }

  // Au Férion : « Objectif tenu » ou objectif suivant (+30 min)
  function bilanFerion(p) {
    const o = p.objectifFerion;
    if (!o) return "";
    if (o.resultat === "tenu") {
      return `<div class="ligne-objectif">Objectif tenu : 45 min pour aller au bout · ${echapper(sub(o))} avant ${jolieDate(new Date(o.arriveeVisee))}</div>`;
    }
    if (o.finir) return `<div class="ligne-objectif">Objectif manqué : finis en contrôle</div>`;
    return `<div class="ligne-objectif">Nouvel objectif : ${echapper(sub(o))} · arrivée avant ${jolieDate(new Date(o.arriveeVisee))}</div>`;
  }

  // 5. Col Saint-Roch : écran de décision (seul endroit où un objectif chrono apparaît)
  function dessinerCol(k) {
    const p = etat.passages[k];
    const depart = new Date(p.depart);
    const seg = COURSE.segments[k];           // S4
    const o = proposerObjectif(depart, niveauEtat(p));
    const entete = `
      <header class="entete">
        <div class="entete-ligne">
          <div class="surtitre">Col Saint-Roch · départ ${jolieDate(depart)}</div>
          <div class="horloge" id="horloge"></div>
        </div>`;
    if (o.finir) {
      const raison = o.raison === "etat" ? "État 🔴 : pas d'objectif chrono" : "Trop tard pour un objectif chrono";
      return entete + `
          <h1 class="titre">Finir en contrôle</h1>
          <div class="sous-titre">${raison}</div>
        </header>
        ${blocConsignes(seg, false, null)}
        <div class="espace"></div>
        <button class="btn btn-principal" data-action="col-finir">C'est parti</button>`;
    }
    const limite = new Date(o.limiteFerion);
    return entete + `
        <h1 class="titre-moyen">Objectif proposé : ${echapper(o.objectif)}</h1>
        ${o.texte ? `<div class="sous-titre violet">${echapper(capitaliser(o.texte))}</div>` : ""}
      </header>
      <section class="bloc bloc-objectif">
        <div class="bloc-label">Pour le ${echapper(sub(o))} : Férion avant</div>
        <div class="gros violet">${jolieDate(limite)}</div>
      </section>
      ${blocConsignes(seg, false, o)}
      <div class="espace"></div>
      <button class="btn btn-principal btn-objectif" data-action="col-go">Go pour le ${echapper(sub(o))}</button>
      <button class="btn" data-action="col-non">Non, je finis tranquille</button>`;
  }

  // 6. Alerte douleur vive : écran rouge plein, prioritaire sur tout.
  // Le ressenti se remplit AU ravito : le « prochain ravito » est donc celui où tu es.
  function dessinerAlerte(k) {
    const lieu = COURSE.lieux[k];
    return `
      <div class="alerte-plein">
        <div class="surtitre clair">Douleur vive</div>
        <h1 class="titre">Arrête-toi ici.</h1>
        <div class="alerte-lieu">${echapper(lieu.nom)}</div>
        <div class="alerte-txt">Préviens un bénévole.</div>
        <div class="espace"></div>
        <button class="btn btn-blanc" data-action="erreur-alerte">Je me suis trompé de bouton</button>
      </div>`;
  }

  // Recalage : « Tu es à quel ravito ? »
  function dessinerRecalage() {
    const ph = phase();
    const k = dernierLieuAtteint();
    const boutons = [];
    for (let j = k + 1; j <= NB_LIEUX; j++) {
      boutons.push(`<button class="btn btn-gros" data-action="recaler" data-lieu="${j}">${echapper(COURSE.lieux[j].nom)}</button>`);
    }
    const rester = ph.ecran === "segment"
      ? `Je suis toujours en route vers ${echapper(COURSE.segments[ph.seg].a)}`
      : `Je suis toujours ${echapper(COURSE.lieux[k].au)}`;
    return `
      <header class="entete">
        <div class="surtitre">On se recale</div>
        <h1 class="titre">Tu es à quel ravito ?</h1>
      </header>
      ${boutons.join("")}
      <div class="espace"></div>
      <button class="btn" data-action="pas-recaler">${rester}</button>`;
  }

  // Écran provisoire d'arrivée (tableau complet + Excel à l'étape 5)
  function dessinerArrivee() {
    const fin = new Date(etat.passages[NB_LIEUX].arrivee);
    const lignes = [];
    for (let i = 1; i <= NB_LIEUX; i++) {
      const p = etat.passages[i];
      if (p && p.arrivee) lignes.push(`<div class="bloc-ligne info"><span>${echapper(COURSE.lieux[i].court)}</span><span>${jolieDate(new Date(p.arrivee))}</span></div>`);
    }
    return `
      <header class="entete">
        <div class="surtitre">Arrivée · Levens</div>
        <h1 class="titre">${jolieDuree(fin - dateDepart())}</h1>
        <div class="sous-titre">Bravo ! Arrivé à ${jolieDate(fin)}</div>
      </header>
      <section class="bloc">
        <div class="bloc-label">Passages</div>
        ${lignes.join("")}
      </section>
      <div class="espace"></div>
      <div class="discret">Tableau complet et export Excel : étape 5.</div>`;
  }

  function dessinerReglage(titre, surtitre, boutons, sousTexte) {
    return `
      <header class="entete">
        <div class="surtitre">${surtitre}</div>
        <h1 class="titre">${titre}</h1>
      </header>
      <section class="bloc">
        <div class="reglage-heure" id="reglage">${joli(minutesEnHhmm(minutesEnReglage))}</div>
        <div class="discret">${sousTexte}</div>
      </section>
      <div class="grille-4">
        ${boutons.map((b) => `<button class="btn" data-action="ajuster" data-min="${b[1]}">${b[0]}</button>`).join("")}
      </div>`;
  }

  function dessinerCorrection() {
    return dessinerReglage("Départ réel", "Corriger l'heure de départ",
      [["−5", -5], ["−1", -1], ["+1", 1], ["+5", 5]], "Prévu : " + joli(COURSE.heureDepart)) + `
      <button class="btn" data-action="maintenant">Le départ vient d'être donné</button>
      <div class="espace"></div>
      <div class="deux-btn">
        <button class="btn" data-action="annuler">Annuler</button>
        <button class="btn btn-principal" data-action="valider">Valider</button>
      </div>`;
  }

  function dessinerTest() {
    return dessinerReglage("Simuler l'heure", "Mode test",
      [["−1 h", -60], ["−5", -5], ["+5", 5], ["+1 h", 60]],
      "Dimanche 29/11 · données de test séparées de la vraie course") + `
      <button class="btn btn-principal" data-action="test-valider">Faire comme s'il était cette heure</button>
      <button class="btn" data-action="test-effacer">Effacer les données de test</button>
      ${modeTest ? `<button class="btn" data-action="test-quitter">Quitter le mode test</button>` : ""}
      <div class="espace"></div>
      <button class="btn" data-action="annuler">Annuler</button>`;
  }

  function rafraichirChiffres() {
    const n = maintenant();
    const compte = document.getElementById("compte");
    if (compte) compte.textContent = tempsRestant(dateDepart() - n);
    const horloge = document.getElementById("horloge");
    if (horloge) horloge.textContent = jolieDate(n);
    const ht = document.getElementById("horloge-test");
    if (ht) ht.textContent = jolieDate(n);
  }

  function tempsRestant(ms) {                 // "2 j 16 h", "3 h 12 min", "4:05"
    if (ms <= 0) return "0:00";
    const s = Math.ceil(ms / 1000);
    const j = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (j > 0) return j + " j " + h + " h";
    if (h > 0) return h + " h " + String(m).padStart(2, "0") + " min";
    return m + ":" + String(sec).padStart(2, "0");
  }

  let ecranPrecedent = null;
  function afficher(forcer) {
    const n = maintenant();
    const ph = phase();
    const ecran = ecranForce || ph.ecran;
    const signature = [ecran, ph.seg, ph.lieu, heureDeCourse(n),
      ecran === "ravito" || ecran === "segment" || ecran === "col" ? Math.floor(n / 60000) : ""].join("|");
    if (forcer || signature !== signatureAffichee) {
      if (ecranPrecedent === "avant" && ph.ecran === "segment") {
        noterEvenement("départ", "course démarrée à " + joli(heureDepartActuelle()));
      }
      ecranPrecedent = ph.ecran;
      const changeEcran = !signatureAffichee || signatureAffichee.split("|")[0] !== ecran;
      signatureAffichee = signature;
      let html;
      if (ecran === "correction") html = dessinerCorrection();
      else if (ecran === "test") html = dessinerTest();
      else if (ecran === "recalage") html = dessinerRecalage();
      else if (ecran === "avant") html = dessinerAvant();
      else if (ecran === "segment") html = dessinerSegment(ph.seg);
      else if (ecran === "ressenti") html = dessinerRessenti(ph.lieu);
      else if (ecran === "alerte") html = dessinerAlerte(ph.lieu);
      else if (ecran === "col") html = dessinerCol(ph.lieu);
      else if (ecran === "ravito") html = dessinerRavito(ph.lieu);
      else html = dessinerArrivee();
      document.body.classList.toggle("fond-alerte", ecran === "alerte");
      app.innerHTML = bandeauTest() + html;
      if (changeEcran) window.scrollTo(0, 0);
    }
    rafraichirChiffres();
  }

  // ---------- Appuis sur les boutons ----------
  function enregistrerArrivee(k, n, viaRecalage) {
    const s = calculerStatut(k, n);
    etat.passages[k] = Object.assign({
      arrivee: n.toISOString(), depart: null, ressenti: {},
      ressentiFini: k === NB_LIEUX, ressentiPasse: false,
    }, s);
    const obj = objectifChoisiAuCol();
    if (k === IDX_FERION && obj) {
      const tenu = n <= new Date(obj.limiteFerion);
      const o = tenu ? obj : ligneSuivante(obj.idx);
      etat.passages[k].objectifFerion = Object.assign({}, o, { resultat: tenu ? "tenu" : "suivant" });
      noterEvenement("objectif au Férion", tenu ? "tenu : " + obj.objectif : "nouvel objectif : " + o.objectif);
    }
    noterEvenement("j'arrive", COURSE.lieux[k].nom + " · " + STATUTS[s.statut].titre + (viaRecalage ? " (recalage)" : ""));
  }

  app.addEventListener("click", function (ev) {
    const bouton = ev.target.closest("button[data-action]");
    if (!bouton) return;
    const action = bouton.dataset.action;
    const n = maintenant();
    const ph = phase();

    switch (action) {
      // --- Avant le départ ---
      case "lancer":
        etat.compteAReboursLance = true;
        noterEvenement("compte à rebours", "départ prévu à " + joli(heureDepartActuelle()));
        break;

      // --- Correction de l'heure de départ ---
      case "corriger":
        minutesEnReglage = hhmmEnMinutes(heureDepartActuelle());
        ecranForce = "correction";
        break;
      case "ajuster":
        minutesEnReglage = Math.max(0, Math.min(1439, minutesEnReglage + Number(bouton.dataset.min)));
        document.getElementById("reglage").textContent = joli(minutesEnHhmm(minutesEnReglage));
        return;
      case "maintenant":
        minutesEnReglage = n.getHours() * 60 + n.getMinutes();
        document.getElementById("reglage").textContent = joli(minutesEnHhmm(minutesEnReglage));
        return;
      case "annuler":
        ecranForce = null;
        break;
      case "valider": {
        const avant = heureDepartActuelle();
        const nouvelle = minutesEnHhmm(minutesEnReglage);
        etat.heureDepartCorrigee = nouvelle === COURSE.heureDepart ? null : nouvelle;
        noterEvenement("correction d'heure", "départ " + joli(avant) + " → " + joli(nouvelle));
        ecranForce = null;
        break;
      }

      // --- Pendant un segment ---
      case "noter": {
        const type = bouton.dataset.type;
        noterEvenement("noter " + type, "");
        const texte = bouton.textContent;
        bouton.textContent = "noté ✓";
        bouton.classList.add("note");
        setTimeout(() => { bouton.textContent = texte; bouton.classList.remove("note"); }, 1000);
        return;
      }
      case "arrive":
        enregistrerArrivee(dernierLieuAtteint() + 1, n, false);
        break;

      // --- Ressenti ---
      case "choix": {
        const p = etat.passages[ph.lieu];
        const q = bouton.dataset.q;
        const v = Number(bouton.dataset.v);
        p.ressenti[q] = p.ressenti[q] === v ? undefined : v;   // 2e appui = annuler
        sauver();
        if (q === "douleur" && p.ressenti[q] === 3) noterEvenement("alerte affichée", "douleur vive · " + COURSE.lieux[ph.lieu].nom);
        break;
      }
      case "plan": {
        const p = etat.passages[ph.lieu];
        p.ressentiFini = true;
        const resume = QUESTIONS.map((q) => p.ressenti[q.cle] ? q.label + " " + q.choix[p.ressenti[q.cle] - 1] : null)
          .filter(Boolean).join(", ");
        noterEvenement("ressenti", resume || "aucune réponse");
        break;
      }
      case "passer": {
        const p = etat.passages[ph.lieu];
        p.ressentiFini = true;
        p.ressentiPasse = true;
        p.ressenti = {};
        noterEvenement("ressenti passé", COURSE.lieux[ph.lieu].nom);
        break;
      }

      // --- Alerte ---
      case "erreur-alerte": {
        const p = etat.passages[ph.lieu];
        delete p.ressenti.douleur;
        p.ressentiFini = false;               // on revient aux questions
        noterEvenement("alerte annulée", "je me suis trompé de bouton");
        break;
      }

      // --- Ravito ---
      case "repars": {
        const p = etat.passages[ph.lieu];
        p.depart = n.toISOString();
        if (calculAffiche) {
          etat.preparees.iso = etat.preparees.iso.concat(calculAffiche.iso);
          etat.preparees.sachets = etat.preparees.sachets.concat(calculAffiche.sachets);
        }
        noterEvenement("je repars", COURSE.lieux[ph.lieu].nom);
        break;
      }

      // --- Col Saint-Roch ---
      case "col-go":
      case "col-non":
      case "col-finir": {
        const p = etat.passages[ph.lieu];
        const o = proposerObjectif(new Date(p.depart), niveauEtat(p));
        p.objectif = o;
        p.decision = action === "col-go" ? "go" : action === "col-non" ? "non" : "finir";
        noterEvenement("décision au col", o.objectif + " · " + (p.decision === "go" ? "go" : p.decision === "non" ? "je finis tranquille" : "finir en contrôle"));
        break;
      }

      // --- Recalage ---
      case "recaler": {
        const j = Number(bouton.dataset.lieu);
        const k = dernierLieuAtteint();
        // Le ravito où l'on était sans avoir appuyé « Je repars » : départ inconnu
        if (k > 0 && !etat.passages[k].depart) etat.passages[k].recale = true;
        // Les ravitos sautés : passés sans heure
        for (let m = k + 1; m < j; m++) etat.passages[m] = { recale: true, ressentiFini: true, ressenti: {} };
        enregistrerArrivee(j, n, true);
        noterEvenement("recalage", "je suis à " + COURSE.lieux[j].nom);
        etat.recalageIgnoreJusqua = null;
        ecranForce = null;
        break;
      }
      case "pas-recaler":
        etat.recalageIgnoreJusqua = new Date(n.getTime() + 30 * 60000).toISOString();  // on ne redemande pas avant 30 min
        sauver();
        ecranForce = null;
        break;

      // --- Mode test ---
      case "test":
        ouvrirTest();
        return;
      case "test-valider":
        modeTest = { decalageMs: dateDuJour(minutesEnHhmm(minutesEnReglage)) - Date.now() };
        ecrireJSON(CLE_MODE_TEST, modeTest);
        etat = charger();
        ecranForce = null;
        verifierRecalage();
        break;
      case "test-effacer":
        ecrireJSON(CLE_TEST, null);
        if (modeTest) etat = charger();
        bouton.textContent = "Données de test effacées ✓";
        return;
      case "test-quitter":
        modeTest = null;
        ecrireJSON(CLE_MODE_TEST, null);
        etat = charger();
        ecranForce = null;
        verifierRecalage();
        break;
    }
    afficher(true);
  });

  function ouvrirTest() {
    const n = maintenant();
    minutesEnReglage = modeTest ? n.getHours() * 60 + n.getMinutes() : hhmmEnMinutes("05:25");
    ecranForce = "test";
    afficher(true);
  }

  // Mode test : appui long (1 s) sur le titre
  let minuterieAppuiLong = null;
  app.addEventListener("pointerdown", function (ev) {
    if (!ev.target.closest(".titre, .titre-seg, .titre-moyen, .surtitre")) return;
    minuterieAppuiLong = setTimeout(ouvrirTest, 1000);
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach((t) =>
    app.addEventListener(t, () => clearTimeout(minuterieAppuiLong)));
  app.addEventListener("contextmenu", (ev) => ev.preventDefault());

  // ---------- Démarrage ----------
  verifierRecalage();
  afficher(true);
  setInterval(afficher, 1000);
  // À chaque réouverture (téléphone sorti de la poche) : remise à jour + recalage si besoin
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) {
      verifierRecalage();
      afficher(true);
    }
  });

  // ---------- Hors ligne ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(function () {});
  }
})();
