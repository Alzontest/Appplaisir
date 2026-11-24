/*
  js/nutrition.js — L'ONGLET "NUTRITION"

  - En haut : une ligne vide pour saisir un plat (nom, kcal, protéines,
    glucides, lipides) et le bouton ( + ) pour l'ajouter.
  - Au milieu : la liste des plats du jour. Chaque plat a une quantité
    (× 1 par défaut, ex. × 1,5 pour 150 g d'un plat noté pour 100 g).
    Chaque case reste modifiable :
    la modification est enregistrée dès que tu quittes la case.
    Le bouton 🗑 supprime un plat (après confirmation).
  - En bas : les totaux du jour.

  Une case vide = "X" = valeur inconnue. Elle est enregistrée comme null
  et n'est pas comptée dans les totaux (une petite note le signale).
*/

// ===== Les éléments de la page =====
const champDateNutrition = document.getElementById("date-nutrition");
const saisieNom = document.getElementById("saisie-nom");
const erreurSaisie = document.getElementById("erreur-saisie");
const listePlats = document.getElementById("liste-plats");
const texteAucunPlat = document.getElementById("aucun-plat");
const noteInconnues = document.getElementById("note-inconnues");

// Les 4 valeurs d'un plat, dans l'ordre d'affichage.
// Chaque "champ" a : sa clé dans les données, son nom lisible, et son unité.
const CHAMPS_NUTRITION = [
  { cle: "kcal", nom: "kcal", unite: "kcal" },
  { cle: "prot", nom: "Prot", unite: "g" },
  { cle: "gluc", nom: "Gluc", unite: "g" },
  { cle: "lip", nom: "Lip", unite: "g" }
];

/**
 * Lit un nombre tapé dans une case.
 * Renvoie un objet { valide, valeur } :
 *   ""  ou "x"     → valide, valeur null (inconnue)
 *   "12" ou "12,5" → valide, valeur 12 ou 12.5
 *   "abc" ou "-3"  → pas valide
 */
function lireNombre(texte) {
  const propre = texte.trim().replace(",", "."); // accepte la virgule française
  if (propre === "" || propre.toLowerCase() === "x") {
    return { valide: true, valeur: null };
  }
  const nombre = Number(propre);
  // isNaN = "is Not a Number" : vrai si le texte n'est pas un nombre.
  if (isNaN(nombre) || nombre < 0) {
    return { valide: false, valeur: null };
  }
  return { valide: true, valeur: nombre };
}

/**
 * Transforme une valeur enregistrée en texte pour une case :
 * null → "" (la case affiche alors son "X" gris), 12.5 → "12,5".
 */
function nombreEnTexte(valeur) {
  if (valeur === null || valeur === undefined) {
    return "";
  }
  return String(valeur).replace(".", ",");
}

/**
 * Arrondit pour l'affichage des totaux : 1 chiffre après la virgule au plus.
 */
function arrondir(valeur) {
  return Math.round(valeur * 10) / 10;
}

// ===================== AJOUTER UN PLAT =====================

/**
 * Lit la ligne de saisie du haut et ajoute le plat au jour affiché.
 */
function ajouterPlat() {
  const plat = { id: creerIdPlat(), nom: saisieNom.value.trim() };
  let auMoinsUneValeur = false;

  // On lit les 4 cases une par une.
  for (const champ of CHAMPS_NUTRITION) {
    const caseSaisie = document.getElementById("saisie-" + champ.cle);
    const lecture = lireNombre(caseSaisie.value);
    if (!lecture.valide) {
      afficherErreurSaisie("« " + caseSaisie.value + " » n'est pas un nombre valide (" + champ.nom + ").");
      caseSaisie.focus();
      return; // on s'arrête : rien n'est ajouté
    }
    plat[champ.cle] = lecture.valeur;
    if (lecture.valeur !== null) {
      auMoinsUneValeur = true;
    }
  }

  // Une ligne complètement vide ne sert à rien.
  if (plat.nom === "" && !auMoinsUneValeur) {
    afficherErreurSaisie("Écris au moins un nom ou une valeur.");
    saisieNom.focus();
    return;
  }
  if (plat.nom === "") {
    plat.nom = "Plat";
  }

  donneesDuJour(dateAffichee).repas.push(plat);
  enregistrerClasseur();
  viderSaisie(); // pour le plat suivant
  afficherNutrition();
}

