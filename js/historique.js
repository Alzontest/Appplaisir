/*
  js/historique.js — L'ONGLET "HISTORIQUE"

  Tu choisis une ÉCHELLE (Semaine / Mois / Année) et tu changes de période
  avec ◁ ▷. Tout s'adapte à l'échelle :
    - le calendrier : 7 cases (semaine), une grille (mois), 12 mois (année) ;
    - la courbe des calories : 1 point par jour, ou 1 point par mois (moyenne) ;
    - les statistiques : score moyen, médailles, meilleure série,
      réussite par ligne, moyennes de nutrition ;
    - le poids : nombre de pesées, poids moyen, écart sur la période,
      % de pesées dans l'objectif, et sa courbe (1 point par jour ou par mois).

  QUELS JOURS COMPTENT DANS LES MOYENNES ?
    - à partir du premier jour où tu as utilisé l'app ;
    - jusqu'à aujourd'hui (aujourd'hui seulement s'il est déjà rempli) ;
    - un jour oublié (non rempli) compte 0.
*/

// ===== Les éléments de la page =====
const titrePeriode = document.getElementById("titre-periode");
const boutonPeriodeSuivante = document.getElementById("periode-suivante");
const zoneResumeHistorique = document.getElementById("resume-historique");
const zoneCalendrier = document.getElementById("calendrier");
const zoneGraphiqueHistorique = document.getElementById("graphique-historique");
const infoGraphiqueHistorique = document.getElementById("info-graphique-historique");
const listeStatsLignes = document.getElementById("stats-lignes");
const zoneStatsNutrition = document.getElementById("stats-nutrition");
const zoneStatsPoids = document.getElementById("stats-poids");
const zoneGraphiquePoidsHistorique = document.getElementById("graphique-poids-historique");
const infoGraphiquePoidsHistorique = document.getElementById("info-graphique-poids-historique");

const NOMS_MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet",
  "août", "septembre", "octobre", "novembre", "décembre"];
const MOIS_COURTS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.",
  "août", "sept.", "oct.", "nov.", "déc."];
const INITIALES_MOIS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
// En France, la semaine commence le lundi.
const ENTETE_SEMAINE = ["L", "M", "M", "J", "V", "S", "D"];

// L'échelle choisie et une date "repère" qui dit quelle période afficher.
let echelleHistorique = "semaine";
let reperePeriode = dateDuJour();

// ===================== OUTILS DE DATES =====================

/**
 * Transforme "2026-11-22" en objet Date (à midi, pour éviter les surprises d'heure).
 */
function texteEnDate(texte) {
  const m = texte.split("-");
  return new Date(Number(m[0]), Number(m[1]) - 1, Number(m[2]), 12);
}

/**
 * Le lundi de la semaine qui contient cette date.
 */
function lundiDeLaSemaine(date) {
  const d = texteEnDate(date);
  // getDay() : 0 = dimanche … 6 = samedi. (getDay() + 6) % 7 : 0 = lundi … 6 = dimanche.
  return decalerDate(date, -((d.getDay() + 6) % 7));
}

/**
 * Le nombre de jours d'un mois : le "jour 0" du mois suivant est le dernier jour de ce mois.
 */
function joursDansLeMois(annee, mois) {
  return new Date(annee, mois + 1, 0).getDate();
}

/**
 * Toutes les dates de "debut" à "fin" (incluses), dans l'ordre.
 */
function datesEntre(debut, fin) {
  const dates = [];
  let date = debut;
  while (date <= fin) {
    dates.push(date);
    date = decalerDate(date, 1);
  }
  return dates;
}

/**
 * Le numéro du jour à la française : 1 → "1er", 16 → "16".
 */
function numeroJour(n) {
  return n === 1 ? "1er" : String(n);
}

/**
 * La période affichée : { debut, fin, titre }.
 */
