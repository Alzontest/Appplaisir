/*
  js/objectifs.js — LES OBJECTIFS DE DIÈTE ET LE VERDICT "DIÈTE TENUE"

  1. L'HISTORIQUE DES OBJECTIFS
     Les objectifs sont rangés dans classeur.objectifs, chacun avec la date
     à partir de laquelle il s'applique :
       objectifs: [
         { depuis: "2026-01-01", kcal: 1500, marge: 10, protMin: 120 },
         { depuis: "2026-07-01", kcal: 2000, marge: 10, protMin: 150 }
       ]
     Pour juger un jour, on prend le DERNIER objectif dont la date "depuis"
     est avant (ou égale à) ce jour. Ainsi, le 15 mars est jugé avec 1500 kcal
     même si tu passes à 2000 kcal en juillet : rien ne change rétroactivement.

  2. LE VERDICT DU JOUR
     Diète tenue = calories dans la fourchette (objectif ± marge)
                   ET protéines ≥ minimum.
     Ce verdict n'est jamais enregistré : il est recalculé à chaque affichage,
     à partir des repas du jour et de l'objectif de ce jour-là.
*/

// ===== Les éléments de la page =====
const fenetreObjectifs = document.getElementById("fenetre-objectifs");
const champObjectifKcal = document.getElementById("champ-objectif-kcal");
const champObjectifMarge = document.getElementById("champ-objectif-marge");
const champObjectifProt = document.getElementById("champ-objectif-prot");
const champObjectifDepuis = document.getElementById("champ-objectif-depuis");
const apercuFourchette = document.getElementById("apercu-fourchette");
const erreurObjectifs = document.getElementById("erreur-objectifs");
const listeHistoriqueObjectifs = document.getElementById("historique-objectifs");

// ===================== CALCULS =====================

/**
 * Renvoie la liste des objectifs (vide si aucun n'a encore été réglé).
 * Les classeurs créés avant la v0.6 n'ont pas encore cette liste.
 */
function listeObjectifs() {
  if (!classeur.objectifs) {
    classeur.objectifs = [];
  }
  return classeur.objectifs;
}

/**
 * Renvoie l'objectif en vigueur pour une date, ou null s'il n'y en avait pas encore.
 * @param {string} date - "AAAA-MM-JJ"
 */
function objectifDuJour(date) {
  let trouve = null;
  listeObjectifs().forEach(function (objectif) {
    // On garde le plus récent parmi ceux qui ont commencé avant ou ce jour-là.
    if (objectif.depuis <= date && (trouve === null || objectif.depuis > trouve.depuis)) {
      trouve = objectif;
    }
  });
  return trouve;
}

/**
 * Calcule la fourchette de calories : 2200 ± 10 % → { min: 1980, max: 2420 }.
 */
function fourchetteKcal(objectif) {
  const ecart = (objectif.kcal * objectif.marge) / 100;
  return {
    min: Math.round(objectif.kcal - ecart),
    max: Math.round(objectif.kcal + ecart)
  };
}

/**
 * Le bilan diète d'un jour. Renvoie un objet :
 * {
 *   objectif:  l'objectif du jour (ou null),
 *   totaux:    les totaux du jour (voir totauxDuJour dans js/nutrition.js),
 *   aDesRepas: true s'il y a au moins un plat noté,
 *   etatKcal:  "bas" | "ok" | "haut"   (null si pas d'objectif),
 *   etatProt:  "bas" | "ok"            (null si pas d'objectif),
 *   tenue:     true | false | null     (null = on ne peut pas juger)
 * }
 */
