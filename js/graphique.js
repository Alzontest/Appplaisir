/*
  js/graphique.js — UNE COURBE GÉNÉRIQUE (calories, poids…)

  Une seule fonction dessine toutes les courbes de l'app :
    dessinerCourbe(conteneur, zoneInfo, points, options)

  "points" est une liste, une case par colonne (un jour ou un mois) :
    { etiquette: "L 16",            ← texte sous la colonne ("" = rien)
      valeur: 2090,                 ← null = pas de donnée (un trou dans la courbe)
      fourchette: { min, max },     ← la zone de l'objectif (null = pas d'objectif)
                                       min ou max à null = la zone va jusqu'au bord
                                       (ex. poids en perte : tout ce qui est SOUS la limite)
      prevu: 75.0,                  ← (facultatif) une 2e série dessinée en pointillés
                                       (ex. la trajectoire de poids prévue)
      titre: "Sam. 21/11/2026" }    ← affiché quand on touche la colonne

  "options" décrit ce qu'on dessine :
    {
      indexFort: 6,                     ← la colonne à mettre en avant (-1 = aucune)
      unite: "kcal",                    ← l'unité affichée ("kcal", "kg"…)
      echelle: "zero",                  ← "zero" : l'axe part de 0 (calories)
                                          "ajustee" : l'axe suit les valeurs (poids)
      legende: "zone de ton objectif…", ← le texte sous la courbe
      legendePrevue: "trajectoire…",    ← (facultatif) la légende des pointillés
      texteVide: "aucun plat noté",     ← affiché pour une colonne sans donnée
      formaterValeur: fonction,         ← comment écrire une valeur (ex. 74,6)
      formaterBorne: fonction,          ← comment écrire min / max de l'objectif
      // Options facultatives (utilisées par l'onglet Poids) :
      taillePoints: 0.5,                ← taille des points (1 = normale, 0.5 = moitié)
      zoneContinue: true,               ← la zone en UNE forme continue (pas d'escalier)
      graduationsRondes: true           ← repères sur des nombres ronds (1 ou 2 kg…)
    }

  Pour les calories, dessinerCourbeCalories() remplit ces options pour toi :
  le Bilan et l'Historique l'utilisent sans rien changer.
*/

// Les dimensions du dessin (en unités du "viewBox" : le SVG s'adapte ensuite
// à la largeur de l'écran tout seul).
const LARGEUR_GRAPHIQUE = 320;
const HAUTEUR_GRAPHIQUE = 180;
const MARGE_GRAPHIQUE = { haut: 12, droite: 8, bas: 30, gauche: 40 };

/**
 * Crée un élément SVG (un dessin). Les éléments SVG ont besoin de
 * createElementNS avec "l'adresse" du format SVG, au lieu de createElement.
 */
function creerSvg(nom, attributs) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", nom);
  Object.keys(attributs).forEach(function (cle) {
    element.setAttribute(cle, attributs[cle]);
  });
  return element;
}

/**
 * Arrondit "joliment" vers le haut pour l'axe : 2340 → 2500, 870 → 1000.
 */
function maximumJoli(valeur) {
  if (valeur <= 0) {
    return 1000;
  }
  const pas = valeur > 2000 ? 500 : 250;
  return Math.ceil(valeur / pas) * pas;
}

/**
 * Calcule le bas et le haut de l'axe vertical.
 *  - "zero"    : de 0 à un maximum "joli" (pour les calories).
 *  - "ajustee" : autour des valeurs, avec un peu de marge (pour le poids :
 *                partir de 0 écraserait la courbe tout en haut).
 */
function bornesAxe(points, echelle) {
  const valeurs = [];
  points.forEach(function (p) {
    if (p.valeur !== null) {
      valeurs.push(p.valeur);
    }
    if (p.fourchette) {
      // Une borne à null ("jusqu'au bord") ne compte pas pour l'échelle.
      if (p.fourchette.min !== null) {
        valeurs.push(p.fourchette.min);
      }
      if (p.fourchette.max !== null) {
        valeurs.push(p.fourchette.max);
      }
    }
    if (typeof p.prevu === "number") {
      valeurs.push(p.prevu);
    }
  });

  if (echelle === "ajustee") {
    if (valeurs.length === 0) {
      return { bas: 0, haut: 100 };
    }
    // Math.min(...valeurs) : les "..." passent tous les éléments du tableau.
    const plusPetit = Math.min(...valeurs);
    const plusGrand = Math.max(...valeurs);
    const marge = Math.max(0.5, (plusGrand - plusPetit) * 0.15);
    return { bas: Math.floor(plusPetit - marge), haut: Math.ceil(plusGrand + marge) };
  }

  const plusGrand = valeurs.length > 0 ? Math.max(...valeurs) : 0;
  return { bas: 0, haut: maximumJoli(plusGrand * 1.05) };
}

