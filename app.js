// ============================================================================
// APP.JS — Game Engine, Web MIDI, Dynamische Hand-Split, 150ms Hold & Vrij Spel
// ============================================================================

// Actieve grondtonen (standaard alle 12 aan)
window.activeRoots = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

// Huidige ingedrukte MIDI-noten (zowel via fysieke MIDI-piano als schermklavier)
window.pressedMidis = new Set();

// Spelstatus
window.currentQuestions = [];
window.currentQuestionIndex = 0;
window.currentGameMode = null; // 'daily', 'daily_archive', 'iiVI', 'retry', 'free', 10, 20, 50
window.currentDailyDateStr = null;
window.lastRegularGameMode = 10;
window.lastFreePlaySignature = '';

// Timers & 150ms Hold-validatie
window.gameStartTime = 0;
window.chordStartTime = 0;
window.timerIntervalId = null;
window.isTransitioningChord = false;

window.HOLD_DURATION_MS = 150;
window.holdStartTime = null;
window.holdRafId = null;

// Statistische logging per akkoord voor de "3 Traagste Akkoorden" analyse
window.sessionChordLogs = [];
window.slowestRetryQueue = [];

// Screen Wake Lock
window.wakeLockSentinel = null;

// ============================================================================
// 1. INITIALISATIE BIJ OPSTARTEN
// ============================================================================
window.addEventListener('DOMContentLoaded', () => {
  window.renderRootFilterChips();
  window.updatePoolSummary();
  window.buildVirtualPiano(36, 84); // C2 (36) t/m C6 (84)
  window.syncPlayerNameUI();
  window.refreshDailyCardUI();
  window.refreshAllLocalPRBadges();
  window.loadDailyLeaderboardForCurrentOffset();
  window.initMIDI(false);
  window.registerServiceWorker();
});

window.registerServiceWorker = function () {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
};

// ============================================================================
// 2. SCREEN WAKE LOCK (Houdt scherm van telefoon/tablet aan tijdens spelen)
// ============================================================================
window.requestWakeLock = async function () {
  const badge = document.getElementById('wakeLockBadge');
  const text = document.getElementById('wakeLockText');
  if (!('wakeLock' in navigator)) return;

  try {
    window.wakeLockSentinel = await navigator.wakeLock.request('screen');
    if (badge) badge.classList.remove('hidden');
    if (text) text.textContent = 'Scherm Actief';
  } catch (e) {
    // Stil negeren als batterijbesparing Wake Lock weigert
  }
};

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !document.getElementById('gameScreen').classList.contains('hidden')) {
    window.requestWakeLock();
  }
});

// ============================================================================
// 3. WEB MIDI API KOPPELING
// ============================================================================
window.midiAccess = null;

window.initMIDI = async function (manualClick = false) {
  const dot = document.getElementById('midiStatusDot');
  const txt = document.getElementById('midiStatusText');

  if (!navigator.requestMIDIAccess) {
    if (txt) txt.textContent = 'Geen Web MIDI (Gebruik Schermklavier)';
    if (dot) dot.className = 'w-2 h-2 rounded-full bg-rose-400';
    return;
  }

  try {
    window.midiAccess = await navigator.requestMIDIAccess({ sysex: false });
    window.bindMidiInputs();
    window.midiAccess.onstatechange = () => window.bindMidiInputs();
  } catch (err) {
    if (txt) txt.textContent = 'MIDI Geweigerd';
    if (dot) dot.className = 'w-2 h-2 rounded-full bg-rose-400';
    if (manualClick) {
      alert('Geef in je browser toestemming voor MIDI-apparaten en controleer je USB-kabel.');
    }
  }
};

window.bindMidiInputs = function () {
  if (!window.midiAccess) return;
  const inputs = Array.from(window.midiAccess.inputs.values());
  const btn = document.getElementById('midiStatusBtn');
  const dot = document.getElementById('midiStatusDot');
  const txt = document.getElementById('midiStatusText');

  inputs.forEach((input) => {
    input.onmidimessage = window.handleMidiMessage;
  });

  if (inputs.length > 0) {
    const firstName = inputs[0].name || 'MIDI Piano';
    if (txt) txt.textContent = `MIDI: ${firstName}`;
    if (dot) dot.className = 'w-2 h-2 rounded-full bg-emerald-400';
    if (btn) {
      btn.className =
        'flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 transition';
    }
  } else {
    if (txt) txt.textContent = 'Sluit USB-MIDI Piano aan';
    if (dot) dot.className = 'w-2 h-2 rounded-full bg-amber-400 animate-pulse';
    if (btn) {
      btn.className =
        'flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/30 transition';
    }
  }
};

window.handleMidiMessage = function (event) {
  const [status, data1, data2] = event.data;
  const command = status & 0xf0;

  if (command === 0x90 && data2 > 0) {
    window.pressedMidis.add(data1);
    window.onActiveNotesChanged();
  } else if (command === 0x80 || (command === 0x90 && data2 === 0)) {
    window.pressedMidis.delete(data1);
    window.onActiveNotesChanged();
  }
};

