/*
  js/app.js — LE CHEF D'ORCHESTRE
  Il est chargé EN DERNIER et :
    1. affiche le numéro de version dans l'en-tête ;
    2. gère le changement d'onglet quand on touche un bouton du bas ;
    3. démarre chaque partie de l'app (Ma journée, Nutrition, Objectifs, Poids, Favoris, Bilan, Historique, Sauvegarde).
*/

// Numéro de version de l'app. On le change à chaque étape.
const VERSION = "v1.1";

// ===== 1. Afficher la version =====
// On cherche l'élément dont l'id est "version" et on écrit le texte dedans.
document.getElementById("version").textContent = VERSION;

// ===== 2. Navigation entre les onglets =====

// On récupère tous les boutons du bas et toutes les sections (onglets).
const boutons = document.querySelectorAll(".bouton-onglet");
const onglets = document.querySelectorAll(".onglet");

/**
 * Affiche l'onglet demandé et cache tous les autres.
 * @param {string} idOnglet - l'id de la section à afficher (ex. "onglet-nutrition")
 */
function afficherOnglet(idOnglet) {
  // On parcourt chaque section : visible si c'est la bonne, cachée sinon.
  onglets.forEach(function (onglet) {
    if (onglet.id === idOnglet) {
      onglet.classList.remove("cache");
    } else {
      onglet.classList.add("cache");
    }
  });

  // Même logique pour les boutons : seul le bon est "actif" (mis en couleur).
  boutons.forEach(function (bouton) {
    if (bouton.dataset.onglet === idOnglet) {
      bouton.classList.add("actif");
    } else {
      bouton.classList.remove("actif");
    }
  });

  // Le Bilan est recalculé à chaque fois qu'on l'ouvre
  // (tes réponses ou tes plats ont pu changer entre-temps).
  if (idOnglet === "onglet-bilan") {
    afficherBilan();
  }
  // Pareil pour le Poids et l'Historique.
  if (idOnglet === "onglet-poids") {
    afficherPoids();
  }
  if (idOnglet === "onglet-historique") {
    afficherHistorique();
  }

  // On remonte en haut de la page à chaque changement d'onglet.
  window.scrollTo(0, 0);
}

// On "écoute" le clic sur chaque bouton.
// Quand on touche un bouton, on lit son attribut data-onglet
// et on affiche la section correspondante.
boutons.forEach(function (bouton) {
  bouton.addEventListener("click", function () {
    afficherOnglet(bouton.dataset.onglet);
  });
});

// ===== 3. Démarrer les différentes parties =====
// Ces fonctions viennent des fichiers chargés avant celui-ci.
// D'abord, la "photo" des jours passés (js/score.js) : ainsi leurs scores
// ne bougeront plus, même si tu changes un coefficient plus tard.
figerJoursPasses();
// Puis on ajoute les lignes "Pesée" et "Poids dans l'objectif" si elles manquent
// (js/poids.js). Dans CET ordre : les jours passés gardent leur photo sans elles.
verifierLignesSpeciales();
// Enfin, les lignes sans niveau reçoivent un niveau 1 à 4 d'après leur ancien coef
// (js/score.js). Les photos des jours passés gardent leur coef : scores inchangés.
verifierNiveaux();
// Et à chaque retour dans l'app (par exemple le lendemain matin).
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "visible") {
    figerJoursPasses();
  }
});

initialiserJournee();    // js/journee.js
initialiserNutrition();  // js/nutrition.js
initialiserObjectifs();  // js/objectifs.js
initialiserPoids();      // js/poids.js
initialiserFavoris();    // js/favoris.js
initialiserBilan();      // js/bilan.js
initialiserHistorique(); // js/historique.js
initialiserMiseAJour();  // js/mise-a-jour.js : hors connexion + mises à jour
initialiserSauvegarde(); // js/sauvegarde.js
