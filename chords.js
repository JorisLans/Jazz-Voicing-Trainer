// ============================================================================
// CHORDS.JS — Muziektheorie, Hybride Voicings, Daily PRNG, ii-V-I & Audio
// ============================================================================

window.NOTE_NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
window.NOTE_NAMES_FLAT  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

// Standaard jazz-schrijfwijze voor grondtonen
window.ROOT_DISPLAY_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
window.WHITE_KEY_ROOTS = [0, 2, 4, 5, 7, 9, 11];

// Gebruik mollen voor kruis/mol-keuze afhankelijk van de grondtoon
window.FLAT_PREF_ROOTS = new Set([1, 3, 5, 8, 10, 0]); // Db, Eb, F, Ab, Bb, C

window.pcToNoteName = function (pc, rootPc = 0) {
  const norm = ((pc % 12) + 12) % 12;
  const useFlats = window.FLAT_PREF_ROOTS.has(((rootPc % 12) + 12) % 12);
  return useFlats ? window.NOTE_NAMES_FLAT[norm] : window.NOTE_NAMES_SHARP[norm];
};

window.midiToNoteName = function (midi, rootPc = 0) {
  const pc = ((midi % 12) + 12) % 12;
  const octave = Math.floor(midi / 12) - 1;
  return `${window.pcToNoteName(pc, rootPc)}${octave}`;
};

