(() => {
  const Arouet = window.Arouet ??= {};

  Arouet.constants = {
    colors: {
      duoCorrect: { r: [180, 255], g: [220, 255], b: [0, 160] },
      duoWrong: { r: [220, 255], g: [150, 220], b: [0, 160] },
      wordBar: 'rgb(190, 237, 41)',
      cdWrong: [
        'rgb(255, 219, 144)',
        'rgb(255, 150, 150)',
        'rgb(255, 191, 191)'
      ]
    },
    advanceLabels: ['CONTINUER', 'SUIVANT', 'NEXT', 'TERMINER', "C'EST PARTI", 'OK', 'CONTINUE'],
    autoNextLabels: ['SUIVANT', 'CONTINUER', 'NEXT', 'VALIDER', 'TERMINER']
  };

  Arouet.state = {
    lastQuestion: '',
    autoClickPending: false,
    debounceTimer: null,
    actionTimer: null,
    pendingSave: null,
    pendingAutoSave: null,
    classifyRevealedKey: ''
  };

  Arouet.config = {
    enabled: true,
    delays: { min: 500, max: 750 },
    nextDelay: 400,
    debounceDelay: 120
  };

  Arouet.normalizeText = (text) => (text || '')
    .replace(/[\u2018\u2019\u201A\u201B\u2032\u2035]/g, "'")
    .replace(/[\u00AB\u00BB\u201C\u201D]/g, '"')
    .replace(/[\u00A0\u202F\u2009\u200B\u200C\u200D\uFEFF]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  Arouet.normalizeKey = (text) => Arouet.normalizeText(text).toLowerCase();

  Arouet.getCurrentQuestionText = () => {
    const el = document.querySelector('[data-testid="b"], [data-testid="u"], [data-testid="i"]');
    return el?.innerText?.trim() ?? '';
  };

  Arouet.cleanText = (text) => {
    if (!text) return '';
    return text.split('\n')[0].trim().replace(/[\u200B-\u200D\uFEFF]/g, '');
  };

  Arouet.questionToKey = (text, type) => `${type || 'q'}_${Arouet.normalizeKey(text)}`;

  Arouet.getBgColor = (el) => {
    const rgb = getComputedStyle(el).backgroundColor;
    const match = rgb.match(/\d+/g);
    return match ? { r: Number(match[0]), g: Number(match[1]), b: Number(match[2]) } : null;
  };

  Arouet.inRange = (value, [min, max]) => value >= min && value <= max;

  Arouet.isElementReady = (el) => {
    if (!el) return false;
    if (el.disabled) return false;
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && el.offsetParent !== null;
  };

  Arouet.isVisible = (el) => {
    if (!el) return false;
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden' && el.offsetWidth > 0;
  };

  Arouet.randomDelay = () => {
    const { min, max } = Arouet.config.delays;
    return Math.floor(Math.random() * (max - min + 1)) + min;
  };

  Arouet.onNewQuestion = (question) => {
    Arouet.state.lastQuestion = question;
    Arouet.state.autoClickPending = false;
  };

  Arouet.commitPendingAutoSave = (currentQuestion) => {
    const pending = Arouet.state.pendingAutoSave;
    if (!pending) return;

    const currentKey = Arouet.normalizeKey(currentQuestion || Arouet.getCurrentQuestionText());
    if (!currentKey) return;

    if (Arouet.normalizeKey(pending.question) !== currentKey) {
      console.log('[Arouet] saving pending auto answer:', pending.question, '->', pending.answer);
      Arouet.saveAnswer(pending.question, pending.answer);
      Arouet.state.pendingAutoSave = null;
    }
  };

  Arouet.clearPendingAutoSaveForQuestion = (question) => {
    const pending = Arouet.state.pendingAutoSave;
    if (pending && Arouet.normalizeKey(pending.question) === Arouet.normalizeKey(question)) {
      Arouet.state.pendingAutoSave = null;
    }
  };

  Arouet.buttonText = (button) => {
    const textEl = button?.querySelector?.('[data-testid="button-text"]') || button;
    return (textEl?.innerText || '').trim().toUpperCase();
  };

  Arouet.findButtonByLabels = (selector, labels, visibilityCheck = Arouet.isVisible) => {
    return [...document.querySelectorAll(selector)].find((button) => {
      const text = Arouet.buttonText(button);
      return labels.some((label) => text.includes(label)) && visibilityCheck(button);
    });
  };

  Arouet.reactClick = (el) => {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const shared = {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      screenX: rect.left + rect.width / 2,
      screenY: rect.top + rect.height / 2
    };

    el.dispatchEvent(new PointerEvent('pointerdown', { ...shared, pointerId: 1, pointerType: 'mouse', isPrimary: true, buttons: 1 }));
    el.dispatchEvent(new MouseEvent('mousedown', { ...shared, button: 0, buttons: 1 }));
    el.dispatchEvent(new PointerEvent('pointerup', { ...shared, pointerId: 1, pointerType: 'mouse', isPrimary: true }));
    el.dispatchEvent(new MouseEvent('mouseup', { ...shared, button: 0, buttons: 0 }));
    el.dispatchEvent(new MouseEvent('click', { ...shared, button: 0, buttons: 0 }));
  };

  Arouet.stripWord = (text) => {
    return Arouet.normalizeKey(text).replace(/[^a-z\u00E0\u00E2\u00E4\u00E9\u00E8\u00EA\u00EB\u00EE\u00EF\u00F4\u00F9\u00FB\u00FC\u00FF\u0153\u00E6\u00E7']/gi, '');
  };
})();
