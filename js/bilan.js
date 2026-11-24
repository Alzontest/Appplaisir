/*
  js/bilan.js — L'ONGLET "BILAN DU JOUR"

  Pour le jour affiché (le même que dans les autres onglets) :
    - le score /100 en grand, sa couleur et sa médaille (js/score.js) ;
    - la série en cours (jours d'affilée à 80 ou plus) ;
    - le détail : chaque ligne, réussie ou non, et ses points ;
    - la nutrition face aux objectifs (js/objectifs.js) ;
    - le poids du jour, son objectif et l'écart sur une semaine (js/poids.js) ;
    - la courbe des calories des 7 derniers jours, avec la zone de l'objectif.

  Rien n'est enregistré ici : tout est recalculé à chaque affichage.
*/

// ===== Les éléments de la page =====
const champDateBilan = document.getElementById("date-bilan");
const carteScore = document.getElementById("carte-score");
const listeDetailScore = document.getElementById("detail-score");
const zoneBilanNutrition = document.getElementById("bilan-nutrition");
const zoneBilanPoids = document.getElementById("bilan-poids");
const zoneGraphique = document.getElementById("graphique-7-jours");
const infoGraphique = document.getElementById("info-graphique");

// Les initiales des jours, de dimanche (0) à samedi (6), comme getDay().
const INITIALES_JOURS = ["D", "L", "M", "M", "J", "V", "S"];
const NOMS_JOURS = ["Dim.", "Lun.", "Mar.", "Mer.", "Jeu.", "Ven.", "Sam."];

/**
 * (Re)construit tout l'onglet pour le jour affiché.
 */
function afficherBilan() {
  champDateBilan.value = dateAffichee;
  const resultat = scoreDuJour(dateAffichee);

  afficherCarteScore(resultat);
  afficherSerie();
  afficherDetailScore(resultat);
  afficherBilanNutrition();
  afficherBilanPoids();
  dessinerGraphique7Jours();
}

// ===================== LE SCORE =====================

function afficherCarteScore(resultat) {
  document.getElementById("score-valeur").textContent = resultat.score;
  document.getElementById("score-medaille").textContent = medaille(resultat.score);

  // La couleur de la carte : "non-rempli" (gris) ou vert / jaune / rouge.
  carteScore.className = "carte-score " + (resultat.rempli ? "niveau-" + niveauScore(resultat.score) : "non-rempli");

  const texte = document.getElementById("score-texte");
  if (!resultat.rempli) {
    texte.textContent = "Jour non rempli : il compte 0 dans l'historique.";
  } else if (resultat.total === 0) {
    texte.textContent = "Aucune ligne à compter ce jour-là.";
  } else {
    texte.textContent = resultat.points + " point(s) sur " + resultat.total;
  }
}

function afficherSerie() {
  const serie = serieEnCours(dateAffichee);
  const zone = document.getElementById("serie");
  if (serie === 0) {
    zone.textContent = "Pas de série en cours : vise " + SEUIL_SERIE + " ou plus !";
    zone.classList.remove("serie-active");
  } else {
    zone.textContent = "🔥 " + serie + " jour" + (serie > 1 ? "s" : "") + " d'affilée à " + SEUIL_SERIE + " ou plus";
    zone.classList.add("serie-active");
  }
}

// ===================== LE DÉTAIL PAR LIGNE =====================

function afficherDetailScore(resultat) {
  listeDetailScore.innerHTML = "";

  resultat.details.forEach(function (detail) {
    const element = document.createElement("li");
    element.className = "detail-ligne";

    // Le petit rond : ✓ vert, ✗ rouge, ou — gris si la ligne ne compte pas.
    const rond = document.createElement("span");
    if (!detail.compte) {
      rond.className = "mini-rond neutre";
      rond.textContent = "—";
    } else if (detail.reussie) {
      rond.className = "mini-rond fait";
      rond.textContent = "✓";
    } else {
      rond.className = "mini-rond pas-fait";
      rond.textContent = "✗";
    }
    element.appendChild(rond);

    const texte = document.createElement("div");
    texte.className = "detail-texte";
    const nom = document.createElement("span");
    nom.textContent = detail.nom;
    texte.appendChild(nom);
    if (detail.raison) {
      const raison = document.createElement("span");
      raison.className = "detail-raison";
      raison.textContent = detail.raison;
      texte.appendChild(raison);
    }
    element.appendChild(texte);

    const points = document.createElement("span");
    points.className = "detail-points";
    // En points : gagnés / possibles (ex. "6 / 6 pts").
    points.textContent = detail.compte
      ? (detail.reussie ? detail.pointsMax : 0) + " / " + detail.pointsMax + (detail.pointsMax > 1 ? " pts" : " pt")
      : "—";
    element.appendChild(points);

    listeDetailScore.appendChild(element);
  });
}

// ===================== LA NUTRITION =====================

/**
 * Ajoute une ligne "titre : valeur — état" dans le bloc nutrition.
 * L'état a toujours un symbole ET un mot (jamais la couleur seule).
 */
function ajouterLigneNutrition(titre, valeur, etat) {
  ajouterLigneBilan(zoneBilanNutrition, titre, valeur, etat);
}

/**
 * Même chose, dans n'importe quelle zone (nutrition ou poids).
 */
function ajouterLigneBilan(zone, titre, valeur, etat) {
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

  if (etat) {
    const e = document.createElement("span");
    e.className = "etiquette-etat etat-" + etat.cle;
    e.textContent = etat.texte;
    ligne.appendChild(e);
  }

  zone.appendChild(ligne);
}

