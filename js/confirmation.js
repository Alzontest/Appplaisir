/*
  js/confirmation.js — UNE FENÊTRE "ES-TU SÛR ?" RÉUTILISABLE

  Plutôt que de créer une fenêtre de confirmation pour chaque cas,
  on en a UNE seule, qu'on remplit selon le besoin :
    demanderConfirmation({
      titre: "Supprimer cette ligne ?",
      texte: "« Sport » disparaîtra…",
      boutonOui: "Supprimer",
      action: function () { ... ce qu'on fait si on confirme ... }
    });
*/

const fenetreConfirmation = document.getElementById("fenetre-confirmation");
const titreConfirmation = document.getElementById("titre-confirmation");
const texteConfirmation = document.getElementById("texte-confirmation");
const boutonConfirmationOui = document.getElementById("confirmation-oui");

// L'action à lancer si on appuie sur le bouton "Oui".
// Elle change à chaque appel de demanderConfirmation.
let actionAConfirmer = null;

/**
 * Ouvre la fenêtre de confirmation.
 * @param {object} options - { titre, texte, boutonOui, action }
 */
function demanderConfirmation(options) {
  titreConfirmation.textContent = options.titre;
  texteConfirmation.textContent = options.texte;
  boutonConfirmationOui.textContent = options.boutonOui;
  actionAConfirmer = options.action;
  fenetreConfirmation.showModal();
}

// "Annuler" : on ferme sans rien faire.
document.getElementById("confirmation-non").addEventListener("click", function () {
  fenetreConfirmation.close();
});

// "Oui" : on ferme, puis on lance l'action prévue.
boutonConfirmationOui.addEventListener("click", function () {
  fenetreConfirmation.close();
  if (actionAConfirmer) {
    actionAConfirmer();
  }
});