function bilanDiete(date) {
  const objectif = objectifDuJour(date);
  const totaux = totauxDuJour(date);
  const jour = classeur.jours[date];
  const aDesRepas = Boolean(jour && jour.repas && jour.repas.length > 0);

  const bilan = {
    objectif: objectif,
    totaux: totaux,
    aDesRepas: aDesRepas,
    etatKcal: null,
    etatProt: null,
    tenue: null
  };

  if (objectif === null) {
    return bilan; // pas d'objectif pour ce jour : impossible de juger
  }

  const fourchette = fourchetteKcal(objectif);
  if (totaux.kcal < fourchette.min) {
    bilan.etatKcal = "bas";
  } else if (totaux.kcal > fourchette.max) {
    bilan.etatKcal = "haut";
  } else {
    bilan.etatKcal = "ok";
  }

  bilan.etatProt = totaux.prot >= objectif.protMin ? "ok" : "bas";

  // On ne juge la journée que si au moins un plat est noté.
  if (aDesRepas) {
    bilan.tenue = bilan.etatKcal === "ok" && bilan.etatProt === "ok";
  }

  return bilan;
}

// ===================== AFFICHAGE DANS "NUTRITION" =====================

/**
 * Colore les encadrés kcal / protéines et affiche le verdict du jour.
 * Appelée par afficherTotaux() (js/nutrition.js) à chaque changement.
 */
function afficherObjectifsNutrition() {
  const bilan = bilanDiete(dateAffichee);
  const encadreKcal = document.getElementById("encadre-kcal");
  const encadreProt = document.getElementById("encadre-prot");
  const verdict = document.getElementById("verdict-diete");

  // On enlève les anciennes couleurs avant de remettre les nouvelles.
  [encadreKcal, encadreProt].forEach(function (encadre) {
    encadre.classList.remove("etat-ok", "etat-bas", "etat-haut");
  });

  if (bilan.objectif === null) {
    document.getElementById("objectif-kcal").textContent = "";
    document.getElementById("objectif-prot").textContent = "";
    verdict.textContent = "Règle tes objectifs pour savoir si ta diète est tenue.";
    verdict.className = "verdict";
    return;
  }

  const fourchette = fourchetteKcal(bilan.objectif);
  document.getElementById("objectif-kcal").textContent =
    "objectif " + fourchette.min + " – " + fourchette.max;
  document.getElementById("objectif-prot").textContent =
    "minimum " + nombreEnTexte(bilan.objectif.protMin);

  encadreKcal.classList.add("etat-" + bilan.etatKcal);
  encadreProt.classList.add("etat-" + bilan.etatProt);

  if (bilan.tenue === null) {
    verdict.textContent = "Diète tenue : — (aucun plat noté)";
    verdict.className = "verdict";
  } else if (bilan.tenue) {
    verdict.textContent = "Diète tenue : OUI ✓";
    verdict.className = "verdict verdict-oui";
  } else {
    verdict.textContent = "Diète tenue : NON ✗";
    verdict.className = "verdict verdict-non";
  }
}

// ===================== LA FENÊTRE DES OBJECTIFS =====================

/**
 * Ouvre la fenêtre, pré-remplie avec l'objectif du jour affiché.
 */
function ouvrirFenetreObjectifs() {
  const actuel = objectifDuJour(dateAffichee);

  champObjectifKcal.value = actuel ? nombreEnTexte(actuel.kcal) : "";
  // Marge de 10 % proposée par défaut la première fois.
  champObjectifMarge.value = actuel ? nombreEnTexte(actuel.marge) : "10";
  champObjectifProt.value = actuel ? nombreEnTexte(actuel.protMin) : "";
  // Par défaut, le changement s'applique à partir du jour affiché.
  champObjectifDepuis.value = dateAffichee;

  erreurObjectifs.classList.add("cache");
  mettreAJourApercuFourchette();
  afficherHistoriqueObjectifs();
  fenetreObjectifs.showModal();
}

/**
 * Montre en direct la fourchette de calories pendant que tu tapes.
 */
function mettreAJourApercuFourchette() {
  const kcal = lireNombre(champObjectifKcal.value).valeur;
  const marge = lireNombre(champObjectifMarge.value).valeur;
  if (kcal && marge !== null) {
    const fourchette = fourchetteKcal({ kcal: kcal, marge: marge });
    apercuFourchette.textContent = "Soit entre " + fourchette.min + " et " + fourchette.max + " kcal.";
  } else {
    apercuFourchette.textContent = "";
  }
}

