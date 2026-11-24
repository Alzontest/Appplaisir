/*
  js/poids.js — LE POIDS : PESÉES, OBJECTIFS "TRAJECTOIRE" OU "MAINTIEN", ONGLET "⚖️ POIDS"

  1. LES DONNÉES
     - Une pesée par jour : classeur.jours[date].poids = 74.6 (kg, 1 décimale).
     - Les objectifs de poids, avec historique NON rétroactif (comme la diète) :
         Trajectoire : { depuis, mode: "trajectoire", depart: 77, cible: 70, rythme: 2, marge: 1 }
         Maintien    : { depuis, mode: "maintien", cible: 70, marge: 1 }
       rythme = kg par MOIS (1 mois = 30,44 jours). marge = kg.
       Une ancienne entrée (v0.9.1) sans "mode" est lue comme un maintien.
       Un jour est jugé avec le dernier objectif dont "depuis" ≤ ce jour.

  2. COMMENT UN JOUR EST JUGÉ
     - Le poids "jugé" : pas de pesée ce jour-là → rien à juger.
       Au moins 3 pesées sur les 7 derniers jours → leur MOYENNE (lisse les variations d'eau).
       Sinon → la pesée du jour seule.
     - Trajectoire : le poids "prévu" part du poids de départ et descend (ou monte)
       au rythme choisi, sans jamais dépasser la cible.
         perte : ✓ si poids jugé ≤ prévu + marge (être en avance = réussite)
         prise : ✓ si poids jugé ≥ prévu − marge
       Une fois la cible atteinte (prévu = cible) → règle du maintien.
     - Maintien : ✓ si cible − marge ≤ poids jugé ≤ cible + marge.

  3. LES LIGNES AUTOMATIQUES (dans "Ma journée", comptées dans le score)
     - "Pesée" : ✓ si un poids est noté ce jour-là.
     - "Poids dans l'objectif" : le jugement ci-dessus ; pas de pesée = ✗ ;
       pas d'objectif = non comptée.
     verifierLignesSpeciales() les ajoute aux anciennes données (au démarrage
     et après un import), sauf si elles existent déjà, même supprimées.

  4. L'ONGLET : saisie, verdict, écarts, courbe des 30 derniers jours,
     et la fenêtre "🎯 Mon objectif de poids" (Trajectoire / Maintien).
*/

// Les limites acceptées.
const POIDS_MIN = 20;
const POIDS_MAX = 300;
const MARGE_POIDS_MIN = 0.1;
const MARGE_POIDS_MAX = 10;
const RYTHME_MIN = 0.5;
const RYTHME_MAX = 6;
// Un mois "moyen" : 365,25 jours / 12.
const JOURS_PAR_MOIS = 30.44;
// Pour la moyenne : au moins 3 pesées sur 7 jours.
const PESEES_POUR_MOYENNE = 3;
const JOURS_MOYENNE = 7;

// Les 2 lignes automatiques à ajouter si elles n'existent pas.
const LIGNES_SPECIALES_POIDS = [
  { id: "pesee", nom: "Pesée", niveau: 1, speciale: "pesee" },
  { id: "poids", nom: "Poids dans l'objectif", niveau: 4, speciale: "poids" }
];

// ===== Les éléments de la page =====
const champDatePoids = document.getElementById("date-poids");
const champPoids = document.getElementById("champ-poids");
const erreurPoids = document.getElementById("erreur-poids");
const boutonSupprimerPoids = document.getElementById("bouton-supprimer-poids");
const zoneVerdictPoids = document.getElementById("verdict-poids");
const zoneEcartsPoids = document.getElementById("ecarts-poids");
const zoneGraphiquePoids = document.getElementById("graphique-poids");
const infoGraphiquePoids = document.getElementById("info-graphique-poids");

const fenetreObjectifPoids = document.getElementById("fenetre-objectif-poids");
const champPoidsDepart = document.getElementById("champ-poids-depart");
const champPoidsCible = document.getElementById("champ-poids-cible");
const titreChampCible = document.getElementById("titre-champ-cible");
const champPoidsRythme = document.getElementById("champ-poids-rythme");
const champPoidsMarge = document.getElementById("champ-poids-marge");
const champPoidsDepuis = document.getElementById("champ-poids-depuis");
const apercuFourchettePoids = document.getElementById("apercu-fourchette-poids");
const erreurObjectifPoids = document.getElementById("erreur-objectif-poids");
const listeHistoriqueObjectifsPoids = document.getElementById("historique-objectifs-poids");

// Le mode choisi dans la fenêtre : "trajectoire" ou "maintien".
let modeObjectifChoisi = "trajectoire";
// Les valeurs proposées pour le champ "poids final / voulu" selon le mode.
let ciblePourTrajectoire = "";
let ciblePourMaintien = "";

// ===================== OUTILS =====================

/**
 * Arrondit à 1 chiffre après la virgule : 74.649 → 74.6.
 */
function arrondiPoids(valeur) {
  return Math.round(valeur * 10) / 10;
}

/**
 * Écrit un poids avec toujours 1 décimale et une virgule : 75 → "75,0".
 * On arrondit d'abord, pour éviter d'écrire "-0,0".
 */
