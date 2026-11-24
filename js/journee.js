/*
  js/journee.js — L'ONGLET "MA JOURNÉE"

  Il affiche une ligne par élément visible de classeur.lignes.
  Chaque ligne normale a 2 boutons ronds :
    ✓ (vert)  = fait
    ✗ (rouge) = pas fait
  Toucher un bouton le sélectionne. Toucher à nouveau le bouton déjà
  sélectionné annule la réponse (la ligne redevient "pas encore répondu").
  Chaque changement est enregistré tout de suite.

  Toucher le NOM d'une ligne ouvre la fenêtre de modification (js/lignes.js).

  Pour un jour PASSÉ, on affiche les lignes et points de ce jour-là
  (la "photo" de js/score.js) : changer une ligne aujourd'hui ne modifie
  pas les jours d'avant.
*/

// Les éléments de la page dont on a besoin.
const champDate = document.getElementById("date-journee");
const listeLignes = document.getElementById("liste-lignes");

// Le jour actuellement affiché (aujourd'hui au départ).
let dateAffichee = dateDuJour();

// Vrai si tu as choisi une date à la main (pour remplir un jour oublié).
// Dans ce cas, l'app ne revient PAS toute seule à aujourd'hui.
let dateChoisieALaMain = false;

/**
 * Prépare l'onglet : met la date du jour dans le champ
 * et réagit quand on choisit une autre date.
 */
function initialiserJournee() {
  champDate.value = dateAffichee;

  // "change" se déclenche quand on choisit une nouvelle date.
  champDate.addEventListener("change", function () {
    choisirDateALaMain(champDate.value);
  });

  // "visibilitychange" se déclenche quand l'app est mise en arrière-plan
  // ou qu'elle revient à l'écran. Au retour, si on a passé minuit,
  // on revient au nouveau jour (sauf date choisie à la main).
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      revenirAAujourdhuiSiBesoin();
    }
  });

  afficherJournee();
}

/**
 * Si la date affichée n'est plus celle du jour (on a passé minuit)
 * et que tu ne l'as pas choisie à la main, on affiche aujourd'hui.
 */
function revenirAAujourdhuiSiBesoin() {
  const aujourdhui = dateDuJour();
  if (!dateChoisieALaMain && dateAffichee !== aujourdhui) {
    appliquerDate(aujourdhui);
  }
}

/**
 * Appelée quand tu choisis une date dans "Ma journée" OU dans "Nutrition".
 * @param {string} valeur - la date choisie ("" si le champ a été effacé)
 */
function choisirDateALaMain(valeur) {
  // Si on efface la date, on revient à aujourd'hui.
  const date = valeur || dateDuJour();
  // Choisir la date d'aujourd'hui revient à "ne rien choisir de spécial".
  dateChoisieALaMain = date !== dateDuJour();
  appliquerDate(date);
}

/**
 * Change le jour affiché PARTOUT : les deux onglets montrent toujours
 * le même jour, pour ne jamais noter un repas sur le mauvais jour.
 */
function appliquerDate(date) {
  dateAffichee = date;
  champDate.value = date;
  afficherJournee();
  afficherNutrition(); // fonction de js/nutrition.js (elle met aussi sa date à jour)
  afficherPoids();     // fonction de js/poids.js
  afficherBilan();     // fonction de js/bilan.js
}

/**
 * (Re)construit toute la liste des lignes pour le jour affiché.
 */