// ============================================================================
// 4. STARTSCHERM: CONFIGURATIE, PRESETS & GRONDTOON-CHIPS
// ============================================================================
window.renderRootFilterChips = function () {
  const container = document.getElementById('rootFilterContainer');
  if (!container) return;

  container.innerHTML = window.ROOT_DISPLAY_NAMES.map((name, pc) => {
    const isActive = window.activeRoots.has(pc);
    return `
      <button
        type="button"
        onclick="window.toggleRootPc(${pc})"
        class="py-1.5 px-2 rounded-xl text-xs font-extrabold mono border transition ${
          isActive ? 'chip-active' : 'chip-inactive'
        }"
      >
        ${name}
      </button>
    `;
  }).join('');
};

window.toggleRootPc = function (pc) {
  if (window.activeRoots.has(pc)) {
    if (window.activeRoots.size <= 1) return;
    window.activeRoots.delete(pc);
  } else {
    window.activeRoots.add(pc);
  }
  window.renderRootFilterChips();
  window.updatePoolSummary();
};

window.toggleAllRoots = function (enableAll = true) {
  if (enableAll) {
    for (let i = 0; i < 12; i++) window.activeRoots.add(i);
  }
  window.renderRootFilterChips();
  window.updatePoolSummary();
};

window.toggleWhiteRootsOnly = function () {
  window.activeRoots = new Set(window.WHITE_KEY_ROOTS);
  window.renderRootFilterChips();
  window.updatePoolSummary();
};

window.applyChordPreset = function (presetName) {
  const maj = document.getElementById('cat_major');
  const min = document.getElementById('cat_minor');
  const dim = document.getElementById('cat_dim');
  const aug = document.getElementById('cat_aug');
  const sev = document.getElementById('cat_sevenths');
  const ext = document.getElementById('cat_extensions');

  if (presetName === 'triads') {
    maj.checked = true;
    min.checked = true;
    dim.checked = true;
    aug.checked = true;
    sev.checked = false;
    ext.checked = false;
  } else if (presetName === 'standard') {
    maj.checked = true;
    min.checked = true;
    dim.checked = true;
    aug.checked = true;
    sev.checked = true;
    ext.checked = false;
  } else if (presetName === 'sevOnly') {
    maj.checked = false;
    min.checked = false;
    dim.checked = false;
    aug.checked = false;
    sev.checked = true;
    ext.checked = false;
  } else if (presetName === 'all') {
    maj.checked = true;
    min.checked = true;
    dim.checked = true;
    aug.checked = true;
    sev.checked = true;
    ext.checked = true;
  }
  window.updatePoolSummary();
};

window.getSelectedChordDefinitions = function () {
  const defs = [];
  if (document.getElementById('cat_major')?.checked) defs.push(...window.CHORD_TYPES.major);
  if (document.getElementById('cat_minor')?.checked) defs.push(...window.CHORD_TYPES.minor);
  if (document.getElementById('cat_dim')?.checked) defs.push(...window.CHORD_TYPES.dim);
  if (document.getElementById('cat_aug')?.checked) defs.push(...window.CHORD_TYPES.aug);
  if (document.getElementById('cat_sevenths')?.checked) defs.push(...window.CHORD_TYPES.sevenths);
  if (document.getElementById('cat_extensions')?.checked) defs.push(...window.CHORD_TYPES.extensions);
  return defs;
};

window.updatePoolSummary = function () {
  const defs = window.getSelectedChordDefinitions();
  const count = defs.length * window.activeRoots.size;
  const badge = document.getElementById('poolSummaryBadge');
  if (!badge) return;

  if (count === 0) {
    badge.textContent = '⚠️ Kies minimaal 1 akkoordcategorie';
    badge.className = 'text-[11px] font-semibold text-rose-300 bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 rounded-lg';
  } else {
    badge.textContent = `Pool: ${count} mogelijke akkoorden (${defs.length} types × ${window.activeRoots.size} toonsoorten)`;
    badge.className = 'text-[11px] font-semibold text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-0.5 rounded-lg';
  }
};

window.generateNextRandomUserQuestion = function () {
  const selectedDefs = window.getSelectedChordDefinitions();
  const rootsArr = Array.from(window.activeRoots);

  let rootPc = rootsArr[Math.floor(Math.random() * rootsArr.length)];
  let def = selectedDefs[Math.floor(Math.random() * selectedDefs.length)];
  let sig = `${rootPc}_${def.id}`;

  if (sig === window.lastFreePlaySignature && (rootsArr.length > 1 || selectedDefs.length > 1)) {
    rootPc = rootsArr[(rootsArr.indexOf(rootPc) + 1) % rootsArr.length];
    def = selectedDefs[(selectedDefs.indexOf(def) + 1) % selectedDefs.length];
    sig = `${rootPc}_${def.id}`;
  }

  window.lastFreePlaySignature = sig;
  return window.buildChordQuestion(rootPc, def, Math.random);
};