/**
 * Vide la ligne de saisie du haut (et ferme les suggestions de favoris).
 */
function viderSaisie() {
  saisieNom.value = "";
  CHAMPS_NUTRITION.forEach(function (champ) {
    document.getElementById("saisie-" + champ.cle).value = "";
  });
  erreurSaisie.classList.add("cache");
  cacherSuggestions(); // fonction de js/favoris.js
}

function afficherErreurSaisie(texte) {
  erreurSaisie.textContent = texte;
  erreurSaisie.classList.remove("cache");
}

// ===================== AFFICHER =====================

/**
 * (Re)construit tout l'onglet pour le jour affiché : la liste et les totaux.
 */
function afficherNutrition() {
  champDateNutrition.value = dateAffichee;
  listePlats.innerHTML = "";

  const jour = classeur.jours[dateAffichee];
  const repas = jour && jour.repas ? jour.repas : [];

  // Le petit texte "Aucun plat" n'apparaît que si la liste est vide.
  texteAucunPlat.classList.toggle("cache", repas.length > 0);

  repas.forEach(function (plat) {
    listePlats.appendChild(creerElementPlat(plat));
  });

  afficherPastillesFavoris(); // les pastilles en haut (js/favoris.js)
  afficherTotaux();
}

/**
 * Fabrique l'affichage d'un plat : son nom + ☆ + 🗑, puis ses 4 cases.
 * Toutes les cases restent modifiables.
 */
