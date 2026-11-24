/*
  js/favoris.js — LES ALIMENTS FAVORIS

  Un favori est un "modèle" de plat que tu manges souvent (valeurs pour × 1) :
    favoris: [
      { id: "f1795…", nom: "Skyr", kcal: 84, prot: 15, gluc: 6, lip: 0,
        utilisations: 12, derniereUtilisation: "2026-11-21" }
    ]
  "utilisations" compte combien de fois tu l'as ajouté à un jour :
  ça sert à mettre en avant tes favoris les plus fréquents.

  Les 4 façons de s'en servir :
  1. L'étoile d'un plat : ☆ l'ajoute aux favoris, ★ propose de le retirer.
  2. Les PASTILLES en haut de Nutrition : seulement les 8 plus utilisés.
  3. Les SUGGESTIONS : en tapant le nom d'un plat (2 lettres ou plus),
     les favoris qui correspondent s'affichent ; une touche les ajoute.
  4. La fenêtre "Tous mes favoris" : recherche, tri, ＋ ajouter, ✎ modifier, 🗑 supprimer.
*/

// ===== Les éléments de la page =====
const listePastilles = document.getElementById("liste-pastilles");
const texteAucunFavori = document.getElementById("aucun-favori");
const messageFavori = document.getElementById("message-favori");
const boutonGererFavoris = document.getElementById("bouton-gerer-favoris");
const listeSuggestions = document.getElementById("suggestions-favoris");
const fenetreFavoris = document.getElementById("fenetre-favoris");
const champRechercheFavoris = document.getElementById("recherche-favoris");
const listeGestionFavoris = document.getElementById("liste-gestion-favoris");

// Combien de pastilles au maximum en haut de Nutrition.
const NOMBRE_PASTILLES = 8;
// Combien de suggestions au maximum sous le nom.
const NOMBRE_SUGGESTIONS = 6;

// Pour pouvoir annuler le minuteur du petit message s'il est relancé.
let minuteurMessageFavori = null;
// Le tri choisi dans la fenêtre : "utilisation" ou "nom".
let triFavoris = "utilisation";
// L'id du favori en cours de modification dans la fenêtre (null = aucun).
let idFavoriEnEdition = null;

// ===================== OUTILS =====================

/**
 * Renvoie la liste des favoris (les classeurs d'avant la v0.7 n'en ont pas).
 */
function listeFavoris() {
  if (!classeur.favoris) {
    classeur.favoris = [];
  }
  return classeur.favoris;
}

/**
 * Met un texte "au propre" pour comparer : sans majuscules, sans accents,
 * sans espaces autour. "  Pâtes " et "pates" deviennent tous deux "pates".
 * normalize("NFD") sépare les lettres de leurs accents ("â" → "a" + "^"),
 * puis replace(...) supprime les accents.
 */