/**
 * Les repères de l'axe vertical sur des nombres ronds : 72, 73, 74…
 * Pas de 1 si l'écart est petit, de 2 s'il est grand (de 5 au-delà de 14).
 * Renvoie { bas, haut, graduations: [72, 73, …] }.
 */
function axeRond(points) {
  const valeurs = [];
  points.forEach(function (p) {
    if (p.valeur !== null) {
      valeurs.push(p.valeur);
    }
    if (p.fourchette) {
      if (p.fourchette.min !== null) {
        valeurs.push(p.fourchette.min);
      }
      if (p.fourchette.max !== null) {
        valeurs.push(p.fourchette.max);
      }
    }
    if (typeof p.prevu === "number") {
      valeurs.push(p.prevu);
    }
  });
  if (valeurs.length === 0) {
    return { bas: 0, haut: 10, graduations: [0, 5, 10] };
  }
  const plusPetit = Math.min(...valeurs) - 0.5;
  const plusGrand = Math.max(...valeurs) + 0.5;
  const ecart = plusGrand - plusPetit;
  const pas = ecart <= 6 ? 1 : ecart <= 14 ? 2 : 5;
  // On arrondit le bas vers le bas et le haut vers le haut, sur un multiple du pas.
  const bas = Math.floor(plusPetit / pas) * pas;
  const haut = Math.ceil(plusGrand / pas) * pas;
  const graduations = [];
  for (let valeur = bas; valeur <= haut; valeur += pas) {
    graduations.push(valeur);
  }
  return { bas: bas, haut: haut, graduations: graduations };
}

/**
 * Dessine une courbe dans "conteneur".
 * Toucher une colonne écrit sa valeur dans "zoneInfo".
 */