function kgEnTexte(valeur) {
  return arrondiPoids(valeur).toFixed(1).replace(".", ",");
}

/**
 * Écrit un écart avec son signe : -2.4 → "−2,4 kg", 0.6 → "+0,6 kg".
 * ("−" est le vrai signe moins, plus lisible que le tiret "-".)
 */
function ecartEnTexte(ecart) {
  const arrondi = arrondiPoids(ecart);
  if (arrondi > 0) {
    return "+" + kgEnTexte(arrondi) + " kg";
  }
  if (arrondi < 0) {
    return "−" + kgEnTexte(-arrondi) + " kg";
  }
  return "0,0 kg";
}

/**
 * Nombre de jours entre deux dates "AAAA-MM-JJ" (b − a).
 * Date.UTC compte en temps universel : pas de surprise avec l'heure d'été.
 */
function joursEntre(a, b) {
  const da = a.split("-").map(Number);
  const db = b.split("-").map(Number);
  const ms = Date.UTC(db[0], db[1] - 1, db[2]) - Date.UTC(da[0], da[1] - 1, da[2]);
  return Math.round(ms / 86400000); // 86 400 000 ms = 1 jour
}

/**
 * Une date en toutes lettres : "2027-03-08" → "8 mars 2027".
 */
function dateEnLettres(date) {
  const d = texteEnDate(date); // js/historique.js
  return numeroJour(d.getDate()) + " " + NOMS_MOIS[d.getMonth()] + " " + d.getFullYear();
}

// ===================== LES DONNÉES =====================

/**
 * Ajoute les lignes "Pesée" et "Poids dans l'objectif" si AUCUNE ligne
 * avec cet id n'existe (même supprimée : si tu l'as supprimée, on ne la recrée pas).
 * Appelée au démarrage (js/app.js) et après un import (js/sauvegarde.js),
 * TOUJOURS après figerJoursPasses() : les jours passés gardent leur photo sans elles.
 */
function verifierLignesSpeciales() {
  let changement = false;
  LIGNES_SPECIALES_POIDS.forEach(function (modele) {
    // some() : vrai si AU MOINS UN élément du tableau vérifie la condition.
    const existe = classeur.lignes.some(function (ligne) {
      return ligne.id === modele.id;
    });
    if (!existe) {
      // Object.assign({}, modele) fait une copie : on ne partage pas le modèle.
      classeur.lignes.push(Object.assign({}, modele));
      changement = true;
    }
  });
  if (changement) {
    enregistrerClasseur();
  }
}

/**
 * Le poids noté ce jour-là (en kg), ou null s'il n'y a pas de pesée.
 */
function poidsDuJour(date) {
  const jour = classeur.jours[date];
  return jour && typeof jour.poids === "number" ? jour.poids : null;
}

/**
 * Toutes les pesées, de la plus ancienne à la plus récente : [{ date, poids }].
 */
function toutesLesPesees() {
  return Object.keys(classeur.jours)
    .filter(function (date) {
      return poidsDuJour(date) !== null;
    })
    .sort()
    .map(function (date) {
      return { date: date, poids: classeur.jours[date].poids };
    });
}

/**
 * La liste des objectifs de poids (vide si aucun, ou si le classeur est ancien).
 */
function listeObjectifsPoids() {
  if (!classeur.objectifsPoids) {
    classeur.objectifsPoids = [];
  }
  return classeur.objectifsPoids;
}

/**
 * Lit un objectif de façon sûre : une ancienne entrée (v0.9.1) sans "mode"
 * devient un maintien. On renvoie une COPIE (l'objectif enregistré ne change pas).
 */
function normaliserObjectif(objectif) {
  if (objectif.mode === "trajectoire") {
    return Object.assign({}, objectif);
  }
  return { depuis: objectif.depuis, mode: "maintien", cible: objectif.cible, marge: objectif.marge };
}

/**
 * L'objectif de poids en vigueur pour une date (ou null), déjà "normalisé".
 * Le plus récent dont "depuis" ≤ date.
 */
function objectifPoidsDuJour(date) {
  let trouve = null;
  listeObjectifsPoids().forEach(function (objectif) {
    if (objectif.depuis <= date && (trouve === null || objectif.depuis > trouve.depuis)) {
      trouve = objectif;
    }
  });
  return trouve === null ? null : normaliserObjectif(trouve);
}

/**
 * Le sens d'une trajectoire : "perte" si la cible est plus basse que le départ, sinon "prise".
 */
function sensTrajectoire(objectif) {
  return objectif.cible < objectif.depart ? "perte" : "prise";
}

/**
 * Le poids prévu à une date sur une trajectoire :
 * départ ∓ rythme × (jours écoulés / 30,44), sans jamais dépasser la cible.
 */
function poidsPrevu(objectif, date) {
  const jours = Math.max(0, joursEntre(objectif.depuis, date));
  const deplacement = (objectif.rythme * jours) / JOURS_PAR_MOIS;
  if (sensTrajectoire(objectif) === "perte") {
    return Math.max(objectif.cible, objectif.depart - deplacement);
  }
  return Math.min(objectif.cible, objectif.depart + deplacement);
}

