(() => {
  const Arouet = window.Arouet;

  chrome.storage.local.get(['arouet_enabled', 'arouet_delays', 'arouet_nextDelay', 'arouet_debounceDelay'], (data) => {
    if (data.arouet_enabled !== undefined) Arouet.config.enabled = data.arouet_enabled !== false;
    if (data.arouet_delays) Arouet.config.delays = data.arouet_delays;
    if (data.arouet_nextDelay) Arouet.config.nextDelay = data.arouet_nextDelay;
    if (data.arouet_debounceDelay) Arouet.config.debounceDelay = data.arouet_debounceDelay;
  });

  chrome.storage.onChanged.addListener((changes) => {
    if (changes.arouet_enabled) {
      Arouet.config.enabled = changes.arouet_enabled.newValue !== false;
      Arouet.state.autoClickPending = false;
      Arouet.state.pendingSave = null;
      Arouet.state.pendingAutoSave = null;
    }
    if (changes.arouet_delays) Arouet.config.delays = changes.arouet_delays.newValue;
    if (changes.arouet_nextDelay) Arouet.config.nextDelay = changes.arouet_nextDelay.newValue;
    if (changes.arouet_debounceDelay) Arouet.config.debounceDelay = changes.arouet_debounceDelay.newValue;
  });

  Arouet.saveAnswer = (questionText, answerData, force = false, type) => {
    console.log('[Arouet] Tentative de sauvegarde pour :', questionText);
    const key = Arouet.questionToKey(questionText, type);

    chrome.storage.local.get(['arouet_db', 'arouet_count', 'arouet_learn'], (data) => {
      if (data.arouet_learn === false) return;

      const db = data.arouet_db ?? {};
      const oldAnswer = db[key];
      const isNew = !oldAnswer;

      if (isNew) {
        console.log(`[Arouet] Nouvelle question ajoutee : "${questionText}"`);
      } else if (force && JSON.stringify(oldAnswer) !== JSON.stringify(answerData)) {
        console.log(`[Arouet] Question corrigee : "${questionText}"`);
      }

      if (db[key] && !force) return;

      db[key] = answerData;
      chrome.storage.local.set({
        arouet_db: db,
        arouet_count: (data.arouet_count ?? 0) + (isNew ? 1 : 0)
      });
    });
  };

  Arouet.getKnownAnswer = (questionText, callback, type) => {
    const key = Arouet.questionToKey(questionText, type);
    chrome.storage.local.get('arouet_db', (data) => {
      callback((data.arouet_db ?? {})[key] ?? null);
    });
  };

  Arouet.classifyLabelKind = (label) => {
    const key = Arouet.normalizeKey(label)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const negative = key.includes('ne sont pas')
      || key.includes('qui ne sont pas')
      || key.includes('pas des')
      || key.includes('pas de');

    if (key.includes('adjectif')) return negative ? 'not_adjective' : 'adjective';
    if (key.includes('noms communs') || key.includes('nom commun')) return negative ? 'not_common_noun' : 'common_noun';
    if (key.includes('invariable')) return negative ? 'not_invariable' : 'invariable';
    if (key.includes('variable')) return negative ? 'not_variable' : 'variable';
    return '';
  };

  Arouet.classifyColumnKey = (labels) => {
    const kinds = labels.map(Arouet.classifyLabelKind);
    return kinds.every(Boolean) ? kinds.join('|') : labels.map((label) => Arouet.normalizeKey(label)).join('|');
  };

  Arouet.migrateClassifyWords = () => {
    chrome.storage.local.get('arouet_db', (data) => {
      const db = data.arouet_db ?? {};
      let changed = false;

      Object.keys(db).forEach((key) => {
        if (key.startsWith('cw||') && typeof db[key] === 'string' && db[key].startsWith('not_')) {
          delete db[key];
          changed = true;
        }
      });

      if (changed) chrome.storage.local.set({ arouet_db: db });
    });
  };

  Arouet.deleteAnswer = (questionText, type) => {
    const key = Arouet.questionToKey(questionText, type);
    chrome.storage.local.get('arouet_db', (data) => {
      const db = data.arouet_db ?? {};
      if (!db[key]) return;
      delete db[key];
      chrome.storage.local.set({ arouet_db: db });
    });
  };

  Arouet.saveClassifyItems = (labels, mapping, force = false) => {
    const columnKey = Arouet.classifyColumnKey(labels);
    if (!columnKey || !Object.keys(mapping).length) return;

    chrome.storage.local.get(['arouet_db', 'arouet_learn'], (data) => {
      if (data.arouet_learn === false) return;

      const db = data.arouet_db ?? {};

      Object.entries(mapping).forEach(([itemText, columnIndex]) => {
        const label = labels[columnIndex];
        if (!label) return;
        const kind = Arouet.classifyLabelKind(label);
        const itemKey = `cw||${Arouet.normalizeKey(itemText)}`;
        const bucketKey = `ci||${columnKey}||${Arouet.normalizeKey(itemText)}`;

        if (force || !db[bucketKey]) {
          db[bucketKey] = { text: itemText, columnLabel: label, columnKind: kind };
        }

        if (kind && !kind.startsWith('not_') && (force || !db[itemKey])) {
          db[itemKey] = kind;
        }
      });

      chrome.storage.local.set({ arouet_db: db });
    });
  };

  Arouet.getKnownClassifyItems = (labels, itemTexts, callback) => {
    const labelIndexes = new Map(
      labels
        .map((label, index) => [Arouet.classifyLabelKind(label), index])
        .filter(([kind]) => kind)
    );

    chrome.storage.local.get('arouet_db', (data) => {
      const db = data.arouet_db ?? {};
      if (labelIndexes.size === labels.length) {
        const positiveIndex = [...labelIndexes.entries()].find(([kind]) => !kind.startsWith('not_'))?.[1] ?? 0;
        const negativeIndex = 1 - positiveIndex;
        const positiveKind = [...labelIndexes.entries()].find(([, i]) => i === positiveIndex)?.[0];

        const mapping = {};
        let knownCount = 0;

        for (const itemText of itemTexts) {
          const kind = db[`cw||${Arouet.normalizeKey(itemText)}`];
          if (kind !== undefined) {
            mapping[itemText] = kind === positiveKind ? positiveIndex : negativeIndex;
            knownCount++;
          } else {
            mapping[itemText] = Math.floor(Math.random() * labels.length);
          }
        }

        callback(knownCount > 0 ? mapping : null);
        return;
      }

      const columnKey = Arouet.classifyColumnKey(labels);
      if (!columnKey || !itemTexts.length) { callback(null); return; }

      const mapping = {};
      for (const itemText of itemTexts) {
        const saved = db[`ci||${columnKey}||${Arouet.normalizeKey(itemText)}`];
        if (!saved) { callback(null); return; }
        const idx = labels.findIndex(l => Arouet.normalizeKey(l) === Arouet.normalizeKey(saved.columnLabel));
        if (idx === -1) { callback(null); return; }
        mapping[itemText] = idx;
      }
      callback(mapping);
    });
  };

  Arouet.autoClick = (questionText, findAndClick, onUnknown, type) => {
    Arouet.getKnownAnswer(questionText, (answer) => {
      chrome.storage.local.get(['arouet_auto', 'arouet_random'], (data) => {
        if (data.arouet_auto === false) return;

        Arouet.state.autoClickPending = true;
        setTimeout(() => {
          if (!Arouet.state.autoClickPending) return;

          if (answer) {
            console.log('[Arouet] clicking known answer:', answer);
            findAndClick(answer);
            Arouet.maybeAutoNext();
          } else if (data.arouet_random === true && typeof onUnknown === 'function') {
            onUnknown();
            Arouet.maybeAutoNext();
          }

          Arouet.state.autoClickPending = false;
        }, Arouet.randomDelay());
      });
    }, type);
  };
})();

Arouet.migrateClassifyWords();