function dessinerCourbe(conteneur, zoneInfo, points, options) {
  conteneur.innerHTML = "";
  const indexFort = options.indexFort !== undefined ? options.indexFort : -1;
  const nombre = points.length;
  // L'axe : repères ronds (option), sinon bas / milieu / haut comme avant.
  let axe;
  let graduations;
  if (options.graduationsRondes) {
    axe = axeRond(points);
    graduations = axe.graduations;
  } else {
    axe = bornesAxe(points, options.echelle);
    graduations = [axe.bas, (axe.bas + axe.haut) / 2, axe.haut];
  }

  const largeurUtile = LARGEUR_GRAPHIQUE - MARGE_GRAPHIQUE.gauche - MARGE_GRAPHIQUE.droite;
  const hauteurUtile = HAUTEUR_GRAPHIQUE - MARGE_GRAPHIQUE.haut - MARGE_GRAPHIQUE.bas;
  const largeurColonne = largeurUtile / nombre;
  // Position horizontale du centre de la colonne i, et position verticale d'une valeur.
  const x = function (i) { return MARGE_GRAPHIQUE.gauche + largeurColonne * (i + 0.5); };
  const y = function (valeur) {
    return MARGE_GRAPHIQUE.haut + hauteurUtile * (1 - (valeur - axe.bas) / (axe.haut - axe.bas));
  };
  // Les points sont plus petits quand il y a beaucoup de colonnes (vue mois, 30 jours),
  // et l'option "taillePoints" peut encore les réduire (0.5 = deux fois plus petits).
  const echellePoints = options.taillePoints || 1;
  let rayon = (nombre > 15 ? 3 : 4) * echellePoints;
  // Avec des petits points, on garde un rayon d'au moins 2 pour qu'ils restent visibles
  // (sinon, sur 30 colonnes, ils deviendraient presque invisibles).
  if (options.taillePoints) {
    rayon = Math.max(2, rayon);
  }
  const rayonFort = rayon + 1.5 * echellePoints;

  const svg = creerSvg("svg", {
    viewBox: "0 0 " + LARGEUR_GRAPHIQUE + " " + HAUTEUR_GRAPHIQUE,
    class: "svg-graphique",
    role: "img",
    "aria-label": "Courbe (" + options.unite + ") : " + points.map(function (p) {
      return p.titre + " " + (p.valeur === null ? options.texteVide : options.formaterValeur(p.valeur) + " " + options.unite);
    }).join(", ")
  });

  // 1. La zone de l'objectif.
  //    Une borne à null : la zone va jusqu'au bord du graphique.
  if (options.zoneContinue) {
    dessinerZoneContinue(svg, points, axe, x, y, largeurColonne);
  }
  // Sinon : une bande verte pâle par colonne (comme avant, pour les calories).
  points.forEach(function (p, i) {
    if (p.fourchette && !options.zoneContinue) {
      const haut = p.fourchette.max === null ? axe.haut : p.fourchette.max;
      const bas = p.fourchette.min === null ? axe.bas : p.fourchette.min;
      svg.appendChild(creerSvg("rect", {
        x: MARGE_GRAPHIQUE.gauche + largeurColonne * i,
        y: y(haut),
        width: largeurColonne,
        height: y(bas) - y(haut),
        class: "graphique-bande"
      }));
    }
  });

  // 2. Les lignes de repère horizontales et leurs valeurs.
  graduations.forEach(function (valeur, numero) {
    svg.appendChild(creerSvg("line", {
      x1: MARGE_GRAPHIQUE.gauche, x2: LARGEUR_GRAPHIQUE - MARGE_GRAPHIQUE.droite, y1: y(valeur), y2: y(valeur),
      class: numero === 0 ? "graphique-axe" : "graphique-grille"
    }));
    const texte = creerSvg("text", { x: MARGE_GRAPHIQUE.gauche - 6, y: y(valeur) + 4, class: "graphique-texte", "text-anchor": "end" });
    // En échelle "zero" on écrit le nombre tel quel (1500) ; sinon avec la virgule (74,5).
    texte.textContent = options.echelle === "zero" || options.graduationsRondes ? valeur : nombreEnTexte(arrondir(valeur));
    svg.appendChild(texte);
  });

  // 2 bis. La série "prévue" (si elle existe) : une ligne en pointillés.
  let cheminPrevu = "";
  let crayonLeveP = true;
  points.forEach(function (p, i) {
    if (typeof p.prevu !== "number") {
      crayonLeveP = true;
      return;
    }
    cheminPrevu += (crayonLeveP ? "M" : "L") + x(i) + " " + y(p.prevu) + " ";
    crayonLeveP = false;
  });
  if (cheminPrevu !== "") {
    svg.appendChild(creerSvg("path", { d: cheminPrevu, class: "graphique-prevue" }));
  }

  // 3. La courbe : on relie les colonnes qui ont une valeur ; une colonne vide
  //    fait un "trou" ("M" = lever le crayon, "L" = tracer jusqu'ici).
  let chemin = "";
  let crayonLeve = true;
  points.forEach(function (p, i) {
    if (p.valeur === null) {
      crayonLeve = true;
      return;
    }
    chemin += (crayonLeve ? "M" : "L") + x(i) + " " + y(p.valeur) + " ";
    crayonLeve = false;
  });
  if (chemin !== "") {
    svg.appendChild(creerSvg("path", { d: chemin, class: "graphique-ligne" }));
  }

  // 4. Les étiquettes, les points, et une grande zone à toucher par colonne.
  points.forEach(function (p, i) {
    const estFort = i === indexFort;

    if (p.etiquette) {
      const etiquette = creerSvg("text", {
        x: x(i), y: HAUTEUR_GRAPHIQUE - 10, "text-anchor": "middle",
        class: "graphique-texte" + (estFort ? " graphique-texte-fort" : "")
      });
      etiquette.textContent = p.etiquette;
      svg.appendChild(etiquette);
    }

    if (p.valeur !== null) {
      const attributs = {
        cx: x(i), cy: y(p.valeur), r: estFort ? rayonFort : rayon,
        class: "graphique-point"
      };
      // Petits points : l'anneau blanc autour rétrécit dans la même proportion,
      // sinon il "mange" la couleur du point (qui paraît alors blanc et creux).
      if (options.taillePoints) {
        attributs.style = "stroke-width: " + 2 * echellePoints + "px";
      }
      svg.appendChild(creerSvg("circle", attributs));
    }

    // La zone à toucher : toute la hauteur de la colonne (plus facile qu'un petit point).
    const zone = creerSvg("rect", {
      x: MARGE_GRAPHIQUE.gauche + largeurColonne * i, y: 0, width: largeurColonne, height: HAUTEUR_GRAPHIQUE,
      class: "graphique-zone"
    });
    zone.addEventListener("click", function () {
      zoneInfo.textContent = texteInfoPoint(p, options);
      svg.querySelectorAll(".graphique-zone").forEach(function (z) {
        z.classList.remove("graphique-zone-active");
      });
      zone.classList.add("graphique-zone-active");
    });
    svg.appendChild(zone);
  });

  conteneur.appendChild(svg);

  // La petite légende de la bande verte.
  const legende = document.createElement("p");
  legende.className = "legende-graphique";
  const pastille = document.createElement("span");
  pastille.className = "pastille-legende";
  legende.appendChild(pastille);
  legende.appendChild(document.createTextNode(" " + options.legende));
  // La légende des pointillés, seulement s'il y en a dans cette courbe.
  if (cheminPrevu !== "" && options.legendePrevue) {
    const trait = document.createElement("span");
    trait.className = "trait-legende";
    legende.appendChild(trait);
    legende.appendChild(document.createTextNode(" " + options.legendePrevue));
  }
  conteneur.appendChild(legende);

  zoneInfo.textContent = "Touche la courbe pour voir une valeur.";
}