/**
 * La date à laquelle la trajectoire atteint la cible :
 * depuis + |départ − cible| / rythme mois (arrondi au jour inférieur).
 */
function dateArrivee(objectif) {
  const jours = (Math.abs(objectif.depart - objectif.cible) / objectif.rythme) * JOURS_PAR_MOIS;
  return decalerDate(objectif.depuis, Math.floor(jours)); // js/score.js
}

/**
 * Le poids "jugé" d'un jour :
 *   pas de pesée ce jour-là → null ;
 *   au moins 3 pesées sur les 7 derniers jours (date − 6 → date) → leur moyenne ;
 *   sinon → la pesée du jour seule.
 * Renvoie { valeur, base: "moyenne 7 j" | "pesée du jour", nombre } ou null.
 */
function poidsJuge(date) {
  const duJour = poidsDuJour(date);
  if (duJour === null) {
    return null;
  }
  const pesees = [];
  for (let i = JOURS_MOYENNE - 1; i >= 0; i--) {
    const p = poidsDuJour(decalerDate(date, -i));
    if (p !== null) {
      pesees.push(p);
    }
  }
  if (pesees.length >= PESEES_POUR_MOYENNE) {
    // reduce additionne tous les éléments du tableau.
    const somme = pesees.reduce(function (total, p) { return total + p; }, 0);
    return { valeur: somme / pesees.length, base: "moyenne 7 j", nombre: pesees.length };
  }
  return { valeur: duJour, base: "pesée du jour", nombre: pesees.length };
}

/**
 * La zone de réussite et le poids prévu d'un jour (pour les courbes) :
 * { zone: { min, max }, prevu } — min ou max à null = "pas de limite de ce côté".
 *   perte    : zone sous la limite (min null, max = prévu + marge)
 *   prise    : zone au-dessus de la limite (min = prévu − marge, max null)
 *   maintien : bande cible ± marge
 * Renvoie null s'il n'y a pas d'objectif ce jour-là.
 */
function zoneReussitePoids(date) {
  const objectif = objectifPoidsDuJour(date);
  if (objectif === null) {
    return null;
  }
  if (objectif.mode === "trajectoire") {
    const prevu = poidsPrevu(objectif, date);
    if (prevu !== objectif.cible) {
      return sensTrajectoire(objectif) === "perte"
        ? { zone: { min: null, max: arrondiPoids(prevu + objectif.marge) }, prevu: prevu }
        : { zone: { min: arrondiPoids(prevu - objectif.marge), max: null }, prevu: prevu };
    }
    // Trajectoire terminée : maintien autour de la cible (la ligne prévue continue à la cible).
    return {
      zone: { min: arrondiPoids(objectif.cible - objectif.marge), max: arrondiPoids(objectif.cible + objectif.marge) },
      prevu: objectif.cible
    };
  }
  return {
    zone: { min: arrondiPoids(objectif.cible - objectif.marge), max: arrondiPoids(objectif.cible + objectif.marge) },
    prevu: null
  };
}

/**
 * Le bilan poids complet d'un jour :
 * {
 *   poids,          ← la pesée du jour (ou null)
 *   objectif,       ← l'objectif en vigueur, normalisé (ou null)
 *   mode,           ← "trajectoire" / "maintien" (ou null)
 *   phase,          ← "trajectoire" tant que la cible n'est pas atteinte, sinon "maintien"
 *   sens,           ← "perte" / "prise" (trajectoire)
 *   juge, baseJugement, nombrePesees  ← le poids jugé et sur quoi il repose
 *   prevu,          ← le poids prévu ce jour (trajectoire)
 *   limite,         ← prévu + marge (perte) ou prévu − marge (prise)
 *   limites,        ← { min, max } de la zone de maintien
 *   avance,         ← kg d'avance (positif) ou de retard (négatif) sur le prévu
 *   dateArrivee,    ← quand la trajectoire atteint la cible
 *   dansObjectif,   ← true / false / null (null = on ne peut pas juger)
 *   raison          ← un texte court pour le score ("en avance de 1,2 kg"…)
 * }
 */