function afficherJournee() {
  // On vide la liste, puis on la reconstruit ligne par ligne.
  listeLignes.innerHTML = "";

  const jour = classeur.jours[dateAffichee];
  // Les réponses de ce jour (ou un objet vide si le jour n'a encore rien).
  const reponses = jour ? jour.reponses : {};

  // La note "Jour passé" n'apparaît que pour un jour passé qui a sa photo.
  const jourPasseFige = Boolean(jour && jour.lignes && dateAffichee < dateDuJour());
  document.getElementById("note-jour-passe").classList.toggle("cache", !jourPasseFige);

  // Les lignes de ce jour-là (photo pour un jour passé, lignes actuelles sinon).
  lignesDuJour(dateAffichee).forEach(function (ligne) { // js/score.js
    // <li> = un élément de liste : une ligne de l'écran.
    const element = document.createElement("li");
    element.className = "ligne";

    // À gauche : le nom + le coefficient, dans un bouton
    // pour pouvoir le toucher et ouvrir la fenêtre de modification.
    const zoneNom = document.createElement("button");
    zoneNom.type = "button";
    zoneNom.className = "ligne-nom";
    // On ouvre toujours la ligne ACTUELLE qui porte cet id (pas la photo).
    // find() renvoie le premier élément qui vérifie la condition.
    const ligneActuelle = classeur.lignes.find(function (l) {
      return l.id === ligne.id && !l.supprimee;
    });
    if (ligneActuelle) {
      zoneNom.addEventListener("click", function () {
        ouvrirFenetreLigne(ligneActuelle); // fonction de js/lignes.js
      });
    } else {
      // Ligne supprimée depuis : on la voit encore sur ce jour passé,
      // mais on ne peut plus la modifier.
      zoneNom.disabled = true;
    }

    const nom = document.createElement("span");
    nom.textContent = ligne.nom;
    zoneNom.appendChild(nom);

    const coef = document.createElement("span");
    coef.className = "ligne-coef";
    coef.textContent = texteImportance(ligne); // "niveau 3 · 6 pts" (js/score.js)
    zoneNom.appendChild(coef);

    element.appendChild(zoneNom);

    if (ligne.speciale === "diete") {
      // La ligne Diète se remplit toute seule grâce à Nutrition.
      // On ajoute sous le nom les calories et protéines du jour…
      const bilan = bilanDiete(dateAffichee); // fonction de js/objectifs.js
      coef.textContent +=
        " · " + nombreEnTexte(arrondir(bilan.totaux.kcal)) + " kcal" +
        " · " + nombreEnTexte(arrondir(bilan.totaux.prot)) + " g prot";
      // …et à droite, le verdict (un rond qu'on ne peut pas toucher).
      element.appendChild(creerVerdictDiete(bilan));
    } else if (ligne.speciale === "pesee" || ligne.speciale === "poids") {
      // Les lignes Pesée et Poids se remplissent toutes seules grâce à l'onglet Poids.
      const bilan = bilanPoids(dateAffichee); // js/poids.js
      if (bilan.poids !== null) {
        coef.textContent += " · " + kgEnTexte(bilan.poids) + " kg";
        // Sur la ligne Poids : la moyenne 7 j si elle sert au jugement.
        if (ligne.speciale === "poids" && bilan.baseJugement === "moyenne 7 j") {
          coef.textContent += " · moy. " + kgEnTexte(bilan.juge);
        }
      }
      element.appendChild(creerVerdictPoids(ligne.speciale, bilan));
    } else {
      // Les 2 boutons ronds, à droite.
      const boutons = document.createElement("div");
      boutons.className = "ligne-boutons";
      boutons.appendChild(creerBoutonReponse(ligne.id, true, reponses[ligne.id]));
      boutons.appendChild(creerBoutonReponse(ligne.id, false, reponses[ligne.id]));
      element.appendChild(boutons);
    }

    listeLignes.appendChild(element);
  });
}

/**
 * Fabrique l'affichage automatique de la ligne Diète :
 *   rond vert ✓ = tenue, rond rouge ✗ = pas tenue,
 *   texte gris si on ne peut pas juger (pas d'objectif ou aucun plat).
 * @param {object} bilan - le résultat de bilanDiete() (js/objectifs.js)
 */
