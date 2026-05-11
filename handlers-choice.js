(() => {
  const Arouet = window.Arouet;

  const getChoiceButtons = () => [...document.querySelectorAll('[class*="r-zo2zu6"]')];

  const getChoiceStatus = (button) => {
    const color = Arouet.getBgColor(button);
    if (!color) return 'neutral';
    const { duoCorrect, duoWrong } = Arouet.constants.colors;

    if (Arouet.inRange(color.r, duoCorrect.r) && Arouet.inRange(color.g, duoCorrect.g) && Arouet.inRange(color.b, duoCorrect.b)) return 'correct';
    if (Arouet.inRange(color.r, duoWrong.r) && Arouet.inRange(color.g, duoWrong.g) && Arouet.inRange(color.b, duoWrong.b)) return 'wrong';
    return 'neutral';
  };

  Arouet.handleChoice = () => {
    const questionEl = document.querySelector('[data-testid="b"]');
    if (!questionEl) return false;

    const question = questionEl.innerText.trim();
    const buttons = getChoiceButtons();
    if (!buttons.length) return false;

    const states = buttons.map(getChoiceStatus);
    const revealed = states.some((state) => state !== 'neutral');

    if (revealed) {
      Arouet.state.autoClickPending = false;
      Arouet.clearPendingAutoSaveForQuestion(question);

      const correctIndex = states.indexOf('correct');
      const wrongIndex = states.indexOf('wrong');

      if (correctIndex !== -1) {
        Arouet.saveAnswer(question, buttons[correctIndex].innerText.trim(), true);
      } else if (wrongIndex !== -1) {
        Arouet.deleteAnswer(question);
      }

      Arouet.maybeAutoNext();
      return true;
}

    if (question !== Arouet.state.lastQuestion) {
      Arouet.onNewQuestion(question);
      Arouet.autoClick(question, (answer) => {
        const target = getChoiceButtons().find((button) => Arouet.normalizeKey(button.innerText) === Arouet.normalizeKey(answer));
        if (target && Arouet.isElementReady(target)) target.click();
      }, () => {
        const currentButtons = getChoiceButtons();
        if (!currentButtons.length) return;
        const randomButton = currentButtons[Math.floor(Math.random() * currentButtons.length)];
        Arouet.state.pendingAutoSave = { question, answer: Arouet.normalizeText(randomButton.innerText).trim() };
        if (Arouet.isElementReady(randomButton)) randomButton.click();
      });
      return true;
    }

    Arouet.autoClick(question, (answer) => {
      const target = getChoiceButtons().find((button) => Arouet.normalizeKey(button.innerText) === Arouet.normalizeKey(answer));
      if (target && Arouet.isElementReady(target)) target.click();
    }, () => {});
    return true;
  };
})();