function periodeAffichee() {
  const d = texteEnDate(reperePeriode);
  const annee = d.getFullYear();
  const mois = d.getMonth();

  if (echelleHistorique === "semaine") {
    const debut = lundiDeLaSemaine(reperePeriode);
    const fin = decalerDate(debut, 6);
    const dd = texteEnDate(debut);
    const df = texteEnDate(fin);
    // "du 16 au 22 novembre 2026", ou "du 30 novembre au 6 décembre 2026".
    const titre = dd.getMonth() === df.getMonth()
      ? "Semaine du " + numeroJour(dd.getDate()) + " au " + numeroJour(df.getDate()) + " " + NOMS_MOIS[df.getMonth()] + " " + df.getFullYear()
      : "Semaine du " + numeroJour(dd.getDate()) + " " + NOMS_MOIS[dd.getMonth()] + " au " + numeroJour(df.getDate()) + " " + NOMS_MOIS[df.getMonth()] + " " + df.getFullYear();
    return { debut: debut, fin: fin, titre: titre };
  }

  if (echelleHistorique === "mois") {
    const debut = dateEnTexte(new Date(annee, mois, 1));
    const fin = dateEnTexte(new Date(annee, mois, joursDansLeMois(annee, mois)));
    // Majuscule au début : "Novembre 2026".
    const nom = NOMS_MOIS[mois].charAt(0).toUpperCase() + NOMS_MOIS[mois].slice(1);
    return { debut: debut, fin: fin, titre: nom + " " + annee };
  }

  return { debut: annee + "-01-01", fin: annee + "-12-31", titre: String(annee) };
}

/**
 * Passe à la période précédente (-1) ou suivante (+1).
 */
function changerPeriode(sens) {
  const d = texteEnDate(reperePeriode);
  if (echelleHistorique === "semaine") {
    reperePeriode = decalerDate(reperePeriode, 7 * sens);
  } else if (echelleHistorique === "mois") {
    reperePeriode = dateEnTexte(new Date(d.getFullYear(), d.getMonth() + sens, 1));
  } else {
    reperePeriode = dateEnTexte(new Date(d.getFullYear() + sens, 0, 1));
  }
  afficherHistorique();
}

// ===================== QUELS JOURS COMPTENT ? =====================

/**
 * Le premier jour où l'app a été utilisée (ou null si elle est vide).
 */
function premierJourUtilise() {
  let premier = null;
  Object.keys(classeur.jours).forEach(function (date) {
    if (jourEstRempli(classeur.jours[date]) && (premier === null || date < premier)) {
      premier = date;
    }
  });
  return premier;
}

/**
 * Vrai si ce jour compte dans les moyennes (voir les règles en haut du fichier).
 */
function jourCompte(date, premier, aujourdhui) {
  if (premier === null || date < premier || date > aujourdhui) {
    return false;
  }
  if (date === aujourdhui) {
    return jourEstRempli(classeur.jours[date]);
  }
  return true;
}

// ===================== AFFICHER TOUT L'ONGLET =====================

function afficherHistorique() {
  const periode = periodeAffichee();
  const aujourdhui = dateDuJour();
  const premier = premierJourUtilise();

  titrePeriode.textContent = periode.titre;
  // Pas de période "suivante" si on est déjà sur celle d'aujourd'hui.
  boutonPeriodeSuivante.disabled = periode.fin >= aujourdhui;

  // Les boutons d'échelle : celui qui est choisi est mis en avant.
  document.querySelectorAll(".bouton-echelle").forEach(function (bouton) {
    bouton.classList.toggle("actif", bouton.dataset.echelle === echelleHistorique);
  });

  // On calcule UNE fois le score de chaque jour compté (et on le garde ici).
  const toutesLesDates = datesEntre(periode.debut, periode.fin);
  const scores = {};
  const datesComptees = toutesLesDates.filter(function (date) {
    return jourCompte(date, premier, aujourdhui);
  });
  datesComptees.forEach(function (date) {
    scores[date] = scoreDuJour(date);
  });

  afficherResume(datesComptees, scores);
  afficherCalendrier(periode, toutesLesDates, scores, premier, aujourdhui);
  afficherCourbeHistorique(periode, toutesLesDates, aujourdhui);
  afficherStatsLignes(datesComptees, scores);
  afficherStatsNutrition(datesComptees);
  afficherStatsPoids(periode, toutesLesDates, aujourdhui);
}

// ===================== LE RÉSUMÉ =====================

