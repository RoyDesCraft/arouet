(() => {
  const Arouet = window.Arouet;

  const getItems = () => {
    const legacyItems = [...document.querySelectorAll('[class*="r-1537yvj"]')]
      .filter((el) => el.querySelector('[data-testid="html"]'));

    if (legacyItems.length) return legacyItems;

    return [...document.querySelectorAll('.r-vacyoi > div')]
      .filter((el) => el.querySelector('[data-testid="html"]'));
  };

  const getDropZones = () => [...document.querySelectorAll('.r-vacyoi')];

  const isFeedbackLabel = (text) => {
    const key = Arouet.normalizeKey(text);
    return key.includes('bravo')
      || key.includes('mauvaise reponse')
      || key.includes('mauvaise réponse')
      || key.includes('bonne reponse')
      || key.includes('bonne réponse');
  };

  Arouet.isClassifyRevealed = () => {
    const items = getItems();
    const dropZones = getDropZones();
    if (items.length === 0 || dropZones.length < 2) return false;

    const hasAdvanceButton = !!Arouet.findButtonByLabels(
      '[data-testid="button"]',
      Arouet.constants.advanceLabels,
      Arouet.isVisible
    );
    if (hasAdvanceButton) return true;

    return items.some((item) => {
      const card = item.querySelector('[class*="r-14lw9ot"]');
      return card && getComputedStyle(card).backgroundColor !== 'rgba(0, 0, 0, 0)';
    });
  };

  const getColumnLabels = () => {
    return [...document.querySelectorAll('.r-1fdo3w0')]
      .map((column) => Arouet.cleanText(column.innerText))
      .filter(Boolean)
      .filter((label) => !isFeedbackLabel(label))
      .slice(0, getDropZones().length);
  };

  const getQuestionKey = (items) => {
    const itemTexts = items.map((item) => Arouet.cleanText(item.innerText)).sort().join('|');
    return `cd_safe_v4||${getColumnLabels().join('|')}||${itemTexts}`;
  };

  const getCurrentZoneIndex = (item, dropZones) => {
    const itemRect = item.getBoundingClientRect();
    const centerX = itemRect.left + itemRect.width / 2;

    const visualIndex = dropZones.findIndex((zone) => {
      const zoneRect = zone.getBoundingClientRect();
      return centerX >= zoneRect.left && centerX <= zoneRect.right;
    });

    if (visualIndex !== -1) return visualIndex;
    return dropZones.findIndex((zone) => zone.contains(item));
  };

  const isIncorrectCard = (item) => {
    const card = item.querySelector('[style*="background-color"]');
    if (!card) return false;
    const bg = card.style.backgroundColor;
    return bg === 'rgb(255, 219, 144)' || bg === 'rgb(255, 150, 150)' || bg === 'rgb(255, 191, 191)';
  };

  const buildRevealedMapping = (items, dropZones) => {
    const mapping = {};

    items.forEach((item) => {
      const text = Arouet.cleanText(item.innerText);
      if (!text) return;

      const zoneIndex = getCurrentZoneIndex(item, dropZones);
      if (zoneIndex === -1) return;

      mapping[text] = isIncorrectCard(item) ? 1 - zoneIndex : zoneIndex;
    });

    return mapping;
  };

  const clickContinueAfterSave = (button) => {
    if (Arouet.state.autoClickPending) return;

    Arouet.state.autoClickPending = true;
    setTimeout(() => {
      Arouet.reactClick(button);
      Arouet.state.autoClickPending = false;
      Arouet.state.lastQuestion = '';
    }, 120);
  };

  const solveClassify = (questionKey, mapping, dropZones) => {
    Arouet.state.autoClickPending = true;
    Arouet.state.lastQuestion = questionKey;

    let delay = 0;
    Object.entries(mapping).forEach(([text, targetColumnIndex]) => {
      setTimeout(() => {
        if (!Arouet.state.autoClickPending) return;
        const currentDropZones = getDropZones();
        const item = getItems().find((el) => Arouet.cleanText(el.innerText) === text);
        if (item && currentDropZones[targetColumnIndex]) {
          Arouet.reactClick(item);
          setTimeout(() => Arouet.reactClick(currentDropZones[targetColumnIndex]), 150);
        }
      }, delay);
      delay += 500;
    });

    setTimeout(() => {
      if (!Arouet.state.autoClickPending) return;
      let fixDelay = 0;

      getItems().forEach((item) => {
        if (!isIncorrectCard(item)) return;

        setTimeout(() => {
          if (!Arouet.state.autoClickPending) return;
          const currentDropZones = getDropZones();
          const currentZoneIndex = getCurrentZoneIndex(item, currentDropZones);
          if (currentZoneIndex !== -1) {
            Arouet.reactClick(item);
            setTimeout(() => Arouet.reactClick(currentDropZones[1 - currentZoneIndex]), 150);
          }
        }, fixDelay);
        fixDelay += 800;
      });

      setTimeout(() => {
        if (!Arouet.state.autoClickPending) return;
        const validateButton = [...document.querySelectorAll('[data-testid="button"]')]
          .find((button) => Arouet.buttonText(button) === 'VALIDER');

        if (validateButton && !validateButton.disabled) Arouet.reactClick(validateButton);
        Arouet.state.autoClickPending = false;
      }, fixDelay + 500);
    }, delay + 300);
  };

  const handleRevealedClassify = (continueButton) => {
  const items = getItems();
  if (!items.length) return false;

  const hasColoredCards = items.some(isIncorrectCard) || items.some((item) => {
    const card = item.querySelector('[style*="background-color"]');
    if (!card) return false;
    const bg = card.style.backgroundColor;
    return bg === 'rgb(240, 254, 180)' || bg === 'rgb(198, 246, 213)' || bg === 'rgb(220, 252, 231)';
  });

  if (!hasColoredCards) {
    clickContinueAfterSave(continueButton);
    return true;
  }

  const dropZones = getDropZones();
  const labels = getColumnLabels();
  const questionKey = getQuestionKey(items);
  const mapping = buildRevealedMapping(items, dropZones);

  if (Object.keys(mapping).length > 0) {
    const columnKey = Arouet.classifyColumnKey(labels);

    chrome.storage.local.get(['arouet_db', 'arouet_count', 'arouet_learn'], (data) => {
      if (data.arouet_learn === false) return;

      const db = data.arouet_db ?? {};
      const key = Arouet.questionToKey(questionKey);
      const isNew = !db[key];

      db[key] = mapping;

      if (columnKey) {
        Object.entries(mapping).forEach(([itemText, columnIndex]) => {
          const label = labels[columnIndex];
          if (!label) return;
          const kind = Arouet.classifyLabelKind(label);
          const itemKey = `cw||${Arouet.normalizeKey(itemText)}`;
          const bucketKey = `ci||${columnKey}||${Arouet.normalizeKey(itemText)}`;

          db[bucketKey] = { text: itemText, columnLabel: label, columnKind: kind };
          if (kind && !kind.startsWith('not_')) db[itemKey] = kind;
        });
      }

      chrome.storage.local.set({
        arouet_db: db,
        arouet_count: (data.arouet_count ?? 0) + (isNew ? 1 : 0)
      });
    });
  }

  clickContinueAfterSave(continueButton);
  return true;
};

  Arouet.handleClassify = () => {
    const continueButton = Arouet.findButtonByLabels(
      '[data-testid="button"]',
      Arouet.constants.advanceLabels,
      Arouet.isVisible
    );

    if (continueButton && handleRevealedClassify(continueButton)) return true;

    const items = getItems();
    const dropZones = getDropZones();
    if (items.length === 0 || dropZones.length < 2) return false;

    const questionKey = getQuestionKey(items);
    if (questionKey === Arouet.state.lastQuestion || Arouet.state.autoClickPending) {
      return false;
    }

    Arouet.getKnownAnswer(questionKey, (answer) => {
      if (Arouet.state.autoClickPending || Arouet.state.lastQuestion === questionKey) return;

      if (answer) {
        solveClassify(questionKey, answer, dropZones);
        return;
      }

      Arouet.getKnownClassifyItems(getColumnLabels(), items.map((item) => Arouet.cleanText(item.innerText)), (itemAnswer) => {
        if (itemAnswer) {
          console.log('[Arouet] Classement recompose depuis les mots connus:', itemAnswer);
          solveClassify(questionKey, itemAnswer, dropZones);
          return;
        }

        console.log(`[Arouet] Classement inconnu : "${questionKey}"`);
        chrome.storage.local.get('arouet_random', (data) => {
          if (data.arouet_random === false) return;

          const randomMapping = {};
          items.forEach((item) => {
            randomMapping[Arouet.cleanText(item.innerText)] = Math.floor(Math.random() * dropZones.length);
          });
          solveClassify(questionKey, randomMapping, dropZones);
        });
      });
    });

    return true;
  };
})();