function bilanPoids(date) {
  const poids = poidsDuJour(date);
  const objectif = objectifPoidsDuJour(date);
  const jugement = poidsJuge(date);
  const bilan = {
    poids: poids, objectif: objectif, mode: null, phase: null, sens: null,
    juge: jugement ? jugement.valeur : null,
    baseJugement: jugement ? jugement.base : null,
    nombrePesees: jugement ? jugement.nombre : 0,
    prevu: null, limite: null, limites: null, avance: null, dateArrivee: null,
    dansObjectif: null, raison: ""
  };

  if (objectif === null) {
    bilan.raison = "pas d'objectif : non comptée";
    return bilan;
  }
  bilan.mode = objectif.mode;

  if (objectif.mode === "trajectoire") {
    bilan.sens = sensTrajectoire(objectif);
    bilan.prevu = poidsPrevu(objectif, date);
    bilan.dateArrivee = dateArrivee(objectif);
    bilan.phase = bilan.prevu === objectif.cible ? "maintien" : "trajectoire";
  } else {
    bilan.phase = "maintien";
  }

  if (bilan.phase === "trajectoire") {
    bilan.limite = bilan.sens === "perte" ? bilan.prevu + objectif.marge : bilan.prevu - objectif.marge;
  } else {
    bilan.limites = { min: objectif.cible - objectif.marge, max: objectif.cible + objectif.marge };
  }

  if (bilan.juge === null) {
    bilan.raison = "pas de pesée";
    return bilan; // dansObjectif reste null : la ligne compte ✗ (voir js/score.js)
  }

  if (bilan.phase === "trajectoire") {
    // Avance positive = mieux que prévu (plus bas pour une perte, plus haut pour une prise).
    bilan.avance = bilan.sens === "perte" ? bilan.prevu - bilan.juge : bilan.juge - bilan.prevu;
    // On compare des valeurs arrondies au dixième (ce que tu vois à l'écran).
    bilan.dansObjectif = bilan.sens === "perte"
      ? arrondiPoids(bilan.juge) <= arrondiPoids(bilan.limite)
      : arrondiPoids(bilan.juge) >= arrondiPoids(bilan.limite);
    if (!bilan.dansObjectif) {
      bilan.raison = (bilan.sens === "perte" ? "au-dessus" : "en dessous") + " de la limite (" + kgEnTexte(bilan.limite) + " kg)";
    } else if (arrondiPoids(bilan.avance) >= 0) {
      bilan.raison = "en avance de " + kgEnTexte(bilan.avance) + " kg";
    } else {
      bilan.raison = "en retard de " + kgEnTexte(-bilan.avance) + " kg, dans la marge";
    }
  } else {
    const juge = arrondiPoids(bilan.juge);
    bilan.dansObjectif = juge >= arrondiPoids(bilan.limites.min) && juge <= arrondiPoids(bilan.limites.max);
    bilan.raison = bilan.dansObjectif ? "dans la zone de maintien" : "hors de la zone de maintien";
  }
  return bilan;
}

/**
 * La dernière pesée faite au plus tard à cette date (ou null).
 */
function derniereePeseeAvant(date) {
  let trouvee = null;
  toutesLesPesees().forEach(function (pesee) {
    if (pesee.date <= date) {
      trouvee = pesee; // la liste est triée : la dernière qui passe est la plus récente
    }
  });
  return trouvee;
}

/**
 * Les écarts de poids vus depuis "date" :
 *  - reference : la pesée du jour, ou à défaut la dernière avant ;
 *  - semaine   : la pesée la plus proche d'il y a 7 jours, AU PLUS TÔT
 *                (donc faite il y a 7 jours ou plus), et l'écart avec elle ;
 *  - premiere  : la toute première pesée, et l'écart avec elle.
 */
function ecartsPoids(date) {
  const reference = derniereePeseeAvant(date);
  const resultat = { reference: reference, semaine: null, premiere: null };
  if (reference === null) {
    return resultat;
  }

  const ilYA7Jours = decalerDate(reference.date, -7); // js/score.js
  const peseeSemaine = derniereePeseeAvant(ilYA7Jours);
  if (peseeSemaine) {
    resultat.semaine = { date: peseeSemaine.date, ecart: reference.poids - peseeSemaine.poids };
  }

  const premiere = toutesLesPesees()[0];
  if (premiere.date < reference.date) {
    resultat.premiere = { date: premiere.date, ecart: reference.poids - premiere.poids };
  }
  return resultat;
}

// ===================== TEXTES COMMUNS (onglet, Bilan, Journée) =====================

/**
 * La base du jugement en clair :
 * "moyenne 7 j : 74,6 kg (5 pesées)" ou "pesée du jour (pas encore assez de pesées pour la moyenne)".
 */
function texteBaseJugement(bilan) {
  if (bilan.juge === null) {
    return "";
  }
  if (bilan.baseJugement === "moyenne 7 j") {
    return "moyenne 7 j : " + kgEnTexte(bilan.juge) + " kg (" + bilan.nombrePesees + " pesées)";
  }
  return "pesée du jour (pas encore assez de pesées pour la moyenne)";
}

/**
 * L'étiquette du verdict, toujours symbole + mot : { cle: "ok" | "bas", texte }.
 * Renvoie null si on ne peut pas juger.
 */
function etiquetteVerdictPoids(bilan) {
  if (bilan.dansObjectif === null) {
    return null;
  }
  if (bilan.phase === "trajectoire") {
    const avance = arrondiPoids(bilan.avance);
    if (!bilan.dansObjectif) {
      return { cle: "bas", texte: "✗ En retard de " + kgEnTexte(-bilan.avance) + " kg" };
    }
    return avance >= 0
      ? { cle: "ok", texte: "✓ En avance de " + kgEnTexte(bilan.avance) + " kg" }
      : { cle: "ok", texte: "✓ En retard de " + kgEnTexte(-bilan.avance) + " kg (dans la marge)" };
  }
  return bilan.dansObjectif
    ? { cle: "ok", texte: "✓ Dans la zone" }
    : { cle: "bas", texte: "✗ Hors zone" };
}

/**
 * Le résumé de l'objectif du jour en une ligne.
 */