function afficherResume(datesComptees, scores) {
  zoneResumeHistorique.innerHTML = "";

  if (datesComptees.length === 0) {
    const vide = document.createElement("p");
    vide.className = "texte-doux";
    vide.textContent = "Aucune donnée sur cette période.";
    zoneResumeHistorique.appendChild(vide);
    return;
  }

  // Score moyen (les jours non remplis comptent 0).
  let somme = 0;
  let remplis = 0;
  const nombreMedailles = { "🥇": 0, "🥈": 0, "🥉": 0 };
  let meilleureSerie = 0;
  let serie = 0;

  datesComptees.forEach(function (date) {
    const r = scores[date];
    somme += r.score;
    if (r.rempli) {
      remplis += 1;
    }
    const m = medaille(r.score);
    if (m) {
      nombreMedailles[m] += 1;
    }
    // Meilleure série : on compte les jours d'affilée à 80 ou plus.
    serie = r.score >= SEUIL_SERIE ? serie + 1 : 0;
    meilleureSerie = Math.max(meilleureSerie, serie);
  });
  const moyenne = Math.round(somme / datesComptees.length);

  // La carte du score moyen (mêmes couleurs que dans le Bilan).
  const carte = document.createElement("div");
  carte.className = "carte-score niveau-" + niveauScore(moyenne);
  carte.innerHTML =
    '<div class="score-ligne"><span class="score-valeur"></span>' +
    '<span class="score-sur">/ 100</span><span class="score-medaille"></span></div>' +
    '<p class="score-texte"></p>';
  carte.querySelector(".score-valeur").textContent = moyenne;
  carte.querySelector(".score-medaille").textContent = medaille(moyenne);
  carte.querySelector(".score-texte").textContent =
    "score moyen sur " + datesComptees.length + " jour(s) · " + remplis + " rempli(s)";
  zoneResumeHistorique.appendChild(carte);

  const details = document.createElement("p");
  details.className = "resume-details";
  details.textContent =
    "🥇 " + nombreMedailles["🥇"] + " · 🥈 " + nombreMedailles["🥈"] + " · 🥉 " + nombreMedailles["🥉"] +
    " · 🔥 meilleure série : " + meilleureSerie + " jour(s)";
  zoneResumeHistorique.appendChild(details);
}

// ===================== LE CALENDRIER =====================

function afficherCalendrier(periode, toutesLesDates, scores, premier, aujourdhui) {
  zoneCalendrier.innerHTML = "";

  if (echelleHistorique === "annee") {
    afficherCalendrierAnnee(periode, scores);
    return;
  }

  zoneCalendrier.className = "calendrier calendrier-jours";

  // La ligne d'en-tête : L M M J V S D.
  ENTETE_SEMAINE.forEach(function (lettre) {
    const entete = document.createElement("span");
    entete.className = "cal-entete";
    entete.textContent = lettre;
    zoneCalendrier.appendChild(entete);
  });

  // En vue mois, des cases vides avant le 1er pour tomber sur le bon jour.
  const decalage = (texteEnDate(periode.debut).getDay() + 6) % 7;
  for (let i = 0; i < decalage; i++) {
    zoneCalendrier.appendChild(document.createElement("span"));
  }

  toutesLesDates.forEach(function (date) {
    const caseJour = document.createElement("button");
    caseJour.type = "button";
    caseJour.className = "cal-jour";

    const numero = document.createElement("span");
    numero.className = "cal-numero";
    numero.textContent = texteEnDate(date).getDate();
    caseJour.appendChild(numero);

    const valeur = document.createElement("span");
    valeur.className = "cal-score";

    if (scores[date]) {
      // Jour compté : couleur selon le score, ou gris "non rempli" (0).
      const r = scores[date];
      caseJour.classList.add(r.rempli ? "niveau-" + niveauScore(r.score) : "cal-non-rempli");
      valeur.textContent = r.score;
    } else if (date === aujourdhui) {
      caseJour.classList.add("cal-en-cours"); // aujourd'hui, pas encore rempli
      valeur.textContent = "…";
    } else {
      caseJour.classList.add("cal-hors"); // avant le premier jour, ou dans le futur
    }
    if (date === aujourdhui) {
      caseJour.classList.add("cal-aujourdhui");
    }
    caseJour.appendChild(valeur);

    // Toucher un jour (jusqu'à aujourd'hui) ouvre son Bilan.
    if (date <= aujourdhui) {
      caseJour.setAttribute("aria-label", "Bilan du " + dateLisible(date));
      caseJour.addEventListener("click", function () {
        choisirDateALaMain(date);       // js/journee.js
        afficherOnglet("onglet-bilan"); // js/app.js
      });
    } else {
      caseJour.disabled = true;
    }

    zoneCalendrier.appendChild(caseJour);
  });
}