// ============================================================================
// 1. AKKOORD DEFINITIES (Klassieke Inversies + Hybride Slash-Extensions)
// ============================================================================
window.CHORD_TYPES = {
  // --- DRIEKLANKEN (3 noten per hand, klassieke inversies) ---
  major: [
    {
      id: 'maj',
      suffix: '',
      name: 'Major Drieklank',
      category: 'major',
      mode: 'inversion',
      handSize: 3,
      intervals: [0, 4, 7],
      degreeLabels: ['1 (Grondtoon)', '3 (Grote Terts)', '5 (Kwint)']
    }
  ],
  minor: [
    {
      id: 'm',
      suffix: 'm',
      name: 'Minor Drieklank',
      category: 'minor',
      mode: 'inversion',
      handSize: 3,
      intervals: [0, 3, 7],
      degreeLabels: ['1 (Grondtoon)', 'b3 (Kleine Terts)', '5 (Kwint)']
    }
  ],
  dim: [
    {
      id: 'dim',
      suffix: 'dim',
      name: 'Diminished Drieklank',
      category: 'dim',
      mode: 'inversion',
      handSize: 3,
      intervals: [0, 3, 6],
      degreeLabels: ['1 (Grondtoon)', 'b3 (Kleine Terts)', 'b5 (Verm. Kwint)']
    }
  ],
  aug: [
    {
      id: 'aug',
      suffix: 'aug',
      name: 'Augmented Drieklank',
      category: 'aug',
      mode: 'inversion',
      handSize: 3,
      intervals: [0, 4, 8],
      degreeLabels: ['1 (Grondtoon)', '3 (Grote Terts)', '#5 (Overm. Kwint)']
    }
  ],

  // --- SEVENTHS (4 noten per hand, klassieke inversies 0 t/m 3) ---
  sevenths: [
    {
      id: 'maj7',
      suffix: 'maj7',
      name: 'Major 7th',
      category: 'sevenths',
      mode: 'inversion',
      handSize: 4,
      intervals: [0, 4, 7, 11],
      degreeLabels: ['1 (Grondtoon)', '3 (Grote Terts)', '5 (Kwint)', '7 (Grote Septiem)']
    },
    {
      id: '7',
      suffix: '7',
      name: 'Dominant 7th',
      category: 'sevenths',
      mode: 'inversion',
      handSize: 4,
      intervals: [0, 4, 7, 10],
      degreeLabels: ['1 (Grondtoon)', '3 (Grote Terts)', '5 (Kwint)', 'b7 (Kleine Septiem)']
    },
    {
      id: 'm7',
      suffix: 'm7',
      name: 'Minor 7th',
      category: 'sevenths',
      mode: 'inversion',
      handSize: 4,
      intervals: [0, 3, 7, 10],
      degreeLabels: ['1 (Grondtoon)', 'b3 (Kleine Terts)', '5 (Kwint)', 'b7 (Kleine Septiem)']
    },
    {
      id: 'm7b5',
      suffix: 'm7b5',
      name: 'Half-Diminished (m7b5)',
      category: 'sevenths',
      mode: 'inversion',
      handSize: 4,
      intervals: [0, 3, 6, 10],
      degreeLabels: ['1 (Grondtoon)', 'b3 (Kleine Terts)', 'b5 (Verm. Kwint)', 'b7 (Kleine Septiem)']
    },
    {
      id: 'dim7',
      suffix: 'dim7',
      name: 'Diminished 7th',
      category: 'sevenths',
      mode: 'inversion',
      handSize: 4,
      intervals: [0, 3, 6, 9],
      degreeLabels: ['1 (Grondtoon)', 'b3 (Kleine Terts)', 'b5 (Verm. Kwint)', 'bb7 (Dubbelverm. 7)']
    }
  ],

  // --- FURTHER EXTENSIONS (4 noten per hand, Slash-Chord Hybride Modus) ---
  extensions: [
    {
      id: '9',
      suffix: '9',
      name: 'Dominant 9th',
      category: 'extensions',
      mode: 'slash',
      handSize: 4,
      allowedIntervals: [0, 4, 7, 10, 2],       // 1, 3, 5, b7, 9
      slashBassOptions: [0, 4, 7, 10],          // Basnoot per hand uit 1, 3, 5, b7
      requiredInterval: 2,                      // 9 is verplicht in elke hand
      requiredLabel: '9',
      recommendedVoicing: [0, 4, 10, 2]         // 1 - 3 - b7 - 9
    },
    {
      id: 'maj9',
      suffix: 'maj9',
      name: 'Major 9th',
      category: 'extensions',
      mode: 'slash',
      handSize: 4,
      allowedIntervals: [0, 4, 7, 11, 2],       // 1, 3, 5, 7, 9
      slashBassOptions: [0, 4, 7, 11],
      requiredInterval: 2,
      requiredLabel: '9',
      recommendedVoicing: [0, 4, 11, 2]
    },
    {
      id: 'm9',
      suffix: 'm9',
      name: 'Minor 9th',
      category: 'extensions',
      mode: 'slash',
      handSize: 4,
      allowedIntervals: [0, 3, 7, 10, 2],       // 1, b3, 5, b7, 9
      slashBassOptions: [0, 3, 7, 10],
      requiredInterval: 2,
      requiredLabel: '9',
      recommendedVoicing: [0, 3, 10, 2]
    },
    {
      id: '11',
      suffix: '11',
      name: 'Dominant 11th',
      category: 'extensions',
      mode: 'slash',
      handSize: 4,
      allowedIntervals: [0, 4, 7, 10, 2, 5],    // 1, (3), 5, b7, 9, 11
      slashBassOptions: [0, 7, 10, 5],
      requiredInterval: 5,                      // 11 (kwart) is verplicht
      requiredLabel: '11',
      recommendedVoicing: [0, 7, 10, 5]
    },
    {
      id: 'm11',
      suffix: 'm11',
      name: 'Minor 11th',
      category: 'extensions',
      mode: 'slash',
      handSize: 4,
      allowedIntervals: [0, 3, 7, 10, 2, 5],    // 1, b3, 5, b7, 9, 11
      slashBassOptions: [0, 3, 7, 10],
      requiredInterval: 5,
      requiredLabel: '11',
      recommendedVoicing: [0, 3, 10, 5]
    },
    {
      id: '13',
      suffix: '13',
      name: 'Dominant 13th',
      category: 'extensions',
      mode: 'slash',
      handSize: 4,
      allowedIntervals: [0, 4, 7, 10, 2, 9],    // 1, 3, 5, b7, 9, 13 (géén 11 avoid note!)
      slashBassOptions: [0, 4, 7, 10],
      requiredInterval: 9,                      // 13 (grote sext) is verplicht
      requiredLabel: '13',
      recommendedVoicing: [0, 4, 10, 9]         // 1 - 3 - b7 - 13
    },
    {
      id: 'maj13',
      suffix: 'maj13',
      name: 'Major 13th',
      category: 'extensions',
      mode: 'slash',
      handSize: 4,
      allowedIntervals: [0, 4, 7, 11, 2, 9],    // 1, 3, 5, 7, 9, 13 (géén 11 avoid note!)
      slashBassOptions: [0, 4, 7, 11],
      requiredInterval: 9,
      requiredLabel: '13',
      recommendedVoicing: [0, 4, 11, 9]
    },
    {
      id: 'm13',
      suffix: 'm13',
      name: 'Minor 13th',
      category: 'extensions',
      mode: 'slash',
      handSize: 4,
      allowedIntervals: [0, 3, 7, 10, 2, 5, 9], // 1, b3, 5, b7, 9, 11, 13
      slashBassOptions: [0, 3, 7, 10],
      requiredInterval: 9,
      requiredLabel: '13',
      recommendedVoicing: [0, 3, 10, 9]
    }
  ]
};

