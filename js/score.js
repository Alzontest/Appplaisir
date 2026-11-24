/*
  js/score.js — LE SCORE SUR 100, LES MÉDAILLES ET LA SÉRIE

  1. LE SCORE D'UN JOUR
     score = 100 × (points des lignes réussies) / (points des lignes comptées)
     Les points d'une ligne viennent de son NIVEAU d'importance (1 à 4) :
       niveau 1 = 1 pt · niveau 2 = 3 pts · niveau 3 = 6 pts · niveau 4 = 10 pts
       (formule n × (n + 1) / 2). Une ligne ancienne sans niveau garde son "coef".
     - Ligne normale : réussie si tu as répondu ✓. Sans réponse = ✗.
     - Ligne Diète : réussie si le verdict automatique est "tenue".
       Objectif réglé mais aucun plat noté = ✗.
       Aucun objectif réglé pour ce jour = la ligne n'est pas comptée.
     - Ligne Pesée : réussie si un poids est noté ce jour-là (sinon ✗).
     - Ligne Poids dans l'objectif : jugée par bilanPoids (js/poids.js) :
       trajectoire (sous / au-dessus de la limite du jour) ou maintien (cible ± marge),
       sur la moyenne 7 j dès 3 pesées. Pas de pesée = ✗.
       Aucun objectif de poids pour ce jour = la ligne n'est pas comptée.
     - Jour complètement vide (rien répondu, aucun plat) = 0.

  2. LA "PHOTO" DES LIGNES (pour que les jours passés ne bougent plus)
     Chaque jour passé garde une copie de ses lignes et de leurs points :
       jours["2026-11-20"].lignes = [ { id: "sport", nom: "Sport", niveau: 4 }, … ]
       (les photos prises avant la v0.9.3 contiennent "coef" : elles le gardent)
     Si tu changes un niveau aujourd'hui, les jours passés gardent
     l'ancien : leur score ne change pas. Aujourd'hui (et les jours futurs)
     utilisent toujours les lignes actuelles.
     La photo est prise au démarrage de l'app, et juste AVANT chaque
     modification d'une ligne (créer, modifier, supprimer).

  3. MÉDAILLES ET SÉRIE
     🥉 dès 60 · 🥈 dès 80 · 🥇 à 100
     Série = nombre de jours d'affilée à 80 ou plus.
*/

// Les seuils, au même endroit pour pouvoir les changer facilement.
const SEUIL_BRONZE = 60;
const SEUIL_ARGENT = 80;
const SEUIL_OR = 100;
const SEUIL_SERIE = 80;
// Couleurs du score : vert dès 80, jaune dès 50, rouge en dessous.
const SEUIL_VERT = 80;
const SEUIL_JAUNE = 50;

// ===================== LES POINTS D'UNE LIGNE =====================

const NIVEAU_MIN = 1;
const NIVEAU_MAX = 4;

/**
 * Les points d'un niveau : n × (n + 1) / 2 → 1, 3, 6, 10.
 */
function pointsDuNiveau(niveau) {
  return (niveau * (niveau + 1)) / 2;
}

/**
 * Les points que vaut une ligne : son niveau s'il existe,
 * sinon son ancien coefficient (photos des jours passés d'avant la v0.9.3).
 * C'est la SEULE fonction qui décide des points d'une ligne.
 */
function pointsDeLaLigne(ligne) {
  if (typeof ligne.niveau === "number") {
    return pointsDuNiveau(ligne.niveau);
  }
  return typeof ligne.coef === "number" ? ligne.coef : 1;
}

/**
 * Le texte affiché sous le nom d'une ligne : "niveau 3 · 6 pts" (ou "5 pts" pour un ancien coef).
 */
function texteImportance(ligne) {
  const points = pointsDeLaLigne(ligne);
  const textePoints = points + (points > 1 ? " pts" : " pt");
  return typeof ligne.niveau === "number" ? "niveau " + ligne.niveau + " · " + textePoints : textePoints;
}

/**
 * Le niveau qui correspond à un ancien coefficient :
 * 1 → 1 ; 2 à 4 → 2 ; 5 à 7 → 3 ; 8 à 10 → 4.
 */