/**
 * Vue année : 12 cases, une par mois, colorées selon le score moyen du mois.
 * Toucher un mois ouvre la vue Mois correspondante.
 */
function afficherCalendrierAnnee(periode, scores) {
  zoneCalendrier.className = "calendrier calendrier-annee";
  const annee = Number(periode.debut.slice(0, 4));

  for (let mois = 0; mois < 12; mois++) {
    const prefixe = annee + "-" + String(mois + 1).padStart(2, "0");
    // Les jours comptés de ce mois : ceux dont la date commence par "2026-11".
    const datesDuMois = Object.keys(scores).filter(function (date) {
      return date.startsWith(prefixe);
    });

    const caseMois = document.createElement("button");
    caseMois.type = "button";
    caseMois.className = "cal-mois";

    const nom = document.createElement("span");
    nom.className = "cal-numero";
    nom.textContent = MOIS_COURTS[mois];
    caseMois.appendChild(nom);

    const valeur = document.createElement("span");
    valeur.className = "cal-score";
    if (datesDuMois.length > 0) {
      let somme = 0;
      datesDuMois.forEach(function (date) {
        somme += scores[date].score;
      });
      const moyenne = Math.round(somme / datesDuMois.length);
      caseMois.classList.add("niveau-" + niveauScore(moyenne));
      valeur.textContent = moyenne;
    } else {
      caseMois.classList.add("cal-hors");
    }
    caseMois.appendChild(valeur);

    caseMois.addEventListener("click", function () {
      echelleHistorique = "mois";
      reperePeriode = prefixe + "-01";
      afficherHistorique();
    });
    zoneCalendrier.appendChild(caseMois);
  }
}

// ===================== LA COURBE DES CALORIES =====================

/**
 * Les kcal d'un jour (null s'il n'y a aucun plat).
 */
function kcalDuJour(date) {
  const jour = classeur.jours[date];
  if (!jour || !jour.repas || jour.repas.length === 0) {
    return null;
  }
  return arrondir(totauxDuJour(date).kcal);
}

function afficherCourbeHistorique(periode, toutesLesDates, aujourdhui) {
  const points = [];
  let indexFort = -1;

  if (echelleHistorique === "annee") {
    // 1 point par mois : la moyenne des jours avec des plats.
    const annee = Number(periode.debut.slice(0, 4));
    for (let mois = 0; mois < 12; mois++) {
      const prefixe = annee + "-" + String(mois + 1).padStart(2, "0");
      let sommeKcal = 0;
      let nbJours = 0;
      let sommeMin = 0;
      let sommeMax = 0;
      let nbObjectifs = 0;
      toutesLesDates.forEach(function (date) {
        if (!date.startsWith(prefixe) || date > aujourdhui) {
          return;
        }
        const kcal = kcalDuJour(date);
        if (kcal === null) {
          return;
        }
        sommeKcal += kcal;
        nbJours += 1;
        const objectif = objectifDuJour(date);
        if (objectif) {
          const f = fourchetteKcal(objectif);
          sommeMin += f.min;
          sommeMax += f.max;
          nbObjectifs += 1;
        }
      });
      if (prefixe === aujourdhui.slice(0, 7)) {
        indexFort = mois;
      }
      const nomMois = NOMS_MOIS[mois].charAt(0).toUpperCase() + NOMS_MOIS[mois].slice(1);
      points.push({
        etiquette: INITIALES_MOIS[mois],
        kcal: nbJours > 0 ? Math.round(sommeKcal / nbJours) : null,
        fourchette: nbObjectifs > 0
          ? { min: Math.round(sommeMin / nbObjectifs), max: Math.round(sommeMax / nbObjectifs) }
          : null,
        titre: nomMois + " " + annee + " (moyenne de " + nbJours + " jour(s) avec repas)"
      });
    }
  } else {
    // 1 point par jour.
    toutesLesDates.forEach(function (date, i) {
      const d = texteEnDate(date);
      const objectif = objectifDuJour(date);
      let etiquette;
      if (echelleHistorique === "semaine") {
        etiquette = ENTETE_SEMAINE[i] + " " + d.getDate();
      } else {
        // En vue mois, une étiquette tous les 5 jours (sinon c'est illisible).
        etiquette = d.getDate() === 1 || d.getDate() % 5 === 0 ? String(d.getDate()) : "";
      }
      if (date === aujourdhui) {
        indexFort = i;
      }
      points.push({
        etiquette: etiquette,
        kcal: date <= aujourdhui ? kcalDuJour(date) : null,
        fourchette: objectif && date <= aujourdhui ? fourchetteKcal(objectif) : null,
        titre: NOMS_JOURS[d.getDay()] + " " + dateLisible(date)
      });
    });
  }

  dessinerCourbeCalories(zoneGraphiqueHistorique, infoGraphiqueHistorique, points, { indexFort: indexFort });
}