window.INVERSION_NAMES = [
  'Grondligging',
  '1e Inversie',
  '2e Inversie',
  '3e Inversie'
];

// ============================================================================
// 2. SEEDED RANDOM GENERATOR VOOR DE DAILY CHALLENGE
// ============================================================================
window.createSeededRandom = function (seedString) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedString.length; i++) {
    h ^= seedString.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return function () {
    h += h << 13;
    h ^= h >>> 7;
    h += h << 3;
    h ^= h >>> 17;
    h += h << 5;
    return (h >>> 0) / 4294967296;
  };
};

// ============================================================================
// 3. AKKOORD OPGAVE BOUWERS (Regulier, Slash, Daily & Blinde ii-V-I)
// ============================================================================
window.buildChordQuestion = function (rootPc, chordDef, rngFunc = Math.random, options = {}) {
  const rootName = window.ROOT_DISPLAY_NAMES[rootPc];
  const fullSymbol = `${rootName}${chordDef.suffix}`;
  const isBlindIIVI = Boolean(options.isBlindIIVI);

  // Modus A: Blinde ii-V-I (vrije inversie per hand!)
  if (isBlindIIVI) {
    const allowedPcs = chordDef.intervals.map((iv) => (rootPc + iv) % 12);
    return {
      rootPc,
      rootName,
      chordDef,
      symbol: fullSymbol,
      mode: 'free_inversion',
      handSize: chordDef.handSize,
      allowedPcs,
      isBlindIIVI: true,
      keyCenterPc: options.keyCenterPc,
      keyCenterName: options.keyCenterName,
      romanStepIndex: options.romanStepIndex, // 1, 2 of 3
      romanLabel: options.romanLabel,         // bijv. "ii — Mineur 7 (m7)"
      lhInv: 0,
      rhInv: 1
    };
  }

  // Modus B: Hybride Slash-Chords (Further Extensions 9, 11, 13)
  if (chordDef.mode === 'slash') {
    const bassPool = chordDef.slashBassOptions;
    const lhBassIdx = Math.floor(rngFunc() * bassPool.length);
    let rhBassIdx = Math.floor(rngFunc() * bassPool.length);
    if (bassPool.length > 1 && rhBassIdx === lhBassIdx) {
      rhBassIdx = (lhBassIdx + 1 + Math.floor(rngFunc() * (bassPool.length - 1))) % bassPool.length;
    }

    const lhBassInterval = bassPool[lhBassIdx];
    const rhBassInterval = bassPool[rhBassIdx];
    const lhBassPc = (rootPc + lhBassInterval) % 12;
    const rhBassPc = (rootPc + rhBassInterval) % 12;
    const lhBassName = window.pcToNoteName(lhBassPc, rootPc);
    const rhBassName = window.pcToNoteName(rhBassPc, rootPc);

    const allowedPcs = chordDef.allowedIntervals.map((iv) => (rootPc + iv) % 12);
    const requiredPc = (rootPc + chordDef.requiredInterval) % 12;
    const requiredNoteName = window.pcToNoteName(requiredPc, rootPc);

    return {
      rootPc,
      rootName,
      chordDef,
      symbol: fullSymbol,
      mode: 'slash',
      handSize: 4,
      allowedPcs,
      requiredPc,
      requiredLabel: chordDef.requiredLabel,
      requiredNoteName,
      lhBassPc,
      rhBassPc,
      lhBassName,
      rhBassName,
      lhSlashLabel: `${fullSymbol} / ${lhBassName}`,
      rhSlashLabel: `${fullSymbol} / ${rhBassName}`
    };
  }

  // Modus C: Klassieke Inversies (Drieklanken & Sevenths)
  const numInversions = chordDef.intervals.length; // 3 of 4
  const lhInv = Math.floor(rngFunc() * numInversions);
  let rhInv = Math.floor(rngFunc() * numInversions);
  if (numInversions > 1 && rhInv === lhInv) {
    rhInv = (lhInv + 1 + Math.floor(rngFunc() * (numInversions - 1))) % numInversions;
  }

  const allowedPcs = chordDef.intervals.map((iv) => (rootPc + iv) % 12);
  const lhBassPc = allowedPcs[lhInv];
  const rhBassPc = allowedPcs[rhInv];

  return {
    rootPc,
    rootName,
    chordDef,
    symbol: fullSymbol,
    mode: 'inversion',
    handSize: chordDef.handSize,
    allowedPcs,
    lhInv,
    rhInv,
    lhBassPc,
    rhBassPc,
    lhInvLabel: window.INVERSION_NAMES[lhInv],
    rhInvLabel: window.INVERSION_NAMES[rhInv],
    lhDegreeHint: `${chordDef.degreeLabels[lhInv]} (${window.pcToNoteName(lhBassPc, rootPc)}) onderop`,
    rhDegreeHint: `${chordDef.degreeLabels[rhInv]} (${window.pcToNoteName(rhBassPc, rootPc)}) onderop`
  };
};