function texteObjectifDuJour(bilan) {
  if (bilan.objectif === null) {
    return "Pas d'objectif de poids : règle-le avec le bouton 🎯 ci-dessous.";
  }
  if (bilan.phase === "trajectoire") {
    return "prévu aujourd'hui : " + kgEnTexte(bilan.prevu) + " kg · limite " + kgEnTexte(bilan.limite) + " kg";
  }
  return "Maintien " + kgEnTexte(bilan.limites.min) + " – " + kgEnTexte(bilan.limites.max) + " kg";
}

/**
 * Le résumé d'un objectif enregistré (fenêtre, historique).
 */
function texteObjectif(objectifBrut) {
  const objectif = normaliserObjectif(objectifBrut);
  if (objectif.mode === "trajectoire") {
    const signe = sensTrajectoire(objectif) === "perte" ? "−" : "+";
    return "trajectoire " + kgEnTexte(objectif.depart) + " → " + kgEnTexte(objectif.cible) + " kg, " +
      signe + nombreEnTexte(objectif.rythme) + " kg/mois, marge " + kgEnTexte(objectif.marge) +
      " kg (arrivée vers le " + dateEnLettres(dateArrivee(objectif)) + ")";
  }
  return "maintien " + kgEnTexte(objectif.cible) + " kg ± " + kgEnTexte(objectif.marge) + " kg (" +
    kgEnTexte(objectif.cible - objectif.marge) + " – " + kgEnTexte(objectif.cible + objectif.marge) + ")";
}

// ===================== L'ONGLET "POIDS" =====================

/**
 * (Re)construit tout l'onglet pour le jour affiché.
 */
function afficherPoids() {
  champDatePoids.value = dateAffichee;
  const poids = poidsDuJour(dateAffichee);

  // La case de saisie montre la pesée du jour (si elle existe).
  // On ne la réécrit pas si tu es en train d'écrire dedans.
  if (document.activeElement !== champPoids) {
    champPoids.value = poids === null ? "" : kgEnTexte(poids);
  }
  boutonSupprimerPoids.classList.toggle("cache", poids === null);

  afficherVerdictPoids();
  afficherEcartsPoids();
  dessinerGraphiquePoids();
}

/**
 * La carte du jour : poids, base du jugement, objectif, verdict.
 * Toujours un symbole ET un mot, jamais la couleur seule.
 */
function afficherVerdictPoids() {
  zoneVerdictPoids.innerHTML = "";
  const bilan = bilanPoids(dateAffichee);

  const carte = document.createElement("div");
  carte.className = "carte-poids";

  function ajouterTexte(classe, texte) {
    if (!texte) {
      return;
    }
    const p = document.createElement("p");
    p.className = classe;
    p.textContent = texte;
    carte.appendChild(p);
  }

  ajouterTexte("poids-valeur", bilan.poids === null ? "Pas de pesée" : kgEnTexte(bilan.poids) + " kg");
  ajouterTexte("poids-details", texteBaseJugement(bilan));

  const etiquette = etiquetteVerdictPoids(bilan);
  if (etiquette) {
    const e = document.createElement("span");
    e.className = "etiquette-etat etat-" + etiquette.cle;
    e.textContent = etiquette.texte;
    carte.appendChild(e);
    carte.classList.add(etiquette.cle === "ok" ? "niveau-vert" : "niveau-rouge");
  } else {
    carte.classList.add("non-rempli");
  }

  ajouterTexte("poids-details", texteObjectifDuJour(bilan));
  if (bilan.mode === "trajectoire") {
    ajouterTexte("poids-details", bilan.phase === "trajectoire"
      ? kgEnTexte(bilan.objectif.cible) + " kg prévu vers le " + dateEnLettres(bilan.dateArrivee)
      : "🎯 Cible de la trajectoire atteinte le " + dateEnLettres(bilan.dateArrivee) + " : place au maintien");
  }

  zoneVerdictPoids.appendChild(carte);
}

/**
 * Les écarts : depuis la semaine dernière et depuis la première pesée.
 */
function afficherEcartsPoids() {
  zoneEcartsPoids.innerHTML = "";
  const ecarts = ecartsPoids(dateAffichee);

  if (ecarts.reference === null) {
    zoneEcartsPoids.appendChild(creerLigneEcart("Écarts", "aucune pesée pour l'instant"));
    return;
  }
  // Si on n'est pas pesé ce jour-là, on précise de quelle pesée on part.
  if (ecarts.reference.date !== dateAffichee) {
    const note = document.createElement("p");
    note.className = "aide aide-gauche";
    note.textContent = "Calculé depuis ta dernière pesée (" + dateLisible(ecarts.reference.date) + " : " + kgEnTexte(ecarts.reference.poids) + " kg).";
    zoneEcartsPoids.appendChild(note);
  }

  zoneEcartsPoids.appendChild(creerLigneEcart(
    "Depuis la semaine dernière",
    ecarts.semaine
      ? ecartEnTexte(ecarts.semaine.ecart) + " (depuis le " + dateLisible(ecarts.semaine.date) + ")"
      : "pas de pesée il y a 7 jours ou plus"
  ));
  zoneEcartsPoids.appendChild(creerLigneEcart(
    "Depuis la première pesée",
    ecarts.premiere
      ? ecartEnTexte(ecarts.premiere.ecart) + " (depuis le " + dateLisible(ecarts.premiere.date) + ")"
      : "c'est ta première pesée"
  ));
}