function creerElementPlat(plat) {
  const element = document.createElement("li");
  element.className = "plat";

  // --- Ligne 1 : le nom + l'étoile favori + le bouton supprimer ---
  const haut = document.createElement("div");
  haut.className = "plat-haut";

  const caseNom = document.createElement("input");
  caseNom.type = "text";
  caseNom.className = "plat-nom";
  caseNom.maxLength = 60;
  caseNom.value = plat.nom;
  caseNom.setAttribute("aria-label", "Nom du plat");
  // "change" : quand on quitte la case après l'avoir modifiée.
  caseNom.addEventListener("change", function () {
    const nom = caseNom.value.trim();
    if (nom === "") {
      caseNom.value = plat.nom; // un nom vide n'est pas accepté : on remet l'ancien
      return;
    }
    plat.nom = nom;
    enregistrerClasseur();
    mettreAJourEtoile(); // le nouveau nom est peut-être (ou plus) un favori
  });
  haut.appendChild(caseNom);

  // La quantité : "× 1" par défaut. Les 4 cases gardent les valeurs pour × 1
  // (ex. blanc de poulet pour 100 g) ; × 1,5 compte une fois et demie ces valeurs.
  const zoneQuantite = document.createElement("label");
  zoneQuantite.className = "plat-quantite";
  const signeFois = document.createElement("span");
  signeFois.textContent = "×";
  zoneQuantite.appendChild(signeFois);
  const caseQuantite = document.createElement("input");
  caseQuantite.type = "text";
  caseQuantite.inputMode = "decimal";
  caseQuantite.autocomplete = "off";
  caseQuantite.value = nombreEnTexte(quantiteDuPlat(plat));
  caseQuantite.setAttribute("aria-label", "Quantité (multiplicateur)");
  caseQuantite.addEventListener("change", function () {
    const lecture = lireNombre(caseQuantite.value);
    // La quantité doit être un nombre plus grand que 0 (et pas énorme).
    if (!lecture.valide || !lecture.valeur || lecture.valeur > 20) {
      caseQuantite.value = nombreEnTexte(quantiteDuPlat(plat)); // on remet l'ancienne
      return;
    }
    plat.quantite = lecture.valeur;
    caseQuantite.value = nombreEnTexte(lecture.valeur);
    enregistrerClasseur();
    mettreAJourLigneReelle();
    afficherTotaux();
  });
  zoneQuantite.appendChild(caseQuantite);
  // (la zone quantité est placée plus bas, sur la ligne 3)

  // L'étoile : ☆ = pas encore favori, ★ = déjà dans les favoris (js/favoris.js).
  const boutonFavori = document.createElement("button");
  boutonFavori.type = "button";
  boutonFavori.className = "plat-favori";
  function mettreAJourEtoile() {
    const estFavori = Boolean(trouverFavori(plat.nom));
    boutonFavori.textContent = estFavori ? "★" : "☆";
    boutonFavori.classList.toggle("est-favori", estFavori);
    boutonFavori.setAttribute("aria-label", estFavori ? "Retirer des favoris" : "Ajouter aux favoris");
  }
  mettreAJourEtoile();
  boutonFavori.addEventListener("click", function () {
    basculerFavori(plat);
  });
  haut.appendChild(boutonFavori);

  const boutonSupprimer = document.createElement("button");
  boutonSupprimer.type = "button";
  boutonSupprimer.className = "plat-supprimer";
  boutonSupprimer.textContent = "🗑";
  boutonSupprimer.setAttribute("aria-label", "Supprimer ce plat");
  boutonSupprimer.addEventListener("click", function () {
    demanderConfirmation({
      titre: "Supprimer ce plat ?",
      texte: "« " + plat.nom + " » sera retiré de ce jour.",
      boutonOui: "Supprimer",
      action: function () {
        supprimerPlat(plat.id);
      }
    });
  });
  haut.appendChild(boutonSupprimer);

  element.appendChild(haut);

  // --- Ligne 2 : les 4 cases ---
  const valeurs = document.createElement("div");
  valeurs.className = "plat-valeurs";

  CHAMPS_NUTRITION.forEach(function (champ) {
    const etiquette = document.createElement("label");
    etiquette.className = "valeur";

    const nom = document.createElement("span");
    nom.textContent = champ.nom;
    etiquette.appendChild(nom);

    const caseValeur = document.createElement("input");
    caseValeur.type = "text";
    caseValeur.inputMode = "decimal";
    caseValeur.placeholder = "X";
    caseValeur.autocomplete = "off";
    caseValeur.value = nombreEnTexte(plat[champ.cle]);
    caseValeur.addEventListener("change", function () {
      const lecture = lireNombre(caseValeur.value);
      if (!lecture.valide) {
        // Valeur incorrecte : on remet l'ancienne valeur.
        caseValeur.value = nombreEnTexte(plat[champ.cle]);
        return;
      }
      plat[champ.cle] = lecture.valeur;
      caseValeur.value = nombreEnTexte(lecture.valeur);
      enregistrerClasseur();
      // On ne redessine QUE les totaux (et la ligne "= …") : redessiner la liste
      // ferait perdre la case dans laquelle tu es peut-être en train d'écrire.
      mettreAJourLigneReelle();
      afficherTotaux();
    });
    etiquette.appendChild(caseValeur);

    valeurs.appendChild(etiquette);
  });

  element.appendChild(valeurs);

  // --- Ligne 3 : la quantité "× [1]" + les valeurs réelles si elle n'est pas 1 ---
  // ex. "× [1,5]  = 247,5 kcal · 46,5 g prot · 0 g gluc · 5,4 g lip"
  const bas = document.createElement("div");
  bas.className = "plat-bas";
  bas.appendChild(zoneQuantite);
  const ligneReelle = document.createElement("span");
  ligneReelle.className = "plat-reel";
  function mettreAJourLigneReelle() {
    const quantite = quantiteDuPlat(plat);
    if (quantite === 1) {
      ligneReelle.textContent = "quantité";
      ligneReelle.classList.remove("plat-reel-actif");
      return;
    }
    const morceaux = CHAMPS_NUTRITION.map(function (champ) {
      const valeur = plat[champ.cle];
      if (valeur === null || valeur === undefined) {
        return "X " + champ.nom.toLowerCase();
      }
      const reel = nombreEnTexte(arrondir(valeur * quantite));
      return champ.unite === "kcal" ? reel + " kcal" : reel + " g " + champ.nom.toLowerCase();
    });
    ligneReelle.textContent = "= " + morceaux.join(" · ");
    ligneReelle.classList.add("plat-reel-actif");
  }
  mettreAJourLigneReelle();
  bas.appendChild(ligneReelle);
  element.appendChild(bas);

  return element;
}