// Genereer de vaste Daily Challenge van 10 akkoorden voor een datum (YYYY-MM-DD)
window.generateDailyQuestions = function (dateStr) {
  const rng = window.createSeededRandom(`JAZZ_DAILY_V2_${dateStr}`);
  // Daily gebruikt altijd: Major, Minor, Dim, Aug & Sevenths (géén Further Extensions)
  const dailyChordDefs = [
    ...window.CHORD_TYPES.major,
    ...window.CHORD_TYPES.minor,
    ...window.CHORD_TYPES.dim,
    ...window.CHORD_TYPES.aug,
    ...window.CHORD_TYPES.sevenths
  ];

  const questions = [];
  let lastKeySignature = '';

  for (let i = 0; i < 10; i++) {
    let rootPc = Math.floor(rng() * 12);
    let chordDef = dailyChordDefs[Math.floor(rng() * dailyChordDefs.length)];
    let sig = `${rootPc}_${chordDef.id}`;

    // Voorkom 2x exact hetzelfde akkoord achter elkaar
    if (sig === lastKeySignature) {
      rootPc = (rootPc + 5) % 12;
      sig = `${rootPc}_${chordDef.id}`;
    }
    lastKeySignature = sig;
    questions.push(window.buildChordQuestion(rootPc, chordDef, rng));
  }

  return questions;
};

// Genereer Blinde ii-V-I Progressie (4 toonsoorten x 3 trappen = 12 akkoorden)
window.generateIIVIQuestions = function (activeRoots, useSevenths) {
  const rootsPool = activeRoots && activeRoots.length > 0 ? [...activeRoots] : [0, 2, 4, 5, 7, 9, 11];
  const questions = [];

  // Kies 4 verschillende toonsoorten
  const chosenKeyCenters = [];
  const shuffled = [...rootsPool].sort(() => Math.random() - 0.5);
  for (let i = 0; i < 4; i++) {
    chosenKeyCenters.push(shuffled[i % shuffled.length]);
  }

  const defMinor = useSevenths ? window.CHORD_TYPES.sevenths[2] : window.CHORD_TYPES.minor[0]; // m7 of m
  const defDom   = useSevenths ? window.CHORD_TYPES.sevenths[1] : window.CHORD_TYPES.major[0]; // 7 of maj
  const defMajor = useSevenths ? window.CHORD_TYPES.sevenths[0] : window.CHORD_TYPES.major[0]; // maj7 of maj

  chosenKeyCenters.forEach((keyPc) => {
    const keyName = `${window.ROOT_DISPLAY_NAMES[keyPc]} Major`;

    // Trap 1: ii (2 halve tonen boven de grondtoon van de toonsoort)
    const iiRoot = (keyPc + 2) % 12;
    questions.push(
      window.buildChordQuestion(iiRoot, defMinor, Math.random, {
        isBlindIIVI: true,
        keyCenterPc: keyPc,
        keyCenterName: keyName,
        romanStepIndex: 1,
        romanLabel: useSevenths ? 'ii — Mineur 7 (m7)' : 'ii — Mineur Drieklank'
      })
    );

    // Trap 2: V (7 halve tonen boven de grondtoon van de toonsoort)
    const vRoot = (keyPc + 7) % 12;
    questions.push(
      window.buildChordQuestion(vRoot, defDom, Math.random, {
        isBlindIIVI: true,
        keyCenterPc: keyPc,
        keyCenterName: keyName,
        romanStepIndex: 2,
        romanLabel: useSevenths ? 'V — Dominant 7 (7)' : 'V — Majeur Drieklank'
      })
    );

    // Trap 3: I (de grondtoon van de toonsoort zelf)
    questions.push(
      window.buildChordQuestion(keyPc, defMajor, Math.random, {
        isBlindIIVI: true,
        keyCenterPc: keyPc,
        keyCenterName: keyName,
        romanStepIndex: 3,
        romanLabel: useSevenths ? 'I — Majeur 7 (maj7)' : 'I — Majeur Drieklank'
      })
    );
  });

  return questions;
};

