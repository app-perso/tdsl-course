// =====================================================================
//  APPLI DE COURSE TDSL — logique
//  Étape 1 : Avant le départ, compte à rebours, correction d'heure.
//  Étape 2 : écrans Segment / Ressenti / Ravito, nutrition par heure,
//            calcul des flasques, mode test simple (appui long sur le titre).
// =====================================================================

(function () {
  "use strict";

  const CLE_REELLE = "tdsl-course-etat-v1";     // données de la vraie course
  const CLE_TEST = "tdsl-course-etat-test";     // données du mode test (séparées)
  const CLE_MODE_TEST = "tdsl-course-mode-test";
  const app = document.getElementById("app");
  const NB_LIEUX = COURSE.lieux.length - 1;     // 5 arrivées de segment

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
  function etatVide() {
    return {
      heureDepartCorrigee: null,   // "HH:MM" si le départ a été décalé
      compteAReboursLance: false,
      passages: {},                // 1..5 : { arrivee, depart, ressenti:{}, ressentiFini, ressentiPasse }
      preparees: { iso: [], sachets: [] },   // heures déjà préparées aux ravitos
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

  // Une heure "HH:MM" le jour de la course -> Date
  function dateDuJour(hhmm) {
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
  // Départ 5h30 : à 8h50 -> H4. Avant le départ -> H1.
  function heureDeCourse(d) {
    const ms = d - dateDepart();
    if (ms < 0) return 1;
    return Math.floor(ms / 3600000) + 1;
  }
  function nutritionPour(h) {
    return COURSE.nutrition[h] || COURSE.nutritionReserve;
  }
  function debutHeure(h) {                    // début de l'heure de course Hh
    return new Date(dateDepart().getTime() + (h - 1) * 3600000);
  }

  // ---------- Où en est la course ? ----------
  function dernierLieuAtteint() {
    let k = 0;
    for (let i = 1; i <= NB_LIEUX; i++) if (etat.passages[i] && etat.passages[i].arrivee) k = i;
    return k;
  }
  function phase() {
    const k = dernierLieuAtteint();
    if (k === 0) {
      if (maintenant() < dateDepart()) return { ecran: "avant" };
      return { ecran: "segment", seg: 0 };
    }
    if (k === NB_LIEUX) return { ecran: "arrivee" };
    const p = etat.passages[k];
    if (!p.depart) return { ecran: p.ressentiFini ? "ravito" : "ressenti", lieu: k };
    return { ecran: "segment", seg: k };
  }

  // ---------- Calcul des flasques et sachets au ravito ----------
  // Au départ, on part avec ce qu'il faut jusqu'à l'heure max d'arrivée au 1er ravito.
  function prepareesAuDepart(impair) {
    const limite = dateDuJour(COURSE.segments[0].arriveeMax);
    const liste = [];
    for (let h = 1; h <= 12; h++) if ((h % 2 === 1) === impair && debutHeure(h) <= limite) liste.push(h);
    return liste;
  }
  // Heures (impaires = ISO, paires = sachets) qui commencent avant "fin" et pas encore préparées
  function heuresAPreparer(impair, n, fin) {
    const deja = new Set(prepareesAuDepart(impair).concat(impair ? etat.preparees.iso : etat.preparees.sachets));
    const liste = [];
    for (let h = 1; h <= 12; h++) {
      if ((h % 2 === 1) !== impair || deja.has(h)) continue;
      const debut = debutHeure(h);
      // on ignore une heure commencée depuis plus d'1 h (trop tard pour la préparer)
      if (debut <= fin && debut > new Date(n.getTime() - 3600000)) liste.push(h);
    }
    return liste;
  }
  function calculRavito(k) {
    const n = maintenant();
    const segSuivant = COURSE.segments[k];
    // Intervalle : de maintenant à l'heure max d'arrivée au ravito suivant
    // (si elle est déjà dépassée : maintenant + temps max du segment)
    const finMax = dateDuJour(segSuivant.arriveeMax);
    const finSecours = new Date(n.getTime() + dureeEnMs(segSuivant.tempsMax));
    const fin = finMax > finSecours ? finMax : finSecours;

    const estFerion = COURSE.lieux[k].id === "ferion";
    const total = estFerion && !COURSE.reglages.reserveExigeeAuFerion ? 2 : COURSE.reglages.flasquesParDefaut;
    const iso = heuresAPreparer(true, n, fin).slice(0, total);
    const sachets = heuresAPreparer(false, n, fin);
    return { total: total, iso: iso, eau: total - iso.length, sachets: sachets };
  }

  // ---------- Morceaux d'écran réutilisables ----------
  function blocArrivee(seg, avecProfil) {
    return `
      <section class="bloc">
        <div class="bloc-label">${seg.id} · Arrivée ${echapper(seg.a)}</div>
        <div class="gros vert">${joli(seg.arriveeMin)} – ${joli(seg.arriveeMax)}</div>
        <div class="info">Barrière ${joli(seg.barriere)}</div>
        ${avecProfil ? `<div class="info">${km(seg.distance)} km · +${metres(seg.dPlus)} m · −${metres(seg.dMoins)} m</div>` : ""}
      </section>`;
  }

  function blocConsignes(seg) {
    const bpmAffiche = seg.bpmTexte ? "BPM " + seg.bpmTexte : "BPM " + seg.bpm;
    return `
      <section class="bloc">
        <div class="bloc-ligne">
          <div class="bloc-label">Consignes</div>
          <div>
            <div class="bpm">${echapper(bpmAffiche)}</div>
            ${seg.bpmNote ? `<div class="bpm-note">${echapper(seg.bpmNote)}</div>` : ""}
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
  let ecranForce = null;      // "correction" ou "test" quand on règle une heure
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
      ${blocArrivee(seg, true)}
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
    // Pendant les 30 premières minutes, on peut encore corriger l'heure de départ
    const correctionPossible = i === 0 && n - dateDepart() < 30 * 60000;
    return `
      <header class="entete">
        <div class="entete-ligne">
          <h1 class="titre-seg">${seg.id} · ${echapper(seg.de)} → ${echapper(seg.a)}</h1>
          <div class="horloge" id="horloge"></div>
        </div>
      </header>
      ${blocArrivee(seg, false)}
      ${blocConsignes(seg)}
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

  function dessinerRavito(k) {
    const p = etat.passages[k];
    const lieu = COURSE.lieux[k];
    const segArrive = COURSE.segments[k - 1];      // le segment qui vient de finir (arrêt prévu)
    const segSuivant = COURSE.segments[k];
    const arrivee = new Date(p.arrivee);
    const reparsAvant = new Date(arrivee.getTime() + segArrive.arretPrevu * 60000);
    const c = calculRavito(k);
    calculAffiche = c;

    const detailIso = c.iso.length
      ? `${c.iso.length} ISO (poudre ${c.iso.map((h) => "H" + h).join(" + ")})` + (c.eau ? ` + ${c.eau} eau` : "")
      : `${c.eau} eau`;
    const sachets = c.sachets.length === 0 ? ""
      : c.sachets.length === 1 ? `Sachet H${c.sachets[0]} devant`
      : `Sachets ${c.sachets.slice(0, -1).map((h) => "H" + h).join(", ")} et H${c.sachets[c.sachets.length - 1]} devant`;
    const vides = c.total >= 4 ? "" : c.total === 3 ? "La 4e reste vide" : "La 3e et la 4e restent vides";

    return `
      <header class="entete">
        <div class="entete-ligne">
          <div class="surtitre">Ravito · ${echapper(lieu.court)}</div>
          <div class="horloge" id="horloge"></div>
        </div>
        <h1 class="titre">Repars au plus tard à ${jolieDate(reparsAvant)}</h1>
        <div class="info">Arrivé à ${jolieDate(arrivee)} · arrêt prévu ${segArrive.arretPrevu} min</div>
      </header>
      <section class="bloc">
        <div class="bloc-label">Au ravito</div>
        <div class="flasques">Remplis ${c.total} flasques</div>
        <div class="flasques-detail">${echapper(detailIso)}</div>
        ${sachets ? `<div class="consigne">${sachets}</div>` : ""}
        ${vides ? `<div class="info">${vides}</div>` : ""}
      </section>
      <section class="bloc">
        <div class="bloc-label">Ensuite · ${segSuivant.id} · ${echapper(segSuivant.de)} → ${echapper(segSuivant.a)}</div>
        <div class="gros vert">${joli(segSuivant.arriveeMin)} – ${joli(segSuivant.arriveeMax)}</div>
        <div class="info">Arrivée ${echapper(segSuivant.a)} · barrière ${joli(segSuivant.barriere)}</div>
        <div class="info">${km(segSuivant.distance)} km · +${metres(segSuivant.dPlus)} m · −${metres(segSuivant.dMoins)} m</div>
      </section>
      <div class="espace"></div>
      <button class="btn btn-principal" data-action="repars">Je repars</button>`;
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

  // Met à jour seulement ce qui bouge (compte à rebours, horloges)
  function rafraichirChiffres() {
    const n = maintenant();
    const compte = document.getElementById("compte");
    if (compte) compte.textContent = tempsRestant(dateDepart() - n);
    const horloge = document.getElementById("horloge");
    if (horloge) horloge.textContent = jolieDate(n);
    const ht = document.getElementById("horloge-test");
    if (ht) ht.textContent = jolieDate(n);
  }

  // Temps restant lisible : "2 j 16 h", "3 h 12 min", "4:05"
  function tempsRestant(ms) {
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
    // On redessine seulement si quelque chose a changé (sinon on met juste l'heure à jour)
    const signature = [ecran, ph.seg, ph.lieu, heureDeCourse(n),
      ecran === "ravito" || ecran === "segment" ? Math.floor(n / 60000) : ""].join("|");
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
      else if (ecran === "avant") html = dessinerAvant();
      else if (ecran === "segment") html = dessinerSegment(ph.seg);
      else if (ecran === "ressenti") html = dessinerRessenti(ph.lieu);
      else if (ecran === "ravito") html = dessinerRavito(ph.lieu);
      else html = dessinerArrivee();
      app.innerHTML = bandeauTest() + html;
      if (changeEcran) window.scrollTo(0, 0);
    }
    rafraichirChiffres();
  }

  // ---------- Appuis sur les boutons ----------
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
      case "arrive": {
        const k = dernierLieuAtteint() + 1;
        const fin = k === NB_LIEUX;
        etat.passages[k] = {
          arrivee: n.toISOString(), depart: null, ressenti: {},
          ressentiFini: fin, ressentiPasse: false,
        };
        noterEvenement("j'arrive", COURSE.lieux[k].nom);
        break;
      }

      // --- Ressenti ---
      case "choix": {
        const p = etat.passages[ph.lieu];
        const q = bouton.dataset.q;
        const v = Number(bouton.dataset.v);
        p.ressenti[q] = p.ressenti[q] === v ? undefined : v;   // 2e appui = annuler
        sauver();
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

      // --- Mode test ---
      case "test":
        ouvrirTest();
        return;
      case "test-valider":
        modeTest = { decalageMs: dateDuJour(minutesEnHhmm(minutesEnReglage)) - Date.now() };
        ecrireJSON(CLE_MODE_TEST, modeTest);
        etat = charger();
        ecranForce = null;
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
    if (!ev.target.closest(".titre, .titre-seg, .surtitre")) return;
    minuterieAppuiLong = setTimeout(ouvrirTest, 1000);
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach((t) =>
    app.addEventListener(t, () => clearTimeout(minuterieAppuiLong)));
  app.addEventListener("contextmenu", (ev) => ev.preventDefault());

  // ---------- Démarrage ----------
  afficher(true);
  setInterval(afficher, 1000);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) afficher(false);
  });

  // ---------- Hors ligne : le « service worker » garde une copie de l'appli ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(function () {});
  }
})();
