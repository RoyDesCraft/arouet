(() => {
  const Arouet = window.Arouet;

  const clickSimpleButton = () => {
    const button = Arouet.findButtonByLabels(
      '[data-testid="button"]',
      ['CONTINUER', 'SUIVANT', 'COMMENCER', 'NEXT'],
      Arouet.isElementReady
    );

    if (button && Arouet.state.lastQuestion !== 'button_clicked') {
      Arouet.state.lastQuestion = 'button_clicked';
      setTimeout(() => button.click(), Arouet.randomDelay());
      return true;
    }

    return false;
  };

  const dispatch = () => {
    if (!Arouet.config.enabled) return;
    if (Arouet.state.autoClickPending) return;
    Arouet.commitPendingAutoSave();
    if (Arouet.handleGlobalNext()) return;
    if (Arouet.handleChoice()) return;
    if (Arouet.handleClickFault()) return;
    if (Arouet.handleWord()) return;
    if (Arouet.handleClassify()) return;
    if (Arouet.handleClickDrop()) return;
    if (clickSimpleButton()) return;
  };

  const observer = new MutationObserver((mutations) => {
    clearTimeout(Arouet.state.debounceTimer);
    clearTimeout(Arouet.state.actionTimer);

    const hasStructuralChanges = mutations.some((mutation) => {
      return mutation.type === 'childList'
        || (mutation.type === 'attributes' && mutation.attributeName === 'class' && !mutation.target.style.animation);
    });

    if (hasStructuralChanges) {
      Arouet.state.debounceTimer = setTimeout(() => {
        Arouet.state.actionTimer = setTimeout(dispatch, 40);
      }, Arouet.config.debounceDelay);
    }
  });

  observer.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ['class']
  });

  setTimeout(dispatch, 600);
  console.log('[Arouet] Scripts charges.');
})();
