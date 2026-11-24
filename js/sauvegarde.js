/*
  js/sauvegarde.js — EXPORTER, IMPORTER ET RAPPEL DU DIMANCHE

  - EXPORTER : on transforme le classeur en texte JSON et on le fait
    télécharger comme un fichier "appplaisir-AAAA-MM-JJ.json".
  - IMPORTER : on lit un fichier choisi, on vérifie que c'est bien une
    sauvegarde d'Appplaisir, on demande confirmation, puis on remplace
    les données. Par sécurité, les anciennes données sont gardées de côté.
  - RAPPEL : un bandeau s'affiche si aucun export n'a été fait depuis
    le dernier dimanche (il apparaît le dimanche et reste tant que ce
    n'est pas fait, même si tu as raté le dimanche).
*/

// ===== Les éléments de la page =====
const fenetreSauvegarde = document.getElementById("fenetre-sauvegarde");
const texteDernierExport = document.getElementById("date-dernier-export");
const champFichierImport = document.getElementById("champ-fichier-import");
const messageSauvegarde = document.getElementById("message-sauvegarde");
const bandeauExport = document.getElementById("bandeau-export");

// Nom de la case du localStorage où l'on garde les données d'avant un import.
const CLE_AVANT_IMPORT = "appplaisir-avant-import";

/**
 * Ouvre la fenêtre "Sauvegarde".
 */
function ouvrirFenetreSauvegarde() {
  messageSauvegarde.classList.add("cache");
  mettreAJourTexteDernierExport();
  afficherEtatProtection();
  fenetreSauvegarde.showModal();
}

// ===================== PROTECTION DU STOCKAGE (v0.9.5) =====================
/*
  Par défaut, un navigateur PEUT effacer les données d'un site s'il manque
  de place. navigator.storage.persist() lui demande de ne JAMAIS les effacer
  tout seul. Sur Android, Chrome l'accorde en général quand l'app est
  installée sur l'écran d'accueil (sans poser de question).
  Restent possibles : désinstaller l'app, vider les données de Chrome,
  changer de téléphone → d'où l'export du dimanche.
*/

/**
 * Vrai si le navigateur sait protéger le stockage.
 */
function protectionDisponible() {
  return Boolean(navigator.storage && navigator.storage.persist && navigator.storage.persisted);
}

/**
 * Demande la protection si elle n'est pas encore accordée. Appelée au démarrage.
 */
function protegerStockage() {
  if (!protectionDisponible()) {
    return;
  }
  navigator.storage.persisted().then(function (dejaProtege) {
    if (!dejaProtege) {
      return navigator.storage.persist();
    }
  }).catch(function () {
    // Pas grave : on réessaiera au prochain démarrage.
  });
}

/**
 * Écrit l'état de la protection dans la fenêtre "Sauvegarde".
 */
function afficherEtatProtection() {
  const zone = document.getElementById("etat-protection");
  if (!protectionDisponible() || location.protocol === "file:") {
    zone.textContent = "🔒 Protection du stockage : pas disponible ici (elle le sera une fois l'app installée).";
    zone.className = "etat-protection";
    return;
  }
  navigator.storage.persisted().then(function (protege) {
    zone.textContent = protege
      ? "🔒 Protection du stockage : activée ✓ (le navigateur n'effacera pas tes données tout seul)"
      : "🔓 Protection du stockage : pas encore activée. Elle s'active en général une fois l'app installée sur l'écran d'accueil.";
    zone.className = "etat-protection " + (protege ? "etat-protection-ok" : "");
  }).catch(function () {
    zone.textContent = "";
  });
}

/**
 * Écrit la date du dernier export dans la fenêtre ("jamais" s'il n'y en a pas eu).
 */
function mettreAJourTexteDernierExport() {
  texteDernierExport.textContent = classeur.dernierExport
    ? dateLisible(classeur.dernierExport)
    : "jamais";
}

/**
 * Affiche un message dans la fenêtre "Sauvegarde".
 * @param {string} texte
 * @param {boolean} estUneErreur - true = rouge, false = vert
 */
function afficherMessageSauvegarde(texte, estUneErreur) {
  messageSauvegarde.textContent = texte;
  messageSauvegarde.classList.remove("cache");
  messageSauvegarde.classList.toggle("message-erreur", estUneErreur);
  messageSauvegarde.classList.toggle("message-ok", !estUneErreur);
}

// ===================== EXPORTER =====================

/**
 * Crée le fichier de sauvegarde et le fait télécharger.
 */
function exporterDonnees() {
  const aujourdhui = dateDuJour();

  // On note la date de l'export AVANT de créer le fichier,
  // pour qu'elle soit aussi dans la sauvegarde.
  classeur.dernierExport = aujourdhui;
  enregistrerClasseur();

  // Le contenu du fichier : une petite "étiquette" + toutes les données.
  const contenu = {
    app: "appplaisir",          // pour reconnaître nos fichiers à l'import
    formatVersion: 1,           // utile si la forme des données change un jour
    exporteLe: aujourdhui,
    donnees: classeur
  };

  // JSON.stringify(objet, null, 2) : texte JSON joliment indenté (lisible).
  const texte = JSON.stringify(contenu, null, 2);

  // Un "Blob" est un fichier fabriqué en mémoire, à partir de notre texte.
  const fichier = new Blob([texte], { type: "application/json" });

  // Pour le télécharger, on crée un lien invisible vers ce fichier,
  // on "clique" dessus par programme, puis on le supprime.
  const lien = document.createElement("a");
  lien.href = URL.createObjectURL(fichier);
  lien.download = "appplaisir-" + aujourdhui + ".json"; // nom du fichier
  document.body.appendChild(lien);
  lien.click();
  lien.remove();
  // On libère la mémoire utilisée par le fichier (après un court instant).
  setTimeout(function () {
    URL.revokeObjectURL(lien.href);
  }, 1000);

  mettreAJourTexteDernierExport();
  mettreAJourBandeau();
  afficherMessageSauvegarde("✓ Export réussi : regarde dans tes Téléchargements.", false);
}