// ============================================================================
// 5. VIRTUEEL KLAVIER (Zonder vaste C4-split!)
// ============================================================================
window.buildVirtualPiano = function (startMidi = 36, endMidi = 84) {
  const container = document.getElementById('pianoKeyboard');
  if (!container) return;
  container.innerHTML = '';

  const isBlackPc = new Set([1, 3, 6, 8, 10]);
  const whiteMidis = [];

  for (let m = startMidi; m <= endMidi; m++) {
    if (!isBlackPc.has(m % 12)) whiteMidis.push(m);
  }

  const totalWhite = whiteMidis.length;

  whiteMidis.forEach((midi) => {
    const keyEl = document.createElement('div');
    keyEl.className = 'white-key';
    keyEl.dataset.midi = String(midi);
    keyEl.onclick = () => window.toggleScreenMidiNote(midi);

    const noteName = window.midiToNoteName(midi, 0);
    const showLabel = midi % 12 === 0 || midi === startMidi || midi === endMidi;
    keyEl.innerHTML = `<span class="key-label">${showLabel ? noteName : ''}</span>`;
    container.appendChild(keyEl);
  });

  let whiteIndex = 0;
  for (let m = startMidi; m <= endMidi; m++) {
    const pc = m % 12;
    if (!isBlackPc.has(pc)) {
      whiteIndex++;
    } else {
      const blackEl = document.createElement('div');
      blackEl.className = 'black-key';
      blackEl.dataset.midi = String(m);
      blackEl.onclick = (e) => {
        e.stopPropagation();
        window.toggleScreenMidiNote(m);
      };

      const leftPercent = (whiteIndex / totalWhite) * 100 - 1.55;
      blackEl.style.left = `${leftPercent}%`;
      blackEl.innerHTML = `<span class="key-label">${window.NOTE_NAMES_FLAT[pc]}</span>`;
      container.appendChild(blackEl);
    }
  }
};

window.toggleScreenMidiNote = function (midi) {
  if (window.pressedMidis.has(midi)) {
    window.pressedMidis.delete(midi);
  } else {
    window.pressedMidis.add(midi);
    window.playMidiNotesAudio([midi], 0.55);
  }
  window.onActiveNotesChanged();
};

window.clearScreenKeys = function () {
  window.pressedMidis.clear();
  window.cancelHoldTimer();
  window.onActiveNotesChanged();
};

// ============================================================================
// 6. DYNAMISCHE HAND-SPLIT (Laagste N noten = Links, Hoogste N = Rechts)
// ============================================================================
window.splitPressedNotesDynamically = function (sortedMidis, handSize) {
  const total = sortedMidis.length;
  if (total === 0) return { lhMidis: [], rhMidis: [] };

  if (total <= handSize) {
    return {
      lhMidis: sortedMidis.slice(0, handSize),
      rhMidis: []
    };
  }

  return {
    lhMidis: sortedMidis.slice(0, handSize),
    rhMidis: sortedMidis.slice(handSize)
  };
};

// ============================================================================
// 7. SPELMODI STARTEN (Met compacte smartphone Fullscreen modus)
// ============================================================================
window.setCompactGameViewport = function (isActive) {
  const headerEl = document.getElementById('appHeader');
  if (isActive) {
    document.body.classList.add('in-game-mode');
    if (headerEl) headerEl.classList.add('hidden');
  } else {
    document.body.classList.remove('in-game-mode');
    if (headerEl) headerEl.classList.remove('hidden');
  }
};

window.startGame = function (mode, customArchiveDate = null) {
  window.ensureAudioContext();
  window.requestWakeLock();
  window.pressedMidis.clear();
  window.cancelHoldTimer();
  window.sessionChordLogs = [];
  window.currentQuestionIndex = 0;
  window.isTransitioningChord = false;
  window.lastFreePlaySignature = '';

  const finishFreeBtn = document.getElementById('finishFreePlayBtn');
  if (finishFreeBtn) finishFreeBtn.classList.add('hidden');

  // 1. Officiële Daily Challenge van vandaag
  if (mode === 'daily') {
    if (window.hasPlayedDailyToday()) {
      alert('Je hebt de officiële Daily Challenge van vandaag al gespeeld! Bekijk het klassement of oefen een eerdere dag via het archief.');
      return;
    }
    const todayStr = window.getTodayDateString();
    window.currentGameMode = 'daily';
    window.currentDailyDateStr = todayStr;
    window.currentQuestions = window.generateDailyQuestions(todayStr);
    window.markDailyPlayedToday();
  }
  // 2. Gemiste Daily uit het archief oefenen (buiten mededinging)
  else if (mode === 'daily_archive' && customArchiveDate) {
    window.currentGameMode = 'daily_archive';
    window.currentDailyDateStr = customArchiveDate;
    window.currentQuestions = window.generateDailyQuestions(customArchiveDate);
  }
  // 3. Blinde ii-V-I Progressie (12 akkoorden: 4 toonsoorten x 3 trappen)
  else if (mode === 'iiVI') {
    window.currentGameMode = 'iiVI';
    window.lastRegularGameMode = 'iiVI';
    const useSevenths = document.getElementById('cat_sevenths')?.checked ?? true;
    const rootsArr = Array.from(window.activeRoots);
    window.currentQuestions = window.generateIIVIQuestions(rootsArr, useSevenths);
  }
  // 4. Focus-herkansing van jouw 3 traagste akkoorden (6 opgaven)
  else if (mode === 'retry' && window.slowestRetryQueue.length > 0) {
    window.currentGameMode = 'retry';
    window.currentQuestions = [...window.slowestRetryQueue];
  }
  // 5. Vrij Spel (Eindeloos / Zen Modus)
  else if (mode === 'free') {
    const selectedDefs = window.getSelectedChordDefinitions();
    if (selectedDefs.length === 0) {
      alert('Vink in Stap 1 minimaal één akkoordcategorie aan om Vrij Spel te starten!');
      return;
    }
    window.currentGameMode = 'free';
    window.lastRegularGameMode = 'free';
    window.currentQuestions = [window.generateNextRandomUserQuestion()];
    if (finishFreeBtn) finishFreeBtn.classList.remove('hidden');
  }
  // 6. Reguliere Sprints (10, 20 of 50 akkoorden op eigen niveau)
  else {
    const count = Number(mode) || 10;
    const selectedDefs = window.getSelectedChordDefinitions();
    if (selectedDefs.length === 0) {
      alert('Vink in Stap 1 minimaal één akkoordcategorie aan om te starten!');
      return;
    }

    window.currentGameMode = count;
    window.lastRegularGameMode = count;
    const questions = [];
    for (let i = 0; i < count; i++) {
      questions.push(window.generateNextRandomUserQuestion());
    }
    window.currentQuestions = questions;
  }

  // Wissel naar het compacte 100dvh speelscherm
  window.setCompactGameViewport(true);
  document.getElementById('startScreen').classList.add('hidden');
  document.getElementById('endScreen').classList.add('hidden');
  document.getElementById('gameScreen').classList.remove('hidden');

  window.updateGameModeBadge();
  window.loadCurrentQuestionUI();

  window.gameStartTime = performance.now();
  window.chordStartTime = performance.now();
  if (window.timerIntervalId) clearInterval(window.timerIntervalId);
  window.timerIntervalId = setInterval(window.updateLiveTimers, 80);
};

