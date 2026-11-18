// ============================================================================
// LEADERBOARD.JS — Firebase Daily Ranking, Archief, Speler-Badge & Lokale PR's
// ============================================================================

window.FIREBASE_DB_URL = 'https://jazz-inversie-studio-default-rtdb.europe-west1.firebasedatabase.app';

window.PLAYER_NAME_KEY = 'jazz_player_name';
window.LOCAL_PR_PREFIX = 'jazz_pr_mode_';
window.DAILY_PLAYED_PREFIX = 'jazz_daily_played_';
window.DAILY_RESULT_PREFIX = 'jazz_daily_result_';

// Huidige geselecteerde datum in het Daily Leaderboard archief (0 = vandaag, -1 = gisteren, etc.)
window.leaderboardDayOffset = 0;

// Pending score voor het geval iemand een Daily afrondt vóórdat hij zijn naam heeft ingevuld
window.pendingDailySubmission = null;

// ============================================================================
// 1. DATUM HULPFUNCTIES (Lokale tijd YYYY-MM-DD)
// ============================================================================
window.getDateStringWithOffset = function (dayOffset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

window.getTodayDateString = function () {
  return window.getDateStringWithOffset(0);
};

window.formatDutchDateLabel = function (dateStr) {
  const todayStr = window.getTodayDateString();
  const yesterdayStr = window.getDateStringWithOffset(-1);

  const [y, m, d] = dateStr.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const shortFormatted = dateObj.toLocaleDateString('nl-BE', {
    day: 'numeric',
    month: 'short'
  });

  if (dateStr === todayStr) return `Vandaag (${shortFormatted})`;
  if (dateStr === yesterdayStr) return `Gisteren (${shortFormatted})`;
  return shortFormatted;
};

window.formatTimeMs = function (ms) {
  if (!ms || ms < 0) return '00:00.0';
  const totalSeconds = ms / 1000;
  const mins = Math.floor(totalSeconds / 60);
  const secs = Math.floor(totalSeconds % 60);
  const tenths = Math.floor((ms % 1000) / 100);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${tenths}`;
};

window.formatSecondsShort = function (ms) {
  return `${(ms / 1000).toFixed(1)}s`;
};

// ============================================================================
// 2. SPELERSNAAM OPSLAAN & COMPACTE BADGE ("👤 Speler: [Naam] ✏️")
// ============================================================================
window.getSavedPlayerName = function () {
  return (localStorage.getItem(window.PLAYER_NAME_KEY) || '').trim();
};

window.syncPlayerNameUI = function () {
  const savedName = window.getSavedPlayerName();

  // Startscherm elementen
  const startInputWrap = document.getElementById('playerInputWrap');
  const startBadgeWrap = document.getElementById('playerBadgeWrap');
  const startBadgeName = document.getElementById('playerBadgeName');
  const startInput = document.getElementById('playerNameInput');

  // Eindscherm elementen
  const endInputWrap = document.getElementById('endPlayerInputWrap');
  const endBadgeWrap = document.getElementById('endPlayerBadgeWrap');
  const endBadgeName = document.getElementById('endPlayerBadgeName');
  const endInput = document.getElementById('endPlayerNameInput');

  if (savedName) {
    if (startInputWrap) startInputWrap.classList.add('hidden');
    if (startBadgeWrap) {
      startBadgeWrap.classList.remove('hidden');
      startBadgeWrap.classList.add('inline-flex');
    }
    if (startBadgeName) startBadgeName.textContent = savedName;
    if (startInput) startInput.value = savedName;

    if (endInputWrap) endInputWrap.classList.add('hidden');
    if (endBadgeWrap) {
      endBadgeWrap.classList.remove('hidden');
      endBadgeWrap.classList.add('flex');
    }
    if (endBadgeName) endBadgeName.textContent = savedName;
    if (endInput) endInput.value = savedName;
  } else {
    if (startInputWrap) startInputWrap.classList.remove('hidden');
    if (startBadgeWrap) {
      startBadgeWrap.classList.add('hidden');
      startBadgeWrap.classList.remove('inline-flex');
    }

    if (endInputWrap) endInputWrap.classList.remove('hidden');
    if (endBadgeWrap) {
      endBadgeWrap.classList.add('hidden');
      endBadgeWrap.classList.remove('flex');
    }
  }
};

window.savePlayerNameFromInput = function (inputId) {
  const inputEl = document.getElementById(inputId);
  if (!inputEl) return;

  const cleanName = inputEl.value.trim().replace(/[<>]/g, '').slice(0, 18);
  if (!cleanName) {
    inputEl.focus();
    return;
  }

  localStorage.setItem(window.PLAYER_NAME_KEY, cleanName);
  window.syncPlayerNameUI();

  // Als er op het eindscherm een Daily score klaarstond om gepost te worden, stuur hem nu direct door!
  if (window.pendingDailySubmission) {
    const { dateStr, timeMs, avgMs } = window.pendingDailySubmission;
    window.pendingDailySubmission = null;
    window.submitDailyScoreToFirebase(dateStr, cleanName, timeMs, avgMs);
  } else {
    // Herlaad het klassement zodat je eigen rij gemarkeerd wordt
    window.loadDailyLeaderboardForCurrentOffset();
  }
};

window.editPlayerName = function () {
  const startInputWrap = document.getElementById('playerInputWrap');
  const startBadgeWrap = document.getElementById('playerBadgeWrap');
  const startInput = document.getElementById('playerNameInput');

  if (startBadgeWrap) {
    startBadgeWrap.classList.add('hidden');
    startBadgeWrap.classList.remove('inline-flex');
  }
  if (startInputWrap) startInputWrap.classList.remove('hidden');
  if (startInput) {
    startInput.value = window.getSavedPlayerName();
    startInput.focus();
    startInput.select();
  }
};

window.editPlayerNameOnEndScreen = function () {
  const endInputWrap = document.getElementById('endPlayerInputWrap');
  const endBadgeWrap = document.getElementById('endPlayerBadgeWrap');
  const endInput = document.getElementById('endPlayerNameInput');

  if (endBadgeWrap) {
    endBadgeWrap.classList.add('hidden');
    endBadgeWrap.classList.remove('flex');
  }
  if (endInputWrap) endInputWrap.classList.remove('hidden');
  if (endInput) {
    endInput.value = window.getSavedPlayerName();
    endInput.focus();
    endInput.select();
  }
};

// ============================================================================
// 3. DAILY CHALLENGE VERGRENDELING (1x per dag voor vandaag) & LOKALE PR'S
// ============================================================================
window.hasPlayedDailyToday = function () {
  const todayStr = window.getTodayDateString();
  return localStorage.getItem(`${window.DAILY_PLAYED_PREFIX}${todayStr}`) === 'true';
};

window.markDailyPlayedToday = function () {
  const todayStr = window.getTodayDateString();
  localStorage.setItem(`${window.DAILY_PLAYED_PREFIX}${todayStr}`, 'true');
  window.refreshDailyCardUI();
};

window.saveLocalDailyResult = function (dateStr, timeMs) {
  localStorage.setItem(`${window.DAILY_RESULT_PREFIX}${dateStr}`, String(timeMs));
  window.refreshDailyCardUI();
};

window.getLocalDailyResult = function (dateStr) {
  const val = localStorage.getItem(`${window.DAILY_RESULT_PREFIX}${dateStr}`);
  return val ? Number(val) : null;
};

window.refreshDailyCardUI = function () {
  const todayStr = window.getTodayDateString();
  const dateLabel = document.getElementById('dailyDateLabel');
  const bestBadge = document.getElementById('dailyBestBadge');
  const startBtn = document.getElementById('dailyStartBtn');

  if (dateLabel) {
    dateLabel.textContent = window.formatDutchDateLabel(todayStr);
  }

  const played = window.hasPlayedDailyToday();
  const savedTime = window.getLocalDailyResult(todayStr);

  if (played) {
    if (bestBadge) {
      bestBadge.textContent = savedTime
        ? `✅ Vandaag voltooid in ${window.formatTimeMs(savedTime)}`
        : '✅ Poging van vandaag gebruikt';
    }
    if (startBtn) {
      startBtn.disabled = true;
      startBtn.textContent = '✅ Daily Vandaag Gespeeld';
      startBtn.className =
        'px-4 py-2 rounded-xl font-extrabold text-xs sm:text-sm bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed';
    }
  } else {
    if (bestBadge) {
      bestBadge.textContent = 'Nog niet gespeeld vandaag • 1 poging!';
    }
    if (startBtn) {
      startBtn.disabled = false;
      startBtn.textContent = '🔥 Start Daily Challenge →';
      startBtn.className =
        'px-4 py-2 rounded-xl font-extrabold text-xs sm:text-sm bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 shadow-md transition';
    }
  }
};

// Lokale Persoonlijke Records voor 10, 20, 50 en ii-V-I
window.checkAndSaveLocalPR = function (modeKey, timeMs) {
  const storageKey = `${window.LOCAL_PR_PREFIX}${modeKey}`;
  const prevBest = localStorage.getItem(storageKey);
  const prevMs = prevBest ? Number(prevBest) : null;

  if (!prevMs || timeMs < prevMs) {
    localStorage.setItem(storageKey, String(timeMs));
    window.refreshAllLocalPRBadges();
    return { isNewPR: true, prevMs };
  }
  window.refreshAllLocalPRBadges();
  return { isNewPR: false, prevMs };
};

window.refreshAllLocalPRBadges = function () {
  const modes = ['10', '20', '50', 'iiVI'];
  modes.forEach((m) => {
    const el = document.getElementById(`pr_${m}`);
    if (!el) return;
    const saved = localStorage.getItem(`${window.LOCAL_PR_PREFIX}${m}`);
    el.textContent = saved ? `PR: ${window.formatTimeMs(Number(saved))}` : 'PR: —';
  });
};

// ============================================================================
// 4. FIREBASE REALTIME DATABASE — DAILY CHALLENGE LEADERBOARD + ARCHIEF
// ============================================================================
window.submitDailyScoreToFirebase = async function (dateStr, playerName, timeMs, avgMs) {
  const syncEl = document.getElementById('scoreSyncStatus');
  if (syncEl) {
    syncEl.textContent = '⏳ Opslaan in klassement...';
    syncEl.className = 'text-xs font-semibold text-amber-300';
  }

  const payload = {
    name: playerName,
    timeMs: Math.round(timeMs),
    avgMs: Math.round(avgMs),
    date: dateStr,
    timestamp: Date.now()
  };

  try {
    const res = await fetch(`${window.FIREBASE_DB_URL}/daily/${dateStr}.json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    if (syncEl) {
      syncEl.textContent = '✅ Staan in het Daily klassement!';
      syncEl.className = 'text-xs font-semibold text-emerald-400';
    }

    // Ververs zowel het startscherm- als eindscherm-klassement
    await window.loadDailyLeaderboardForDate(dateStr, 'dailyLeaderboardList');
    await window.loadDailyLeaderboardForDate(dateStr, 'endDailyLeaderboardList');
  } catch (err) {
    console.warn('Firebase opslaan mislukt:', err);
    if (syncEl) {
      syncEl.textContent = '⚠️ Offline — score lokaal bewaard';
      syncEl.className = 'text-xs font-semibold text-rose-400';
    }
  }
};

