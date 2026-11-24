/*
  js/mise-a-jour.js — INSTALLER LE SERVICE WORKER ET PROPOSER LES MISES À JOUR

  1. Au démarrage, on "inscrit" le service worker (sw.js) : c'est lui qui
     garde une copie de l'app dans le téléphone pour qu'elle marche sans internet.
     ⚠️ Ça ne marche qu'en https (GitHub Pages) ou sur "localhost" :
     en ouvrant index.html par double-clic (adresse "file://"), on ne fait rien.

  2. Quand une nouvelle version de l'app est en ligne, le téléphone la
     télécharge en arrière-plan. Une fois prête, un bandeau bleu propose :
     "✨ Nouvelle version prête — Recharger". On ne recharge JAMAIS tout seul,
     pour ne pas te couper pendant que tu écris.
*/

const bandeauMiseAJour = document.getElementById("bandeau-mise-a-jour");

// Vrai quand TU as demandé à recharger (bouton du bandeau).
let rechargementDemande = false;
// La nouvelle version en attente (un service worker "installé" mais pas encore actif).
let nouvelleVersionEnAttente = null;

/**
 * Affiche le bandeau "Nouvelle version prête".
 */
function proposerMiseAJour(serviceWorker) {
  nouvelleVersionEnAttente = serviceWorker;
  bandeauMiseAJour.classList.remove("cache");
}

/**
 * Inscrit le service worker et surveille les mises à jour. Appelée par js/app.js.
 */
function initialiserMiseAJour() {
  // Le navigateur ne connaît pas les service workers, ou on est en "file://" : rien à faire.
  if (!("serviceWorker" in navigator) || location.protocol === "file:") {
    return;
  }

  // Le bouton "Recharger" : on dit à la nouvelle version de prendre la main…
  document.getElementById("bouton-mise-a-jour").addEventListener("click", function () {
    if (nouvelleVersionEnAttente) {
      rechargementDemande = true;
      nouvelleVersionEnAttente.postMessage("activer-nouvelle-version");
    }
  });

  // … et quand elle a pris la main, on recharge la page (une seule fois).
  navigator.serviceWorker.addEventListener("controllerchange", function () {
    if (rechargementDemande) {
      rechargementDemande = false;
      location.reload();
    }
  });

  navigator.serviceWorker.register("sw.js").then(function (inscription) {
    // Une nouvelle version attendait déjà (téléchargée lors d'une visite précédente).
    // "controller" existe seulement si une ANCIENNE version tournait déjà :
    // à la toute première installation, il n'y a rien à proposer.
    if (inscription.waiting && navigator.serviceWorker.controller) {
      proposerMiseAJour(inscription.waiting);
    }

    // Une nouvelle version commence à se télécharger.
    inscription.addEventListener("updatefound", function () {
      const nouvelle = inscription.installing;
      nouvelle.addEventListener("statechange", function () {
        if (nouvelle.state === "installed" && navigator.serviceWorker.controller) {
          proposerMiseAJour(nouvelle);
        }
      });
    });

    // À chaque retour dans l'app, on regarde s'il y a du nouveau en ligne.
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "visible") {
        inscription.update().catch(function () {
          // Pas d'internet : pas grave, on réessaiera plus tard.
        });
      }
    });
  }).catch(function () {
    // L'inscription a échoué (rare) : l'app marche quand même, simplement pas hors connexion.
  });
}
