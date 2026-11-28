// =====================================================================
//  DONNÉES DE LA COURSE — TDSL
//  C'est le SEUL fichier à modifier si un horaire ou une consigne change.
//  Les heures s'écrivent "HH:MM" (ex. "07:35"), les durées "H:MM".
// =====================================================================

const COURSE = {
  nom: "TDSL",

  // Date et heure de départ prévues (heure de France)
  dateDepart: "2026-11-29",   // dimanche 29/11/2026
  heureDepart: "05:30",
  sachetsDepart: "Au départ : sachets H2 et H4 devant",

  // Lieux de passage, dans l'ordre (le départ puis les 5 arrivées de segment)
  // "au" = petit mot pour la phrase « J'arrive au … / à la … »
  lieux: [
    { id: "levens-depart", nom: "Levens",            km: 0 },
    { id: "madone",        nom: "Madone d'Utelle",   court: "Madone",     au: "à la Madone",          km: 11.8 },
    { id: "figaret",       nom: "Figaret",           court: "Figaret",    au: "au Figaret",           km: 27.3 },
    { id: "saint-roch",    nom: "Col Saint-Roch",    court: "Saint-Roch", au: "au col Saint-Roch",    km: 38.3 },
    { id: "ferion",        nom: "Mont Férion",       court: "Férion",     au: "au Mont Férion",       km: 51.1 },
    { id: "levens",        nom: "Levens (arrivée)",  court: "Levens",     au: "à Levens",             km: 58.7 },
  ],

  // Consigne fixe affichée à chaque ravito (déroulé validé du 28/11)
  auRavito: {
    "madone": [
      "Devant : H3 ISO orange + eau",
      "Dos : H5 ISO citron",
      "Sachet H6 devant",
    ],
    "figaret": [
      "Devant : H7 ISO orange + eau",
      "Dos : eau",
      "Sachet H8 devant",
    ],
    "saint-roch": [
      "Devant : H9 ISO citron + eau",
      "Dos : H11 ISO orange",
      "Sachet H10 devant",
    ],
    "ferion": [
      "Finis H9, remplis l'eau",
      "H11 ISO orange devant après 15h30",
      "Sac Réserve devant après 16h30",
    ],
  },

  segments: [
    {
      id: "S1", de: "Levens", a: "Madone",
      kmDebut: 0, kmFin: 11.8, distance: 11.8, dPlus: 1173, dMoins: 531,
      arriveeMin: "07:35", arriveeMax: "07:50", barriere: "09:00",
      arret: "5 min", reparsAuPlusTard: "07:55",   // repars au plus tard : heure fixe
      tempsMin: "2:05", tempsMax: "2:20",
      bpm: 160, bpmNote: "165 en montée raide",
      consignes: [
        "20 premières min plus lentes que tu ne le voudrais",
        "Ne double pas dans les escaliers",
        "Bâtons en montée, marche active",
      ],
    },
    {
      id: "S2", de: "Madone", a: "Figaret",
      kmDebut: 11.8, kmFin: 27.3, distance: 15.5, dPlus: 894, dMoins: 1595,
      arriveeMin: "09:47", arriveeMax: "10:32", barriere: "12:00",
      arret: "10 min", reparsAuPlusTard: "10:42",
      tempsMin: "2:07", tempsMax: "2:37",
      bpm: 160, bpmNote: "165 en montée",
      consignes: [
        "Grosse descente de 900 m à partir du km 22",
        "Descente à 80 %, petits pas, bâtons rangés",
      ],
    },
    {
      id: "S3", de: "Figaret", a: "Saint-Roch",
      kmDebut: 27.3, kmFin: 38.3, distance: 11.0, dPlus: 1009, dMoins: 480,
      arriveeMin: "11:50", arriveeMax: "13:00", barriere: "14:45",
      arret: "10 min", reparsAuPlusTard: "13:10",
      tempsMin: "1:53", tempsMax: "2:18",
      bpm: 160, bpmNote: "165 en montée",
      consignes: [
        "Mange chaud et salé au Figaret",
        "Marche active régulière",
        "Au col : décision",
      ],
    },
    {
      id: "S4", de: "Saint-Roch", a: "Férion",
      kmDebut: 38.3, kmFin: 51.1, distance: 12.8, dPlus: 1125, dMoins: 779,
      arriveeMin: "14:20", arriveeMax: "16:05", barriere: "17:45",
      arret: "2-4 min", reparsAuPlusTard: "16:10",
      tempsMin: "2:20", tempsMax: "2:55",
      bpm: 165, bpmObjectif: 172, bpmNote: "172 si objectif chrono",
      consignes: [
        "Ne t'enflamme pas dans la descente roulante",
        "Gel coca au pied du Férion (km 43,5)",
        "Bâtons, petits pas, aucune pause longue",
      ],
    },
    {
      id: "S5", de: "Férion", a: "Levens",
      kmDebut: 51.1, kmFin: 58.7, distance: 7.6, dPlus: 67, dMoins: 881,
      arriveeMin: "15:15", arriveeMax: "17:20", barriere: "19:00",
      tempsMin: "0:50", tempsMax: "1:10",
      bpm: 175, bpmTexte: "libre", bpmNote: "≤ 175",
      consignes: [
        "Lâche les chevaux, pas la cheville",
        "Les 2 derniers km : vide le réservoir",
      ],
    },
  ],

  // Nutrition selon l'heure de course (H1 = 1re heure entamée, etc.)
  nutrition: {
    1:  "ISO orange",
    2:  "gel thé, compote, pâte de fruit, sel",
    3:  "ISO orange",
    4:  "gel coca, compote, pâte de fruit, sel",
    5:  "ISO citron",
    6:  "gel thé, compote, pâte de fruit, sel",
    7:  "ISO orange",
    8:  "gel coca, compote, pâte de fruit, sel",
    9:  "ISO citron",
    10: "gel coca, compote, pâte de fruit, sel",
    11: "ISO orange",
    12: "sac Réserve : 1 gel thé, 1 gel coca, 1 compote, 1 pâte, 1 sel, crocos",
  },
  // H13 et au-delà : même sac Réserve (pris au Férion après 16h30 ou en cas de coup de mou)
  nutritionReserve: "sac Réserve : 1 gel thé, 1 gel coca, 1 compote, 1 pâte, 1 sel, crocos",

  // Col Saint-Roch : objectif proposé selon l'heure de DÉPART du col
  // "jusqua" = dernière minute incluse (pour un départ à 5h30 ; décalé
  // automatiquement si le départ réel est décalé)
  // "duree" = temps total visé (Sub 10h30 -> "10:30")
  objectifsCol: [
    { jusqua: "11:43", objectif: "Sub 9h",    texte: "jouable en accélérant",     duree: "9:00" },
    { jusqua: "11:55", objectif: "Sub 9h",    texte: "à la limite : tout donner", duree: "9:00" },
    { jusqua: "12:25", objectif: "Sub 9h30",  texte: "jouable",                   duree: "9:30" },
    { jusqua: "12:55", objectif: "Sub 10h",   texte: "jouable",                   duree: "10:00" },
    { jusqua: "13:25", objectif: "Sub 10h30", texte: "jouable",                   duree: "10:30" },
    { jusqua: "13:55", objectif: "Sub 11h",   texte: "jouable",                   duree: "11:00" },
    { jusqua: "23:59", objectif: "Finir en contrôle", texte: "",                  duree: null },
  ],
  minutesFerionAvantArrivee: 45,   // « Férion avant HhMM » = arrivée visée − 45 min

  // Réglages
  reglages: {
    flasquesParDefaut: 3,          // réserve 1,5 L
    reserveExigeeAuFerion: true,   // false = seulement 2 flasques au Férion
    margeBarriereMin: 45,          // en dessous : « Course contre la barrière »
  },
};