// ===================== LA RÉUSSITE PAR LIGNE =====================

function afficherStatsLignes(datesComptees, scores) {
  listeStatsLignes.innerHTML = "";

  // On regroupe par ligne (par son id) : combien de fois réussie / comptée.
  const parLigne = {};
  const ordre = [];
  datesComptees.forEach(function (date) {
    scores[date].details.forEach(function (detail) {
      if (!detail.compte) {
        return;
      }
      if (!parLigne[detail.id]) {
        parLigne[detail.id] = { nom: detail.nom, reussies: 0, comptees: 0 };
        ordre.push(detail.id);
      }
      parLigne[detail.id].nom = detail.nom; // on garde le nom le plus récent
      parLigne[detail.id].comptees += 1;
      if (detail.reussie) {
        parLigne[detail.id].reussies += 1;
      }
    });
  });

  if (ordre.length === 0) {
    const vide = document.createElement("li");
    vide.className = "texte-doux";
    vide.textContent = "Aucune donnée sur cette période.";
    listeStatsLignes.appendChild(vide);
    return;
  }

  ordre.forEach(function (id) {
    const stat = parLigne[id];
    const pourcentage = Math.round((stat.reussies / stat.comptees) * 100);

    const element = document.createElement("li");
    element.className = "stat-ligne";

    const haut = document.createElement("div");
    haut.className = "stat-haut";
    const nom = document.createElement("span");
    nom.className = "stat-nom";
    nom.textContent = stat.nom;
    haut.appendChild(nom);
    const chiffres = document.createElement("span");
    chiffres.className = "stat-chiffres";
    chiffres.textContent = stat.reussies + "/" + stat.comptees + " jours · " + pourcentage + " %";
    haut.appendChild(chiffres);
    element.appendChild(haut);

    // Une barre fine : sa longueur = le pourcentage de réussite.
    const barre = document.createElement("div");
    barre.className = "stat-barre";
    const remplissage = document.createElement("div");
    remplissage.className = "stat-barre-remplie";
    remplissage.style.width = pourcentage + "%";
    barre.appendChild(remplissage);
    element.appendChild(barre);

    listeStatsLignes.appendChild(element);
  });
}

// ===================== LA NUTRITION =====================

function afficherStatsNutrition(datesComptees) {
  let sommeKcal = 0;
  let sommeProt = 0;
  let nbJours = 0;
  datesComptees.forEach(function (date) {
    const jour = classeur.jours[date];
    if (jour && jour.repas && jour.repas.length > 0) {
      const totaux = totauxDuJour(date);
      sommeKcal += totaux.kcal;
      sommeProt += totaux.prot;
      nbJours += 1;
    }
  });

  if (nbJours === 0) {
    zoneStatsNutrition.textContent = "Aucun plat noté sur cette période.";
    return;
  }
  zoneStatsNutrition.textContent =
    "Moyenne par jour : " + nombreEnTexte(Math.round(sommeKcal / nbJours)) + " kcal · " +
    nombreEnTexte(arrondir(sommeProt / nbJours)) + " g de protéines " +
    "(sur " + nbJours + " jour(s) avec des plats notés)";
}

// ===================== LE POIDS =====================

