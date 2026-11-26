// =====================================================================
//  APPLI DE COURSE TDSL — logique
//  Étape 1 : écran « Avant le départ », compte à rebours, correction
//  de l'heure de départ, sauvegarde sur le téléphone, mode hors ligne.
// =====================================================================

(function () {
  "use strict";

  const CLE_SAUVEGARDE = "tdsl-course-etat-v1";
  const app = document.getElementById("app");

  // ---------- Heure « maintenant » (centralisée pour le futur mode test) ----------
  function maintenant() {
    return new Date();
  }

  // ---------- Sauvegarde : tout est écrit à chaque appui ----------
  function etatVide() {
    return {
      heureDepartCorrigee: null,   // "HH:MM" si le départ a été décalé
      compteAReboursLance: false,  // bouton « Départ dans 5 min » appuyé
      evenements: [],              // { heure: ISO, type, detail }
    };
  }

  function charger() {
    try {
      const brut = localStorage.getItem(CLE_SAUVEGARDE);
      if (!brut) return etatVide();
      return Object.assign(etatVide(), JSON.parse(brut));
    } catch (e) {
      return etatVide();
    }
  }

  let etat = charger();

  function sauver() {
    try {
      localStorage.setItem(CLE_SAUVEGARDE, JSON.stringify(etat));
    } catch (e) { /* stockage plein ou bloqué : on continue sans planter */ }
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
  // "07:35" -> "7h35"
  function joli(hhmm) {
    const [h, m] = hhmm.split(":");
    return Number(h) + "h" + m;
  }
  function jolieDate(d) {
    return d.getHours() + "h" + String(d.getMinutes()).padStart(2, "0");
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

  function heureDepartActuelle() {
    return etat.heureDepartCorrigee || COURSE.heureDepart;
  }
  function dateDepart() {
    const [a, mo, j] = COURSE.dateDepart.split("-").map(Number);
    const [h, mi] = heureDepartActuelle().split(":").map(Number);
    return new Date(a, mo - 1, j, h, mi, 0, 0);
  }

  // Heure de course entamée : départ 5h30, à 8h50 -> H4. Avant le départ -> H1.
  function heureDeCourse(d) {
    const ms = d - dateDepart();
    if (ms < 0) return 1;
    return Math.floor(ms / 3600000) + 1;
  }
  function nutritionPour(h) {
    return COURSE.nutrition[h] || COURSE.nutritionReserve;
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

  // ---------- Morceaux d'écran réutilisables ----------
  function blocArrivee(seg) {
    const lieu = COURSE.lieux.find((l) => l.court === seg.a) || { nom: seg.a };
    return `
      <section class="bloc">
        <div class="bloc-label">${seg.id} · Arrivée ${echapper(lieu.court || lieu.nom)}</div>
        <div class="gros vert">${joli(seg.arriveeMin)} – ${joli(seg.arriveeMax)}</div>
        <div class="info">Barrière ${joli(seg.barriere)}</div>
        <div class="info">${km(seg.distance)} km · +${metres(seg.dPlus)} m · −${metres(seg.dMoins)} m</div>
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
    return `
      <section class="bloc">
        <div class="bloc-label">Nutrition</div>
        <div class="nutri-h">H${h}</div>
        <div class="nutri-txt" id="nutri-txt">${echapper(capitaliser(nutritionPour(h)))}</div>
      </section>`;
  }
  function capitaliser(t) {
    return t.charAt(0).toUpperCase() + t.slice(1);
  }

  // ---------- Écrans ----------
  let ecranAffiche = null;   // nom de l'écran actuellement dessiné
  let ecranForce = null;     // "correction" quand on règle l'heure
  let heureEnReglage = null; // minutes, pendant la correction

  function choisirEcran() {
    if (ecranForce) return ecranForce;
    if (maintenant() < dateDepart()) return "avant";
    return "course";
  }

  function dessinerAvant() {
    const seg = COURSE.segments[0];
    const lance = etat.compteAReboursLance;
    const jour = dateDepart().toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "2-digit" });
    app.innerHTML = `
      <header class="entete">
        <div class="surtitre">Avant le départ</div>
        <h1 class="titre">Départ ${joli(heureDepartActuelle())}</h1>
        ${lance
          ? `<div class="sous-titre">La course démarre seule dans</div>
             <div class="compte" id="compte"></div>`
          : `<div class="sous-titre">${echapper(capitaliser(jour))} · dans <span id="compte"></span></div>`}
      </header>
      ${blocArrivee(seg)}
      ${blocConsignes(seg)}
      ${blocNutrition(1)}
      <div class="espace"></div>
      ${lance ? "" : `<button class="btn btn-principal" data-action="lancer">Départ dans 5 min</button>`}
      <button class="btn" data-action="corriger">Départ décalé ? Corriger l'heure</button>
    `;
  }

  // Écran provisoire une fois la course partie (le vrai écran Segment arrive à l'étape 2)
  function dessinerCourse() {
    const seg = COURSE.segments[0];
    const h = heureDeCourse(maintenant());
    app.innerHTML = `
      <header class="entete">
        <div class="entete-ligne">
          <h1 class="titre-seg">${seg.id} · ${echapper(seg.de)} → ${echapper(seg.a)}</h1>
          <div class="horloge" id="horloge"></div>
        </div>
        <div class="sous-titre">Partie à ${joli(heureDepartActuelle())}</div>
      </header>
      ${blocArrivee(seg)}
      ${blocConsignes(seg)}
      ${blocNutrition(h)}
      <div class="espace"></div>
      <div class="discret">La suite des écrans arrive à l'étape 2.</div>
      <button class="btn" data-action="corriger">Départ décalé ? Corriger l'heure</button>
    `;
    app.dataset.heureCourse = String(h);
  }

  function dessinerCorrection() {
    app.innerHTML = `
      <header class="entete">
        <div class="surtitre">Corriger l'heure de départ</div>
        <h1 class="titre">Départ réel</h1>
      </header>
      <section class="bloc">
        <div class="reglage-heure" id="reglage">${joli(minutesEnHhmm(heureEnReglage))}</div>
        <div class="discret">Prévu : ${joli(COURSE.heureDepart)}</div>
      </section>
      <div class="grille-4">
        <button class="btn" data-action="ajuster" data-min="-5">−5</button>
        <button class="btn" data-action="ajuster" data-min="-1">−1</button>
        <button class="btn" data-action="ajuster" data-min="1">+1</button>
        <button class="btn" data-action="ajuster" data-min="5">+5</button>
      </div>
      <button class="btn" data-action="maintenant">Le départ vient d'être donné</button>
      <div class="espace"></div>
      <div class="deux-btn">
        <button class="btn" data-action="annuler">Annuler</button>
        <button class="btn btn-principal" data-action="valider">Valider</button>
      </div>
    `;
  }

  // Met à jour seulement ce qui bouge (compte à rebours, horloge)
  function rafraichirChiffres() {
    const n = maintenant();
    const compte = document.getElementById("compte");
    if (compte) compte.textContent = tempsRestant(dateDepart() - n);
    const horloge = document.getElementById("horloge");
    if (horloge) horloge.textContent = jolieDate(n);
  }

  function afficher(forcer) {
    const ecran = choisirEcran();
    // Si l'heure de course change (nutrition), on redessine aussi
    const hc = String(heureDeCourse(maintenant()));
    if (forcer || ecran !== ecranAffiche || (ecran === "course" && app.dataset.heureCourse !== hc)) {
      if (ecranAffiche === "avant" && ecran === "course") {
        noterEvenement("départ", "course démarrée à " + joli(heureDepartActuelle()));
      }
      ecranAffiche = ecran;
      if (ecran === "avant") dessinerAvant();
      else if (ecran === "course") dessinerCourse();
      else if (ecran === "correction") dessinerCorrection();
      window.scrollTo(0, 0);
    }
    rafraichirChiffres();
  }

  // ---------- Appuis sur les boutons ----------
  app.addEventListener("click", function (ev) {
    const bouton = ev.target.closest("button[data-action]");
    if (!bouton) return;
    const action = bouton.dataset.action;

    if (action === "lancer") {
      etat.compteAReboursLance = true;
      noterEvenement("compte à rebours", "départ prévu à " + joli(heureDepartActuelle()));
      afficher(true);
    } else if (action === "corriger") {
      heureEnReglage = hhmmEnMinutes(heureDepartActuelle());
      ecranForce = "correction";
      afficher(true);
    } else if (action === "ajuster") {
      heureEnReglage = Math.max(0, Math.min(1439, heureEnReglage + Number(bouton.dataset.min)));
      document.getElementById("reglage").textContent = joli(minutesEnHhmm(heureEnReglage));
    } else if (action === "maintenant") {
      const n = maintenant();
      heureEnReglage = n.getHours() * 60 + n.getMinutes();
      document.getElementById("reglage").textContent = joli(minutesEnHhmm(heureEnReglage));
    } else if (action === "annuler") {
      ecranForce = null;
      afficher(true);
    } else if (action === "valider") {
      const avant = heureDepartActuelle();
      const nouvelle = minutesEnHhmm(heureEnReglage);
      etat.heureDepartCorrigee = nouvelle === COURSE.heureDepart ? null : nouvelle;
      noterEvenement("correction d'heure", "départ " + joli(avant) + " → " + joli(nouvelle));
      ecranForce = null;
      afficher(true);
    }
  });

  // ---------- Démarrage ----------
  afficher(true);
  setInterval(afficher, 1000);
  // Quand on rouvre l'appli (téléphone sorti de la poche), on remet tout à jour
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) afficher(false);
  });

  // ---------- Hors ligne : le « service worker » garde une copie de l'appli ----------
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }
  // Demande au téléphone de ne pas effacer nos données
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().catch(function () {});
  }
})();