function niveauDepuisCoef(coef) {
  if (coef <= 1) {
    return 1;
  }
  if (coef <= 4) {
    return 2;
  }
  if (coef <= 7) {
    return 3;
  }
  return 4;
}

/**
 * Migration : donne un niveau aux lignes actuelles qui n'en ont pas encore
 * (à partir de leur coef). Les photos des jours passés ne sont PAS touchées :
 * leurs scores ne changent pas. Appelée au démarrage et après un import,
 * APRÈS figerJoursPasses() (pour que les jours passés soient photographiés avec leur coef).
 */
function verifierNiveaux() {
  let changement = false;
  classeur.lignes.forEach(function (ligne) {
    if (typeof ligne.niveau !== "number") {
      ligne.niveau = niveauDepuisCoef(typeof ligne.coef === "number" ? ligne.coef : 1);
      delete ligne.coef; // le niveau remplace le coef pour les lignes actuelles
      changement = true;
    }
  });
  if (changement) {
    enregistrerClasseur();
  }
}

// ===================== LA PHOTO DES LIGNES =====================

/**
 * Vrai si le jour contient au moins une réponse ou un plat.
 */
function jourEstRempli(jour) {
  if (!jour) {
    return false;
  }
  const aDesReponses = jour.reponses && Object.keys(jour.reponses).length > 0;
  const aDesRepas = jour.repas && jour.repas.length > 0;
  // Une pesée suffit aussi pour que le jour soit "rempli" (v0.9.1).
  const aUnePesee = typeof jour.poids === "number";
  return Boolean(aDesReponses || aDesRepas || aUnePesee);
}

/**
 * Copie des lignes actuelles (seulement ce qui compte pour le score).
 */
function copieDesLignes() {
  return lignesVisibles().map(function (ligne) {
    // On copie le niveau (ou, pour une ligne pas encore migrée, son coef).
    const copie = { id: ligne.id, nom: ligne.nom };
    if (typeof ligne.niveau === "number") {
      copie.niveau = ligne.niveau;
    } else {
      copie.coef = ligne.coef;
    }
    if (ligne.speciale) {
      copie.speciale = ligne.speciale;
    }
    return copie;
  });
}

/**
 * Prend la photo de tous les jours PASSÉS remplis qui n'en ont pas encore.
 * À appeler au démarrage et juste avant de modifier une ligne.
 */
function figerJoursPasses() {
  const aujourdhui = dateDuJour();
  let changement = false;

  // Object.keys donne la liste des dates du classeur.
  Object.keys(classeur.jours).forEach(function (date) {
    const jour = classeur.jours[date];
    if (date < aujourdhui && !jour.lignes && jourEstRempli(jour)) {
      jour.lignes = copieDesLignes();
      changement = true;
    }
  });

  if (changement) {
    enregistrerClasseur();
  }
}

/**
 * Les lignes à utiliser pour un jour :
 * la photo s'il en a une (jour passé), sinon les lignes actuelles.
 */
function lignesDuJour(date) {
  const jour = classeur.jours[date];
  if (jour && jour.lignes && date < dateDuJour()) {
    return rangerSelonOrdreActuel(jour.lignes);
  }
  return lignesVisibles();
}

/**
 * Range une liste de lignes dans l'ordre actuel de classeur.lignes.
 * Sert pour la "photo" d'un jour passé : elle garde ses lignes et ses
 * points, mais s'affiche dans l'ordre que tu as choisi.
 * Une ligne qui n'existe plus du tout va à la fin.
 */
function rangerSelonOrdreActuel(lignes) {
  const ordre = classeur.lignes.map(function (l) { return l.id; });
  function place(ligne) {
    const p = ordre.indexOf(ligne.id);
    return p === -1 ? ordre.length : p;
  }
  // slice() fait une copie : on ne touche pas à la photo enregistrée.
  return lignes.slice().sort(function (a, b) { return place(a) - place(b); });
}

// ===================== LE SCORE =====================

/**
 * Calcule le score d'un jour. Renvoie :
 * {
 *   score: 80,            ← de 0 à 100 (arrondi)
 *   points: 12,           ← coefficients gagnés
 *   total: 15,            ← coefficients possibles
 *   rempli: true,         ← false si le jour est complètement vide
 *   details: [ { id, nom, pointsMax, reussie, compte, raison } ]
 * }
 * "compte" est false pour la Diète quand aucun objectif n'existe ce jour-là.
 */