window.finishFreePlaySession = function () {
  if (window.sessionChordLogs.length === 0) {
    window.returnToMenu();
  } else {
    window.finishGameSession();
  }
};

window.practiceArchivedDaily = function () {
  const dateStr = window.getDateStringWithOffset(window.leaderboardDayOffset);
  window.startGame('daily_archive', dateStr);
};

window.replayLastMode = function () {
  if (window.currentGameMode === 'daily') {
    window.startGame(10);
  } else if (window.currentGameMode === 'daily_archive' && window.currentDailyDateStr) {
    window.startGame('daily_archive', window.currentDailyDateStr);
  } else if (window.currentGameMode === 'retry') {
    window.startSlowestRetry();
  } else {
    window.startGame(window.lastRegularGameMode || 10);
  }
};

window.returnToMenu = function () {
  if (window.timerIntervalId) clearInterval(window.timerIntervalId);
  window.cancelHoldTimer();
  window.pressedMidis.clear();

  window.setCompactGameViewport(false);
  document.getElementById('gameScreen').classList.add('hidden');
  document.getElementById('endScreen').classList.add('hidden');
  document.getElementById('startScreen').classList.remove('hidden');

  window.refreshDailyCardUI();
  window.refreshAllLocalPRBadges();
  window.loadDailyLeaderboardForCurrentOffset();
};

window.updateGameModeBadge = function () {
  const badge = document.getElementById('gameModeBadge');
  if (!badge) return;

  if (window.currentGameMode === 'daily') {
    badge.textContent = `🔥 Daily`;
    badge.className = 'hidden sm:inline-block text-[10px] sm:text-xs font-extrabold px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30';
  } else if (window.currentGameMode === 'daily_archive') {
    badge.textContent = `🕹️ Archief`;
    badge.className = 'hidden sm:inline-block text-[10px] sm:text-xs font-extrabold px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30';
  } else if (window.currentGameMode === 'iiVI') {
    badge.textContent = '🎷 ii–V–I';
    badge.className = 'hidden sm:inline-block text-[10px] sm:text-xs font-extrabold px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30';
  } else if (window.currentGameMode === 'retry') {
    badge.textContent = '🎯 Herkansing';
    badge.className = 'hidden sm:inline-block text-[10px] sm:text-xs font-extrabold px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30';
  } else if (window.currentGameMode === 'free') {
    badge.textContent = '♾️ Vrij Spel';
    badge.className = 'hidden sm:inline-block text-[10px] sm:text-xs font-extrabold px-2 py-0.5 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30';
  } else {
    badge.textContent = `⚡ Sprint (${window.currentGameMode})`;
    badge.className = 'hidden sm:inline-block text-[10px] sm:text-xs font-extrabold px-2 py-0.5 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-500/30';
  }
};