function afficherStatsPoids(periode, toutesLesDates, aujourdhui) {
  zoneStatsPoids.innerHTML = "";
  const premier = premierJourUtilise();

  // Les pesées de la période (jusqu'à aujourd'hui), dans l'ordre.
  const pesees = toutesLesDates
    .filter(function (date) {
      return date <= aujourdhui && poidsDuJour(date) !== null;
    })
    .map(function (date) {
      return { date: date, poids: poidsDuJour(date) };
    });

  // Les jours réussis : parmi les jours comptés qui ont un objectif de poids
  // (un jour sans pesée compte comme raté, comme dans le score).
  let joursAvecObjectif = 0;
  let joursReussis = 0;
  toutesLesDates.forEach(function (date) {
    if (!jourCompte(date, premier, aujourdhui) || objectifPoidsDuJour(date) === null) {
      return;
    }
    joursAvecObjectif += 1;
    if (bilanPoids(date).dansObjectif === true) {
      joursReussis += 1;
    }
  });

  if (pesees.length === 0) {
    const vide = document.createElement("p");
    vide.className = "texte-doux";
    vide.textContent = "Aucune pesée sur cette période.";
    zoneStatsPoids.appendChild(vide);
  } else {
    let somme = 0;
    pesees.forEach(function (pesee) {
      somme += pesee.poids;
    });
    const premiere = pesees[0];
    const derniere = pesees[pesees.length - 1];

    zoneStatsPoids.appendChild(creerLigneEcart("Pesées", pesees.length + " pesée(s)"));
    zoneStatsPoids.appendChild(creerLigneEcart("Poids moyen", kgEnTexte(somme / pesees.length) + " kg"));
    zoneStatsPoids.appendChild(creerLigneEcart(
      "Écart sur la période",
      pesees.length > 1
        ? ecartEnTexte(derniere.poids - premiere.poids) + " (du " + dateLisible(premiere.date) + " au " + dateLisible(derniere.date) + ")"
        : "une seule pesée"
    ));

    // Où en est-on à la fin de la période (dernière pesée) ?
    const bilanFin = bilanPoids(derniere.date);
    if (bilanFin.objectif !== null && bilanFin.dansObjectif !== null) {
      const etiquette = etiquetteVerdictPoids(bilanFin);
      zoneStatsPoids.appendChild(creerLigneEcart(
        "En fin de période (" + dateLisible(derniere.date) + ")",
        etiquette.texte + (bilanFin.phase === "trajectoire" ? " · prévu " + kgEnTexte(bilanFin.prevu) + " kg" : "")
      ));
      // Date d'arrivée : celle de la trajectoire, et une estimation au rythme
      // prévu à partir du poids jugé (plus tôt si tu es en avance).
      if (bilanFin.phase === "trajectoire") {
        const moisRestants = Math.abs(bilanFin.juge - bilanFin.objectif.cible) / bilanFin.objectif.rythme;
        const estimee = decalerDate(derniere.date, Math.floor(moisRestants * JOURS_PAR_MOIS));
        zoneStatsPoids.appendChild(creerLigneEcart(
          "Arrivée à " + kgEnTexte(bilanFin.objectif.cible) + " kg",
          "estimée vers le " + dateEnLettres(estimee) + " (prévue le " + dateEnLettres(bilanFin.dateArrivee) + ")"
        ));
      }
    }
  }

  zoneStatsPoids.appendChild(creerLigneEcart(
    "Jours réussis",
    joursAvecObjectif > 0
      ? joursReussis + "/" + joursAvecObjectif + " jour(s) · " + Math.round((joursReussis / joursAvecObjectif) * 100) + " %"
      : "aucun objectif de poids sur cette période"
  ));

  afficherCourbePoidsHistorique(periode, toutesLesDates, aujourdhui);
}

/**
 * La courbe du poids, avec la même logique d'échelle que les calories :
 * 1 point par jour (semaine, mois) ou 1 point par mois (année : moyenne),
 * la zone de réussite et la trajectoire prévue en pointillés.
 * Les pointillés continuent aussi sur les jours (ou mois) À VENIR de la période,
 * pour voir où tu dois aller ; une fois la cible atteinte, ils restent à plat sur la cible.
 */