function nomPourComparer(nom) {
  return nom.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

/**
 * Cherche le favori qui porte ce nom. Renvoie le favori, ou undefined.
 */
function trouverFavori(nom) {
  return listeFavoris().find(function (favori) {
    return nomPourComparer(favori.nom) === nomPourComparer(nom);
  });
}

/**
 * Compare deux favoris pour le tri "les plus utilisés" :
 * d'abord le nombre d'utilisations, puis la plus récente, puis le nom.
 * Une fonction de tri renvoie un nombre négatif si a passe avant b, positif sinon.
 */
function comparerParUtilisation(a, b) {
  const ecart = (b.utilisations || 0) - (a.utilisations || 0);
  if (ecart !== 0) {
    return ecart;
  }
  const dateA = a.derniereUtilisation || "";
  const dateB = b.derniereUtilisation || "";
  if (dateA !== dateB) {
    return dateA < dateB ? 1 : -1;
  }
  return a.nom.localeCompare(b.nom, "fr");
}

function comparerParNom(a, b) {
  return a.nom.localeCompare(b.nom, "fr");
}

/**
 * Le petit résumé d'un plat : "84 kcal · 15 g prot" (les X ne sont pas affichés).
 */
function resumePlat(plat) {
  const morceaux = [];
  if (plat.kcal !== null && plat.kcal !== undefined) {
    morceaux.push(nombreEnTexte(plat.kcal) + " kcal");
  }
  if (plat.prot !== null && plat.prot !== undefined) {
    morceaux.push(nombreEnTexte(plat.prot) + " g prot");
  }
  return morceaux.join(" · ");
}

/**
 * Le détail des 4 valeurs : "kcal 590 · Prot 45 · Gluc 80 · Lip X".
 */
function detailPlat(plat) {
  return CHAMPS_NUTRITION.map(function (champ) {
    const valeur = plat[champ.cle];
    return champ.nom + " " + (valeur === null || valeur === undefined ? "X" : nombreEnTexte(valeur));
  }).join(" · ");
}

// ===================== AJOUTER / RETIRER UN FAVORI =====================

/**
 * Appelée par l'étoile d'un plat (voir creerElementPlat dans js/nutrition.js).
 * ☆ → on ajoute le plat aux favoris. ★ → on propose de le retirer.
 */
function basculerFavori(plat) {
  const existant = trouverFavori(plat.nom);

  if (existant) {
    demanderConfirmation({
      titre: "Retirer des favoris ?",
      texte: "« " + existant.nom + " » ne sera plus dans tes favoris. Les plats déjà notés ne changent pas.",
      boutonOui: "Retirer",
      action: function () {
        retirerFavori(existant.id);
      }
    });
    return;
  }

  // On enregistre une COPIE des valeurs du plat (pas le plat lui-même) :
  // modifier ensuite le plat du jour ne changera pas le favori.
  // La quantité n'est pas copiée : un favori garde les valeurs pour × 1.
  listeFavoris().push({
    id: creerIdFavori(),
    nom: plat.nom,
    kcal: plat.kcal,
    prot: plat.prot,
    gluc: plat.gluc,
    lip: plat.lip,
    utilisations: 0
  });
  enregistrerClasseur();
  afficherNutrition();
  afficherMessageFavori("⭐ « " + plat.nom + " » ajouté aux favoris");
}

/**
 * Supprime un favori de la liste.
 */
function retirerFavori(idFavori) {
  classeur.favoris = listeFavoris().filter(function (favori) {
    return favori.id !== idFavori;
  });
  enregistrerClasseur();
  afficherNutrition();
  // Si la fenêtre est ouverte, on met aussi sa liste à jour.
  if (fenetreFavoris.open) {
    afficherGestionFavoris();
  }
}

/**
 * Ajoute une copie du favori aux plats du jour affiché (× 1),
 * et compte une utilisation de plus.
 */
function ajouterFavoriAuJour(favori) {
  donneesDuJour(dateAffichee).repas.push({
    id: creerIdPlat(),
    nom: favori.nom,
    kcal: favori.kcal,
    prot: favori.prot,
    gluc: favori.gluc,
    lip: favori.lip
  });

  favori.utilisations = (favori.utilisations || 0) + 1;
  favori.derniereUtilisation = dateDuJour();

  enregistrerClasseur();
  afficherNutrition();
  afficherMessageFavori("✓ « " + favori.nom + " » ajouté au " + dateLisible(dateAffichee));
}

/**
 * Affiche un petit message pendant 2,5 secondes.
 */
function afficherMessageFavori(texte) {
  messageFavori.textContent = texte;
  messageFavori.classList.remove("cache");
  // Si un message était déjà affiché, on annule son minuteur.
  clearTimeout(minuteurMessageFavori);
  // setTimeout lance une action après un délai (en millisecondes).
  minuteurMessageFavori = setTimeout(function () {
    messageFavori.classList.add("cache");
  }, 2500);
}

// ===================== B. LES PASTILLES (les 8 plus utilisés) =====================

/**
 * Dessine une pastille pour chacun des 8 favoris les plus utilisés.
 * Appelée par afficherNutrition().
 */
function afficherPastillesFavoris() {
  listePastilles.innerHTML = "";
  const favoris = listeFavoris();

  texteAucunFavori.classList.toggle("cache", favoris.length > 0);
  // Le lien en haut à droite : "Tous mes favoris (12)".
  boutonGererFavoris.textContent = favoris.length > 0 ? "Tous mes favoris (" + favoris.length + ")" : "Gérer";

  // slice(0, 8) garde seulement les 8 premiers après le tri.
  const lesPlusUtilises = favoris.slice().sort(comparerParUtilisation).slice(0, NOMBRE_PASTILLES);

  lesPlusUtilises.forEach(function (favori) {
    const pastille = document.createElement("button");
    pastille.type = "button";
    pastille.className = "pastille";

    const nom = document.createElement("span");
    nom.className = "pastille-nom";
    nom.textContent = favori.nom;
    pastille.appendChild(nom);

    const resume = resumePlat(favori);
    if (resume !== "") {
      const detail = document.createElement("span");
      detail.className = "pastille-detail";
      detail.textContent = resume;
      pastille.appendChild(detail);
    }

    pastille.addEventListener("click", function () {
      ajouterFavoriAuJour(favori);
    });
    listePastilles.appendChild(pastille);
  });
}

// ===================== A. LES SUGGESTIONS PENDANT LA SAISIE =====================

/**
 * Appelée à chaque lettre tapée dans "Nom du plat".
 * Affiche les favoris qui correspondent (2 lettres minimum).
 */
function afficherSuggestions() {
  const recherche = nomPourComparer(saisieNom.value);
  listeSuggestions.innerHTML = "";

  if (recherche.length < 2) {
    cacherSuggestions();
    return;
  }

  // On garde les favoris dont le nom CONTIENT le texte tapé…
  const trouves = listeFavoris().filter(function (favori) {
    return nomPourComparer(favori.nom).includes(recherche);
  });
  // …ceux qui COMMENCENT par ce texte d'abord, puis les plus utilisés.
  trouves.sort(function (a, b) {
    const aDebut = nomPourComparer(a.nom).startsWith(recherche);
    const bDebut = nomPourComparer(b.nom).startsWith(recherche);
    if (aDebut !== bDebut) {
      return aDebut ? -1 : 1;
    }
    return comparerParUtilisation(a, b);
  });

  if (trouves.length === 0) {
    cacherSuggestions();
    return;
  }

  trouves.slice(0, NOMBRE_SUGGESTIONS).forEach(function (favori) {
    const element = document.createElement("li");
    const bouton = document.createElement("button");
    bouton.type = "button";
    bouton.className = "suggestion";

    const nom = document.createElement("span");
    nom.className = "suggestion-nom";
    nom.textContent = "⭐ " + favori.nom;
    bouton.appendChild(nom);

    const detail = document.createElement("span");
    detail.className = "suggestion-detail";
    detail.textContent = resumePlat(favori);
    bouton.appendChild(detail);

    bouton.addEventListener("click", function () {
      ajouterFavoriAuJour(favori);
      viderSaisie(); // fonction de js/nutrition.js
    });

    element.appendChild(bouton);
    listeSuggestions.appendChild(element);
  });

  listeSuggestions.classList.remove("cache");
}

function cacherSuggestions() {
  listeSuggestions.classList.add("cache");
  listeSuggestions.innerHTML = "";
}

// ===================== D. LA FENÊTRE "TOUS MES FAVORIS" =====================

/**
 * Ouvre la fenêtre avec la recherche vide.
 */
function ouvrirFenetreFavoris() {
  champRechercheFavoris.value = "";
  idFavoriEnEdition = null;
  afficherGestionFavoris();
  fenetreFavoris.showModal();
}

/**
 * Écrit la liste des favoris (filtrée par la recherche et triée).
 */
function afficherGestionFavoris() {
  listeGestionFavoris.innerHTML = "";

  // Les boutons de tri : celui qui est choisi reçoit la classe "actif".
  document.querySelectorAll(".bouton-tri").forEach(function (bouton) {
    bouton.classList.toggle("actif", bouton.dataset.tri === triFavoris);
  });

  const recherche = nomPourComparer(champRechercheFavoris.value);
  const favoris = listeFavoris()
    .filter(function (favori) {
      return recherche === "" || nomPourComparer(favori.nom).includes(recherche);
    })
    .sort(triFavoris === "nom" ? comparerParNom : comparerParUtilisation);

  if (favoris.length === 0) {
    const vide = document.createElement("li");
    vide.className = "texte-doux";
    vide.textContent = listeFavoris().length === 0 ? "Aucun favori pour l'instant." : "Aucun favori ne correspond.";
    listeGestionFavoris.appendChild(vide);
    return;
  }

  favoris.forEach(function (favori) {
    if (favori.id === idFavoriEnEdition) {
      listeGestionFavoris.appendChild(creerFormulaireFavori(favori));
    } else {
      listeGestionFavoris.appendChild(creerElementGestionFavori(favori));
    }
  });
}

/**
 * Un favori dans la liste : nom, valeurs, nombre d'utilisations, et 3 boutons.
 */
function creerElementGestionFavori(favori) {
  const element = document.createElement("li");
  element.className = "gestion-favori";

  const texte = document.createElement("div");
  texte.className = "gestion-favori-texte";
  const nom = document.createElement("strong");
  nom.textContent = favori.nom;
  texte.appendChild(nom);
  const detail = document.createElement("span");
  detail.textContent = detailPlat(favori);
  texte.appendChild(detail);
  const usage = document.createElement("span");
  const fois = favori.utilisations || 0;
  usage.textContent = "utilisé " + fois + " fois";
  texte.appendChild(usage);
  element.appendChild(texte);

  // ＋ : ajouter au jour affiché
  element.appendChild(creerPetitBouton("＋", "Ajouter au jour", "petit-bouton-ajouter", function () {
    ajouterFavoriAuJour(favori);
    afficherGestionFavoris(); // le nombre d'utilisations a changé
  }));

  // ✎ : modifier
  element.appendChild(creerPetitBouton("✎", "Modifier ce favori", "", function () {
    idFavoriEnEdition = favori.id;
    afficherGestionFavoris();
  }));

  // 🗑 : supprimer (avec confirmation)
  element.appendChild(creerPetitBouton("🗑", "Supprimer ce favori", "", function () {
    demanderConfirmation({
      titre: "Supprimer ce favori ?",
      texte: "« " + favori.nom + " » ne sera plus dans tes favoris. Les plats déjà notés ne changent pas.",
      boutonOui: "Supprimer",
      action: function () {
        retirerFavori(favori.id);
      }
    });
  }));

  return element;
}

/**
 * Fabrique un petit bouton rond (＋, ✎, 🗑).
 */
function creerPetitBouton(symbole, description, classeEnPlus, action) {
  const bouton = document.createElement("button");
  bouton.type = "button";
  bouton.className = ("petit-bouton " + classeEnPlus).trim();
  bouton.textContent = symbole;
  bouton.setAttribute("aria-label", description);
  bouton.addEventListener("click", action);
  return bouton;
}

/**
 * Le formulaire de modification d'un favori (à la place de sa ligne).
 */
function creerFormulaireFavori(favori) {
  const element = document.createElement("li");
  element.className = "edition-favori";

  const caseNom = document.createElement("input");
  caseNom.type = "text";
  caseNom.className = "plat-nom";
  caseNom.maxLength = 60;
  caseNom.value = favori.nom;
  caseNom.setAttribute("aria-label", "Nom du favori");
  element.appendChild(caseNom);

  // Les 4 cases, avec le même look que dans la liste des plats.
  const valeurs = document.createElement("div");
  valeurs.className = "plat-valeurs";
  const cases = {}; // pour retrouver chaque case par sa clé au moment d'enregistrer
  CHAMPS_NUTRITION.forEach(function (champ) {
    const etiquette = document.createElement("label");
    etiquette.className = "valeur";
    const titre = document.createElement("span");
    titre.textContent = champ.nom;
    etiquette.appendChild(titre);
    const caseValeur = document.createElement("input");
    caseValeur.type = "text";
    caseValeur.inputMode = "decimal";
    caseValeur.placeholder = "X";
    caseValeur.autocomplete = "off";
    caseValeur.value = nombreEnTexte(favori[champ.cle]);
    etiquette.appendChild(caseValeur);
    cases[champ.cle] = caseValeur;
    valeurs.appendChild(etiquette);
  });
  element.appendChild(valeurs);

  const erreur = document.createElement("p");
  erreur.className = "erreur cache";
  element.appendChild(erreur);

  const actions = document.createElement("div");
  actions.className = "actions";

  const boutonAnnuler = document.createElement("button");
  boutonAnnuler.type = "button";
  boutonAnnuler.className = "bouton-secondaire";
  boutonAnnuler.textContent = "Annuler";
  boutonAnnuler.addEventListener("click", function () {
    idFavoriEnEdition = null;
    afficherGestionFavoris();
  });
  actions.appendChild(boutonAnnuler);

  const boutonEnregistrer = document.createElement("button");
  boutonEnregistrer.type = "button";
  boutonEnregistrer.className = "bouton-principal";
  boutonEnregistrer.textContent = "Enregistrer";
  boutonEnregistrer.addEventListener("click", function () {
    const nom = caseNom.value.trim();
    if (nom === "") {
      erreur.textContent = "Le nom ne peut pas être vide.";
      erreur.classList.remove("cache");
      return;
    }
    // Deux favoris ne peuvent pas avoir le même nom.
    const memeNom = trouverFavori(nom);
    if (memeNom && memeNom.id !== favori.id) {
      erreur.textContent = "Un autre favori s'appelle déjà « " + memeNom.nom + " ».";
      erreur.classList.remove("cache");
      return;
    }
    // On vérifie les 4 valeurs AVANT de modifier quoi que ce soit.
    const nouvellesValeurs = {};
    for (const champ of CHAMPS_NUTRITION) {
      const lecture = lireNombre(cases[champ.cle].value);
      if (!lecture.valide) {
        erreur.textContent = "« " + cases[champ.cle].value + " » n'est pas un nombre valide (" + champ.nom + ").";
        erreur.classList.remove("cache");
        return;
      }
      nouvellesValeurs[champ.cle] = lecture.valeur;
    }

    favori.nom = nom;
    CHAMPS_NUTRITION.forEach(function (champ) {
      favori[champ.cle] = nouvellesValeurs[champ.cle];
    });
    enregistrerClasseur();
    idFavoriEnEdition = null;
    afficherGestionFavoris();
    afficherNutrition(); // pastilles et étoiles à jour
  });
  actions.appendChild(boutonEnregistrer);

  element.appendChild(actions);
  return element;
}

// ===================== DÉMARRAGE =====================

/**
 * Prépare les favoris. Appelée par js/app.js.
 */
function initialiserFavoris() {
  boutonGererFavoris.addEventListener("click", ouvrirFenetreFavoris);
  document.getElementById("bouton-fermer-favoris").addEventListener("click", function () {
    fenetreFavoris.close();
  });

  // Recherche : on redessine la liste à chaque lettre.
  champRechercheFavoris.addEventListener("input", function () {
    idFavoriEnEdition = null;
    afficherGestionFavoris();
  });

  // Tri : on retient le choix et on redessine.
  document.querySelectorAll(".bouton-tri").forEach(function (bouton) {
    bouton.addEventListener("click", function () {
      triFavoris = bouton.dataset.tri;
      afficherGestionFavoris();
    });
  });

  // Suggestions : à chaque lettre tapée dans "Nom du plat".
  saisieNom.addEventListener("input", afficherSuggestions);
}