/**
 * Écrit la liste des objectifs, du plus récent au plus ancien.
 */
function afficherHistoriqueObjectifs() {
  listeHistoriqueObjectifs.innerHTML = "";

  // slice() fait une copie, pour trier sans toucher à l'ordre d'origine.
  // sort() range du plus récent au plus ancien.
  const tries = listeObjectifs().slice().sort(function (a, b) {
    return a.depuis < b.depuis ? 1 : -1;
  });

  if (tries.length === 0) {
    const vide = document.createElement("li");
    vide.textContent = "Aucun objectif pour l'instant.";
    listeHistoriqueObjectifs.appendChild(vide);
    return;
  }

  tries.forEach(function (objectif) {
    const element = document.createElement("li");
    element.textContent =
      "Depuis le " + dateLisible(objectif.depuis) + " : " +
      nombreEnTexte(objectif.kcal) + " kcal ± " + nombreEnTexte(objectif.marge) + " %, " +
      "protéines ≥ " + nombreEnTexte(objectif.protMin) + " g";
    listeHistoriqueObjectifs.appendChild(element);
  });
}

/**
 * Vérifie et enregistre l'objectif saisi.
 */
function enregistrerObjectif(evenement) {
  evenement.preventDefault();

  const kcal = lireNombre(champObjectifKcal.value);
  const marge = lireNombre(champObjectifMarge.value);
  const prot = lireNombre(champObjectifProt.value);
  const depuis = champObjectifDepuis.value;

  // Ici, toutes les cases sont obligatoires (pas de "X" possible).
  if (!kcal.valide || !kcal.valeur) {
    return afficherErreurObjectifs("Indique les calories visées (ex. 2200).", champObjectifKcal);
  }
  if (!marge.valide || marge.valeur === null || marge.valeur > 50) {
    return afficherErreurObjectifs("Indique une marge entre 0 et 50 %.", champObjectifMarge);
  }
  if (!prot.valide || prot.valeur === null) {
    return afficherErreurObjectifs("Indique le minimum de protéines (ex. 150).", champObjectifProt);
  }
  if (!depuis) {
    return afficherErreurObjectifs("Choisis la date de départ.", champObjectifDepuis);
  }

  const nouvel = { depuis: depuis, kcal: kcal.valeur, marge: marge.valeur, protMin: prot.valeur };

  // S'il existe déjà un objectif qui commence le même jour, on le remplace.
  // Sinon, on ajoute le nouvel objectif à l'historique.
  const objectifs = listeObjectifs();
  // findIndex renvoie la position de l'élément trouvé, ou -1 s'il n'existe pas.
  const position = objectifs.findIndex(function (objectif) {
    return objectif.depuis === depuis;
  });
  if (position === -1) {
    objectifs.push(nouvel);
  } else {
    objectifs[position] = nouvel;
  }

  enregistrerClasseur();
  fenetreObjectifs.close();
  // Les verdicts peuvent changer : on redessine les deux onglets.
  afficherJournee();
  afficherNutrition();
}

function afficherErreurObjectifs(texte, champ) {
  erreurObjectifs.textContent = texte;
  erreurObjectifs.classList.remove("cache");
  champ.focus();
}

// ===================== DÉMARRAGE =====================

/**
 * Prépare la fenêtre des objectifs. Appelée par js/app.js.
 */
function initialiserObjectifs() {
  document.getElementById("bouton-objectifs").addEventListener("click", ouvrirFenetreObjectifs);
  document.getElementById("bouton-annuler-objectifs").addEventListener("click", function () {
    fenetreObjectifs.close();
  });
  document.getElementById("formulaire-objectifs").addEventListener("submit", enregistrerObjectif);

  // À chaque lettre tapée : aperçu de la fourchette, et l'erreur disparaît.
  document.getElementById("formulaire-objectifs").addEventListener("input", function () {
    mettreAJourApercuFourchette();
    erreurObjectifs.classList.add("cache");
  });
}