// ============================================================================
// 4. BEREKEN EXACTE MIDI-OPLOSSING (Voor Hint, Audio & Test-Greep knop)
// ============================================================================
window. buildHandSolutionMidis = function (question, isRightHand) {
  const baseOctaveMidi = isRightHand ? 60 : 48; // Rond C3 voor links, C4 voor rechts

  if (question.mode === 'slash') {
    const targetBassPc = isRightHand ? question.rhBassPc : question.lhBassPc;
    // Zoek de laagste MIDI-noot voor deze bas nabij baseOctaveMidi
    let bassMidi = baseOctaveMidi + ((targetBassPc - (baseOctaveMidi % 12) + 12) % 12);
    if (!isRightHand && bassMidi > 55) bassMidi -= 12;
    if (isRightHand && bassMidi < 60) bassMidi += 12;

    // Kies nog 3 unieke akkoordtonen erboven (inclusief de verplichte extensie!)
    const recPcs = question.chordDef.recommendedVoicing.map((iv) => (question.rootPc + iv) % 12);
    const chosenPcs = new Set([targetBassPc, question.requiredPc]);

    for (const pc of recPcs) {
      if (chosenPcs.size < 4) chosenPcs.add(pc);
    }
    for (const pc of question.allowedPcs) {
      if (chosenPcs.size < 4) chosenPcs.add(pc);
    }

    const otherPcs = [...chosenPcs].filter((pc) => pc !== targetBassPc);
    const resultMidis = [bassMidi];
    let currentTop = bassMidi;

    otherPcs.forEach((pc) => {
      let nextMidi = currentTop + 1 + ((pc - ((currentTop + 1) % 12) + 12) % 12);
      resultMidis.push(nextMidi);
      currentTop = nextMidi;
    });

    return resultMidis.sort((a, b) => a - b);
  }

  // Klassieke Inversie of Vrije Inversie (ii-V-I)
  const invIndex = question.mode === 'free_inversion'
    ? (isRightHand ? 1 : 0)
    : (isRightHand ? question.rhInv : question.lhInv);

  const orderedPcs = [];
  const totalNotes = question.allowedPcs.length;
  for (let i = 0; i < totalNotes; i++) {
    orderedPcs.push(question.allowedPcs[(invIndex + i) % totalNotes]);
  }

  let firstMidi = baseOctaveMidi + ((orderedPcs[0] - (baseOctaveMidi % 12) + 12) % 12);
  if (!isRightHand && firstMidi > 55) firstMidi -= 12;
  if (isRightHand && firstMidi < 60) firstMidi += 12;

  const resultMidis = [firstMidi];
  let prev = firstMidi;
  for (let i = 1; i < orderedPcs.length; i++) {
    const pc = orderedPcs[i];
    const nextMidi = prev + 1 + ((pc - ((prev + 1) % 12) + 12) % 12);
    resultMidis.push(nextMidi);
    prev = nextMidi;
  }

  return resultMidis;
};

