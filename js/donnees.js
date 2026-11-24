/*
  js/donnees.js — LIRE ET ENREGISTRER LES DONNÉES SUR L'APPAREIL

  Toutes les données de l'app forment UN SEUL "classeur" (un objet JavaScript).
  On le range dans le localStorage du navigateur : un petit espace de stockage
  qui reste sur l'appareil, même quand on ferme l'app ou qu'on éteint l'écran.

  Forme du classeur :
  {
    lignes: [                              ← les lignes de "Ma journée"
      { id: "sport", nom: "Sport", niveau: 4 },              ← niveau d'importance 1 à 4 (js/score.js)
      { id: "pas",   nom: "10 000 pas", niveau: 2 },
      { id: "diete", nom: "Diète", niveau: 3, speciale: "diete" },
      { id: "pesee", nom: "Pesée", niveau: 1, speciale: "pesee" },               ← automatique (js/poids.js)
      { id: "poids", nom: "Poids dans l'objectif", niveau: 4, speciale: "poids" } ← automatique (js/poids.js)
    ],
    jours: {                               ← ce que tu as noté, jour par jour
      "2026-11-21": {
        reponses: { sport: true, pas: false },
        lignes: [ … ],                     ← la "photo" des lignes de ce jour passé (js/score.js)
        repas: [                           ← les plats de l'onglet Nutrition
          { id: "p1795…", nom: "Poulet riz", kcal: 590, prot: 45, gluc: 80, lip: null, quantite: 1.5 }
        ],                                 ← null = valeur inconnue (X) ; quantite absente = 1
        poids: 74.6                        ← la pesée du jour en kg (absent = pas de pesée)
      }
    },
    objectifs: [                           ← l'historique des objectifs de diète (voir js/objectifs.js)
      { depuis: "2026-11-21", kcal: 2200, marge: 10, protMin: 150 }
    ],
    objectifsPoids: [                      ← l'historique des objectifs de poids (voir js/poids.js)
      { depuis: "2026-10-23", mode: "trajectoire", depart: 77, cible: 70, rythme: 2, marge: 1 },
      { depuis: "2027-04-01", mode: "maintien", cible: 70, marge: 1 }
    ],                                     ← rythme en kg/mois, marge en kg ; sans "mode" = maintien
    favoris: [                             ← tes plats favoris (voir js/favoris.js)
      { id: "f1795…", nom: "Skyr", kcal: 84, prot: 15, gluc: 6, lip: 0, utilisations: 12, derniereUtilisation: "2026-11-21" }
    ],
    dernierExport: "2026-11-16"            ← date de ta dernière sauvegarde (absent = jamais)
  }
  Dans "reponses" : true = fait, false = pas fait, absent = pas encore répondu.

  Une ligne supprimée n'est pas effacée du classeur : elle reçoit
  "supprimee: true" et disparaît de l'écran. Ainsi, tes réponses passées
  restent intactes pour l'historique (v0.8).
*/

// Le nom de la "case" du localStorage où l'on range le classeur.
const CLE_STOCKAGE = "appplaisir";

/**
 * Le classeur de départ, utilisé la toute première fois que l'app s'ouvre.
 * Chaque ligne a un niveau d'importance de 1 à 4 (réglable dans l'app).
 */
function classeurDeDepart() {
  return {
    lignes: [
      { id: "sport", nom: "Sport", niveau: 4 },
      { id: "pas", nom: "10 000 pas", niveau: 2 },
      // "speciale" : ces lignes se remplissent toutes seules
      // (Diète grâce à Nutrition, Pesée et Poids grâce à l'onglet Poids).
      { id: "diete", nom: "Diète", niveau: 3, speciale: "diete" },
      { id: "pesee", nom: "Pesée", niveau: 1, speciale: "pesee" },
      { id: "poids", nom: "Poids dans l'objectif", niveau: 4, speciale: "poids" }
    ],
    jours: {},
    objectifs: [],
    objectifsPoids: [],
    favoris: []
  };
}

/**
 * Lit le classeur dans le localStorage.
 * S'il n'existe pas encore (première ouverture), on renvoie le classeur de départ.
 */
function chargerClasseur() {
  // localStorage ne sait ranger que du TEXTE.
  const texte = localStorage.getItem(CLE_STOCKAGE);

  if (texte === null) {
    return classeurDeDepart();
  }

  // JSON.parse transforme le texte rangé en objet JavaScript utilisable.
  return JSON.parse(texte);
}

/**
 * Enregistre le classeur dans le localStorage.
 * Appelée après CHAQUE modification : pas besoin de bouton "Enregistrer".
 */
function enregistrerClasseur() {
  // JSON.stringify fait l'inverse de JSON.parse : objet → texte.
  localStorage.setItem(CLE_STOCKAGE, JSON.stringify(classeur));
}

/**
 * Transforme une date JavaScript en texte "AAAA-MM-JJ" (ex. "2026-11-21"),
 * selon l'heure de ton appareil.
 * @param {Date} date
 */
function dateEnTexte(date) {
  const annee = date.getFullYear();
  // getMonth() compte les mois à partir de 0 (janvier = 0), d'où le + 1.
  // padStart(2, "0") ajoute un zéro devant si besoin : 3 → "03".
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  const jour = String(date.getDate()).padStart(2, "0");
  return annee + "-" + mois + "-" + jour;
}

/**
 * Donne la date d'aujourd'hui au format "AAAA-MM-JJ".
 */
function dateDuJour() {
  return dateEnTexte(new Date());
}

/**
 * Transforme "2026-11-21" en "21/11/2026", plus agréable à lire.
 * split("-") découpe le texte à chaque tiret : ["2026", "11", "21"].
 */
function dateLisible(texte) {
  const morceaux = texte.split("-");
  return morceaux[2] + "/" + morceaux[1] + "/" + morceaux[0];
}

/**
 * Renvoie les données d'un jour. Si ce jour n'a encore rien, on le crée (vide).
 * @param {string} date - au format "AAAA-MM-JJ"
 */
function donneesDuJour(date) {
  if (!classeur.jours[date]) {
    classeur.jours[date] = { reponses: {} };
  }
  // Les jours créés avant la v0.5 n'ont pas encore de liste "repas" : on l'ajoute.
  if (!classeur.jours[date].repas) {
    classeur.jours[date].repas = [];
  }
  return classeur.jours[date];
}

/**
 * Renvoie seulement les lignes à afficher (celles qui ne sont pas supprimées).
 * filter() garde les éléments d'un tableau pour lesquels la condition est vraie.
 */
function lignesVisibles() {
  return classeur.lignes.filter(function (ligne) {
    return !ligne.supprimee;
  });
}

/**
 * Fabrique un identifiant unique, ex. "p1795290000000-k3f9".
 * Date.now() donne le nombre de millisecondes écoulées depuis 1970,
 * et on ajoute 4 caractères au hasard : même deux touches dans la même
 * milliseconde donnent deux identifiants différents.
 * @param {string} prefixe - "l" pour une ligne, "p" pour un plat, "f" pour un favori
 */
function creerId(prefixe) {
  // Math.random().toString(36) donne un texte au hasard comme "0.k3f9x2…" ;
  // slice(2, 6) en garde 4 caractères.
  return prefixe + Date.now() + "-" + Math.random().toString(36).slice(2, 6);
}

function creerIdLigne() {
  return creerId("l");
}

function creerIdPlat() {
  return creerId("p");
}

function creerIdFavori() {
  return creerId("f");
}

// On charge le classeur UNE fois, au démarrage.
// "classeur" est ensuite utilisable par tous les autres fichiers js.
let classeur = chargerClasseur();