function afficherCourbePoidsHistorique(periode, toutesLesDates, aujourdhui) {
  const points = [];
  let indexFort = -1;

  if (echelleHistorique === "annee") {
    const annee = Number(periode.debut.slice(0, 4));
    for (let mois = 0; mois < 12; mois++) {
      const prefixe = annee + "-" + String(mois + 1).padStart(2, "0");
      let somme = 0;
      let nombre = 0;
      let dernierJour = null; // le dernier jour du mois jusqu'à aujourd'hui
      let finDuMois = null;   // le dernier jour du mois (même dans le futur)
      toutesLesDates.forEach(function (date) {
        if (!date.startsWith(prefixe)) {
          return;
        }
        finDuMois = date;
        if (date > aujourdhui) {
          return;
        }
        dernierJour = date;
        const poids = poidsDuJour(date);
        if (poids !== null) {
          somme += poids;
          nombre += 1;
        }
      });
      if (prefixe === aujourdhui.slice(0, 7)) {
        indexFort = mois;
      }
      // La zone et le prévu du mois : ceux de son dernier jour (jusqu'à aujourd'hui).
      const reussite = dernierJour ? zoneReussitePoids(dernierJour) : null;
      // Mois à venir : pas de zone, mais le prévu de sa fin de mois (pointillés).
      const futur = dernierJour === null && finDuMois !== null ? zoneReussitePoids(finDuMois) : null;
      const nomMois = NOMS_MOIS[mois].charAt(0).toUpperCase() + NOMS_MOIS[mois].slice(1);
      points.push({
        etiquette: INITIALES_MOIS[mois],
        valeur: nombre > 0 ? arrondiPoids(somme / nombre) : null,
        fourchette: reussite ? reussite.zone : null,
        prevu: reussite ? reussite.prevu : futur ? futur.prevu : null,
        titre: nomMois + " " + annee + " (moyenne de " + nombre + " pesée(s))"
      });
    }
  } else {
    toutesLesDates.forEach(function (date, i) {
      const d = texteEnDate(date);
      let etiquette;
      if (echelleHistorique === "semaine") {
        etiquette = ENTETE_SEMAINE[i] + " " + d.getDate();
      } else {
        etiquette = d.getDate() === 1 || d.getDate() % 5 === 0 ? String(d.getDate()) : "";
      }
      if (date === aujourdhui) {
        indexFort = i;
      }
      if (date <= aujourdhui) {
        points.push(pointPoids(date, etiquette)); // js/poids.js
      } else {
        // Jour à venir : pas de pesée ni de zone, mais la trajectoire prévue continue
        // (elle reste à plat sur la cible une fois atteinte : voir zoneReussitePoids).
        const futur = zoneReussitePoids(date);
        points.push({
          etiquette: etiquette, valeur: null, fourchette: null,
          prevu: futur ? futur.prevu : null,
          titre: NOMS_JOURS[d.getDay()] + " " + dateLisible(date)
        });
      }
    });
  }

  // Même style que la courbe de l'onglet Poids (js/poids.js) :
  // zone continue, repères en kilos ronds, petits points.
  dessinerCourbe(zoneGraphiquePoidsHistorique, infoGraphiquePoidsHistorique, points, optionsCourbePoidsAffinee(indexFort));
}

// ===================== DÉMARRAGE =====================

/**
 * Prépare l'onglet. Appelée par js/app.js.
 */
function initialiserHistorique() {
  document.querySelectorAll(".bouton-echelle").forEach(function (bouton) {
    bouton.addEventListener("click", function () {
      // Si la période affichée contient aujourd'hui, on garde aujourd'hui comme repère :
      // ainsi "Semaine" montre la semaine EN COURS, pas la première du mois.
      const periode = periodeAffichee();
      const aujourdhui = dateDuJour();
      if (periode.debut <= aujourdhui && aujourdhui <= periode.fin) {
        reperePeriode = aujourdhui;
      }
      echelleHistorique = bouton.dataset.echelle;
      afficherHistorique();
    });
  });
  document.getElementById("periode-precedente").addEventListener("click", function () {
    changerPeriode(-1);
  });
  boutonPeriodeSuivante.addEventListener("click", function () {
    changerPeriode(+1);
  });
  afficherHistorique();
}
