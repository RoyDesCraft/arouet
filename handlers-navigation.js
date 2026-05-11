(() => {
  const Arouet = window.Arouet;

  Arouet.getNextButton = () => {
    return [...document.querySelectorAll('button, [role="button"]')]
      .find((button) => {
        if (button.disabled) return false;
        if (!button.offsetParent && !button.getClientRects().length) return false;
        const text = button.innerText?.trim().toUpperCase();
        return text && Arouet.constants.autoNextLabels.some((label) => text === label || text.startsWith(label));
      });
  };

  Arouet.getSimpleButton = () => {
    const labels = ['CONTINUER', 'SUIVANT', 'NEXT', 'VALIDER', 'TERMINER', 'COMMENCER'];
    return [...document.querySelectorAll('[data-testid="button"]')].find((button) => {
      if (button.disabled) return false;
      if (!button.offsetParent && !button.getClientRects().length) return false;
      const text = button.querySelector('[data-testid="button-text"]')?.innerText?.trim().toUpperCase();
      return text && labels.some((label) => text === label);
    });
  };

  Arouet.maybeAutoNext = () => {
    chrome.storage.local.get('arouet_autoNext', (data) => {
      if (data.arouet_autoNext !== true) return;

      setTimeout(() => {
        const button = Arouet.getNextButton();
        if (button) button.click();
      }, Math.min(Arouet.config.nextDelay, 400));
    });
  };

  Arouet.handleGlobalNext = () => {
    if (Arouet.isClassifyRevealed?.()) return false;

    const nextButton = Arouet.findButtonByLabels(
      '[data-testid="button"], [data-testid="player-next"]',
      Arouet.constants.advanceLabels,
      Arouet.isVisible
    );

    if (!nextButton || Arouet.state.autoClickPending) return false;

    chrome.storage.local.get('arouet_autoNext', (data) => {
      if (data.arouet_autoNext !== true) return;

      Arouet.state.autoClickPending = true;
      setTimeout(() => {
        Arouet.reactClick(nextButton);
        Arouet.state.autoClickPending = false;
        Arouet.state.lastQuestion = '';
        Arouet.state.classifyRevealedKey = '';
      }, 120);
    });

    return true;
  };
})();