// ============================================================================
// 8. HUIDIGE OPGAVE TONEN OP HET SPEELSCHERM
// ============================================================================
window.loadCurrentQuestionUI = function () {
  const q = window.currentQuestions[window.currentQuestionIndex];
  if (!q) return;

  window.chordStartTime = performance.now();
  window.cancelHoldTimer();

  const solBox = document.getElementById('solutionRevealBox');
  if (solBox) {
    solBox.classList.add('hidden');
    solBox.innerHTML = '';
  }
  document.querySelectorAll('.hint-lh, .hint-rh').forEach((el) => {
    el.classList.remove('hint-lh', 'hint-rh');
  });

  const counterEl = document.getElementById('progressCounter');
  if (counterEl) {
    if (window.currentGameMode === 'free') {
      counterEl.textContent = `#${window.currentQuestionIndex + 1} (♾️)`;
    } else {
      counterEl.textContent = `${window.currentQuestionIndex + 1} / ${window.currentQuestions.length}`;
    }
  }

  const catTag = document.getElementById('chordCategoryTag');
  const titleEl = document.getElementById('targetChordTitle');
  const subEl = document.getElementById('targetChordSubtitle');

  const lhTarget = document.getElementById('lhTargetLabel');
  const lhHint = document.getElementById('lhSubHint');
  const rhTarget = document.getElementById('rhTargetLabel');
  const rhHint = document.getElementById('rhSubHint');

  // MODUS A: BLINDE ii - V - I
  if (q.isBlindIIVI) {
    if (catTag) {
      catTag.textContent = `🎹 Toonsoort: ${q.keyCenterName} • Trap ${q.romanStepIndex}/3`;
      catTag.className =
        'text-[10px] sm:text-xs font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-purple-500/25 text-purple-200 border border-purple-400/40';
    }
    if (titleEl) titleEl.textContent = q.romanLabel;
    if (subEl) {
      subEl.textContent = `Speel de ${q.romanLabel.split(' ')[0]} in ${q.keyCenterName} (${q.handSize} noten/hand)`;
    }

    if (lhTarget) lhTarget.textContent = 'Vrije Inversie';
    if (lhHint) lhHint.textContent = `Alle liggingen (${q.handSize} noten)`;
    if (rhTarget) rhTarget.textContent = 'Vrije Inversie';
    if (rhHint) rhHint.textContent = `Alle liggingen (${q.handSize} noten)`;
  }
  // MODUS B: HYBRIDE SLASH-CHORDS (Further Extensions 9, 11, 13)
  else if (q.mode === 'slash') {
    if (catTag) {
      catTag.textContent = `Slash • ${q.chordDef.name} (Bevat ${q.requiredLabel}: ${q.requiredNoteName})`;
      catTag.className =
        'text-[10px] sm:text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30';
    }
    if (titleEl) titleEl.textContent = q.symbol;
    if (subEl) {
      subEl.textContent = `4 akkoordtonen per hand (incl. ${q.requiredNoteName}) met gevraagde bas onderop`;
    }

    if (lhTarget) lhTarget.textContent = q.lhSlashLabel;
    if (lhHint) lhHint.textContent = `Bas = ${q.lhBassName} (+ ${q.requiredNoteName})`;
    if (rhTarget) rhTarget.textContent = q.rhSlashLabel;
    if (rhHint) rhHint.textContent = `Bas = ${q.rhBassName} (+ ${q.requiredNoteName})`;
  }
  // MODUS C: KLASSIEKE INVERSIES (Drieklanken & Sevenths)
  else {
    if (catTag) {
      catTag.textContent = `${q.chordDef.name} • ${q.handSize} noten/hand`;
      catTag.className =
        'text-[10px] sm:text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-800 text-indigo-300 border border-slate-700';
    }
    if (titleEl) titleEl.textContent = q.symbol;
    const allNoteNames = q.allowedPcs.map((pc) => window.pcToNoteName(pc, q.rootPc)).join(' – ');
    if (subEl) {
      subEl.textContent = `Akkoordtonen: ${allNoteNames}`;
    }

    if (lhTarget) lhTarget.textContent = q.lhInvLabel;
    if (lhHint) lhHint.textContent = q.lhDegreeHint;
    if (rhTarget) rhTarget.textContent = q.rhInvLabel;
    if (rhHint) rhHint.textContent = q.rhDegreeHint;
  }

  window.onActiveNotesChanged();
};

// ============================================================================
// 9. REAL-TIME AANSLAG CONTROLE + 150MS HOLD TIMER
// ============================================================================
window.onActiveNotesChanged = function () {
  const sortedMidis = Array.from(window.pressedMidis).sort((a, b) => a - b);
  const countLabel = document.getElementById('pressedCountLabel');
  if (countLabel) {
    countLabel.textContent = `${sortedMidis.length} actief`;
  }

  const gameHidden = document.getElementById('gameScreen')?.classList.contains('hidden');
  const q = window.currentQuestions[window.currentQuestionIndex];
  const handSize = q ? q.handSize : 4;

  const { lhMidis, rhMidis } = window.splitPressedNotesDynamically(sortedMidis, handSize);

  window.updateVirtualPianoHighlights(lhMidis, rhMidis, false);

  if (gameHidden || !q || window.isTransitioningChord) return;

  const lhResult = window.validateSingleHand(lhMidis, q, false);
  const rhResult = window.validateSingleHand(rhMidis, q, true);

  window.updateHandCardFeedback('lh', lhMidis, lhResult, q.rootPc);
  window.updateHandCardFeedback('rh', rhMidis, rhResult, q.rootPc);

  const handsDoNotOverlap =
    lhMidis.length === handSize &&
    rhMidis.length === handSize &&
    lhMidis[lhMidis.length - 1] < rhMidis[0];

  if (lhResult.valid && rhResult.valid && handsDoNotOverlap) {
    window.updateVirtualPianoHighlights(lhMidis, rhMidis, true);
    window.startHoldTimerIfNeeded();
  } else {
    window.cancelHoldTimer();
  }
};