// ===================== IMPORTER =====================

/**
 * Vérifie qu'un objet lu dans un fichier est bien une sauvegarde valide.
 * Renvoie true si tout va bien.
 */
function estUneSauvegardeValide(contenu) {
  return (
    contenu !== null &&
    typeof contenu === "object" &&
    contenu.app === "appplaisir" &&
    contenu.donnees &&
    Array.isArray(contenu.donnees.lignes) &&       // "lignes" doit être un tableau
    typeof contenu.donnees.jours === "object" &&   // "jours" doit être un objet
    contenu.donnees.jours !== null
  );
}

/**
 * Appelée quand un fichier a été choisi dans le champ "fichier".
 */
function lireFichierImport() {
  // files[0] = le premier (et seul) fichier choisi.
  const fichierChoisi = champFichierImport.files[0];
  if (!fichierChoisi) {
    return; // aucun fichier choisi (on a annulé)
  }

  // Lire un fichier prend un peu de temps : file.text() renvoie une "promesse".
  // .then(...) dit "quand la lecture est finie, fais ceci".
  fichierChoisi.text().then(function (texte) {
    let contenu;
    // try / catch : on "essaie" de lire le JSON ; si le fichier est abîmé
    // ou n'est pas du JSON, on "attrape" l'erreur au lieu de planter.
    try {
      contenu = JSON.parse(texte);
    } catch (erreur) {
      contenu = null;
    }

    if (!estUneSauvegardeValide(contenu)) {
      afficherMessageSauvegarde("✗ Ce fichier n'est pas une sauvegarde d'Appplaisir.", true);
      return;
    }

    const nombreDeJours = Object.keys(contenu.donnees.jours).length;
    demanderConfirmation({
      titre: "Remplacer tes données ?",
      texte:
        "Toutes les données de cet appareil seront remplacées par la sauvegarde du " +
        dateLisible(contenu.exporteLe) + " (" + nombreDeJours + " jour(s) rempli(s)).",
      boutonOui: "Remplacer",
      action: function () {
        remplacerDonnees(contenu.donnees);
      }
    });
  });

  // On vide le champ : ainsi, rechoisir le même fichier redéclenchera "change".
  champFichierImport.value = "";
}

/**
 * Remplace le classeur par les données importées.
 */
function remplacerDonnees(nouvellesDonnees) {
  // Filet de sécurité : on garde une copie des données actuelles.
  localStorage.setItem(CLE_AVANT_IMPORT, JSON.stringify(classeur));

  classeur = nouvellesDonnees;
  enregistrerClasseur();

  // On redessine tout ce qui dépend des données.
  figerJoursPasses();        // js/score.js
  verifierLignesSpeciales(); // js/poids.js : une vieille sauvegarde n'a pas les lignes Pesée / Poids
  verifierNiveaux();         // js/score.js : coef → niveau 1 à 4
  afficherJournee();
  afficherNutrition();
  afficherPoids();
  afficherBilan();
  afficherHistorique();
  mettreAJourTexteDernierExport();
  mettreAJourBandeau();
  afficherMessageSauvegarde("✓ Import réussi : tes données ont été remplacées.", false);
}

// ===================== RAPPEL DU DIMANCHE =====================

/**
 * Renvoie la date du dernier dimanche (aujourd'hui si on est dimanche),
 * au format "AAAA-MM-JJ".
 */
function dernierDimanche() {
  const date = new Date();
  // getDay() : 0 = dimanche, 1 = lundi, … 6 = samedi.
  // On recule d'autant de jours pour tomber sur le dimanche.
  date.setDate(date.getDate() - date.getDay());
  return dateEnTexte(date);
}

/**
 * Affiche ou cache le bandeau de rappel.
 * Il s'affiche si le dernier export est plus ancien que le dernier dimanche
 * (ou s'il n'y a jamais eu d'export).
 * Comparer deux textes "AAAA-MM-JJ" marche comme comparer deux dates.
 */
function mettreAJourBandeau() {
  const exportAFaire =
    !classeur.dernierExport || classeur.dernierExport < dernierDimanche();
  bandeauExport.classList.toggle("cache", !exportAFaire);
}

/**
 * Prépare tout ce qui concerne la sauvegarde. Appelée par js/app.js.
 */
function initialiserSauvegarde() {
  protegerStockage(); // demande au navigateur de ne pas effacer les données
  document.getElementById("bouton-sauvegarde").addEventListener("click", ouvrirFenetreSauvegarde);
  document.getElementById("bouton-exporter").addEventListener("click", exporterDonnees);
  // Le joli bouton "Importer" déclenche le vrai champ fichier, qui est caché.
  document.getElementById("bouton-importer").addEventListener("click", function () {
    champFichierImport.click();
  });
  champFichierImport.addEventListener("change", lireFichierImport);
  document.getElementById("bouton-fermer-sauvegarde").addEventListener("click", function () {
    fenetreSauvegarde.close();
  });

  // Le bouton du bandeau exporte directement, puis affiche la fenêtre
  // pour que tu voies le message de confirmation.
  document.getElementById("bandeau-exporter").addEventListener("click", function () {
    ouvrirFenetreSauvegarde();
    exporterDonnees();
  });

  // Si l'app reste ouverte et qu'on passe à dimanche, on revérifie au retour.
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "visible") {
      mettreAJourBandeau();
    }
  });

  mettreAJourBandeau();
}
