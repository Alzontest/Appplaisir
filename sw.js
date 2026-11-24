/*
  sw.js — LE SERVICE WORKER : L'APP MARCHE SANS INTERNET

  Un service worker est un petit programme que le navigateur garde à côté
  de l'app, même quand elle est fermée. Le nôtre fait 3 choses :

  1. À L'INSTALLATION : il télécharge TOUS les fichiers de l'app
     (liste FICHIERS ci-dessous) et les range dans un "cache" du téléphone.
  2. À CHAQUE OUVERTURE : quand l'app demande un fichier, il le donne
     depuis le cache, sans passer par internet → l'app marche en mode avion.
  3. AUX MISES À JOUR : quand ce fichier change (nouvelle VERSION_CACHE),
     le navigateur installe la nouvelle version, et l'app propose de recharger.
     L'ancien cache est alors supprimé.

  ⚠️ À CHAQUE NOUVELLE VERSION DE L'APP : changer VERSION_CACHE ci-dessous
     (sinon le téléphone garderait les anciens fichiers).
     Et si on ajoute un fichier à l'app, l'ajouter aussi dans FICHIERS.

  Attention : un service worker ne fonctionne qu'en https (GitHub Pages)
  ou sur "localhost". En ouvrant index.html par double-clic, il est ignoré.
*/

// Le nom du cache : il change à chaque version de l'app.
const VERSION_CACHE = "appplaisir-v1.0";

// Tous les fichiers dont l'app a besoin pour marcher sans internet.
// "./" = la page d'accueil (index.html).
const FICHIERS = [
  "./",
  "./index.html",
  "./style.css",
  "./manifest.json",
  "./icones/icone-192.png",
  "./icones/icone-512.png",
  "./icones/icone-masquable-512.png",
  "./icones/favicon-32.png",
  "./js/donnees.js",
  "./js/confirmation.js",
  "./js/journee.js",
  "./js/lignes.js",
  "./js/nutrition.js",
  "./js/objectifs.js",
  "./js/poids.js",
  "./js/favoris.js",
  "./js/score.js",
  "./js/graphique.js",
  "./js/bilan.js",
  "./js/historique.js",
  "./js/sauvegarde.js",
  "./js/mise-a-jour.js",
  "./js/app.js"
];

// ===== 1. INSTALLATION : on remplit le cache =====
self.addEventListener("install", function (evenement) {
  // waitUntil : "ne considère pas l'installation finie tant que ce n'est pas fait".
  evenement.waitUntil(
    caches.open(VERSION_CACHE).then(function (cache) {
      // { cache: "reload" } : on va chercher les fichiers sur internet,
      // pas dans un vieux cache du navigateur.
      return cache.addAll(FICHIERS.map(function (url) {
        return new Request(url, { cache: "reload" });
      }));
    })
  );
  // On n'active PAS tout de suite la nouvelle version : l'app la proposera
  // ("Nouvelle version prête") pour ne pas recharger pendant que tu écris.
});

// ===== 2. ACTIVATION : on supprime les anciens caches =====
self.addEventListener("activate", function (evenement) {
  evenement.waitUntil(
    caches.keys().then(function (noms) {
      return Promise.all(noms
        .filter(function (nom) {
          return nom.startsWith("appplaisir-") && nom !== VERSION_CACHE;
        })
        .map(function (nom) {
          return caches.delete(nom);
        }));
    }).then(function () {
      // La nouvelle version prend tout de suite la main sur les pages ouvertes.
      return self.clients.claim();
    })
  );
});

// ===== 3. CHAQUE DEMANDE DE FICHIER : d'abord le cache =====
self.addEventListener("fetch", function (evenement) {
  const demande = evenement.request;
  // On ne s'occupe que des lectures (GET) de fichiers de l'app elle-même.
  if (demande.method !== "GET" || new URL(demande.url).origin !== self.location.origin) {
    return;
  }

  evenement.respondWith(
    // ignoreSearch : "index.html?x=1" est servi comme "index.html".
    caches.match(demande, { ignoreSearch: true }).then(function (dansLeCache) {
      if (dansLeCache) {
        return dansLeCache; // trouvé dans le téléphone : pas besoin d'internet
      }
      // Pas dans le cache : on essaie internet…
      return fetch(demande).catch(function () {
        // … et sans internet, pour une page on renvoie l'app elle-même.
        if (demande.mode === "navigate") {
          return caches.match("./index.html");
        }
        return Response.error();
      });
    })
  );
});

// ===== Message de l'app : "active la nouvelle version maintenant" =====
self.addEventListener("message", function (evenement) {
  if (evenement.data === "activer-nouvelle-version") {
    self.skipWaiting();
  }
});