// ============================================================================
// 5. VALIDATIE PER HAND (Klassiek, Slash & Vrije Inversie)
// ============================================================================
window.validateSingleHand = function (handMidis, question, isRightHand) {
  const needed = question.handSize;

  if (!handMidis || handMidis.length === 0) {
    return { valid: false, statusText: 'Wacht op aanslag...', tone: 'neutral' };
  }

  if (handMidis.length < needed) {
    return {
      valid: false,
      statusText: `Nog ${needed - handMidis.length} noot nodig (${handMidis.length}/${needed})`,
      tone: 'pending'
    };
  }

  if (handMidis.length > needed) {
    return {
      valid: false,
      statusText: `Te veel noten (${handMidis.length}/${needed})`,
      tone: 'error'
    };
  }

  const sorted = [...handMidis].sort((a, b) => a - b);
  const pcs = sorted.map((m) => ((m % 12) + 12) % 12);
  const uniquePcs = new Set(pcs);

  // Controleer of alle noten in de hand unieke pitch classes zijn (geen octaaf-verdubbeling binnen 1 hand)
  if (uniquePcs.size !== needed) {
    return {
      valid: false,
      statusText: 'Geen dubbele noten in 1 hand',
      tone: 'error'
    };
  }

  // Controleer of elke gespeelde noot in de toegestane akkoordpool zit
  for (const pc of pcs) {
    if (!question.allowedPcs.includes(pc)) {
      const wrongName = window.pcToNoteName(pc, question.rootPc);
      return {
        valid: false,
        statusText: `❌ Foute noot: ${wrongName}`,
        tone: 'error'
      };
    }
  }

  const lowestPc = pcs[0];

  // A. Vrije Inversie (Blinde ii-V-I modus) -> elke volgorde van de juiste akkoordtonen telt!
  if (question.mode === 'free_inversion') {
    return {
      valid: true,
      statusText: '✅ Akkoord Correct!',
      tone: 'success'
    };
  }

  // B. Hybride Slash-Chord Modus (9, 11, 13)
  if (question.mode === 'slash') {
    const expectedBassPc = isRightHand ? question.rhBassPc : question.lhBassPc;
    const expectedBassName = isRightHand ? question.rhBassName : question.lhBassName;

    if (lowestPc !== expectedBassPc) {
      return {
        valid: false,
        statusText: `❌ Bas moet ${expectedBassName} zijn`,
        tone: 'error'
      };
    }

    if (!uniquePcs.has(question.requiredPc)) {
      return {
        valid: false,
        statusText: `❌ Mis ${question.requiredLabel} (${question.requiredNoteName})`,
        tone: 'error'
      };
    }

    return {
      valid: true,
      statusText: '✅ Slash Voicing OK!',
      tone: 'success'
    };
  }

  // C. Klassieke Inversie Modus (Drieklanken & Sevenths)
  const expectedBassPc = isRightHand ? question.rhBassPc : question.lhBassPc;
  const expectedBassName = window.pcToNoteName(expectedBassPc, question.rootPc);

  if (lowestPc !== expectedBassPc) {
    return {
      valid: false,
      statusText: `❌Verkeerde omkering (zet ${expectedBassName} onderop)`,
      tone: 'error'
    };
  }

  // Controleer bij gesloten/klassieke ligging ook de volgorde van laag naar hoog
  const invIdx = isRightHand ? question.rhInv : question.lhInv;
  const expectedOrder = [];
  for (let i = 0; i < needed; i++) {
    expectedOrder.push(question.allowedPcs[(invIdx + i) % needed]);
  }

  for (let i = 0; i < needed; i++) {
    if (pcs[i] !== expectedOrder[i]) {
      return {
        valid: false,
        statusText: '❌ Volgorde binnen inversie klopt niet',
        tone: 'error'
      };
    }
  }

  return {
    valid: true,
    statusText: '✅ Inversie Correct!',
    tone: 'success'
  };
};

// ============================================================================
// 6. WEB AUDIO SYNTHESIZER (Warm Elektrisch Piano Geluid)
// ============================================================================
window.audioCtx = null;

window.ensureAudioContext = function () {
  if (!window.audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      window.audioCtx = new AudioContextClass();
    }
  }
  if (window.audioCtx && window.audioCtx.state === 'suspended') {
    window.audioCtx.resume();
  }
  return window.audioCtx;
};

window.playMidiNotesAudio = function (midiArray, durationSec = 1.1) {
  const ctx = window.ensureAudioContext();
  if (!ctx || !midiArray || midiArray.length === 0) return;

  const now = ctx.currentTime;
  const perNoteGain = Math.min(0.18, 0.75 / Math.max(1, midiArray.length));

  midiArray.forEach((midi) => {
    const freq = 440 * Math.pow(2, (midi - 69) / 12);

    const oscMain = ctx.createOscillator();
    const oscWarm = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscMain.type = 'triangle';
    oscWarm.type = 'sine';

    oscMain.frequency.setValueAtTime(freq, now);
    oscWarm.frequency.setValueAtTime(freq * 2, now); // Zachte boventoon

    const warmGain = ctx.createGain();
    warmGain.gain.setValueAtTime(0.18, now);

    gainNode.gain.setValueAtTime(0.0001, now);
    gainNode.gain.exponentialRampToValueAtTime(perNoteGain, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(perNoteGain * 0.45, now + 0.25);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + durationSec);

    oscMain.connect(gainNode);
    oscWarm.connect(warmGain);
    warmGain.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscMain.start(now);
    oscWarm.start(now);
    oscMain.stop(now + durationSec + 0.05);
    oscWarm.stop(now + durationSec + 0.05);
  });
};