function scoreDuJour(date) {
  const jour = classeur.jours[date];
  const reponses = jour && jour.reponses ? jour.reponses : {};
  const resultat = { score: 0, points: 0, total: 0, rempli: jourEstRempli(jour), details: [] };

  lignesDuJour(date).forEach(function (ligne) {
    // pointsMax : ce que vaut la ligne (selon son niveau, ou son coef pour une ancienne photo).
    const detail = { id: ligne.id, nom: ligne.nom, pointsMax: pointsDeLaLigne(ligne), reussie: false, compte: true, raison: "" };

    if (ligne.speciale === "diete") {
      const bilan = bilanDiete(date); // js/objectifs.js
      if (bilan.objectif === null) {
        detail.compte = false;
        detail.raison = "pas d'objectif : non comptée";
      } else if (!bilan.aDesRepas) {
        detail.raison = "aucun plat noté";
      } else {
        detail.reussie = bilan.tenue === true;
      }
    } else if (ligne.speciale === "pesee") {
      detail.reussie = poidsDuJour(date) !== null; // js/poids.js
      if (!detail.reussie) {
        detail.raison = "pas de pesée";
      }
    } else if (ligne.speciale === "poids") {
      const bilan = bilanPoids(date); // js/poids.js
      if (bilan.objectif === null) {
        detail.compte = false;
        detail.raison = "pas d'objectif : non comptée";
      } else {
        // bilan.raison : « pas de pesée », « en avance de 1,2 kg »,
        // « au-dessus de la limite (76,0 kg) », « hors de la zone de maintien »…
        detail.reussie = bilan.dansObjectif === true;
        detail.raison = bilan.raison;
      }
    } else {
      detail.reussie = reponses[ligne.id] === true;
      if (reponses[ligne.id] === undefined) {
        detail.raison = "pas répondu";
      }
    }

    if (detail.compte) {
      resultat.total += detail.pointsMax;
      if (detail.reussie) {
        resultat.points += detail.pointsMax;
      }
    }
    resultat.details.push(detail);
  });

  if (resultat.total > 0) {
    resultat.score = Math.round((resultat.points / resultat.total) * 100);
  }
  return resultat;
}

/**
 * La médaille d'un score : "🥇", "🥈", "🥉" ou "" (aucune).
 */
function medaille(score) {
  if (score >= SEUIL_OR) {
    return "🥇";
  }
  if (score >= SEUIL_ARGENT) {
    return "🥈";
  }
  if (score >= SEUIL_BRONZE) {
    return "🥉";
  }
  return "";
}

/**
 * Le niveau de couleur d'un score : "vert", "jaune" ou "rouge".
 */
function niveauScore(score) {
  if (score >= SEUIL_VERT) {
    return "vert";
  }
  if (score >= SEUIL_JAUNE) {
    return "jaune";
  }
  return "rouge";
}

// ===================== LA SÉRIE =====================

/**
 * Recule ou avance une date de N jours : decalerDate("2026-11-22", -1) → "2026-11-21".
 */
function decalerDate(date, nombreDeJours) {
  const morceaux = date.split("-");
  // new Date(année, mois - 1, jour) : attention, les mois commencent à 0.
  const d = new Date(Number(morceaux[0]), Number(morceaux[1]) - 1, Number(morceaux[2]));
  d.setDate(d.getDate() + nombreDeJours);
  return dateEnTexte(d);
}

/**
 * Nombre de jours d'affilée à 80 ou plus, en finissant à "date".
 * Si "date" est aujourd'hui et pas encore à 80, la journée est "en cours" :
 * on compte la série à partir d'hier, pour ne pas la casser trop tôt.
 */
function serieEnCours(date) {
  let jourCourant = date;
  if (date === dateDuJour() && scoreDuJour(date).score < SEUIL_SERIE) {
    jourCourant = decalerDate(date, -1);
  }

  let serie = 0;
  // On recule jour par jour tant que le score est assez haut
  // (avec une limite de 10 ans pour ne jamais tourner en rond).
  while (serie < 3660 && scoreDuJour(jourCourant).score >= SEUIL_SERIE) {
    serie += 1;
    jourCourant = decalerDate(jourCourant, -1);
  }
  return serie;
}