function creerLigneEcart(titre, valeur) {
  const ligne = document.createElement("div");
  ligne.className = "nutri-ligne";
  const gauche = document.createElement("div");
  const t = document.createElement("span");
  t.className = "nutri-titre";
  t.textContent = titre;
  gauche.appendChild(t);
  const v = document.createElement("span");
  v.className = "nutri-valeur";
  v.textContent = valeur;
  gauche.appendChild(v);
  ligne.appendChild(gauche);
  return ligne;
}

/**
 * Les options de la courbe du poids (utilisées ici, dans le Bilan et l'Historique).
 */
function optionsCourbePoids(indexFort) {
  return {
    indexFort: indexFort,
    unite: "kg",
    echelle: "ajustee", // l'axe suit les valeurs : partir de 0 aplatirait la courbe
    legende: "zone de réussite de ton objectif de poids",
    legendePrevue: "trajectoire prévue",
    texteVide: "pas de pesée",
    formaterValeur: kgEnTexte,
    formaterBorne: kgEnTexte
  };
}

/**
 * Les options "affinées" de la courbe du poids, partagées par l'onglet Poids
 * et par l'Historique : petits points, zone continue, repères en kilos ronds.
 * (Un seul endroit à modifier si on veut changer le style des deux courbes.)
 */
function optionsCourbePoidsAffinee(indexFort) {
  // Object.assign : on part des options communes et on en ajoute / remplace certaines.
  return Object.assign(optionsCourbePoids(indexFort), {
    taillePoints: 0.5,       // points deux fois plus petits
    zoneContinue: true,      // plus d'effet escalier sur une trajectoire
    graduationsRondes: true  // repères sur des kilos ronds
  });
}

/**
 * Un point de courbe du poids pour une date.
 */
function pointPoids(date, etiquette) {
  const d = texteEnDate(date);
  const reussite = zoneReussitePoids(date);
  return {
    etiquette: etiquette,
    valeur: poidsDuJour(date),
    fourchette: reussite ? reussite.zone : null,
    prevu: reussite ? reussite.prevu : null,
    titre: NOMS_JOURS[d.getDay()] + " " + dateLisible(date) // js/bilan.js
  };
}

// Le nombre de jours de la courbe de l'onglet Poids.
const JOURS_COURBE_POIDS = 14;

/**
 * La courbe des 14 derniers jours (jusqu'au jour affiché), avec des réglages
 * propres à cet onglet : petits points, zone continue, repères en kilos ronds.
 */
function dessinerGraphiquePoids() {
  const points = [];
  for (let i = JOURS_COURBE_POIDS - 1; i >= 0; i--) {
    const date = decalerDate(dateAffichee, -i);
    // Une étiquette tous les 2 jours, en partant du jour affiché (pour qu'il en ait une).
    points.push(pointPoids(date, i % 2 === 0 ? String(texteEnDate(date).getDate()) : ""));
  }
  dessinerCourbe(zoneGraphiquePoids, infoGraphiquePoids, points, optionsCourbePoidsAffinee(JOURS_COURBE_POIDS - 1));
}

// ===================== SAISIR / SUPPRIMER UNE PESÉE =====================

function enregistrerPoids() {
  const lecture = lireNombre(champPoids.value); // js/nutrition.js
  if (!lecture.valide || lecture.valeur === null || lecture.valeur < POIDS_MIN || lecture.valeur > POIDS_MAX) {
    erreurPoids.textContent = "Indique un poids entre " + POIDS_MIN + " et " + POIDS_MAX + " kg (ex. 74,6).";
    erreurPoids.classList.remove("cache");
    champPoids.focus();
    return;
  }
  // Un seul poids par jour : on remplace celui qui existe peut-être déjà.
  donneesDuJour(dateAffichee).poids = arrondiPoids(lecture.valeur);
  enregistrerClasseur();
  erreurPoids.classList.add("cache");
  champPoids.blur(); // on quitte la case pour qu'elle affiche "74,6"
  afficherPoids();
  afficherJournee(); // les lignes Pesée et Poids se mettent à jour
}

function demanderSuppressionPoids() {
  const poids = poidsDuJour(dateAffichee);
  if (poids === null) {
    return;
  }
  demanderConfirmation({
    titre: "Supprimer la pesée ?",
    texte: "La pesée du " + dateLisible(dateAffichee) + " (" + kgEnTexte(poids) + " kg) sera supprimée.",
    boutonOui: "Supprimer",
    action: function () {
      delete classeur.jours[dateAffichee].poids;
      enregistrerClasseur();
      champPoids.value = "";
      afficherPoids();
      afficherJournee();
    }
  });
}

// ===================== LA FENÊTRE "MON OBJECTIF DE POIDS" =====================

/**
 * Affiche les champs du mode choisi (Trajectoire ou Maintien).
 */