window.updateHandCardFeedback = function (prefix, handMidis, validationResult, rootPc) {
  const card = document.getElementById(`${prefix}Card`);
  const badge = document.getElementById(`${prefix}StatusBadge`);
  const notesEl = document.getElementById(`${prefix}PlayedNotes`);

  if (notesEl) {
    notesEl.textContent =
      handMidis.length > 0
        ? `${handMidis.map((m) => window.midiToNoteName(m, rootPc)).join('–')}`
        : 'Ingedrukt: —';
  }

  if (badge) {
    badge.textContent = validationResult.statusText;
    if (validationResult.tone === 'success') {
      badge.className = 'text-[9px] sm:text-xs font-extrabold px-1.5 py-0.5 rounded bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 truncate max-w-full';
    } else if (validationResult.tone === 'error') {
      badge.className = 'text-[9px] sm:text-xs font-bold px-1.5 py-0.5 rounded bg-rose-500/25 text-rose-300 border border-rose-500/40 truncate max-w-full';
    } else if (validationResult.tone === 'pending') {
      badge.className = 'text-[9px] sm:text-xs font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-200 border border-amber-500/30 truncate max-w-full';
    } else {
      badge.className = 'text-[9px] sm:text-xs font-bold px-1.5 py-0.5 rounded bg-slate-900/90 text-slate-300 border border-slate-700 truncate max-w-full';
    }
  }

  if (card) {
    const isLeft = prefix === 'lh';
    if (validationResult.tone === 'success') {
      card.className = 'rounded-xl p-2 sm:p-3 bg-emerald-950/40 border-2 border-emerald-400/70 transition shadow-md flex flex-col justify-between';
    } else if (validationResult.tone === 'error') {
      card.className = 'rounded-xl p-2 sm:p-3 bg-rose-950/35 border border-rose-500/50 transition flex flex-col justify-between';
    } else {
      card.className = isLeft
        ? 'rounded-xl p-2 sm:p-3 bg-blue-950/35 border border-blue-500/30 transition flex flex-col justify-between'
        : 'rounded-xl p-2 sm:p-3 bg-purple-950/35 border border-purple-500/30 transition flex flex-col justify-between';
    }
  }
};

window.updateVirtualPianoHighlights = function (lhMidis, rhMidis, bothCorrect = false) {
  const lhSet = new Set(lhMidis);
  const rhSet = new Set(rhMidis);

  document.querySelectorAll('#pianoKeyboard [data-midi]').forEach((keyEl) => {
    const m = Number(keyEl.dataset.midi);
    keyEl.classList.remove('active-lh', 'active-rh', 'active-correct');

    if (bothCorrect && (lhSet.has(m) || rhSet.has(m))) {
      keyEl.classList.add('active-correct');
    } else if (lhSet.has(m)) {
      keyEl.classList.add('active-lh');
    } else if (rhSet.has(m)) {
      keyEl.classList.add('active-rh');
    }
  });
};

// 150ms Hold-Timer implementatie
window.startHoldTimerIfNeeded = function () {
  if (window.holdStartTime !== null || window.isTransitioningChord) return;

  window.holdStartTime = performance.now();
  const container = document.getElementById('holdProgressContainer');
  const bar = document.getElementById('holdProgressBar');
  if (container) container.style.opacity = '1';

  const tick = (now) => {
    if (window.holdStartTime === null) return;
    const elapsed = now - window.holdStartTime;
    const pct = Math.min(100, (elapsed / window.HOLD_DURATION_MS) * 100);
    if (bar) bar.style.width = `${pct}%`;

    if (elapsed >= window.HOLD_DURATION_MS) {
      window.cancelHoldTimer();
      window.handleChordCompleted();
    } else {
      window.holdRafId = requestAnimationFrame(tick);
    }
  };

  window.holdRafId = requestAnimationFrame(tick);
};

window.cancelHoldTimer = function () {
  window.holdStartTime = null;
  if (window.holdRafId) {
    cancelAnimationFrame(window.holdRafId);
    window.holdRafId = null;
  }
  const container = document.getElementById('holdProgressContainer');
  const bar = document.getElementById('holdProgressBar');
  if (container) container.style.opacity = '0';
  if (bar) bar.style.width = '0%';
};

