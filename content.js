const AROUET = {
  autoClickDelay: { min: 500, max: 750 },
  colors: {
    duoCorrect: { r: [180, 255], g: [220, 255], b: [0, 160] },
    duoWrong:   { r: [220, 255], g: [150, 220], b: [0, 160] },
    wordBar:    'rgb(190, 237, 41)',
    cdCorrect:  'rgb(240, 254, 180)',
    cdWrong:    'rgb(255, 219, 144)'
  },
};

let lastQuestion = '';
let autoClickPending = false;
let debounceTimer = null;
let actionTimer = null;
let pendingSave = null;
let pendingAutoSave = null;
let cdRevealedKey = '';

let config = { delays: { min: 500, max: 750 }, nextDelay: 1500, debounceDelay: 120 };

chrome.storage.local.get(['arouet_delays', 'arouet_nextDelay', 'arouet_debounceDelay'], (data) => {
  if (data.arouet_delays) config.delays = data.arouet_delays;
  if (data.arouet_nextDelay) config.nextDelay = data.arouet_nextDelay;
  if (data.arouet_debounceDelay) config.debounceDelay = data.arouet_debounceDelay;
});

function normalizeText(text) {
  return (text || '')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
    .replace(/[«»\u201C\u201D]/g, '"')
    .replace(/[\u00A0\u202F\u2009\u200B\u200C\u200D\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeKey(text) { return normalizeText(text).toLowerCase(); }
function questionToKey(text, type) { return (type || 'q') + '_' + normalizeKey(text); }

function isElementReady(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  return !el.disabled && rect.width > 0 && rect.height > 0 && el.offsetParent !== null;
}

function onNewQuestion(question) {
  lastQuestion = question;
  autoClickPending = false;
  if (pendingAutoSave && normalizeKey(pendingAutoSave.question) !== normalizeKey(question)) {
    pendingAutoSave = null;
  }
}

function randomDelay() {
  const { min, max } = config.delays;
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function reactClick(el) {
  if (!el) return;
  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const shared = { bubbles: true, cancelable: true, clientX: x, clientY: y };
  el.dispatchEvent(new PointerEvent('pointerdown', { ...shared, pointerId: 1, pointerType: 'mouse' }));
  el.dispatchEvent(new MouseEvent('mousedown', { ...shared, button: 0 }));
  el.dispatchEvent(new PointerEvent('pointerup', { ...shared, pointerId: 1, pointerType: 'mouse' }));
  el.dispatchEvent(new MouseEvent('mouseup', { ...shared, button: 0 }));
  el.dispatchEvent(new MouseEvent('click', { ...shared, button: 0 }));
}

function saveAnswer(questionText, answerData, force = false, type) {
  console.log("💾 [Arouet] Tentative de sauvegarde pour :", questionText);
  const key = questionToKey(questionText, type);
  chrome.storage.local.get(['arouet_db', 'arouet_count', 'arouet_learn'], (data) => {
    if (data.arouet_learn === false) return;
    const db = data.arouet_db ?? {};
    const oldAnswer = db[key];
    const isNew = !oldAnswer;

    if (isNew) {
      console.log(`✨ [Arouet] Nouvelle question ajoutée de nulle part : "${questionText}"`);
    } else if (force && JSON.stringify(oldAnswer) !== JSON.stringify(answerData)) {
      console.log(`🛠️ [Arouet] Question corrigée (la réponse était déjà là mais a été mise à jour) : "${questionText}"`);
    }

    if (db[key] && !force) return;

    db[key] = answerData;
    chrome.storage.local.set({ 
      arouet_db: db, 
      arouet_count: (data.arouet_count ?? 0) + (isNew ? 1 : 0) 
    });
  });
}

function getKnownAnswer(questionText, callback, type) {
  const key = questionToKey(questionText, type);
  chrome.storage.local.get('arouet_db', (data) => {
    callback((data.arouet_db ?? {})[key] ?? null);
  });
}

function maybeAutoNext() {
  chrome.storage.local.get('arouet_autoNext', (data) => {
    if (data.arouet_autoNext !== true) return;
    setTimeout(() => {
      const labels = ['SUIVANT', 'CONTINUER', 'NEXT', 'VALIDER', 'TERMINER'];
      const btn = [...document.querySelectorAll('button, [role="button"]')]
        .find(el => labels.some(l => el.innerText?.toUpperCase().includes(l)) && isElementReady(el));
      if (btn) btn.click();
    }, config.nextDelay);
  });
}

function handleChoice() {
  const questionEl = document.querySelector('[data-testid="b"]');
  if (!questionEl) return false;
  const question = questionEl.innerText.trim();
  const buttons = [...document.querySelectorAll('[class*="r-zo2zu6"]')];
  if (!buttons.length) return false;

  const getStatus = (btn) => {
    const rgb = getComputedStyle(btn).backgroundColor.match(/\d+/g);
    if (!rgb) return 'neutral';
    const [r, g, b] = rgb.map(Number);
    const { duoCorrect, duoWrong } = AROUET.colors;
    if (r >= duoCorrect.r[0] && g >= duoCorrect.g[0] && b <= duoCorrect.b[1]) return 'correct';
    if (r >= duoWrong.r[0] && g <= duoWrong.g[1]) return 'wrong';
    return 'neutral';
  };

  const states = buttons.map(getStatus);
  const revealed = states.some(s => s !== 'neutral');

  if (revealed) {
    const correct = buttons.find((_, i) => states[i] === 'correct');
    if (correct) {
      saveAnswer(question, correct.innerText.trim(), true);
      maybeAutoNext();
    }
    return true;
  }

  if (question !== lastQuestion) {
    onNewQuestion(question);
    getKnownAnswer(question, (answer) => {
      if (!answer) {
        console.log(`❓ [Arouet] Question inconnue : "${question}"`);
      }
      chrome.storage.local.get(['arouet_auto', 'arouet_random'], (data) => {
        if (data.arouet_auto === false) return;
        setTimeout(() => {
          if (answer) {
            const target = buttons.find(b => normalizeKey(b.innerText) === normalizeKey(answer));
            if (target) target.click();
          } else if (data.arouet_random) {
            const randBtn = buttons[Math.floor(Math.random() * buttons.length)];
            pendingAutoSave = { question, answer: randBtn.innerText.trim() };
            randBtn.click();
          }
        }, randomDelay());
      });
    });
    return true;
  }
  return false;
}

function getCDColumns() {
  const grid = document.querySelector('[class*="r-1niwhzg"]');
  const headerRow = grid?.querySelector('[class*="r-18u37iz"][class*="r-1wtj0ep"]');
  return headerRow ? [...headerRow.querySelectorAll('[class*="r-1fdo3w0"]')] : [];
}

function getCDItems() {
  return [...document.querySelectorAll('[class*="r-1537yvj"]')].filter(el => el.querySelector('[data-testid="html"]'));
}

function getCDDropZones() {
  return [...document.querySelectorAll('.r-vacyoi')];
}

function getCDQuestionText() {
  const items = getCDItems().map(it => it.innerText.trim()).sort().join('|');
  const columns = [...document.querySelectorAll('.r-1fdo3w0')].map(c => c.innerText.trim()).join('|');
  return "classify||" + columns + "||" + items;
}

function reactClick(el) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const opts = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        buttons: 1
    };

    el.dispatchEvent(new PointerEvent('pointerdown', { ...opts, pointerId: 1, pointerType: 'mouse' }));
    el.dispatchEvent(new MouseEvent('mousedown', opts));
    el.dispatchEvent(new PointerEvent('pointerup', { ...opts, pointerId: 1, pointerType: 'mouse' }));
    el.dispatchEvent(new MouseEvent('mouseup', opts));
    el.dispatchEvent(new MouseEvent('click', opts));
}

let hasClickedValider = false;

function isVisible(el) {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0;
}

let cdPlacementDone = false;

function cleanText(txt) {
    if (!txt) return "";
    return txt.split('\n')[0].trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
}

function handleCD() {
    const allButtons = [...document.querySelectorAll('[data-testid="button"]')];
    
    // 1. RECHERCHE DU BOUTON CONTINUER (PHASE DE SAUVEGARDE)
    const globalContinuerBtn = allButtons.find(b => {
        const textEl = b.querySelector('[data-testid="button-text"]');
        if (!textEl) return false;
        const t = textEl.innerText.trim().toUpperCase();
        return ["CONTINUER", "SUIVANT", "NEXT", "OK", "C'EST PARTI", "CONTINUE"].some(word => t.includes(word));
    });

    if (globalContinuerBtn && isVisible(globalContinuerBtn)) {
        const items = getCDItems();
        if (items.length > 0) {
            const dropZones = getCDDropZones();
            const itemTexts = items.map(it => cleanText(it.innerText)).sort().join('|');
            const colLabels = [...document.querySelectorAll('.r-1fdo3w0')].map(c => cleanText(c.innerText)).join('|');
            const questionKey = `cd_safe_v4||${colLabels}||${itemTexts}`;

            const mapping = {};
            items.forEach(item => {
                const text = cleanText(item.innerText);
                const card = item.querySelector('[class*="r-14lw9ot"]');
                if (!card) return;
                
                const bg = getComputedStyle(card).backgroundColor;
                const itemRect = item.getBoundingClientRect();
                const centerX = itemRect.left + itemRect.width / 2;
                
                const zoneIdx = dropZones.findIndex(z => {
                    const zRect = z.getBoundingClientRect();
                    return centerX >= zRect.left && centerX <= zRect.right;
                });

                if (zoneIdx !== -1) {
                    // Si la carte est orange/rouge, la bonne place est l'AUTRE colonne
                    const isIncorrect = bg.includes("255, 219, 144") || bg.includes("255, 150, 150") || bg.includes("rgb(255, 191, 191)");
                    mapping[text] = isIncorrect ? (1 - zoneIdx) : zoneIdx;
                }
            });

            if (Object.keys(mapping).length > 0) {
                // On force la sauvegarde ici avec les vraies couleurs révélées
                saveAnswer(questionKey, mapping, true);
            }
        }

        if (!autoClickPending) {
            autoClickPending = true;
            setTimeout(() => {
                reactClick(globalContinuerBtn);
                autoClickPending = false;
                lastQuestion = ""; 
            }, 600);
        }
        return true; 
    }

    // 2. RECHERCHE DE L'EXERCICE (PHASE D'ACTION)
    const items = getCDItems();
    const dropZones = getCDDropZones();
    if (items.length === 0 || dropZones.length < 2) return false;

    const itemTexts = items.map(it => cleanText(it.innerText)).sort().join('|');
    const colLabels = [...document.querySelectorAll('.r-1fdo3w0')].map(c => cleanText(c.innerText)).join('|');
    const questionKey = `cd_safe_v4||${colLabels}||${itemTexts}`;

    if (questionKey !== lastQuestion && !autoClickPending) {
        getKnownAnswer(questionKey, (answer) => {
            if (!answer) console.log(`❓ [Arouet] Classement inconnu : "${questionKey}"`);
            
            if (autoClickPending || lastQuestion === questionKey) return;

            const solve = (mapping) => {
                autoClickPending = true;
                lastQuestion = questionKey;
                let delay = 0;

                // Placement
                Object.entries(mapping).forEach(([text, targetColIdx]) => {
                    setTimeout(() => {
                        const itm = getCDItems().find(el => cleanText(el.innerText) === text);
                        if (itm && dropZones[targetColIdx]) {
                            reactClick(itm);
                            setTimeout(() => reactClick(dropZones[targetColIdx]), 150);
                        }
                    }, delay);
                    delay += 500;
                });

                // Correction et Validation
                setTimeout(() => {
                    let fixDelay = 0;
                    getCDItems().forEach(item => {
                        const card = item.querySelector('[class*="r-14lw9ot"]');
                        if (!card) return;
                        const bg = getComputedStyle(card).backgroundColor;
                        
                        if (bg.includes("255, 219, 144") || bg.includes("255, 150, 150")) {
                            setTimeout(() => {
                                const itemRect = item.getBoundingClientRect();
                                const centerX = itemRect.left + itemRect.width / 2;
                                const currentZoneIdx = dropZones.findIndex(z => {
                                    const zRect = z.getBoundingClientRect();
                                    return centerX >= zRect.left && centerX <= zRect.right;
                                });
                                if (currentZoneIdx !== -1) {
                                    reactClick(item);
                                    setTimeout(() => reactClick(dropZones[1 - currentZoneIdx]), 150);
                                }
                            }, fixDelay);
                            fixDelay += 800;
                        }
                    });

                    setTimeout(() => {
                        const validerBtn = [...document.querySelectorAll('[data-testid="button"]')].find(b => {
                            const t = b.querySelector('[data-testid="button-text"]');
                            return t && t.innerText.trim().toUpperCase() === "VALIDER";
                        });
                        if (validerBtn && !validerBtn.disabled) reactClick(validerBtn);
                        autoClickPending = false;
                    }, fixDelay + 500);
                }, delay + 300);
            };

            if (answer) {
                solve(answer);
            } else {
                chrome.storage.local.get('arouet_random', (data) => {
                    if (data.arouet_random !== false) {
                        const randomMap = {};
                        items.forEach(it => { randomMap[cleanText(it.innerText)] = Math.floor(Math.random() * dropZones.length); });
                        solve(randomMap);
                    }
                });
            }
        });
        return true;
    }
    return false;
}

function handleGlobalNext() {
    // 1. On cherche le bouton immédiatement de façon synchrone
    const allButtons = [...document.querySelectorAll('[data-testid="button"], [data-testid="player-next"]')];
    
    const nextBtn = allButtons.find(b => {
        const textEl = b.querySelector('[data-testid="button-text"]') || b;
        const t = (textEl.innerText || "").trim().toUpperCase();
        return (
            t.includes("CONTINUER") || 
            t.includes("SUIVANT") || 
            t.includes("NEXT") || 
            t.includes("C'EST PARTI") || 
            t.includes("OK") ||
            t.includes("CONTINUE")
        ) && isVisible(b);
    });

    // 2. Si on trouve le bouton et qu'on n'est pas déjà en train de cliquer
    if (nextBtn && !autoClickPending) {
        // 3. On vérifie le réglage storage
        chrome.storage.local.get('arouet_autoNext', (data) => {
            if (data.arouet_autoNext === true) {
                autoClickPending = true; 
                setTimeout(() => {
                    reactClick(nextBtn);
                    autoClickPending = false;
                    lastQuestion = "";
                    cdRevealedKey = ""; // Reset pour le prochain exercice
                }, 600);
            }
        });
        // On retourne true pour dire au dispatch : "J'ai trouvé un bouton Suivant, ne fais rien d'autre"
        return true; 
    }
    return false;
}

function dispatch() {
  if (autoClickPending) return;
  if (handleGlobalNext()) return;
  if (handleChoice()) return;
  if (handleCD()) return;
  
  const simpleBtn = [...document.querySelectorAll('[data-testid="button"]')]
    .find(b => ['CONTINUER', 'SUIVANT', 'COMMENCER', 'NEXT'].some(l => b.innerText.toUpperCase().includes(l)) && isElementReady(b));
  if (simpleBtn && lastQuestion !== "button_clicked") {
    lastQuestion = "button_clicked";
    setTimeout(() => simpleBtn.click(), randomDelay());
  }
}

const observer = new MutationObserver(() => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(dispatch, config.debounceDelay);
});

observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });

console.log('[Arouet] Script corrigé et chargé.');