function choisirModeObjectif(mode) {
  // On garde ce qui a été tapé pour l'ancien mode, et on propose la valeur du nouveau.
  if (modeObjectifChoisi === "trajectoire") {
    ciblePourTrajectoire = champPoidsCible.value;
  } else {
    ciblePourMaintien = champPoidsCible.value;
  }
  champPoidsCible.value = mode === "trajectoire" ? ciblePourTrajectoire : ciblePourMaintien;
  modeObjectifChoisi = mode;
  document.querySelectorAll(".bouton-mode").forEach(function (bouton) {
    bouton.classList.toggle("actif", bouton.dataset.mode === mode);
  });
  // Les champs "départ" et "rythme" n'existent qu'en Trajectoire.
  document.querySelectorAll(".seulement-trajectoire").forEach(function (element) {
    element.classList.toggle("cache", mode !== "trajectoire");
  });
  titreChampCible.textContent = mode === "trajectoire" ? "Poids final (kg)" : "Poids voulu (kg)";
  effacerErreurObjectifPoids();
  mettreAJourApercuPoids();
}

function ouvrirFenetreObjectifPoids() {
  const actuel = objectifPoidsDuJour(dateAffichee);
  const derniere = derniereePeseeAvant(dateAffichee);
  const dernierPoids = derniere ? kgEnTexte(derniere.poids) : "";

  // Départ (trajectoire) et poids voulu (maintien) : pré-remplis avec la dernière pesée.
  // Poids final (trajectoire) : celui de la trajectoire en cours, sinon vide.
  champPoidsDepart.value = dernierPoids || (actuel && actuel.depart ? kgEnTexte(actuel.depart) : "");
  ciblePourTrajectoire = actuel && actuel.mode === "trajectoire" ? kgEnTexte(actuel.cible) : "";
  ciblePourMaintien = dernierPoids || (actuel ? kgEnTexte(actuel.cible) : "");
  // Le mode "actuel" est appliqué juste après : on prépare le champ en conséquence.
  modeObjectifChoisi = actuel ? actuel.mode : "trajectoire";
  champPoidsCible.value = modeObjectifChoisi === "trajectoire" ? ciblePourTrajectoire : ciblePourMaintien;
  champPoidsRythme.value = actuel && actuel.rythme ? nombreEnTexte(actuel.rythme) : "2";
  champPoidsMarge.value = actuel ? kgEnTexte(actuel.marge) : "1,0";
  champPoidsDepuis.value = dateAffichee;

  choisirModeObjectif(modeObjectifChoisi);
  afficherHistoriqueObjectifsPoids();
  fenetreObjectifPoids.showModal();
}

/**
 * Lit et vérifie les champs. Renvoie { objectif } si tout va bien,
 * ou { erreur, champ } pour le premier problème trouvé.
 * "bascule" est vrai quand une trajectoire trop courte devient un maintien.
 */
function lireFormulaireObjectifPoids() {
  const cible = lireNombre(champPoidsCible.value);
  const marge = lireNombre(champPoidsMarge.value);
  const depuis = champPoidsDepuis.value;
  const nomCible = modeObjectifChoisi === "trajectoire" ? "poids final" : "poids voulu";

  if (modeObjectifChoisi === "trajectoire") {
    const depart = lireNombre(champPoidsDepart.value);
    if (!depart.valide || depart.valeur === null || depart.valeur < POIDS_MIN || depart.valeur > POIDS_MAX) {
      return { erreur: "Indique un poids de départ entre " + POIDS_MIN + " et " + POIDS_MAX + " kg.", champ: champPoidsDepart };
    }
  }
  if (!cible.valide || cible.valeur === null || cible.valeur < POIDS_MIN || cible.valeur > POIDS_MAX) {
    return { erreur: "Indique un " + nomCible + " entre " + POIDS_MIN + " et " + POIDS_MAX + " kg.", champ: champPoidsCible };
  }
  if (modeObjectifChoisi === "trajectoire") {
    const rythme = lireNombre(champPoidsRythme.value);
    if (!rythme.valide || rythme.valeur === null || rythme.valeur < RYTHME_MIN || rythme.valeur > RYTHME_MAX) {
      return { erreur: "Indique un rythme entre 0,5 et 6 kg par mois.", champ: champPoidsRythme };
    }
  }
  if (!marge.valide || marge.valeur === null || marge.valeur < MARGE_POIDS_MIN || marge.valeur > MARGE_POIDS_MAX) {
    return { erreur: "Indique une marge entre 0,1 et 10 kg.", champ: champPoidsMarge };
  }
  if (!depuis) {
    return { erreur: "Choisis la date de départ.", champ: champPoidsDepuis };
  }

  const valeurCible = arrondiPoids(cible.valeur);
  const valeurMarge = arrondiPoids(marge.valeur);

  if (modeObjectifChoisi === "trajectoire") {
    const valeurDepart = arrondiPoids(lireNombre(champPoidsDepart.value).valeur);
    // Bascule automatique : un écart plus petit que la marge, c'est déjà du maintien.
    if (Math.abs(valeurDepart - valeurCible) <= valeurMarge) {
      return { bascule: true, objectif: { depuis: depuis, mode: "maintien", cible: valeurCible, marge: valeurMarge } };
    }
    return {
      objectif: {
        depuis: depuis, mode: "trajectoire", depart: valeurDepart, cible: valeurCible,
        rythme: Math.round(lireNombre(champPoidsRythme.value).valeur * 100) / 100, marge: valeurMarge
      }
    };
  }
  return { objectif: { depuis: depuis, mode: "maintien", cible: valeurCible, marge: valeurMarge } };
}