function creerVerdictDiete(bilan) {
  if (bilan.tenue === null) {
    const info = document.createElement("span");
    info.className = "ligne-auto";
    info.textContent = bilan.objectif === null ? "Pas d'objectif" : "Aucun plat";
    return info;
  }

  // Même apparence que les boutons ✓ / ✗ choisis, mais ce n'est pas un bouton :
  // c'est un simple <span>, on ne peut pas le toucher.
  const rond = document.createElement("span");
  rond.className = "bouton-reponse selectionne verdict-rond " + (bilan.tenue ? "fait" : "pas-fait");
  rond.textContent = bilan.tenue ? "✓" : "✗";
  rond.setAttribute("aria-label", bilan.tenue ? "Diète tenue" : "Diète pas tenue");
  return rond;
}

/**
 * Un rond ✓ vert / ✗ rouge qu'on ne peut pas toucher (lignes automatiques).
 */
function creerRondAuto(reussi, description) {
  const rond = document.createElement("span");
  rond.className = "bouton-reponse selectionne verdict-rond " + (reussi ? "fait" : "pas-fait");
  rond.textContent = reussi ? "✓" : "✗";
  rond.setAttribute("aria-label", description);
  return rond;
}

/**
 * Un petit texte gris à droite d'une ligne automatique ("Pas de pesée"…).
 */
function creerTexteAuto(texte) {
  const info = document.createElement("span");
  info.className = "ligne-auto";
  info.textContent = texte;
  return info;
}

/**
 * L'affichage automatique des lignes "Pesée" et "Poids dans l'objectif".
 *   Pesée : ✓ si un poids est noté, sinon "Pas de pesée" (compte ✗ dans le score).
 *   Poids : "Pas d'objectif" (non comptée), "Pas de pesée" (✗),
 *           sinon ✓ réussi / ✗ raté (trajectoire ou maintien : voir js/poids.js).
 * @param {string} speciale - "pesee" ou "poids"
 * @param {object} bilan - le résultat de bilanPoids() (js/poids.js)
 */
function creerVerdictPoids(speciale, bilan) {
  if (speciale === "pesee") {
    return bilan.poids === null
      ? creerTexteAuto("Pas de pesée")
      : creerRondAuto(true, "Pesée faite");
  }
  if (bilan.objectif === null) {
    return creerTexteAuto("Pas d'objectif");
  }
  if (bilan.poids === null) {
    return creerTexteAuto("Pas de pesée");
  }
  return creerRondAuto(bilan.dansObjectif, bilan.dansObjectif ? "Poids dans l'objectif" : "Poids hors objectif");
}

/**
 * Fabrique un bouton rond ✓ ou ✗.
 * @param {string} idLigne - l'id de la ligne (ex. "sport")
 * @param {boolean} valeur - true pour ✓ (fait), false pour ✗ (pas fait)
 * @param {boolean|undefined} reponseActuelle - ce qui est déjà enregistré
 */
function creerBoutonReponse(idLigne, valeur, reponseActuelle) {
  const bouton = document.createElement("button");
  bouton.type = "button";
  bouton.className = "bouton-reponse " + (valeur ? "fait" : "pas-fait");
  bouton.textContent = valeur ? "✓" : "✗";
  // Texte lu par les lecteurs d'écran (accessibilité).
  bouton.setAttribute("aria-label", valeur ? "Fait" : "Pas fait");

  // Si c'est la réponse enregistrée, le bouton est "sélectionné" (rempli).
  if (reponseActuelle === valeur) {
    bouton.classList.add("selectionne");
  }

  bouton.addEventListener("click", function () {
    const jour = donneesDuJour(dateAffichee);

    if (jour.reponses[idLigne] === valeur) {
      // On retouche le bouton déjà choisi : on annule la réponse.
      delete jour.reponses[idLigne];
    } else {
      jour.reponses[idLigne] = valeur;
    }

    enregistrerClasseur();
    afficherJournee(); // on redessine pour mettre à jour les couleurs
  });

  return bouton;
}
