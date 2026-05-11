(() => {
  const Arouet = window.Arouet;

  const getWordButtons = () => {
    return [...document.querySelectorAll('[class*="r-11c0sde"]')]
      .filter((el) => Arouet.normalizeText(el.innerText).length > 0);
  };

  const getWordQuestionText = () => {
    const instruction = Arouet.normalizeText(
      document.querySelector('[data-testid="u"]')?.innerText
      || document.querySelector('[data-testid="i"]')?.innerText
      || document.querySelector('[data-testid="b"]')?.innerText
      || ''
    );
    const words = getWordButtons().map((button) => Arouet.normalizeText(button.innerText));
    if (!instruction || !words.length) return '';
    return `${instruction}||${words.join(' ')}`;
  };

  const getWordBarColor = (wordButton) => {
    const row = wordButton.closest('div[style*="flex-direction: row"]');
    const bar = row?.firstElementChild;
    return bar ? getComputedStyle(bar).backgroundColor : null;
  };

  const clickSavedWords = (savedWords) => {
    const words = Array.isArray(savedWords) ? savedWords : [savedWords];
    getWordButtons().forEach((button) => {
      const isSaved = words.some((word) => Arouet.normalizeKey(word) === Arouet.normalizeKey(button.innerText));
      if (isSaved && Arouet.isElementReady(button)) button.click();
    });
  };

  Arouet.handleWord = () => {
    const buttons = getWordButtons();
    if (!buttons.length) return false;

    const question = getWordQuestionText();
    if (!question) return false;

    const correctButtons = buttons.filter((button) => getWordBarColor(button) === Arouet.constants.colors.wordBar);
    const revealed = correctButtons.length > 0;

    if (revealed) {
      Arouet.state.autoClickPending = false;
      Arouet.clearPendingAutoSaveForQuestion(question);
      const correctWords = correctButtons.map((button) => Arouet.normalizeText(button.innerText)).filter(Boolean);
      if (correctWords.length) {
        Arouet.saveAnswer(question, correctWords, true);
        Arouet.maybeAutoNext();
      }
      return true;
    }

    if (question !== Arouet.state.lastQuestion) {
      Arouet.onNewQuestion(question);
      Arouet.autoClick(question, clickSavedWords, () => {
        const currentButtons = getWordButtons();
        if (!currentButtons.length) return;
        const button = currentButtons[Math.floor(Math.random() * currentButtons.length)];
        Arouet.state.pendingAutoSave = { question, answer: Arouet.normalizeText(button.innerText).trim() };
        if (Arouet.isElementReady(button)) button.click();
      });
      return true;
    }

    Arouet.autoClick(question, clickSavedWords, () => {});
    return true;
  };
})();