/**
 * L'aperçu en direct sous les champs.
 */
function mettreAJourApercuPoids() {
  const lecture = lireFormulaireObjectifPoids();
  if (lecture.erreur) {
    apercuFourchettePoids.textContent = "";
    return;
  }
  const o = lecture.objectif;
  if (lecture.bascule) {
    apercuFourchettePoids.textContent =
      "Écart trop petit pour une trajectoire : objectif de maintien " +
      kgEnTexte(o.cible - o.marge) + " – " + kgEnTexte(o.cible + o.marge) + " kg";
  } else if (o.mode === "trajectoire") {
    const signe = sensTrajectoire(o) === "perte" ? "−" : "+";
    apercuFourchettePoids.textContent =
      signe + nombreEnTexte(o.rythme) + " kg/mois : " + kgEnTexte(o.cible) + " kg atteint vers le " +
      dateEnLettres(dateArrivee(o));
  } else {
    apercuFourchettePoids.textContent =
      "Maintien : entre " + kgEnTexte(o.cible - o.marge) + " et " + kgEnTexte(o.cible + o.marge) + " kg";
  }
}

function afficherHistoriqueObjectifsPoids() {
  listeHistoriqueObjectifsPoids.innerHTML = "";
  const tries = listeObjectifsPoids().slice().sort(function (a, b) {
    return a.depuis < b.depuis ? 1 : -1;
  });
  if (tries.length === 0) {
    const vide = document.createElement("li");
    vide.textContent = "Aucun objectif pour l'instant.";
    listeHistoriqueObjectifsPoids.appendChild(vide);
    return;
  }
  tries.forEach(function (objectif) {
    const element = document.createElement("li");
    element.textContent = "Depuis le " + dateLisible(objectif.depuis) + " : " + texteObjectif(objectif);
    listeHistoriqueObjectifsPoids.appendChild(element);
  });
}

function effacerErreurObjectifPoids() {
  erreurObjectifPoids.classList.add("cache");
  fenetreObjectifPoids.querySelectorAll(".champ-erreur").forEach(function (champ) {
    champ.classList.remove("champ-erreur");
  });
}

function enregistrerObjectifPoids(evenement) {
  evenement.preventDefault();
  effacerErreurObjectifPoids();
  const lecture = lireFormulaireObjectifPoids();
  if (lecture.erreur) {
    erreurObjectifPoids.textContent = lecture.erreur;
    erreurObjectifPoids.classList.remove("cache");
    lecture.champ.classList.add("champ-erreur"); // le champ en erreur est entouré de rouge
    lecture.champ.focus();
    return;
  }

  const nouvel = lecture.objectif;
  // Même date déjà existante → on remplace ; sinon on ajoute à l'historique.
  const objectifs = listeObjectifsPoids();
  const position = objectifs.findIndex(function (objectif) {
    return objectif.depuis === nouvel.depuis;
  });
  if (position === -1) {
    objectifs.push(nouvel);
  } else {
    objectifs[position] = nouvel;
  }

  enregistrerClasseur();
  fenetreObjectifPoids.close();
  afficherPoids();
  afficherJournee();
}

// ===================== DÉMARRAGE =====================

function initialiserPoids() {
  document.getElementById("bouton-enregistrer-poids").addEventListener("click", enregistrerPoids);
  boutonSupprimerPoids.addEventListener("click", demanderSuppressionPoids);
  champPoids.addEventListener("keydown", function (evenement) {
    if (evenement.key === "Enter") {
      evenement.preventDefault();
      enregistrerPoids();
    }
  });
  champPoids.addEventListener("input", function () {
    erreurPoids.classList.add("cache");
  });
  // Choisir une date ici change aussi la date des autres onglets.
  champDatePoids.addEventListener("change", function () {
    choisirDateALaMain(champDatePoids.value); // js/journee.js
  });

  document.getElementById("bouton-objectif-poids").addEventListener("click", ouvrirFenetreObjectifPoids);
  document.getElementById("bouton-annuler-objectif-poids").addEventListener("click", function () {
    fenetreObjectifPoids.close();
  });
  document.querySelectorAll(".bouton-mode").forEach(function (bouton) {
    bouton.addEventListener("click", function () {
      choisirModeObjectif(bouton.dataset.mode);
    });
  });
  const formulaire = document.getElementById("formulaire-objectif-poids");
  formulaire.addEventListener("submit", enregistrerObjectifPoids);
  // "input" (lettres tapées) et "change" (date choisie) : l'aperçu suit en direct.
  ["input", "change"].forEach(function (evenement) {
    formulaire.addEventListener(evenement, function () {
      mettreAJourApercuPoids();
      effacerErreurObjectifPoids();
    });
  });

  afficherPoids();
}
