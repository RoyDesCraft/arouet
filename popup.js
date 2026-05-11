function refresh() {
  chrome.storage.local.get(['arouet_count', 'arouet_auto', 'arouet_learn', 'arouet_autoNext', 'arouet_random', 'arouet_delays', 'arouet_nextDelay', 'arouet_debounceDelay'], (data) => {
    document.getElementById('count').textContent = data.arouet_count ?? 0;
    document.getElementById('toggle-auto').checked = data.arouet_auto !== false;
    document.getElementById('toggle-learn').checked = data.arouet_learn !== false;
    document.getElementById('toggle-auto-next').checked = data.arouet_autoNext === true;
    document.getElementById('toggle-random').checked = data.arouet_random === true;
    
    const delays = data.arouet_delays ?? { min: 500, max: 750 };
    document.getElementById('delay-min').value = delays.min;
    document.getElementById('delay-max').value = delays.max;
    
    document.getElementById('next-delay').value = data.arouet_nextDelay ?? 1500;
    document.getElementById('debounce-delay').value = data.arouet_debounceDelay ?? 120;
  });
}

document.getElementById('toggle-auto').addEventListener('change', e => {
  chrome.storage.local.set({ arouet_auto: e.target.checked });
});
document.getElementById('toggle-learn').addEventListener('change', e => {
  chrome.storage.local.set({ arouet_learn: e.target.checked });
});
document.getElementById('toggle-auto-next').addEventListener('change', e => {
  chrome.storage.local.set({ arouet_autoNext: e.target.checked });
});
document.getElementById('toggle-random').addEventListener('change', e => {
  chrome.storage.local.set({ arouet_random: e.target.checked });
});

['delay-min', 'delay-max'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    const min = Math.max(0, parseInt(document.getElementById('delay-min').value) || 0);
    const max = Math.max(min, parseInt(document.getElementById('delay-max').value) || 0);
    chrome.storage.local.set({ arouet_delays: { min, max } });
  });
});

document.getElementById('next-delay').addEventListener('input', e => {
  const value = Math.max(0, parseInt(e.target.value) || 0);
  chrome.storage.local.set({ arouet_nextDelay: value });
});

document.getElementById('debounce-delay').addEventListener('input', e => {
  const value = Math.max(0, parseInt(e.target.value) || 0);
  chrome.storage.local.set({ arouet_debounceDelay: value });
});

document.getElementById('btn-clear').addEventListener('click', () => {
  if (confirm('Effacer toutes les réponses mémorisées ?')) {
    chrome.storage.local.set({ arouet_db: {}, arouet_count: 0 }, refresh);
  }
});

document.getElementById('btn-export').addEventListener('click', () => {
  chrome.storage.local.get(['arouet_db', 'arouet_count'], (data) => {
    const payload = JSON.stringify({ db: data.arouet_db ?? {}, count: data.arouet_count ?? 0 }, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arouet-export-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
});

document.getElementById('btn-import').addEventListener('click', () => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target.result);
        if (!parsed.db || typeof parsed.db !== 'object') throw new Error('Format invalide');
        chrome.storage.local.get('arouet_db', (data) => {
          const merged = { ...parsed.db, ...(data.arouet_db ?? {}) };
          const count = Object.keys(merged).length;
          chrome.storage.local.set({ arouet_db: merged, arouet_count: count }, () => {
            refresh();
            alert(`✅ Import réussi — ${count} questions au total.`);
          });
        });
      } catch (err) {
        alert('❌ Fichier invalide : ' + err.message);
      }
    };
    reader.readAsText(file);
  };
  input.click();
});

refresh();