// ============================================================================
// 10. AKKOORD GOEDGEKEURD -> LOG TIJD & DOOR NAAR VOLGENDE (INCL. VRIJ SPEL)
// ============================================================================
window.handleChordCompleted = function () {
  if (window.isTransitioningChord) return;
  window.isTransitioningChord = true;

  const q = window.currentQuestions[window.currentQuestionIndex];
  const durationMs = performance.now() - window.chordStartTime;

  window.sessionChordLogs.push({
    question: q,
    durationMs,
    displayTitle: q.isBlindIIVI
      ? `${q.keyCenterName}: ${q.romanLabel.split(' ')[0]} (${q.symbol})`
      : q.symbol,
    displaySub:
      q.mode === 'slash'
        ? `LH: ${q.lhSlashLabel} • RH: ${q.rhSlashLabel}`
        : q.isBlindIIVI
        ? 'Vrije Inversie'
        : `LH: ${q.lhInvLabel} • RH: ${q.rhInvLabel}`
  });

  if (q.isBlindIIVI) {
    const titleEl = document.getElementById('targetChordTitle');
    if (titleEl) {
      titleEl.textContent = `${q.romanLabel} → ${q.symbol} ✅`;
    }
  }

  setTimeout(() => {
    window.pressedMidis.clear();
    window.currentQuestionIndex++;

    if (window.currentGameMode === 'free') {
      window.currentQuestions.push(window.generateNextRandomUserQuestion());
      window.isTransitioningChord = false;
      window.loadCurrentQuestionUI();
      return;
    }

    if (window.currentQuestionIndex >= window.currentQuestions.length) {
      window.finishGameSession();
    } else {
      window.isTransitioningChord = false;
      window.loadCurrentQuestionUI();
    }
  }, 240);
};

// ============================================================================
// 11. HULPKNOPPEN TIJDENS HET SPELEN (Oplossing, Beluister & Test Greep)
// ============================================================================
window.showCurrentSolution = function () {
  const q = window.currentQuestions[window.currentQuestionIndex];
  if (!q) return;

  const lhMidis = window.buildHandSolutionMidis(q, false);
  const rhMidis = window.buildHandSolutionMidis(q, true);

  const lhNames = lhMidis.map((m) => window.midiToNoteName(m, q.rootPc)).join('–');
  const rhNames = rhMidis.map((m) => window.midiToNoteName(m, q.rootPc)).join('–');

  document.querySelectorAll('#pianoKeyboard [data-midi]').forEach((el) => {
    const m = Number(el.dataset.midi);
    el.classList.remove('hint-lh', 'hint-rh');
    if (lhMidis.includes(m)) el.classList.add('hint-lh');
    if (rhMidis.includes(m)) el.classList.add('hint-rh');
  });

  if (q.isBlindIIVI) {
    const titleEl = document.getElementById('targetChordTitle');
    if (titleEl) titleEl.textContent = `${q.romanLabel} → ${q.symbol}`;
  }

  const solBox = document.getElementById('solutionRevealBox');
  if (solBox) {
    solBox.classList.remove('hidden');
    solBox.innerHTML = `
      <div><strong>💡 ${q.symbol}:</strong> <span class="text-blue-300">L:</span> ${lhNames} | <span class="text-purple-300">R:</span> ${rhNames}</div>
    `;
  }
};

window.playCurrentChordAudio = function () {
  const q = window.currentQuestions[window.currentQuestionIndex];
  if (!q) return;
  const lhMidis = window.buildHandSolutionMidis(q, false);
  const rhMidis = window.buildHandSolutionMidis(q, true);
  window.playMidiNotesAudio([...lhMidis, ...rhMidis], 1.25);
};

window.simulateCorrectChord = function () {
  const q = window.currentQuestions[window.currentQuestionIndex];
  if (!q || window.isTransitioningChord) return;

  const lhMidis = window.buildHandSolutionMidis(q, false);
  const rhMidis = window.buildHandSolutionMidis(q, true);
  const combined = [...lhMidis, ...rhMidis];

  window.pressedMidis = new Set(combined);
  window.playMidiNotesAudio(combined, 0.8);
  window.onActiveNotesChanged();
};

// ============================================================================
// 12. LIVE TIMERS & EINDSCHERM (Inclusief 3 Traagste Akkoorden & Daily Post)
// ============================================================================
window.updateLiveTimers = function () {
  const now = performance.now();
  const totalElapsed = now - window.gameStartTime;
  const chordElapsed = now - window.chordStartTime;

  const totalEl = document.getElementById('liveTimerDisplay');
  const chordEl = document.getElementById('currentChordTimer');

  if (totalEl) totalEl.textContent = window.formatTimeMs(totalElapsed);
  if (chordEl) chordEl.textContent = `Huidig: ${(chordElapsed / 1000).toFixed(1)}s`;
};