// Le symbole et le mot de chaque état.
const ETATS_TEXTE = {
  ok: { cle: "ok", texte: "✓ dans l'objectif" },
  bas: { cle: "bas", texte: "▼ insuffisant" },
  haut: { cle: "haut", texte: "▲ dépassé" }
};

function afficherBilanNutrition() {
  zoneBilanNutrition.innerHTML = "";
  const bilan = bilanDiete(dateAffichee);
  const kcal = nombreEnTexte(arrondir(bilan.totaux.kcal)) + " kcal";
  const prot = nombreEnTexte(arrondir(bilan.totaux.prot)) + " g";

  if (bilan.objectif === null) {
    ajouterLigneNutrition("Calories", kcal, null);
    ajouterLigneNutrition("Protéines", prot, null);
    const note = document.createElement("p");
    note.className = "aide aide-gauche";
    note.textContent = "Aucun objectif de diète pour ce jour (réglage dans Nutrition → 🎯).";
    zoneBilanNutrition.appendChild(note);
    return;
  }

  const fourchette = fourchetteKcal(bilan.objectif);
  ajouterLigneNutrition("Calories", kcal + " · objectif " + fourchette.min + " – " + fourchette.max, ETATS_TEXTE[bilan.etatKcal]);
  ajouterLigneNutrition(
    "Protéines",
    prot + " · minimum " + nombreEnTexte(bilan.objectif.protMin),
    bilan.etatProt === "ok" ? { cle: "ok", texte: "✓ atteint" } : ETATS_TEXTE.bas
  );

  let verdict;
  if (!bilan.aDesRepas) {
    verdict = { cle: "bas", texte: "✗ aucun plat noté" };
  } else if (bilan.tenue) {
    verdict = { cle: "ok", texte: "✓ tenue" };
  } else {
    verdict = { cle: "bas", texte: "✗ pas tenue" };
  }
  ajouterLigneNutrition("Diète", "", verdict);
}

// ===================== LE POIDS =====================

function afficherBilanPoids() {
  zoneBilanPoids.innerHTML = "";
  const bilan = bilanPoids(dateAffichee); // js/poids.js

  // 1. Le poids du jour, et sur quoi il est jugé (moyenne 7 j ou pesée du jour).
  ajouterLigneBilan(
    zoneBilanPoids,
    "Poids du jour",
    bilan.poids === null ? "pas de pesée" : kgEnTexte(bilan.poids) + " kg · " + texteBaseJugement(bilan),
    null
  );

  // 2. L'objectif : avance / retard (trajectoire) ou zone de maintien,
  //    avec l'étiquette symbole + mot.
  let titre = "Objectif";
  let valeur = "aucun objectif (réglage dans Poids → 🎯)";
  if (bilan.objectif !== null) {
    titre = bilan.phase === "trajectoire" ? "Trajectoire" : "Maintien";
    valeur = texteObjectifDuJour(bilan);
    if (bilan.phase === "trajectoire") {
      valeur += " · " + kgEnTexte(bilan.objectif.cible) + " kg vers le " + dateEnLettres(bilan.dateArrivee);
    }
  }
  ajouterLigneBilan(zoneBilanPoids, titre, valeur, etiquetteVerdictPoids(bilan));

  // 3. L'écart sur une semaine.
  const ecarts = ecartsPoids(dateAffichee);
  ajouterLigneBilan(
    zoneBilanPoids,
    "Sur une semaine",
    ecarts.semaine
      ? ecartEnTexte(ecarts.semaine.ecart) + " (depuis le " + dateLisible(ecarts.semaine.date) + ")"
      : "pas de pesée il y a 7 jours ou plus",
    null
  );
}

// ===================== LA COURBE DES 7 DERNIERS JOURS =====================

/**
 * Prépare les 7 colonnes de la courbe : du jour affiché - 6 jusqu'au jour affiché,
 * puis la dessine avec la fonction commune de js/graphique.js.
 */
function dessinerGraphique7Jours() {
  const points = [];
  for (let i = 6; i >= 0; i--) {
    const date = decalerDate(dateAffichee, -i);
    const jour = classeur.jours[date];
    const aDesRepas = Boolean(jour && jour.repas && jour.repas.length > 0);
    const objectif = objectifDuJour(date);
    const morceaux = date.split("-");
    const d = new Date(Number(morceaux[0]), Number(morceaux[1]) - 1, Number(morceaux[2]));
    points.push({
      etiquette: INITIALES_JOURS[d.getDay()] + " " + d.getDate(),
      // null = aucun plat noté : pas de point ce jour-là (un trou dans la courbe).
      kcal: aDesRepas ? arrondir(totauxDuJour(date).kcal) : null,
      fourchette: objectif ? fourchetteKcal(objectif) : null,
      titre: NOMS_JOURS[d.getDay()] + " " + dateLisible(date)
    });
  }
  // La dernière colonne (le jour affiché) est mise en avant.
  dessinerCourbeCalories(zoneGraphique, infoGraphique, points, { indexFort: 6 });
}

// ===================== DÉMARRAGE =====================

/**
 * Prépare l'onglet. Appelée par js/app.js.
 */
function initialiserBilan() {
  // Choisir une date ici change aussi la date des autres onglets.
  champDateBilan.addEventListener("change", function () {
    choisirDateALaMain(champDateBilan.value); // js/journee.js
  });
  afficherBilan();
}
