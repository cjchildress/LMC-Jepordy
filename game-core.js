(function (root) {
  'use strict';
  function validateGame(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('The game must be a JSON object.');
    if (raw.schemaVersion !== undefined && raw.schemaVersion !== 1) throw new Error('Unsupported game format. Use schemaVersion 1.');
    function required(value, label, max) {
      if (typeof value !== 'string' || !value.trim()) throw new Error(label + ' is required.');
      if (value.trim().length > max) throw new Error(label + ' must be ' + max + ' characters or fewer.');
      return value.trim();
    }
    const title = required(raw.title, 'Game title', 80);
    function categoriesFor(items, roundLabel, maxDoubles) {
    if (!Array.isArray(items) || items.length < 1 || items.length > 8) throw new Error(roundLabel + ': use 1 to 8 categories.');
    let dailyCount = 0;
    const categories = items.map((category, ci) => {
      const label = 'Category ' + (ci + 1);
      if (!category || typeof category !== 'object') throw new Error(label + ' must be an object.');
      const name = required(category.name, label + ' name', 40);
      if (!Array.isArray(category.questions) || category.questions.length < 1 || category.questions.length > 8) throw new Error(label + ' needs 1 to 8 questions.');
      const questions = category.questions.map((q, qi) => {
        const prefix = name + ', question ' + (qi + 1);
        if (!q || typeof q !== 'object') throw new Error(prefix + ' must be an object.');
        if (!Number.isInteger(q.value) || q.value < 1 || q.value > 100000) throw new Error(prefix + ': points must be a whole number from 1 to 100,000.');
        if (q.reference !== undefined && typeof q.reference !== 'string') throw new Error(prefix + ': Scripture reference must be text.');
        const reference = (q.reference || '').trim();
        if (reference.length > 150) throw new Error(prefix + ': Scripture reference must be 150 characters or fewer.');
        if (q.dailyDouble !== undefined && typeof q.dailyDouble !== 'boolean') throw new Error(prefix + ': Daily Double must be true or false.');
        if (q.dailyDouble) dailyCount++;
        return { value: q.value, question: required(q.question, prefix + ' text', 600), answer: required(q.answer, prefix + ' answer', 600), reference, ...(q.dailyDouble ? {dailyDouble:true} : {}) };
      });
      return { name, questions };
    });
    if (dailyCount > maxDoubles) throw new Error(roundLabel + ' allows up to ' + maxDoubles + ' Daily Double' + (maxDoubles === 1 ? '.' : 's.'));
    return categories;
    }
    const game = { schemaVersion:1, title, categories:categoriesFor(raw.categories, 'Round 1', 1) };
    if (raw.doubleJeopardy != null) game.doubleJeopardy = { categories:categoriesFor(raw.doubleJeopardy.categories, 'Double Jeopardy', 2) };
    if (raw.finalJeopardy != null) {
      const f = raw.finalJeopardy;
      const reference = f.reference === undefined ? '' : f.reference;
      if (typeof reference !== 'string' || reference.length > 150) throw new Error('Final Jeopardy reference must be text, up to 150 characters.');
      game.finalJeopardy = { category:required(f.category,'Final Jeopardy category',40), question:required(f.question,'Final Jeopardy question',600), answer:required(f.answer,'Final Jeopardy answer',600), reference:reference.trim() };
    }
    return game;
  }
  function roundCategories(game, round = 'single') { return round === 'double' ? game.doubleJeopardy?.categories || [] : game.categories; }
  function questionFor(state, key) {
    const parts = key.split(':'), round = parts[0] === 'double' ? 'double' : 'single';
    if (state.round && state.round !== round) throw new Error('That question is in another round.');
    const indices = (round === 'double' ? parts.slice(1) : parts).map(Number);
    if (indices.length !== 2 || indices.some(i=>!Number.isInteger(i)||i<0)) throw new Error('Invalid question.');
    const q = roundCategories(state.game,round)[indices[0]]?.questions[indices[1]];
    if (!q) throw new Error('Invalid question.');
    return q;
  }
  function wagerLimit(state, team, kind = 'daily-double') {
    if (team !== 0 && team !== 1) throw new Error('Choose a team.');
    const score = Math.max(0,state.teams[team].score);
    return kind === 'final' ? score : Math.max(score,...roundCategories(state.game,state.round).flatMap(c=>c.questions.map(q=>q.value)));
  }
  function validateWager(amount, maximum) {
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > maximum) throw new Error('Wager must be a whole number from 0 to ' + maximum.toLocaleString('en-US') + ' points.');
    return amount;
  }
  function settleClue(state, outcome, deductWrong) {
    const { key, value, attempted, winner } = outcome;
    if (state.used[key]) throw new Error('That question has already been played.');
    const q = questionFor(state,key);
    if (!q || q.value !== value) throw new Error('Invalid question.');
    if (winner !== null && winner !== 0 && winner !== 1) throw new Error('Choose a team.');
    if (!Array.isArray(attempted) || attempted.some(i => i !== 0 && i !== 1)) throw new Error('Invalid responding team.');
    const missed = [...new Set(attempted)];
    if (missed.includes(winner)) throw new Error('A team that already missed cannot score this question.');
    const nextTeam = winner === null ? (outcome.nextTeam ?? 1 - state.activeTeam) : winner;
    if (nextTeam !== 0 && nextTeam !== 1) throw new Error('Choose the next team.');
    return {
      teams: state.teams.map((team, index) => ({ ...team, score: team.score + (winner === index ? value : 0) - (deductWrong && missed.includes(index) ? value : 0) })),
      used: { ...state.used, [key]: { winner, missed } },
      activeTeam: nextTeam
    };
  }
  function answerClue(state, clue, answer, deductWrong) {
    if (clue.team !== 0 && clue.team !== 1) throw new Error('Choose the answering team.');
    if (clue.attempted.includes(clue.team)) throw new Error('That team has already attempted this question.');
    if (!['no-answer', 'incorrect', 'correct'].includes(answer)) throw new Error('Choose an answer outcome.');
    if (clue.kind === 'daily-double') {
      if (state.used[clue.key]) throw new Error('That question has already been played.');
      const question = questionFor(state,clue.key);
      if (!question.dailyDouble) throw new Error('That question is not a Daily Double.');
      const wager = validateWager(clue.wager,wagerLimit(state,clue.team));
      const correct = answer === 'correct';
      return { result: {
        teams:state.teams.map((t,i)=>({...t,score:t.score+(i===clue.team?(correct?wager:-wager):0)})),
        used:{...state.used,[clue.key]:{kind:'daily-double',wager,winner:correct?clue.team:null,missed:correct?[]:[clue.team]}},
        activeTeam:correct?clue.team:1-clue.team
      }};
    }
    const attempted = answer === 'incorrect' ? [...clue.attempted, clue.team] : [...clue.attempted];
    if (answer === 'incorrect' && new Set(attempted).size < 2) {
      return { clue: { ...clue, attempted, team: 1 - clue.team, revealed: false } };
    }
    return { result: settleClue(state, {
      key: clue.key, value: clue.value, attempted,
      winner: answer === 'correct' ? clue.team : null,
      nextTeam: 1 - clue.team
    }, deductWrong) };
  }
  function settleFinal(state, wagers, correct) {
    if (!state.game.finalJeopardy) throw new Error('Add a Final Jeopardy question first.');
    if (state.finalScored) throw new Error('Final Jeopardy has already been scored.');
    if (!Array.isArray(wagers)||wagers.length!==2||!Array.isArray(correct)||correct.length!==2||correct.some(c=>typeof c!=='boolean')) throw new Error('Enter both wagers and mark both answers.');
    wagers.forEach((w,i)=>validateWager(w,wagerLimit(state,i,'final')));
    return {teams:state.teams.map((t,i)=>({...t,score:t.score+(correct[i]?wagers[i]:-wagers[i])})),finalScored:true};
  }
  const api = { validateGame, settleClue, answerClue, roundCategories, questionFor, wagerLimit, validateWager, settleFinal };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.GameCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