/**
 * La zone de réussite en UNE forme continue (au lieu d'un rectangle par colonne) :
 * le bord haut passe par le centre de chaque colonne, donc une trajectoire
 * qui descend donne une pente douce au lieu d'un escalier.
 * Une colonne sans zone coupe la forme en plusieurs morceaux.
 */
function dessinerZoneContinue(svg, points, axe, x, y, largeurColonne) {
  // On découpe en "morceaux" de colonnes consécutives qui ont une zone.
  const morceaux = [];
  let morceau = [];
  points.forEach(function (p, i) {
    if (p.fourchette) {
      morceau.push(i);
    } else if (morceau.length > 0) {
      morceaux.push(morceau);
      morceau = [];
    }
  });
  if (morceau.length > 0) {
    morceaux.push(morceau);
  }

  morceaux.forEach(function (indices) {
    // Le haut et le bas de la zone pour une colonne (null = jusqu'au bord).
    const haut = function (i) {
      return points[i].fourchette.max === null ? axe.haut : points[i].fourchette.max;
    };
    const bas = function (i) {
      return points[i].fourchette.min === null ? axe.bas : points[i].fourchette.min;
    };
    const premier = indices[0];
    const dernier = indices[indices.length - 1];
    const gauche = x(premier) - largeurColonne / 2;
    const droite = x(dernier) + largeurColonne / 2;

    // Bord haut de gauche à droite, puis bord bas de droite à gauche, puis on ferme (Z).
    let d = "M" + gauche + " " + y(haut(premier)) + " ";
    indices.forEach(function (i) {
      d += "L" + x(i) + " " + y(haut(i)) + " ";
    });
    d += "L" + droite + " " + y(haut(dernier)) + " ";
    d += "L" + droite + " " + y(bas(dernier)) + " ";
    indices.slice().reverse().forEach(function (i) {
      d += "L" + x(i) + " " + y(bas(i)) + " ";
    });
    d += "L" + gauche + " " + y(bas(premier)) + " Z";
    svg.appendChild(creerSvg("path", { d: d, class: "graphique-bande" }));
  });
}

/**
 * Le texte affiché quand on touche une colonne.
 */
function texteInfoPoint(p, options) {
  let texte = p.titre + " : ";
  if (p.valeur === null) {
    // Pas de valeur (ex. jour à venir) : on donne quand même le prévu s'il existe.
    texte += options.texteVide;
    if (typeof p.prevu === "number") {
      texte += " · prévu " + options.formaterValeur(p.prevu);
    }
    return texte;
  }
  texte += options.formaterValeur(p.valeur) + " " + options.unite;
  if (p.fourchette) {
    const min = p.fourchette.min;
    const max = p.fourchette.max;
    if (min !== null && p.valeur < min) {
      texte += " · ▼ sous l'objectif";
    } else if (max !== null && p.valeur > max) {
      texte += " · ▲ au-dessus de l'objectif";
    } else {
      texte += " · ✓ dans l'objectif";
    }
    // La zone : "(1980 – 2420)", "(≤ 76,0)" ou "(≥ 74,0)".
    if (min !== null && max !== null) {
      texte += " (" + options.formaterBorne(min) + " – " + options.formaterBorne(max) + ")";
    } else if (max !== null) {
      texte += " (≤ " + options.formaterBorne(max) + ")";
    } else {
      texte += " (≥ " + options.formaterBorne(min) + ")";
    }
  }
  if (typeof p.prevu === "number") {
    texte += " · prévu " + options.formaterValeur(p.prevu);
  }
  return texte;
}

/**
 * La courbe des CALORIES (Bilan et Historique) : mêmes points qu'avant,
 * avec "kcal" à la place de "valeur", et les options des calories.
 */
function dessinerCourbeCalories(conteneur, zoneInfo, points, options) {
  const pointsGeneriques = points.map(function (p) {
    return { etiquette: p.etiquette, valeur: p.kcal, fourchette: p.fourchette, titre: p.titre };
  });
  dessinerCourbe(conteneur, zoneInfo, pointsGeneriques, {
    indexFort: options && options.indexFort !== undefined ? options.indexFort : -1,
    unite: "kcal",
    echelle: "zero",
    legende: "zone de ton objectif de calories",
    texteVide: "aucun plat noté",
    formaterValeur: nombreEnTexte,
    formaterBorne: function (borne) { return String(borne); }
  });
}