window.finishGameSession = function () {
  if (window.timerIntervalId) clearInterval(window.timerIntervalId);
  window.cancelHoldTimer();
  window.isTransitioningChord = false;

  const totalTimeMs = performance.now() - window.gameStartTime;
  const completedCount = Math.max(1, window.sessionChordLogs.length);
  const avgTimeMs = totalTimeMs / completedCount;

  window.setCompactGameViewport(false);
  document.getElementById('gameScreen').classList.add('hidden');
  document.getElementById('endScreen').classList.remove('hidden');

  document.getElementById('finalTotalTime').textContent = window.formatTimeMs(totalTimeMs);
  document.getElementById('finalAvgTime').textContent = `${(avgTimeMs / 1000).toFixed(1)}s`;

  const endModeBadge = document.getElementById('endModeBadge');
  const recordStatusEl = document.getElementById('finalRecordStatus');
  const shareDailyBtn = document.getElementById('shareDailyBtn');
  const endDailyBoard = document.getElementById('endDailyLeaderboardSection');
  const endPlayerSection = document.getElementById('endPlayerSection');

  window.syncPlayerNameUI();

  // A. Officiële Daily Challenge voltooid
  if (window.currentGameMode === 'daily') {
    const dateStr = window.currentDailyDateStr || window.getTodayDateString();
    window.saveLocalDailyResult(dateStr, totalTimeMs);
    window.prepareDailyShareText(dateStr, totalTimeMs, avgTimeMs, false);

    if (endModeBadge) endModeBadge.textContent = `🔥 Daily Challenge (${dateStr}) Voltooid`;
    if (recordStatusEl) recordStatusEl.textContent = 'Officiële Daily Tijd!';
    if (shareDailyBtn) shareDailyBtn.classList.remove('hidden');
    if (endDailyBoard) endDailyBoard.classList.remove('hidden');
    if (endPlayerSection) endPlayerSection.classList.remove('hidden');

    const savedPlayer = window.getSavedPlayerName();
    if (savedPlayer) {
      window.submitDailyScoreToFirebase(dateStr, savedPlayer, totalTimeMs, avgTimeMs);
    } else {
      window.pendingDailySubmission = { dateStr, timeMs: totalTimeMs, avgMs: avgTimeMs };
      window.loadDailyLeaderboardForDate(dateStr, 'endDailyLeaderboardList');
    }
  }
  // B. Archief Daily geoefend
  else if (window.currentGameMode === 'daily_archive') {
    const dateStr = window.currentDailyDateStr;
    window.prepareDailyShareText(dateStr, totalTimeMs, avgTimeMs, true);

    if (endModeBadge) endModeBadge.textContent = `🕹️ Archief Daily (${dateStr}) Voltooid`;
    if (recordStatusEl) recordStatusEl.textContent = 'Oefenronde (Archief)';
    if (shareDailyBtn) shareDailyBtn.classList.remove('hidden');
    if (endDailyBoard) endDailyBoard.classList.remove('hidden');
    if (endPlayerSection) endPlayerSection.classList.add('hidden');

    window.loadDailyLeaderboardForDate(dateStr, 'endDailyLeaderboardList');
  }
  // C. Vrij Spel, Sprints of Focus-Herkansing
  else {
    if (shareDailyBtn) shareDailyBtn.classList.add('hidden');
    if (endDailyBoard) endDailyBoard.classList.add('hidden');
    if (endPlayerSection) endPlayerSection.classList.add('hidden');

    if (window.currentGameMode === 'free') {
      if (endModeBadge) endModeBadge.textContent = '♾️ Vrij Spel Sessie Voltooid!';
      if (recordStatusEl) recordStatusEl.textContent = `${completedCount} akkoorden gespeeld`;
    } else if (window.currentGameMode === 'retry') {
      if (endModeBadge) endModeBadge.textContent = '🎯 Focus-Herkansing Voltooid!';
      if (recordStatusEl) recordStatusEl.textContent = 'Zwakke plekken getraind 💪';
    } else {
      const modeKey = String(window.currentGameMode);
      const prInfo = window.checkAndSaveLocalPR(modeKey, totalTimeMs);
      if (endModeBadge) {
        endModeBadge.textContent =
          modeKey === 'iiVI' ? '🎷 ii–V–I Progressie Voltooid' : `⚡ Sprint (${modeKey} Akkoorden) Voltooid`;
      }
      if (recordStatusEl) {
        recordStatusEl.textContent = prInfo.isNewPR
          ? '🏆 Nieuw Persoonlijk Record!'
          : `Beste tijd: ${window.formatTimeMs(prInfo.prevMs)}`;
      }
    }
  }

  window.renderSlowestChordsAnalysis();
};

window.renderSlowestChordsAnalysis = function () {
  const listEl = document.getElementById('slowestChordsList');
  const sectionEl = document.getElementById('slowestChordsSection');
  if (!listEl || !sectionEl) return;

  if (!window.sessionChordLogs || window.sessionChordLogs.length === 0) {
    sectionEl.classList.add('hidden');
    return;
  }

  sectionEl.classList.remove('hidden');
  const sortedBySlowest = [...window.sessionChordLogs]
    .sort((a, b) => b.durationMs - a.durationMs)
    .slice(0, 3);

  const retryList = [];
  sortedBySlowest.forEach((item) => {
    retryList.push(item.question);
  });
  sortedBySlowest.forEach((item) => {
    retryList.push(item.question);
  });
  window.slowestRetryQueue = retryList;

  listEl.innerHTML = sortedBySlowest
    .map((item, idx) => {
      return `
        <div class="p-2.5 rounded-xl bg-slate-800/90 border border-slate-700 flex flex-col justify-between">
          <div class="flex items-center justify-between gap-1">
            <span class="text-xs font-extrabold text-white">${idx + 1}. ${window.escapeHtml(item.displayTitle)}</span>
            <span class="text-xs font-extrabold mono text-amber-300">${window.formatSecondsShort(item.durationMs)}</span>
          </div>
          <div class="text-[11px] text-slate-400 mono mt-1">
            ${window.escapeHtml(item.displaySub)}
          </div>
        </div>
      `;
    })
    .join('');
};

window.startSlowestRetry = function () {
  if (!window.slowestRetryQueue || window.slowestRetryQueue.length === 0) return;
  window.startGame('retry');
};
