(() => {
  const Arouet = window.Arouet;

  const getNoFaultButton = () => {
    return [...document.querySelectorAll('[class*="r-1phboty"]')]
      .find((el) => Arouet.normalizeKey(el.innerText).includes('pas de faute'));
  };

  const isFaultQuestion = () => {
    const instruction = Arouet.normalizeKey(document.querySelector('[data-testid="i"]')?.innerText || '');
    return instruction.includes('faute') && !!getNoFaultButton();
  };

  const getFaultWords = () => {
    return [...document.querySelectorAll('[class*="r-11c0sde"]')]
      .filter((el) => Arouet.normalizeText(el.innerText).length > 0);
  };

  const getFaultQuestionText = () => {
    const instruction = Arouet.normalizeText(document.querySelector('[data-testid="i"]')?.innerText || '');
    const words = getFaultWords().map((word) => Arouet.normalizeText(word.innerText));
    if (!instruction || !words.length) return '';
    return `${instruction}||${words.join(' ')}`;
  };

  const getFaultWordFromDOM = () => {
    const words = getFaultWords();
    for (let index = 0; index < words.length; index++) {
      const row = words[index].closest('div[style*="flex-direction: row"]');
      if (row && row.querySelector('svg')) {
        return { text: Arouet.normalizeText(words[index].innerText), index };
      }
    }
    return null;
  };

  const isAnswerRevealed = () => {
    for (const wordButton of getFaultWords()) {
      const row = wordButton.closest('div[style*="flex-direction: row"]');
      if (row && row.querySelector('svg')) return true;
    }

    const noFault = getNoFaultButton();
    return noFault ? noFault.querySelector('button[disabled]') !== null : false;
  };

  const clickFaultWord = (answer) => {
    const isNoFault = answer.index === -1 || Arouet.normalizeKey(answer.text ?? answer).includes('pas de faute');
    if (isNoFault) {
      const outer = getNoFaultButton();
      const button = outer?.querySelector('button') ?? outer;
      if (button && Arouet.isElementReady(button)) button.click();
      return;
    }

    const text = answer.text ?? answer;
    const index = answer.index ?? -1;
    const words = getFaultWords();

    if (index >= 0 && words[index] && Arouet.stripWord(words[index].innerText) === Arouet.stripWord(text)) {
      if (Arouet.isElementReady(words[index])) words[index].click();
      return;
    }

    const fallback = words.find((word) => Arouet.stripWord(word.innerText) === Arouet.stripWord(text));
    if (fallback && Arouet.isElementReady(fallback)) fallback.click();
  };

  const savePendingFault = () => {
    if (!Arouet.state.pendingSave) return;
    Arouet.saveAnswer(Arouet.state.pendingSave.question, Arouet.state.pendingSave.answer);
    Arouet.state.pendingSave = null;
  };

  Arouet.handleClickFault = () => {
    if (!isFaultQuestion()) return false;

    const question = getFaultQuestionText();
    if (!question) return false;

    const faultyWord = getFaultWordFromDOM();
    const revealed = isAnswerRevealed();

    if (revealed) {
      savePendingFault();
      Arouet.state.autoClickPending = false;
      Arouet.clearPendingAutoSaveForQuestion(question);
      Arouet.saveAnswer(question, faultyWord || { text: "Il n'y a pas de faute", index: -1 }, true);
      Arouet.maybeAutoNext();
      return true;
    }

    if (question !== Arouet.state.lastQuestion) {
      savePendingFault();
      Arouet.onNewQuestion(question);
      Arouet.autoClick(question, (answer) => {
        Arouet.state.pendingSave = { question, answer };
        clickFaultWord(answer);
        const isNoFault = typeof answer === 'object' ? answer.index === -1 : Arouet.normalizeKey(answer).includes('pas de faute');
        if (isNoFault) Arouet.saveAnswer(question, answer);
      }, () => {
        const candidates = getFaultWords();
        if (candidates.length) candidates[Math.floor(Math.random() * candidates.length)].click();
      });
      return true;
    }

    return true;
  };
})();