window.loadDailyLeaderboardForDate = async function (dateStr, targetContainerId = 'dailyLeaderboardList') {
  const container = document.getElementById(targetContainerId);
  if (!container) return;

  container.innerHTML = `
    <div class="text-xs text-slate-400 py-4 text-center">
      Klassement van ${window.formatDutchDateLabel(dateStr)} ophalen...
    </div>
  `;

  try {
    const res = await fetch(`${window.FIREBASE_DB_URL}/daily/${dateStr}.json`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rawData = await res.json();

    if (!rawData) {
      container.innerHTML = `
        <div class="text-xs text-slate-400 py-5 text-center bg-slate-900/50 rounded-xl border border-slate-800">
          Nog geen scores geregistreerd voor <strong>${window.formatDutchDateLabel(dateStr)}</strong>. Zet jij de eerste tijd neer? 🎹
        </div>
      `;
      return;
    }

    // Filter op UNIEKE SPELERSNAAM (alleen de allersnelste tijd per persoon telt!)
    const bestPerPlayer = new Map();
    Object.values(rawData).forEach((entry) => {
      if (!entry || !entry.name || typeof entry.timeMs !== 'number') return;
      const key = entry.name.trim().toLowerCase();
      const existing = bestPerPlayer.get(key);
      if (!existing || entry.timeMs < existing.timeMs) {
        bestPerPlayer.set(key, entry);
      }
    });

    const sortedEntries = [...bestPerPlayer.values()]
      .sort((a, b) => a.timeMs - b.timeMs)
      .slice(0, 15);

    const currentPlayerName = window.getSavedPlayerName().toLowerCase();
    const medals = ['🥇', '🥈', '🥉'];

    container.innerHTML = sortedEntries
      .map((item, idx) => {
        const isMe = currentPlayerName && item.name.trim().toLowerCase() === currentPlayerName;
        const rankBadge = idx < 3 ? medals[idx] : `<span class="mono text-xs text-slate-400">#${idx + 1}</span>`;
        const avgSec = ((item.avgMs || item.timeMs / 10) / 1000).toFixed(1);

        return `
          <div class="flex items-center justify-between px-3 py-2 rounded-xl border ${
            isMe
              ? 'bg-indigo-500/20 border-indigo-400/50 text-white'
              : 'bg-slate-900/75 border-slate-800/90 text-slate-200'
          }">
            <div class="flex items-center gap-2.5">
              <div class="w-6 text-center font-bold text-sm">${rankBadge}</div>
              <div>
                <span class="text-xs sm:text-sm font-bold ${isMe ? 'text-indigo-200' : 'text-white'}">
                  ${window.escapeHtml(item.name)}
                </span>
                ${
                  isMe
                    ? '<span class="ml-1.5 text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-indigo-500/30 text-indigo-200">Jij</span>'
                    : ''
                }
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-[11px] text-slate-400 mono hidden sm:inline">${avgSec}s / akk</span>
              <span class="text-xs sm:text-sm font-extrabold mono text-emerald-400">
                ${window.formatTimeMs(item.timeMs)}
              </span>
            </div>
          </div>
        `;
      })
      .join('');
  } catch (err) {
    console.warn('Fout bij laden Daily Leaderboard:', err);
    container.innerHTML = `
      <div class="text-xs text-rose-300 py-4 text-center bg-rose-950/30 rounded-xl border border-rose-500/30">
        Kon het online klassement niet bereiken. Controleer je internetverbinding.
      </div>
    `;
  }
};

window.escapeHtml = function (str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
};

// ============================================================================
// 5. DATUM-ARCHIEF KNOPPEN ("◀ Vorige", "Vandaag", "Volgende ▶")
// ============================================================================
window.loadDailyLeaderboardForCurrentOffset = function () {
  const dateStr = window.getDateStringWithOffset(window.leaderboardDayOffset);
  const displayBtn = document.getElementById('leaderboardDateDisplay');
  const nextBtn = document.getElementById('leaderboardNextDayBtn');
  const archiveBar = document.getElementById('archivePracticeBar');
  const archiveText = document.getElementById('archivePracticeText');

  if (displayBtn) {
    displayBtn.textContent = window.formatDutchDateLabel(dateStr);
  }
  if (nextBtn) {
    nextBtn.disabled = window.leaderboardDayOffset >= 0;
  }

  // Als je naar gisteren of eerder kijkt, toon de knop om die gemiste Daily te oefenen
  if (archiveBar) {
    if (window.leaderboardDayOffset < 0) {
      archiveBar.classList.remove('hidden');
      if (archiveText) {
        archiveText.textContent = `De 10 Daily akkoorden van ${window.formatDutchDateLabel(dateStr)} (buiten mededinging) spelen?`;
      }
    } else {
      archiveBar.classList.add('hidden');
    }
  }

  window.loadDailyLeaderboardForDate(dateStr, 'dailyLeaderboardList');
};

window.shiftLeaderboardDate = function (deltaDays) {
  const nextOffset = window.leaderboardDayOffset + deltaDays;
  if (nextOffset > 0) return; // Niet in de toekomst kijken
  window.leaderboardDayOffset = nextOffset;
  window.loadDailyLeaderboardForCurrentOffset();
};

window.resetLeaderboardDateToToday = function () {
  window.leaderboardDayOffset = 0;
  window.loadDailyLeaderboardForCurrentOffset();
};

// ============================================================================
// 6. DEEL DAILY SCORE KNOP (Wordle-stijl tekstje voor WhatsApp / Groepschat)
// ============================================================================
window.lastCompletedDailyShareText = '';

window.prepareDailyShareText = function (dateStr, timeMs, avgMs, isArchivePractice = false) {
  const label = window.formatDutchDateLabel(dateStr);
  const prefix = isArchivePractice ? `🕹️ Jazz Daily Archief (${dateStr})` : `🔥 Jazz Inversie Daily (${dateStr})`;
  window.lastCompletedDailyShareText =
    `${prefix}\n` +
    `🎹 10/10 two-hand voicings in ${window.formatTimeMs(timeMs)} (gem. ${(avgMs / 1000).toFixed(1)}s/akkoord)\n` +
    `Kun jij mijn tijd verbeteren?`;
};

window.shareDailyScore = async function () {
  const text = window.lastCompletedDailyShareText;
  if (!text) return;

  const btn = document.getElementById('shareDailyBtn');

  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      if (btn) {
        const old = btn.textContent;
        btn.textContent = '✅ Gekopieerd naar klembord!';
        setTimeout(() => {
          btn.textContent = old;
        }, 2200);
      }
    } else {
      prompt('Kopieer je Daily Score:', text);
    }
  } catch (e) {
    prompt('Kopieer je Daily Score:', text);
  }
};