/**
 * La quantité d'un plat : 1 par défaut
 * (les plats notés avant la v0.7.1 n'ont pas de quantité).
 */
function quantiteDuPlat(plat) {
  return plat.quantite || 1;
}

/**
 * Retire un plat du jour affiché.
 */
function supprimerPlat(idPlat) {
  const jour = donneesDuJour(dateAffichee);
  // On garde tous les plats SAUF celui qui a cet id.
  jour.repas = jour.repas.filter(function (plat) {
    return plat.id !== idPlat;
  });
  enregistrerClasseur();
  afficherNutrition();
}

// ===================== TOTAUX =====================

/**
 * Additionne les plats d'un jour, en tenant compte de leur quantité (× 1,5…).
 * Renvoie par exemple :
 *   { kcal: 674, prot: 60, gluc: 86, lip: 10, inconnues: { kcal: 0, prot: 0, gluc: 0, lip: 1 } }
 * "inconnues" compte les cases X (non comptées) pour chaque valeur.
 * Cette fonction sert aussi pour la ligne Diète et servira pour l'historique.
 */
function totauxDuJour(date) {
  const totaux = { kcal: 0, prot: 0, gluc: 0, lip: 0, inconnues: { kcal: 0, prot: 0, gluc: 0, lip: 0 } };
  const jour = classeur.jours[date];
  const repas = jour && jour.repas ? jour.repas : [];

  repas.forEach(function (plat) {
    const quantite = quantiteDuPlat(plat);
    CHAMPS_NUTRITION.forEach(function (champ) {
      const valeur = plat[champ.cle];
      if (valeur === null || valeur === undefined) {
        totaux.inconnues[champ.cle] += 1;
      } else {
        totaux[champ.cle] += valeur * quantite;
      }
    });
  });

  return totaux;
}

/**
 * Affiche les totaux du jour en bas de l'onglet.
 */
function afficherTotaux() {
  const totaux = totauxDuJour(dateAffichee);

  CHAMPS_NUTRITION.forEach(function (champ) {
    // nombreEnTexte affiche la virgule à la française : 674,5
    document.getElementById("total-" + champ.cle).textContent = nombreEnTexte(arrondir(totaux[champ.cle]));
  });

  // La note sur les valeurs inconnues : seulement s'il y en a.
  const morceaux = [];
  CHAMPS_NUTRITION.forEach(function (champ) {
    const nombre = totaux.inconnues[champ.cle];
    if (nombre > 0) {
      morceaux.push(champ.nom + " : " + nombre);
    }
  });

  if (morceaux.length > 0) {
    noteInconnues.textContent = "Valeurs inconnues (X) non comptées — " + morceaux.join(" · ");
    noteInconnues.classList.remove("cache");
  } else {
    noteInconnues.classList.add("cache");
  }

  // Couleurs selon l'objectif + verdict "Diète tenue" (js/objectifs.js).
  afficherObjectifsNutrition();

  // La ligne Diète de "Ma journée" dépend des repas : on la met à jour aussi.
  afficherJournee();
}

// ===================== DÉMARRAGE =====================

/**
 * Prépare l'onglet. Appelée par js/app.js.
 */
function initialiserNutrition() {
  document.getElementById("bouton-ajouter-plat").addEventListener("click", ajouterPlat);

  // Choisir une date ici change aussi la date de "Ma journée".
  champDateNutrition.addEventListener("change", function () {
    choisirDateALaMain(champDateNutrition.value); // fonction de js/journee.js
  });

  // Dans la ligne de saisie, la touche "Entrée" du clavier ajoute le plat.
  document.querySelector(".saisie-plat").addEventListener("keydown", function (evenement) {
    if (evenement.key === "Enter") {
      evenement.preventDefault();
      ajouterPlat();
    }
  });

  // Dès que tu corriges une case de la saisie, le message d'erreur disparaît.
  document.querySelector(".saisie-plat").addEventListener("input", function () {
    erreurSaisie.classList.add("cache");
  });

  afficherNutrition();
}
