/*
  js/lignes.js — CRÉER, MODIFIER ET SUPPRIMER LES LIGNES DE "MA JOURNÉE"

  Une seule fenêtre sert à la fois pour :
    - CRÉER une ligne (bouton "+ Ajouter une ligne") ;
    - MODIFIER une ligne (toucher son nom dans la liste).
  La variable "ligneEnCours" indique dans quel cas on est :
    null      → on crée une nouvelle ligne
    une ligne → on modifie cette ligne-là
*/

// ===== Les éléments de la page =====
const fenetreLigne = document.getElementById("fenetre-ligne");
const formulaireLigne = document.getElementById("formulaire-ligne");
const titreFenetreLigne = document.getElementById("titre-fenetre-ligne");
const champNom = document.getElementById("champ-nom");
const erreurNom = document.getElementById("erreur-nom");
const niveauValeur = document.getElementById("niveau-valeur");
const explicationNiveau = document.getElementById("explication-niveau");
const boutonValider = document.getElementById("bouton-valider");
const boutonSupprimer = document.getElementById("bouton-supprimer");

// Les limites du niveau (NIVEAU_MIN = 1, NIVEAU_MAX = 4) sont dans js/score.js.
// Niveau proposé pour une nouvelle ligne.
const NIVEAU_PAR_DEFAUT = 2;

// La ligne en cours de modification (null = création d'une nouvelle ligne)
let ligneEnCours = null;
// Le niveau affiché dans la fenêtre
let niveauChoisi = NIVEAU_PAR_DEFAUT;

/**
 * Ouvre la fenêtre.
 * @param {object|null} ligne - la ligne à modifier, ou null pour en créer une
 */
function ouvrirFenetreLigne(ligne) {
  ligneEnCours = ligne;

  if (ligne === null) {
    // Création : champs vides
    titreFenetreLigne.textContent = "Nouvelle ligne";
    champNom.value = "";
    niveauChoisi = NIVEAU_PAR_DEFAUT;
    boutonValider.textContent = "Ajouter";
    boutonSupprimer.classList.add("cache");
  } else {
    // Modification : on pré-remplit avec les valeurs de la ligne
    titreFenetreLigne.textContent = "Modifier la ligne";
    champNom.value = ligne.nom;
    // Une ligne pas encore migrée (sans niveau) : on convertit son coef.
    niveauChoisi = typeof ligne.niveau === "number" ? ligne.niveau : niveauDepuisCoef(ligne.coef || 1);
    boutonValider.textContent = "Enregistrer";
    boutonSupprimer.classList.remove("cache");
  }

  erreurNom.classList.add("cache");
  afficherNiveauChoisi();
  // showModal() affiche la fenêtre par-dessus la page et bloque le reste.
  fenetreLigne.showModal();
}

/**
 * Écrit le niveau et ce qu'il vaut : "Niveau 4 · vaut 10 points".
 */
function afficherNiveauChoisi() {
  niveauValeur.textContent = niveauChoisi;
  const points = pointsDuNiveau(niveauChoisi); // js/score.js
  explicationNiveau.textContent =
    "Niveau " + niveauChoisi + " · vaut " + points + (points > 1 ? " points" : " point");
}

/**
 * Change le niveau de +1 ou -1, sans sortir de 1 à 4.
 * @param {number} pas - +1 ou -1
 */
function changerNiveau(pas) {
  // Math.min / Math.max "bloquent" la valeur entre les deux limites.
  niveauChoisi = Math.min(NIVEAU_MAX, Math.max(NIVEAU_MIN, niveauChoisi + pas));
  afficherNiveauChoisi();
}

/**
 * Appelée quand on valide le formulaire ("Ajouter" ou "Enregistrer").
 */
function validerLigne(evenement) {
  // Par défaut, un formulaire recharge la page quand on le valide.
  // preventDefault() empêche ce comportement : on gère tout nous-mêmes.
  evenement.preventDefault();

  // trim() enlève les espaces au début et à la fin.
  const nom = champNom.value.trim();
  if (nom === "") {
    erreurNom.classList.remove("cache");
    champNom.focus();
    return; // on s'arrête là : rien n'est enregistré
  }

  // Avant de changer les lignes, on prend la "photo" des jours passés
  // pour que leur score ne change pas (js/score.js).
  figerJoursPasses();

  if (ligneEnCours === null) {
    // Création : on ajoute la nouvelle ligne à la fin de la liste
    classeur.lignes.push({ id: creerIdLigne(), nom: nom, niveau: niveauChoisi });
  } else {
    // Modification : on change directement la ligne existante
    ligneEnCours.nom = nom;
    ligneEnCours.niveau = niveauChoisi;
    delete ligneEnCours.coef; // le niveau remplace l'ancien coefficient
  }

  enregistrerClasseur();
  fenetreLigne.close();
  afficherJournee();
}

/**
 * Premier temps de la suppression : on demande confirmation
 * avec la fenêtre réutilisable de js/confirmation.js.
 */
function demanderSuppression() {
  demanderConfirmation({
    titre: "Supprimer cette ligne ?",
    texte:
      "« " + ligneEnCours.nom + " » disparaîtra de ta journée. " +
      "Tes réponses passées sont conservées pour l'historique.",
    boutonOui: "Supprimer",
    action: confirmerSuppression
  });
}

/**
 * Second temps : la suppression est confirmée.
 * On ne détruit pas la ligne, on la marque "supprimee" (voir js/donnees.js).
 */
function confirmerSuppression() {
  figerJoursPasses(); // la photo des jours passés d'abord (js/score.js)
  ligneEnCours.supprimee = true;
  enregistrerClasseur();
  fenetreLigne.close();
  afficherJournee();
}

// ===== On relie les boutons à leurs actions =====
document.getElementById("bouton-ajouter-ligne").addEventListener("click", function () {
  ouvrirFenetreLigne(null);
});
document.getElementById("niveau-moins").addEventListener("click", function () {
  changerNiveau(-1);
});
document.getElementById("niveau-plus").addEventListener("click", function () {
  changerNiveau(+1);
});
document.getElementById("bouton-annuler").addEventListener("click", function () {
  fenetreLigne.close();
});
// "input" se déclenche à chaque lettre tapée : dès que tu écris,
// le message d'erreur "Donne un nom à la ligne" disparaît.
champNom.addEventListener("input", function () {
  erreurNom.classList.add("cache");
});
formulaireLigne.addEventListener("submit", validerLigne);
boutonSupprimer.addEventListener("click", demanderSuppression);
