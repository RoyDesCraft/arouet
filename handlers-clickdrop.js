(() => {
  const Arouet = window.Arouet;

  const getItems = () => {
    return [...document.querySelectorAll('[class*="r-bx70bn"]')]
      .filter((el) => Arouet.normalizeText(el.innerText).length > 0);
  };

  const getColumns = () => [...document.querySelectorAll('[class*="r-1niwhzg"]')];

  const looksLikeClassify = () => {
    const classifyItems = [...document.querySelectorAll('[class*="r-1537yvj"]')]
      .filter((el) => el.querySelector('[data-testid="html"]'));
    const modernItems = [...document.querySelectorAll('.r-vacyoi > div')]
      .filter((el) => el.querySelector('[data-testid="html"]'));
    return (classifyItems.length > 0 || modernItems.length > 0) && document.querySelectorAll('.r-vacyoi').length >= 2;
  };

  const placeItems = (answer) => {
    if (typeof answer !== 'object' || Array.isArray(answer)) return;

    const items = getItems();
    const columns = getColumns();
    Object.entries(answer).forEach(([itemText, columnIndex]) => {
      const item = items.find((candidate) => candidate.innerText.trim() === itemText);
      const column = columns[columnIndex];
      if (item && column && Arouet.isElementReady(item) && Arouet.isElementReady(column)) {
        item.click();
        setTimeout(() => column.click(), 100);
      }
    });
  };

  Arouet.handleClickDrop = () => {
    if (looksLikeClassify()) return false;

    const items = getItems();
    const columns = getColumns();
    if (!items.length || !columns.length) return false;

    const question = document.querySelector('[data-testid="b"]')?.innerText?.trim();
    if (!question) return false;

    const placedItems = columns.flatMap((column) => [...column.querySelectorAll('[class*="r-bx70bn"]')]);
    const revealed = placedItems.length > 0;

    if (revealed) {
      Arouet.state.autoClickPending = false;
      Arouet.clearPendingAutoSaveForQuestion(question);

      const mapping = {};
      columns.forEach((column, index) => {
        [...column.querySelectorAll('[class*="r-bx70bn"]')]
          .map((item) => item.innerText.trim())
          .filter(Boolean)
          .forEach((text) => { mapping[text] = index; });
      });

      if (Object.keys(mapping).length) {
        Arouet.saveAnswer(question, mapping, true);
        Arouet.maybeAutoNext();
      }
      return true;
    }

    if (question !== Arouet.state.lastQuestion) {
      Arouet.onNewQuestion(question);
      Arouet.autoClick(question, placeItems, () => {
        if (!items.length || !columns.length) return;
        const item = items[Math.floor(Math.random() * items.length)];
        const column = columns[Math.floor(Math.random() * columns.length)];
        if (Arouet.isElementReady(item) && Arouet.isElementReady(column)) {
          Arouet.state.pendingAutoSave = { question, answer: { [item.innerText.trim()]: columns.indexOf(column) } };
          item.click();
          setTimeout(() => column.click(), 100);
        }
      });
      return true;
    }

    Arouet.autoClick(question, placeItems, () => {});
    return true;
  };
})();
