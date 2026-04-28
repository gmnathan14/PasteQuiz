console.log('Main script START');
window.onerror=function(msg,url,line,col,error){console.error('Script error:',msg,'at line',line)};
const S={text:'',difficulty:'medium',quizLength:5,questionType:'mixed',timedMode:true,enhance:false,questions:[],currentQ:0,answers:[],skippedIndices:[],inSkipRound:false,skipQueuePos:0,streak:0,maxStreak:0,correctCount:0,timedOutCount:0,timerInterval:null,timeLeft:0,timerPaused:false,harderRetry:false,pendingConf:false,modifying:false,targetedTopic:null,targetedHarder:false,askConfidence:true,bookmarked:[]};
const TIMER={easy:30,medium:20,hard:15};
const QUIZ_SESSION_KEY='pastequiz_session';
const QUIZ_SESSION_MAX_AGE=24*60*60*1000; // 24 hours

function saveQuizProgress(){
  try{
    const payload={
      savedAt:Date.now(),
      currentQ:S.currentQ,
      answers:S.answers,
      correctCount:S.correctCount,
      streak:S.streak,
      maxStreak:S.maxStreak,
      timedOutCount:S.timedOutCount,
      questions:S.questions,
      text:S.text,
      difficulty:S.difficulty,
      questionType:S.questionType,
      timedMode:S.timedMode,
      timeLeft:S.timeLeft,
      timerPaused:S.timerPaused,
      targetedTopic:S.targetedTopic,
      targetedHarder:S.targetedHarder,
      askConfidence:S.askConfidence,
      inSkipRound:S.inSkipRound,
      skipQueuePos:S.skipQueuePos,
      skippedIndices:S.skippedIndices
    };
    sessionStorage.setItem(QUIZ_SESSION_KEY,JSON.stringify(payload));
  }catch(e){console.warn('Progress save failed',e)}
}

function loadQuizProgress(){
  try{
    const raw=sessionStorage.getItem(QUIZ_SESSION_KEY);
    if(!raw)return null;
    const data=JSON.parse(raw);
    if(!data.savedAt||Date.now()-data.savedAt>QUIZ_SESSION_MAX_AGE){clearQuizProgress();return null}
    if(!data.questions||data.questions.length===0){clearQuizProgress();return null}
    return data;
  }catch(e){clearQuizProgress();return null}
}

function clearQuizProgress(){try{sessionStorage.removeItem(QUIZ_SESSION_KEY)}catch(e){}}

function showResumeBanner(){
  const banner=document.getElementById('resume-banner');
  if(banner)banner.classList.add('show');
}

function hideResumeBanner(){
  const banner=document.getElementById('resume-banner');
  if(banner)banner.classList.remove('show');
}

function resumeQuiz(){
  const data=loadQuizProgress();
  if(!data){hideResumeBanner();return}
  S.currentQ=data.currentQ||0;
  S.answers=data.answers||[];
  S.correctCount=data.correctCount||0;
  S.streak=data.streak||0;
  S.maxStreak=data.maxStreak||0;
  S.timedOutCount=data.timedOutCount||0;
  S.questions=data.questions||[];
  S.text=data.text||'';
  S.difficulty=data.difficulty||'medium';
  S.questionType=data.questionType||'mixed';
  S.timedMode=!!data.timedMode;
  S.timeLeft=data.timeLeft||0;
  S.timerPaused=!!data.timerPaused;
  S.targetedTopic=data.targetedTopic||null;
  S.targetedHarder=!!data.targetedHarder;
  S.askConfidence=!!data.askConfidence;
  S.inSkipRound=!!data.inSkipRound;
  S.skipQueuePos=data.skipQueuePos||0;
  S.skippedIndices=data.skippedIndices||[];
  hideResumeBanner();
  showScreen('screen-quiz');
  document.getElementById('loader').classList.remove('show');
  document.getElementById('quiz-body').style.display='block';
  renderQuestion();
  if(S.targetedTopic){
    const badge=document.getElementById('quiz-targeted-badge');
    if(badge){badge.textContent='Targeted: '+S.targetedTopic;badge.classList.add('show')}
    document.getElementById('quiz-breadcrumb').classList.add('show');
    addTargetedHarderToggle();
  }
  if(S.timedMode&&!S.timerPaused){startTimer()}
  else if(S.timedMode&&S.timerPaused){
    document.getElementById('timer-row').style.display='';
    updateTimerUI();
    document.getElementById('pause-btn').textContent='▶ Resume';
    document.getElementById('pause-btn').classList.add('paused');
  }
}

function startFresh(){
  clearQuizProgress();
  hideResumeBanner();
}


function login() {
  try {
    const username = document.getElementById("login-username");
    if (!username) { console.error("login-username not found"); return; }
    const val = username.value.trim();
    if (!val) { username.focus(); return; }
    localStorage.setItem("currentUser", val);
    updateUserDisplay();
    showScreen("screen-home");
  } catch(e) { console.error("login error:", e); }
}

function selectLen(n){S.quizLength=n;document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('selected',+t.dataset.len===n))}
function selectDiff(d){S.difficulty=d;document.querySelectorAll('.diff-tab').forEach(t=>t.classList.toggle('selected',t.dataset.diff===d))}
function selectQtype(qt){S.questionType=qt;document.querySelectorAll('.qtype-tab').forEach(t=>t.classList.toggle('selected',t.dataset.qtype===qt))}
function toggleSetting(key){S[key]=!S[key];const ids={timedMode:'toggle-timed',enhance:'toggle-enhance'};if(ids[key])document.getElementById(ids[key]).classList.toggle('on',S[key]);if(key==='timedMode')document.getElementById('timer-row').style.display=S.timedMode?'':'none'}
function toggleHarderRetry(){S.harderRetry=!S.harderRetry;document.getElementById('toggle-harder-retry').classList.toggle('on',S.harderRetry)}
function applySubject(btn){document.querySelectorAll('.subj-chip').forEach(b=>b.classList.remove('active'));btn.classList.add('active');selectDiff(btn.dataset.diff);selectQtype(btn.dataset.qtype)}

function showScreen(id){
  const current=document.querySelector('.screen.active');
  if(current&&current.id!==id){
    current.classList.add('leaving');
    setTimeout(()=>{current.classList.remove('active','leaving')},200);
    const next=document.getElementById(id);
    setTimeout(()=>{next.classList.add('active');window.scrollTo(0,0)},200);
  }else{
    document.getElementById(id).classList.add('active');window.scrollTo(0,0)
  }
}
function goHome(){clearTimer();S.text='';S.questions=[];S.answers=[];S.skippedIndices=[];S.inSkipRound=false;document.getElementById('start-btn').disabled=false;document.getElementById('notes-input').value='';renderRecentQuizzes();renderHomeStats();renderWeakTopicsBar();showScreen('screen-home')}
function confirmHome(){if(confirm('Leave quiz? Progress will be lost.'))goHome()}
function backToResults(){showScreen('screen-results')}
function showReview(){renderReview();showScreen('screen-review')}

function renderHomeStats(){
  const el=document.getElementById('home-stats-strip');const h=loadHistory();
  if(h.length===0){el.innerHTML='';return}
  const avg=Math.round(h.reduce((s,r)=>s+r.pct,0)/h.length);const best=Math.max(...h.map(r=>r.pct));
  el.innerHTML=`<div class="sstat-box"><div class="sstat-val">${h.length}</div><div class="sstat-lbl">Quizzes</div></div><div class="sstat-box"><div class="sstat-val">${avg}%</div><div class="sstat-lbl">Avg Score</div></div><div class="sstat-box"><div class="sstat-val">${best}%</div><div class="sstat-lbl">Best</div></div>`
}

// Cross-session weak topic map — aggregates topic performance across all saved quizzes
function computeWeakTopics(){
  const h=loadHistory();const topics={};
  h.forEach((r,i) => {
    (r.answers||[]).forEach(a => {
      if(!a.topic) return;
      if(!topics[a.topic]) topics[a.topic] = {correct:0,total:0,sessions:new Set(),scores:[]};
      topics[a.topic].total++;
      topics[a.topic].sessions.add(r.id);
      if(a.isCorrect) topics[a.topic].correct++;
      topics[a.topic].scores.push({pct: Math.round((a.isCorrect?1:0)*100), idx: i});
    });
  });
  Object.entries(topics).forEach(([name,d]) => {
    d.trend = d.scores.sort((a,b) => a.idx - b.idx).map(s => s.pct);
  });
  return Object.entries(topics)
    .filter(([,d]) => d.sessions.size >= 2 && (d.correct/d.total) < 0.5)
    .map(([name,d]) => ({name, pct: Math.round((d.correct/d.total)*100), sessions: d.sessions.size, trend: d.trend}))
    .sort((a,b) => a.pct - b.pct)
    .slice(0,6);
}

function renderWeakTopicsBar(){
  const bar=document.getElementById('weak-topics-bar');const list=document.getElementById('weak-topics-list');
  const weak=computeWeakTopics();
  if(weak.length===0){bar.style.display='none';return}
  bar.style.display='';list.innerHTML='';
  weak.forEach(w=>{
    const chip=document.createElement('span');chip.className='weak-topic-chip';
    chip.onclick=()=>startTargetedQuiz(w.name);
    const spark=renderSpark(w.trend||[]);
    chip.innerHTML=`${w.name} <span class="chip-pct">${w.pct}%</span>${spark}<span class="chip-arrow">↗</span>`;
    list.appendChild(chip);
  })
}

async function startQuiz(weaknessMode=false,weaknessQuestions=[]){
  const text=S.text||document.getElementById('notes-input').value.trim();
  const errEl=document.getElementById('home-error');errEl.classList.remove('show');
  if(!weaknessMode&&text.length<50){errEl.textContent='⚠ Paste at least 50 characters of notes.';errEl.classList.add('show');return}
  S.text=text;S.questions=[];S.currentQ=0;S.answers=[];S.skippedIndices=[];S.inSkipRound=false;S.skipQueuePos=0;S.streak=0;S.maxStreak=0;S.correctCount=0;S.timedOutCount=0;S.timerPaused=false;
  document.getElementById('start-btn').disabled=true;
  showScreen('screen-quiz');document.getElementById('loader').classList.add('show');document.getElementById('quiz-body').style.display='none';
  document.getElementById('loader-label').textContent=S.enhance&&!weaknessMode?'improving notes…':'generating quiz…';
  try{
    const res=await fetch('/api/quiz',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:S.text,difficulty:S.difficulty,length:weaknessMode?weaknessQuestions.length:S.quizLength,enhance:S.enhance&&!weaknessMode,weaknessMode,weaknessQuestions,harder:S.targetedTopic?S.targetedHarder:S.harderRetry,questionType:S.questionType})});
    const data=await res.json();
    if(!res.ok)throw new Error(data?.error||'API error');
    if(data.enhancedText)S.text=data.enhancedText;
    S.questions=data.questions;document.getElementById('loader').classList.remove('show');document.getElementById('quiz-body').style.display='block';renderQuestion();
  }catch(e){document.getElementById('start-btn').disabled=false;showScreen('screen-home');document.getElementById('home-error').textContent='⚠ '+e.message;document.getElementById('home-error').classList.add('show')}
}

function renderMath(el){if(typeof MathJax!=='undefined'&&MathJax.typesetPromise)MathJax.typesetPromise([el]).catch(()=>{})}

function renderQuestion(){
  const q=S.questions[S.currentQ],total=S.questions.length;
  document.getElementById('q-progress').textContent=`Q${S.currentQ+1} / ${total}`;
  document.getElementById('q-score').textContent=`${S.correctCount} correct`;
  document.getElementById('prog-fill').style.width=`${(S.currentQ/total)*100}%`;
  document.getElementById('streak-val').textContent=S.streak;
  document.getElementById('accuracy-val').textContent=S.answers.length>0?Math.round((S.correctCount/S.answers.length)*100)+'%':'—';
  document.getElementById('q-type-badge').textContent=q.type==='short'?'Free Response':q.type==='tf'?'True / False':'Multiple Choice';
  document.getElementById('q-number').textContent=`Question ${S.currentQ+1} of ${total}`;
  document.getElementById('q-text').textContent=q.question;
  ['timeout-badge','skipped-badge','expl-box','conf-prompt','conf-row','next-btn','modifying-overlay'].forEach(id=>document.getElementById(id).classList.remove('show'));
  document.getElementById('question-area').style.display='block';
  document.getElementById('go-deeper-btn').disabled=false;document.getElementById('go-deeper-btn').textContent='✦ Go deeper';
  document.getElementById('q-controls').querySelectorAll('.q-ctrl').forEach(b=>b.disabled=false);
  document.getElementById('conf-row').querySelectorAll('.conf-btn').forEach(b=>{b.disabled=false;b.classList.remove('selected-confident','selected-unsure','selected-guess')});
  S.timerPaused=false;document.getElementById('pause-btn').textContent='⏸ Pause';document.getElementById('pause-btn').classList.remove('paused');
  document.getElementById('skip-btn').style.display=S.inSkipRound?'none':'';
  const area=document.getElementById('answer-area');area.innerHTML='';
  if(q.type==='short'){
    area.innerHTML=`<input class="short-input" id="short-input" placeholder="Type your answer…"/><button class="submit-short" id="submit-short-btn" onclick="submitShortAnswer()">Submit →</button>`;
    document.getElementById('short-input').addEventListener('keydown',e=>{if(e.key==='Enter')submitShortAnswer()});
  }else{
    const grid=document.createElement('div');grid.className='options';
    const numMap={A:'1',B:'2',C:'3',D:'4'};
    q.options.forEach(opt=>{const letter=opt.charAt(0).toUpperCase();const btn=document.createElement('button');btn.className='option-btn';btn.textContent=(numMap[letter]||letter)+'. '+opt.slice(3).trim();btn.dataset.letter=letter;btn.onclick=()=>checkAnswer(btn,letter,q.answer.toUpperCase(),q.explanation);grid.appendChild(btn)});
    area.appendChild(grid);
  }
  S.pendingConf=false;
  if(S.timedMode)startTimer();else document.getElementById('timer-row').style.display='none';
  setTimeout(()=>renderMath(document.getElementById('question-area')),50);
}

enderQuestion=function(){
    var qa=document.getElementById('question-area');
    if(qa){qa.classList.add('question-exit');setTimeout(function(){qa.classList.remove('question-exit')},200)}
    _origRenderQuestion.call(this);
    if(S.targetedTopic){
      const badge=document.getElementById('quiz-targeted-badge');
      badge.textContent='Targeted: '+S.targetedTopic;
      badge.classList.add('show');
      document.getElementById('quiz-breadcrumb').classList.add('show');
      addTargetedHarderToggle();
    }
    if(!S.bookmarked)S.bookmarked=[];
    var btn=document.getElementById('bm-btn');
    if(btn){btn.textContent=S.bookmarked.indexOf(S.currentQ)>-1?'★':'☆';btn.classList.toggle('bookmarked',S.bookmarked.indexOf(S.currentQ)>-1)}
    startQuestionTimer();
    if(qa){qa.classList.add('question-enter');setTimeout(function(){qa.classList.remove('question-enter')},300)}
  };


function startTimer(){clearTimer();var timerSetting=localStorage.getItem('defaultTimer');if(timerSetting==='off'){document.getElementById('timer-row').style.display='none';return};var duration=timerSetting?+timerSetting:(TIMER[S.difficulty]||20);document.getElementById('timer-row').style.display='';S.timeLeft=duration;S.timerMax=duration;S.timerPaused=false;updateTimerUI();S.timerInterval=setInterval(()=>{if(S.timerPaused)return;S.timeLeft--;updateTimerUI();if(S.timeLeft<=0){clearTimer();handleTimeout()}},1000)}
function clearTimer(){if(S.timerInterval){clearInterval(S.timerInterval);S.timerInterval=null}}
function updateTimerUI(){const max=S.timerMax||TIMER[S.difficulty]||20,pct=(S.timeLeft/max)*100,state=S.timeLeft<=5?'danger':S.timeLeft<=10?'warn':'';document.getElementById('timer-num').textContent=S.timeLeft;document.getElementById('timer-num').className='timer-num '+state;document.getElementById('timer-bar').style.width=pct+'%';document.getElementById('timer-bar').className='timer-bar-fill '+state}
function togglePause(){if(!S.timerInterval)return;S.timerPaused=!S.timerPaused;document.getElementById('pause-btn').textContent=S.timerPaused?'▶ Resume':'⏸ Pause';document.getElementById('pause-btn').classList.toggle('paused',S.timerPaused);const overlay=document.getElementById('paused-overlay');if(overlay)overlay.classList.toggle('show',S.timerPaused);const qa=document.getElementById('question-area');if(qa)qa.classList.toggle('paused-blur',S.timerPaused);saveQuizProgress()}
  function toggleBookmark(){
    if(!S.questions||S.questions.length===0)return;
    var idx=S.currentQ;
    if(!S.bookmarked)S.bookmarked=[];
    var pos=S.bookmarked.indexOf(idx);
    if(pos>-1){S.bookmarked.splice(pos,1)}else{S.bookmarked.push(idx)}
    var btn=document.getElementById('bm-btn');
    if(btn){btn.textContent=S.bookmarked.indexOf(idx)>-1?'★':'☆';btn.classList.toggle('bookmarked',S.bookmarked.indexOf(idx)>-1)}
    saveQuizProgress();
  }
function handleTimeout(){const q=S.questions[S.currentQ];S.timedOutCount++;S.streak=0;disableAnswerArea(q.answer.toUpperCase());document.getElementById('timeout-badge').classList.add('show');showExplanation(q.explanation);document.getElementById('next-btn').classList.add('show');document.getElementById('q-controls').querySelectorAll('.q-ctrl').forEach(b=>b.disabled=true);S.answers.push({q,userAnswer:null,confidence:'timeout',isCorrect:false,timedOut:true,skipped:false});S.pendingConf=false;updateMeta();saveQuizProgress()}
function skipQuestion(){if(S.inSkipRound)return;clearTimer();S.skippedIndices.push(S.currentQ);document.getElementById('q-controls').querySelectorAll('.q-ctrl').forEach(b=>b.disabled=true);document.getElementById('skipped-badge').classList.add('show');document.getElementById('next-btn').classList.add('show');S.pendingConf=false;saveQuizProgress()}

function checkAnswer(btn,selected,correct,explanation){try{clearTimer();const isCorrect=selected.toUpperCase()===correct.toUpperCase();disableAnswerArea(correct,btn,isCorrect);if(isCorrect){S.correctCount++;S.streak++;S.maxStreak=Math.max(S.maxStreak,S.streak)}else S.streak=0;showExplanation(explanation);document.getElementById('q-controls').querySelectorAll('.q-ctrl').forEach(b=>b.disabled=true);if(S.askConfidence){showConfidenceUI();S.pendingConf=true}else{document.getElementById('next-btn').classList.add('show');tryAutoAdvance()}S.answers.push({q:S.questions[S.currentQ],userAnswer:selected,confidence:S.askConfidence?null:'n/a',isCorrect,timedOut:false,skipped:false});updateMeta()
    if(S.targetedTopic){saveTopicBest(S.targetedTopic,Math.round((S.correctCount/S.answers.length)*100))}saveQuizProgress()}catch(e){console.error('checkAnswer error:',e);alert('Error in checkAnswer: '+e.message)}}

async function submitShortAnswer(){
  const input=document.getElementById('short-input'),userAnswer=input.value.trim();if(!userAnswer)return;clearTimer();input.disabled=true;document.getElementById('submit-short-btn').disabled=true;document.getElementById('q-controls').querySelectorAll('.q-ctrl').forEach(b=>b.disabled=true);document.getElementById('expl-box').classList.add('show');document.getElementById('expl-text-explain').innerHTML=renderMarkdown('Evaluating…');
  try{
    const q=S.questions[S.currentQ];
    const res=await fetch('/api/evaluate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:q.question,userAnswer,correctAnswer:q.answer})});
    const data=await res.json();
    const isCorrect=data.correct===true;
    if(isCorrect){S.correctCount++;S.streak++;S.maxStreak=Math.max(S.maxStreak,S.streak);input.style.borderColor='var(--correct)';input.style.color='var(--correct)'}
    else{S.streak=0;input.style.borderColor='var(--wrong)';input.style.color='var(--wrong)'}
    document.getElementById('expl-text-explain').innerHTML=renderMarkdown(data.feedback||q.explanation||'');
    if(S.askConfidence){showConfidenceUI();S.pendingConf=true}
    else{document.getElementById('next-btn').classList.add('show');tryAutoAdvance()}
    S.answers.push({q,userAnswer,confidence:S.askConfidence?null:'n/a',isCorrect,timedOut:false,skipped:false});
    updateMeta();saveQuizProgress();
  }catch(e){
    const q=S.questions[S.currentQ];
    document.getElementById('expl-text-explain').innerHTML=renderMarkdown('Could not evaluate. Correct answer: '+q.answer);
    S.answers.push({q,userAnswer,confidence:null,isCorrect:false,timedOut:false,skipped:false});
    document.getElementById('next-btn').classList.add('show');tryAutoAdvance();S.pendingConf=false;saveQuizProgress();
  }
}

function disableAnswerArea(correct,clickedBtn,isCorrect){const cl=(correct||'').toUpperCase();document.getElementById('answer-area').querySelectorAll('.option-btn').forEach(b=>{b.disabled=true;if(b.dataset.letter===cl){b.classList.add('revealed');if(b===clickedBtn&&isCorrect)b.classList.add('correct')}});if(clickedBtn&&!isCorrect)clickedBtn.classList.add('wrong')}
function showExplanation(text){if(!text)return;document.getElementById('expl-text-explain').innerHTML=renderMarkdown(text);document.getElementById('expl-box').classList.add('show');setTimeout(()=>renderMath(document.getElementById('expl-box')),50)}
function showConfidenceUI(){if(!S.askConfidence)return;document.getElementById('conf-prompt').classList.add('show');document.getElementById('conf-row').classList.add('show')}
function setConf(level){if(!S.pendingConf)return;const last=S.answers[S.answers.length-1];if(last)last.confidence=level;S.pendingConf=false;const map={confident:'selected-confident',unsure:'selected-unsure',guess:'selected-guess'};document.getElementById('conf-row').querySelectorAll('.conf-btn').forEach(b=>{b.disabled=true;if(b.textContent.toLowerCase()===level)b.classList.add(map[level])});document.getElementById('next-btn').classList.add('show')}
function toggleConfidence(){S.askConfidence=!S.askConfidence;const btn=document.getElementById('conf-toggle-btn');if(btn){btn.textContent=S.askConfidence?'🎯 Conf':'🎯 Conf (off)';btn.classList.toggle('off',!S.askConfidence)}if(!S.askConfidence&&S.pendingConf){S.pendingConf=false;const last=S.answers[S.answers.length-1];if(last&&!last.confidence)last.confidence='n/a';document.getElementById('next-btn').classList.add('show')}}
function updateMeta(){document.getElementById('q-score').textContent=`${S.correctCount} correct`;document.getElementById('streak-val').textContent=S.streak;const a=S.answers.length;document.getElementById('accuracy-val').textContent=a>0?Math.round((S.correctCount/a)*100)+'%':'—'}

async function goDeeper() {
  const btn = document.getElementById('go-deeper-btn');
  btn.disabled = true;
  btn.textContent = 'Loading…';
  const q = S.questions[S.currentQ];
  try {
    const res = await fetch('/api/deeper', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: q.question,
        answer: q.answer,
        explanation: q.explanation,
        userAnswer: S.answers[S.currentQ]?.userAnswer,
        userWasCorrect: S.answers[S.currentQ]?.isCorrect
      })
    });
    if (!res.ok) throw new Error('Server error: ' + res.status);
    const data = await res.json();
    document.getElementById('expl-text-explain').innerHTML = 
      renderMarkdown(data.deeper || data.explanation || q.explanation);
    setTimeout(() => renderMath(document.getElementById('expl-box')), 50);
    btn.textContent = '✓ Go deeper';
    btn.disabled = false;
  } catch(e) {
    console.error(e);
    document.getElementById('expl-text-explain').textContent = 'Failed to load. Try again.';
    btn.textContent = '✦ Go deeper';
    btn.disabled = false;
  }
}

async function modifyQ(action){if(S.modifying)return;S.modifying=true;document.getElementById('question-area').style.display='none';document.getElementById('modifying-overlay').classList.add('show');document.getElementById('mod-label').textContent={regenerate:'regenerating…',harder:'making harder…',easier:'making easier…'}[action]||'modifying…';try{const res=await fetch('/api/modify',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:S.questions[S.currentQ],action,text:S.text})});const data=await res.json();if(!res.ok)throw new Error(data?.error||'Modify failed');S.questions[S.currentQ]=data.question;clearTimer();document.getElementById('modifying-overlay').classList.remove('show');document.getElementById('question-area').style.display='block';S.modifying=false;renderQuestion()}catch(e){document.getElementById('modifying-overlay').classList.remove('show');document.getElementById('question-area').style.display='block';S.modifying=false}}

function nextQuestion(){
  if(S.pendingConf){const last=S.answers[S.answers.length-1];if(last&&!last.confidence)last.confidence='guess';S.pendingConf=false}
  if(S.inSkipRound){S.skipQueuePos++;if(S.skipQueuePos>=S.skippedIndices.length)showResults();else{S.currentQ=S.skippedIndices[S.skipQueuePos];renderQuestion()}return}
  let next=S.currentQ+1;while(next<S.questions.length&&S.skippedIndices.includes(next))next++;
  if(next>=S.questions.length){if(S.skippedIndices.length>0){S.inSkipRound=true;S.skipQueuePos=0;S.currentQ=S.skippedIndices[0];renderQuestion()}else showResults()}
  else{S.currentQ=next;renderQuestion();saveQuizProgress()}
}

document.addEventListener('keydown',e=>{
  if(!document.getElementById('screen-quiz').classList.contains('active'))return;
  if(document.getElementById('quiz-body').style.display==='none')return;
  const tag=document.activeElement.tagName.toLowerCase();if(tag==='input'||tag==='textarea')return;
  if(['1','2','3','4'].includes(e.key)){const btns=document.getElementById('answer-area').querySelectorAll('.option-btn');if(btns[parseInt(e.key)-1]&&!btns[parseInt(e.key)-1].disabled)btns[parseInt(e.key)-1].click()}
  else if(e.code==='Space'){e.preventDefault();togglePause()}
  else if(e.key==='s'||e.key==='S'){const sb=document.getElementById('skip-btn');if(sb&&!sb.disabled&&sb.style.display!=='none')sb.click()}
  else if(e.key==='Enter'){const nb=document.getElementById('next-btn');if(nb&&nb.classList.contains('show'))nb.click()}
});

// ── RESULTS ──────────────────────────────────────────────────────────────────
function showResults(){
  clearTimer();clearQuizProgress();
  saveBestStreak();
    var bestStreak=getBestStreak();
  if(S.targetedTopic){
    const el=document.getElementById('res-msg');
    el.textContent='Targeted quiz: '+S.targetedTopic+'. '+el.textContent;
  }
  cleanupTargetedMode();
  const total=S.answers.length,pct=total>0?Math.round((S.correctCount/total)*100):0;
  const hero=document.querySelector('.results-hero');
  hero.classList.remove('celebrate','motivate');
  if(pct>=80)hero.classList.add('celebrate');
  else if(pct<45)hero.classList.add('motivate');
  const msgs=pct>=95?[
    '🎉 Perfect! You\'ve completely mastered this material!',
    'Incredible work — you\'re ready for anything.',
    '🏆 Flawless. Every concept locked in.',
    'Outstanding! You know this inside and out.'
  ]:pct>=80?[
    'Excellent! You\'ve nailed most of this. 🎯',
    'Strong performance — just a few details to polish.',
    '🎯 Great job! You\'re in the top tier.',
    'Well done — you\'ve got a solid grip on this.'
  ]:pct>=60?[
    'Good progress! You\'re getting there. 💪',
    'Solid effort. A few gaps to clean up.',
    'You\'ve got the basics down. Keep going!',
    'Nice work — you know most of it. 🎯'
  ]:pct>=45?[
    'You\'re building the foundation. Keep at it! 💪',
    'Not bad! Review the missed ones and retry.',
    'Getting there. A few more reps will do it.',
    'Decent start. Focus on the weak spots.'
  ]:[
    'That was tough. Let\'s break this down and try again. 💪',
    'Don\'t worry — every expert was once a beginner.',
    'You\'re just getting started. Review and retry the missed ones!',
    'Keep going! The first attempt is always the hardest.'
  ];
  var streakEl=document.querySelector('.results-hero');
    if(streakEl){streakEl.innerHTML+='<div style="font-size:0.9rem;color:var(--muted);margin-top:8px">Current streak: '+S.maxStreak+' | Best all-time: '+getBestStreak()+'</div>'}
  const msg=msgs[Math.floor(Math.random()*msgs.length)];
  const [scoreEl,msgEl,wrongEl,timeoutEl,streakStatEl,blindEl,luckyEl,solidEl,insightEl]=
    ['res-score','res-msg','stat-correct','stat-timeout','stat-streak','ca-blind','ca-lucky','ca-solid','conf-insight'].map(id=>document.getElementById(id));
  scoreEl.textContent=`${S.correctCount}/${total}`;
  msgEl.textContent=msg;
  wrongEl.textContent=S.answers.filter(a=>!a.isCorrect&&!a.timedOut&&!a.skipped).length;
  timeoutEl.textContent=S.timedOutCount;
  streakStatEl.textContent=S.maxStreak;
  renderConceptBreakdown();
  const blind=S.answers.filter(a=>a.confidence==='confident'&&!a.isCorrect).length;
  const lucky=S.answers.filter(a=>(a.confidence==='unsure'||a.confidence==='guess')&&a.isCorrect).length;
  const solid=S.answers.filter(a=>a.confidence==='confident'&&a.isCorrect).length;
  blindEl.textContent=blind;luckyEl.textContent=lucky;solidEl.textContent=solid;
  insightEl.textContent=blind>2?'⚠ Confident but wrong on '+blind+' questions — these are your real blind spots.':
    lucky>2?'✦ Got '+lucky+' right while unsure — you\'re closer than you think.':
    solid>=total*0.6?'✓ Strong signal: most of what you know, you know correctly.':
    'Track your confidence next round to identify real gaps vs lucky guesses.';
    
  const blindAnswers=S.answers.filter(a=>a.confidence==='confident'&&!a.isCorrect&&!a.timedOut);
  const luckyWrong=S.answers.filter(a=>(a.confidence==='unsure'||a.confidence==='guess')&&!a.isCorrect&&!a.timedOut);
  const plainWrong=S.answers.filter(a=>!a.isCorrect&&!a.timedOut&&a.confidence!=='confident'&&a.confidence!=='unsure'&&a.confidence!=='guess');
  const timedOut=S.answers.filter(a=>a.timedOut);
  const missed=S.answers.filter(a=>!a.isCorrect||a.timedOut);
  const rb=document.getElementById('retry-missed-btn');rb.disabled=missed.length===0;rb.textContent=missed.length>0?`↺ Retry Missed (${missed.length})`:'✓ No misses!';
  const srn=document.getElementById('smart-retry-note');
  srn.style.display=(blind>0&&missed.length>0)?'':'none';
  S._smartMissed=[...blindAnswers,...luckyWrong,...plainWrong,...timedOut];
  showScreen('screen-results');resetTutor();saveQuizToHistory();
  if(blind>0){
    setTimeout(()=>{if(!tutorOpen){toggleTutor()}},800);
  }
  if(S.targetedTopic){
      var topicBest=getTopicBest(S.targetedTopic);
      var currentPct=Math.round((S.correctCount/total)*100);
      if(topicBest>0){
        el.innerHTML+='<div style="font-size:0.85rem;color:'+(currentPct>=topicBest?'var(--correct)':'var(--muted)')+';margin-top:6px">'+S.targetedTopic+' best: '+topicBest+'% (you: '+currentPct+'%)</div>'
      }
    }
  renderBookmarkedOnResults();
}

 function saveBestStreak(){
    try{
      var best=localStorage.getItem('pastequiz_best_streak');
      best=best?parseInt(best):0;
      if(S.maxStreak>best){localStorage.setItem('pastequiz_best_streak',S.maxStreak)}
    }catch(e){}
  }
  function getBestStreak(){
    try{return parseInt(localStorage.getItem('pastequiz_best_streak')||'0')}
    catch(e){return 0}
  }

// Retry missed in smart order (blind spots first)
function retryMissed(){
  const ordered=S._smartMissed&&S._smartMissed.length>0?S._smartMissed:S.answers.filter(a=>!a.isCorrect||a.timedOut);
  startQuiz(true,ordered.map(a=>a.q));
}

/* HISTORY CHART */
function renderAccuracyTrend(){
    var el=document.getElementById('history-trend-chart');
    if(!el){
      el=document.createElement('div');
      el.id='history-trend-chart';
      el.style.marginTop='24px';
      var histSec=document.getElementById('screen-history');
      if(histSec)histSec.appendChild(el);
    }
    var h=loadHistory();
    if(!h||h.length<2){el.style.display='none';return}
    var last10=h.slice(0,10).reverse();
    el.style.display='';
    var width=300,height=100;
    var html='<div style="font-size:0.72rem;font-weight:600;color:var(--muted);margin-bottom:8px">Accuracy Trend (Last 10)</div>';
    html+='<div style="position:relative;width:'+width+'px;height:'+height+'px;border-left:1px solid var(--border);border-bottom:1px solid var(--border);background:rgba(99,102,241,0.03)">';
    for(var i=0;i<last10.length;i++){
      var x=(i/(last10.length-1))*width;
      var y=height-(last10[i].pct/100)*height;
      html+='<div style="position:absolute;left:'+(x-3)+'px;top:'+(y-3)+'px;width:6px;height:6px;border-radius:50%;background:var(--accent)"></div>';
      if(i>0){
        var prevX=((i-1)/(last10.length-1))*width;
        var prevY=height-(last10[i-1].pct/100)*height;
        html+='<svg style="position:absolute;top:0;left:0;width:'+width+'px;height:'+height+'px"><line x1="'+prevX+'" y1="'+prevY+'" x2="'+x+'" y2="'+y+'" style="stroke:var(--accent);stroke-width:2" /></svg>';
      }
      html+='<div style="position:absolute;bottom:-18px;left:'+(x-10)+'px;font-size:0.65rem;color:var(--muted)">'+last10[i].pct+'%</div>';
    }
    html+='</div>';
    el.innerHTML=html;
  }

function saveTopicBest(topic,score){
    if(!topic)return;
    try{
      var key='pastequiz_topic_best_'+topic.replace(/[^a-z0-9]/gi,'_');
      var best=localStorage.getItem(key);
      best=best?parseInt(best):0;
      if(score>best){localStorage.setItem(key,score)}
    }catch(e){}
  }
  function getTopicBest(topic){
    if(!topic)return 0;
    try{return parseInt(localStorage.getItem('pastequiz_topic_best_'+topic.replace(/[^a-z0-9]/gi,'_'))||'0')}
    catch(e){return 0}
  }

function renderConceptBreakdown(){
  const topics={};S.answers.forEach(a=>{const t=(a.q&&a.q.topic)?a.q.topic:null;if(!t)return;if(!topics[t])topics[t]={correct:0,total:0};topics[t].total++;if(a.isCorrect)topics[t].correct++});
  const entries=Object.entries(topics).sort((a,b)=>(a[1].correct/a[1].total)-(b[1].correct/b[1].total));
  const el=document.getElementById('concept-breakdown');if(entries.length<2){el.style.display='none';return}el.style.display='';
  const list=document.getElementById('concept-list');list.innerHTML='';
  entries.forEach(([topic,d])=>{const pct=Math.round((d.correct/d.total)*100);const color=pct>=75?'var(--correct)':pct>=45?'var(--warning)':'var(--wrong)';list.innerHTML+=`<div class="concept-item"><span class="concept-name">${topic}</span><div class="concept-bar-wrap"><div class="concept-bar-fill" style="width:${pct}%;background:${color}"></div></div><span class="concept-pct" style="color:${color}">${pct}%</span></div>`});
}

function renderReview(){
  const list=document.getElementById('review-list');list.innerHTML='';
  S.answers.forEach((a,i)=>{
    const {q,userAnswer,confidence,isCorrect,timedOut,skipped}=a;
    let fh='';
    if(skipped)fh='<span class="review-flag flag-skipped">Skipped</span>';
    else if(timedOut)fh='<span class="review-flag flag-wrong">Timed Out</span>';
    else if(!isCorrect)fh='<span class="review-flag flag-wrong">Wrong</span>';
    if(confidence==='confident'&&!isCorrect)fh+=' <span class="review-flag flag-blind">⚠ Blind Spot</span>';
    else if((confidence==='unsure'||confidence==='guess')&&isCorrect)fh+=' <span class="review-flag flag-lucky">✦ Lucky</span>';
    else if(confidence==='confident'&&isCorrect)fh+=' <span class="review-flag flag-solid">✓ Solid</span>';
    const ua=skipped?'(skipped)':timedOut?'(timed out)':(userAnswer||'(no answer)');
    const cl=confidence&&confidence!=='timeout'?`Confidence: ${confidence}`:'';
    const tl=q.type==='short'?'Free Response':q.type==='tf'?'True / False':'Multiple Choice';
    list.innerHTML+=`<div class="review-item" style="animation-delay:${i*.04}s"><div class="review-q-num">Q${i+1} · ${tl}${q.topic?' · '+q.topic:''}</div>${fh?`<div style="margin-bottom:8px">${fh}</div>`:''}<div class="review-q-text">${q.question}</div><div class="review-answers"><span class="review-ans ${isCorrect?'correct-a':'wrong-a'}">Your answer: ${ua}</span><span class="review-ans correct-a">Correct: ${q.answer}</span>${cl?`<span class="review-ans yours">${cl}</span>`:''}</div>${q.explanation?`<div class="review-expl">${q.explanation}</div>`:''}</div>`;
  });
}

// ── HISTORY ──────────────────────────────────────────────────────────────────
const HISTORY_KEY='pastequiz_history_v1';
function saveQuizToHistory(){
  try{
    const total=S.answers.length;if(total===0)return;
    const pct=Math.round((S.correctCount/total)*100);
    const record={id:Date.now(),date:new Date().toISOString(),difficulty:S.difficulty,questionType:S.questionType,total,correct:S.correctCount,pct,maxStreak:S.maxStreak,timedOutCount:S.timedOutCount,notesSnippet:S.text?S.text.slice(0,300):'',fullNotes:S.text||'',questions:S.questions,answers:S.answers.map(a=>({question:a.q?a.q.question:'',userAnswer:a.userAnswer,correctAnswer:a.q?a.q.answer:'',explanation:a.q?a.q.explanation:'',topic:a.q?a.q.topic:'',type:a.q?a.q.type:'mc',options:a.q?a.q.options:[],isCorrect:a.isCorrect,confidence:a.confidence,timedOut:a.timedOut,skipped:a.skipped}))};
    const ex=loadHistory();ex.unshift(record);if(ex.length>50)ex.splice(50);localStorage.setItem(HISTORY_KEY,JSON.stringify(ex));showSaveToast();
  }catch(e){console.warn('History save failed',e)}
}
function loadHistory(){try{return JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]')}catch{return[]}}
function deleteHistoryRecord(id){
  if(!confirm('Delete this quiz session?'))return;
  const h=loadHistory().filter(r=>r.id!==id);
  localStorage.setItem(HISTORY_KEY,JSON.stringify(h));
  renderHistoryList(h);renderHistorySummary(h);renderHistoryWeakTopics(h);
}
function showSaveToast(){let t=document.getElementById('save-toast');if(!t){t=document.createElement('div');t.id='save-toast';t.style.cssText='position:fixed;bottom:28px;right:28px;background:var(--panel);border:1px solid var(--border);border-left:2px solid var(--correct);border-radius:8px;padding:10px 18px;font-size:0.78rem;color:var(--correct);font-weight:500;z-index:1000;opacity:0;transition:opacity .25s;pointer-events:none;';t.textContent='✓ Quiz saved to history';document.body.appendChild(t)}t.style.opacity='1';setTimeout(()=>{t.style.opacity='0'},2200)}

let _historyFilter='all',_currentDetailRecord=null;
function showHistoryScreen(){const h=loadHistory();_historyFilter='all';document.querySelectorAll('.hfilter-btn').forEach(b=>b.classList.toggle('active',b.dataset.filter==='all'));renderHistorySummary(h);renderHistoryWeakTopics(h);renderHistoryList(h)
renderAccuracyTrend();showScreen('screen-history')}
function setHistoryFilter(f){_historyFilter=f;document.querySelectorAll('.hfilter-btn').forEach(b=>b.classList.toggle('active',b.dataset.filter===f));const h=loadHistory();renderHistoryList(f==='all'?h:h.filter(r=>r.difficulty===f))}
function renderHistorySummary(h){const el=document.getElementById('history-summary-bar');if(h.length===0){el.innerHTML='';return}const avg=Math.round(h.reduce((s,r)=>s+r.pct,0)/h.length),best=Math.max(...h.map(r=>r.pct));el.innerHTML=`<div class="hsummary-box"><div class="hsummary-val">${h.length}</div><div class="hsummary-lbl">Quizzes Taken</div></div><div class="hsummary-box"><div class="hsummary-val">${avg}%</div><div class="hsummary-lbl">Avg Score</div></div><div class="hsummary-box"><div class="hsummary-val">${best}%</div><div class="hsummary-lbl">Best Score</div></div>`}

// Persistent weak topics across sessions — shown in history screen
function renderHistoryWeakTopics(h){
  const sec=document.getElementById('history-weak-section');const grid=document.getElementById('history-weak-grid');
  const weak=computeWeakTopics();
  if(weak.length===0){sec.style.display='none';return}
  sec.style.display='';grid.innerHTML='';
  weak.forEach(w=>{
    const item=document.createElement('div');item.className='history-weak-item';item.onclick=()=>startTargetedQuiz(w.name);
    item.innerHTML='<span class="history-weak-name">'+w.name+'</span>'+renderSpark(w.trend||[]).replace(/"/g,'"')+'<span class="history-weak-pct">'+w.pct+'%</span>';
    grid.appendChild(item);
  });
}

function renderHistoryList(h){
  const el=document.getElementById('history-list');
  if(h.length===0){el.innerHTML=`<div class="history-empty"><div class="history-empty-icon">◎</div><div class="history-empty-text">No quizzes yet.<br>Complete a quiz and it'll appear here.</div></div>`;return}
  el.innerHTML='';
  h.forEach((r,i)=>{
    const sc=r.pct>=75?'good':r.pct>=45?'mid':'bad';
    const date=new Date(r.date);const ds=date.toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})+' · '+date.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
    const ql={mixed:'Mixed',mc:'MC',tf:'T/F',short:'Free'}[r.questionType]||r.questionType;
    const card=document.createElement('div');card.className='history-card';card.style.animationDelay=(i*0.04)+'s';
    card.innerHTML=`<button class="history-card-delete" onclick="deleteHistoryRecord(${r.id})" title="Delete">✕</button><div class="history-card-top"><div class="history-card-score ${sc}">${r.correct}/${r.total}</div><div class="history-card-meta"><div class="history-card-date">${ds}</div><div class="history-card-tags"><span class="history-tag diff-${r.difficulty}">${r.difficulty}</span><span class="history-tag">${ql}</span><span class="history-tag">${r.pct}%</span></div></div></div><div class="history-card-notes">${r.notesSnippet||'(no notes)'}</div>`;
    card.addEventListener('click',e=>{if(e.target.classList.contains('history-card-delete'))return;openHistoryDetail(r)});
    el.appendChild(card);
  });
}
function openHistoryDetail(record){
  _currentDetailRecord=record;
  const sc=record.pct>=75?'var(--correct)':record.pct>=45?'var(--warning)':'var(--wrong)';
  const el=document.getElementById('hdetail-score');el.textContent=`${record.correct}/${record.total}`;el.style.color=sc;el.style.textShadow=`0 0 40px ${sc}60`;
  const date=new Date(record.date);
  document.getElementById('hdetail-stats').innerHTML=`<span class="hdetail-stat"><strong>${record.pct}%</strong> score</span><span class="hdetail-stat"><strong>${record.difficulty}</strong> difficulty</span><span class="hdetail-stat"><strong>${record.maxStreak||0}</strong> best streak</span><span class="hdetail-stat"><strong>${record.timedOutCount||0}</strong> timed out</span><span class="hdetail-stat" style="color:var(--muted);font-size:.7rem">${date.toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'})}</span>`;
  const ne=document.getElementById('hdetail-notes');ne.textContent=record.fullNotes||record.notesSnippet||'(no notes)';ne.classList.remove('expanded');
  renderHistoryDetailReview(record);showScreen('screen-history-detail');
}
function renderHistoryDetailReview(record){
  const list=document.getElementById('hdetail-review-list');list.innerHTML='';
  (record.answers||[]).forEach((a,i)=>{
    let fh='';
    if(a.skipped)fh='<span class="review-flag flag-skipped">Skipped</span>';
    else if(a.timedOut)fh='<span class="review-flag flag-wrong">Timed Out</span>';
    else if(!a.isCorrect)fh='<span class="review-flag flag-wrong">Wrong</span>';
    if(a.confidence==='confident'&&!a.isCorrect)fh+=' <span class="review-flag flag-blind">⚠ Blind Spot</span>';
    else if((a.confidence==='unsure'||a.confidence==='guess')&&a.isCorrect)fh+=' <span class="review-flag flag-lucky">✦ Lucky</span>';
    else if(a.confidence==='confident'&&a.isCorrect)fh+=' <span class="review-flag flag-solid">✓ Solid</span>';
    const ua=a.skipped?'(skipped)':a.timedOut?'(timed out)':(a.userAnswer||'(no answer)');
    const tl=a.type==='short'?'Free Response':a.type==='tf'?'True / False':'Multiple Choice';
    const div=document.createElement('div');div.className='review-item';div.style.animationDelay=(i*0.04)+'s';
    div.innerHTML=`<div class="review-q-num">Q${i+1} · ${tl}${a.topic?' · '+a.topic:''}</div>${fh?`<div style="margin-bottom:8px">${fh}</div>`:''}<div class="review-q-text">${a.question}</div><div class="review-answers"><span class="review-ans ${a.isCorrect?'correct-a':'wrong-a'}">Your answer: ${ua}</span><span class="review-ans correct-a">Correct: ${a.correctAnswer}</span>${a.confidence&&a.confidence!=='timeout'?`<span class="review-ans yours">Confidence: ${a.confidence}</span>`:''}</div>${a.explanation?`<div class="review-expl">${a.explanation}</div>`:''}`;
    list.appendChild(div);
  });
}
function showHistoryDetailReview(){if(!_currentDetailRecord)return;document.getElementById('hdetail-review-list').scrollIntoView({behavior:'smooth'})}
function retakeFromHistory(){
  if(!_currentDetailRecord)return;const r=_currentDetailRecord;
  S.difficulty=r.difficulty;S.questionType=r.questionType;S.text=r.fullNotes||r.notesSnippet||'';
  document.querySelectorAll('.diff-tab').forEach(t=>t.classList.toggle('selected',t.dataset.diff===r.difficulty));
  S.questions=r.questions||[];S.currentQ=0;S.answers=[];S.skippedIndices=[];S.inSkipRound=false;S.skipQueuePos=0;S.streak=0;S.maxStreak=0;S.correctCount=0;S.timedOutCount=0;S.timerPaused=false;
  showScreen('screen-quiz');document.getElementById('loader').classList.remove('show');document.getElementById('quiz-body').style.display='block';renderQuestion();
}

// ── FILE UPLOAD ───────────────────────────────────────────────────────────────
async function handleFileUpload(input){
  const file=input.files[0];if(!file)return;
  const statusEl=document.getElementById('upload-status');statusEl.className='upload-status show';statusEl.textContent='Reading file…';
  try{
    let text='';
    if(file.type==='application/pdf'||file.name.endsWith('.pdf'))text=await extractPdfText(file);
    else text=await readFileAsText(file);
    if(!text||text.trim().length<20)throw new Error('Could not extract readable text from file.');
    document.getElementById('notes-input').value=text;
    statusEl.className='upload-status show';statusEl.textContent=`✓ Loaded "${file.name}" (${Math.round(text.length/1000*10)/10}k chars)`;
  }catch(e){statusEl.className='upload-status show err';statusEl.textContent='⚠ '+(e.message||'Failed to read file.')}
  input.value='';
}
function readFileAsText(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=e=>resolve(e.target.result);reader.onerror=()=>reject(new Error('File read failed.'));reader.readAsText(file,'UTF-8')})}
async function extractPdfText(file){
  if(typeof pdfjsLib==='undefined')throw new Error('PDF library not loaded.');
  pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const arrayBuffer=await file.arrayBuffer();const pdf=await pdfjsLib.getDocument({data:arrayBuffer}).promise;
  let fullText='';for(let i=1;i<=pdf.numPages;i++){const page=await pdf.getPage(i);const content=await page.getTextContent();fullText+=content.items.map(item=>item.str).join(' ')+'\n'}
  return fullText.trim();
}

// ── RECENT QUIZZES ────────────────────────────────────────────────────────────
function renderRecentQuizzes(){
  const el=document.getElementById('recent-quizzes-section');const history=loadHistory();
  if(history.length===0){el.innerHTML='';return}
  const recent=history.slice(0,3);
  el.innerHTML=`<div class="recent-quizzes"><div class="recent-header"><span class="recent-title">Recent Quizzes</span><button class="recent-see-all" onclick="showHistoryScreen()">See all →</button></div><div class="recent-list" id="recent-list-inner"></div></div>`;
  const listEl=document.getElementById('recent-list-inner');
  recent.forEach(r=>{
    const sc=r.pct>=75?'good':r.pct>=45?'mid':'bad';
    const d=new Date(r.date);const dStr=d.toLocaleDateString('en-US',{month:'short',day:'numeric'})+' · '+d.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
    const div=document.createElement('div');div.className='recent-item';
    div.innerHTML=`<div class="recent-score ${sc}">${r.correct}/${r.total}</div><div class="recent-info"><div class="recent-snippet">${r.notesSnippet?r.notesSnippet.slice(0,80):'(no notes)'}</div><div class="recent-date">${dStr} · ${r.difficulty}</div></div><div class="recent-arrow">›</div>`;
    div.addEventListener('click',()=>openHistoryDetail(r));listEl.appendChild(div);
  });
}

// ── AI TUTOR ──────────────────────────────────────────────────────────────────
let tutorMessages=[],tutorOpen=false,tutorInitialized=false,tutorStreaming=false;

function toggleTutor(){tutorOpen=!tutorOpen;document.getElementById('tutor-body').classList.toggle('open',tutorOpen);document.getElementById('tutor-toggle-icon').classList.toggle('open',tutorOpen);if(tutorOpen&&!tutorInitialized)initTutor()}

// Simple markdown to HTML renderer for engaging AI responses
function renderMarkdown(text) {
  if (!text) return '';
  let html = text;

  // 1. Code blocks first (before anything else touches backticks)
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (m, lang, code) =>
    `<pre><code class="lang-${lang}">${code.trim()}</code></pre>`
  );

  // 2. Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // 3. Bold before italic (order matters)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // 4. Italic — only single *, not doubles
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');

  // 5. Headers
  html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');

  // 6. Blockquotes
  html = html.replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>');

  // 7. Unordered lists — mark with ul-li to differentiate
  html = html.replace(/^[-*] (.+)$/gm, '<ul-li>$1</ul-li>');

  // 8. Ordered lists — mark with ol-li to differentiate
  html = html.replace(/^\d+\. (.+)$/gm, '<ol-li>$1</ol-li>');

  // 9. Wrap consecutive ul-li in <ul>
  html = html.replace(/(<ul-li>.*?<\/ul-li>\n?)+/g, m =>
    `<ul>${m.replace(/<ul-li>/g, '<li>').replace(/<\/ul-li>/g, '</li>')}</ul>`
  );

  // 10. Wrap consecutive ol-li in <ol>
  html = html.replace(/(<ol-li>.*?<\/ol-li>\n?)+/g, m =>
    `<ol>${m.replace(/<ol-li>/g, '<li>').replace(/<\/ol-li>/g, '</li>')}</ol>`
  );

  // 11. Paragraphs — split on double newlines
  html = html.split(/\n{2,}/).map(para => {
    para = para.trim();
    if (!para) return '';
    // Don't wrap block elements in <p>
    if (/^<(h[1-6]|ul|ol|pre|blockquote)/.test(para)) return para;
    return `<p>${para.replace(/\n/g, '<br>')}</p>`;
  }).join('\n');

  // 12. Clean up any <p> wrapping block elements (safety net)
  html = html.replace(/<p>(<(ul|ol|pre|blockquote)[\s\S]*?<\/\2>)<\/p>/g, '$1');

  return html;
}

function initTutor(){
  tutorInitialized=true;tutorMessages=[];
  const total=S.answers.length,missed=S.answers.filter(a=>!a.isCorrect&&!a.skipped),pct=total>0?Math.round((S.correctCount/total)*100):0;
  const blind=S.answers.filter(a=>a.confidence==='confident'&&!a.isCorrect);
  const missedSummary=missed.map(a=>`- "${a.q.question}" (correct: ${a.q.answer})`).join('\n');
  const systemCtx=`You are a warm, engaging AI tutor helping a student review a quiz they just completed.\n\nQuiz: ${S.correctCount}/${total} correct (${pct}%). Difficulty: ${S.difficulty}.\n${missed.length>0?`Questions missed:\n${missedSummary}`:'They got everything correct!'}\n${S.text?`\nStudy material (first 800 chars):\n${S.text.slice(0,800)}`:''}\n\nBe encouraging but honest. Use markdown formatting to make responses engaging:\n- Use **bold** for key terms and important points\n- Use *italics* for emphasis\n- Use > for important quotes or definitions\n- Use - or * for bullet lists when listing concepts\n- Use \`code\` for formulas, variables, or technical terms\n- Use **Key:** or **Remember:** prefixes for critical points\nSTRICT RULE: Reply in 3-5 sentences max. Be concise and to the point. Never exceed 5 sentences. Don't dump everything at once; let the student lead.`;
  tutorMessages.push({role:'system',content:systemCtx});

  // Proactive opening: specific observation about blind spots if any, otherwise standard greeting
  let greeting;
  if(blind.length>0){
    const blindTopics=[...new Set(blind.map(a=>a.q.topic).filter(Boolean))];
    const topicStr=blindTopics.length>0?` on ${blindTopics.slice(0,2).join(' and ')}`:' — topics you thought you knew';
    greeting=`You got ${blind.length} question${blind.length>1?'s':''} wrong while feeling confident${topicStr}. These are your real blind spots. Want me to break down why?`;
  }else if(missed.length>0){
    greeting=`Quiz done — ${S.correctCount}/${total}! You missed ${missed.length} question${missed.length>1?'s':''}. Ask me about any of them and I'll break it down.`;
  }else{
    greeting=`Perfect score — ${S.correctCount}/${total}! Ask me anything about the material to go deeper on any concept.`;
  }
  appendTutorMsg('ai',greeting);
}

function appendTutorMsg(role,text){const messages=document.getElementById('tutor-messages');const div=document.createElement('div');div.className='tutor-msg '+role;if(role==='ai'){div.innerHTML=renderMarkdown(text)}else{div.textContent=text}messages.appendChild(div);messages.scrollTop=messages.scrollHeight;return div}
function sendTutorSuggestion(btn){const text=btn.textContent;document.getElementById('tutor-suggestions').style.display='none';document.getElementById('tutor-input').value=text;sendTutorMessage()}

async function sendTutorMessage(){
  if(tutorStreaming)return;
  const input=document.getElementById('tutor-input'),text=input.value.trim();if(!text)return;
  input.value='';tutorStreaming=true;document.getElementById('tutor-send').disabled=true;document.getElementById('tutor-suggestions').style.display='none';
  appendTutorMsg('user',text);tutorMessages.push({role:'user',content:text});
  const messages=document.getElementById('tutor-messages');
  const aiDiv=document.createElement('div');aiDiv.className='tutor-msg ai streaming';aiDiv.textContent='';messages.appendChild(aiDiv);messages.scrollTop=messages.scrollHeight;document.getElementById('typing-indicator').classList.add('show');this._firstToken=true;
  let fullReply='';
  try{
    const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:tutorMessages})});
    if(!res.ok)throw new Error('Server error');
    const reader=res.body.getReader();const decoder=new TextDecoder();let buffer='';
    while(true){
      const{done,value}=await reader.read();if(done)break;
      buffer+=decoder.decode(value,{stream:true});
      const lines=buffer.split('\n');buffer=lines.pop();
      for(const line of lines){
        if(!line.startsWith('data: '))continue;
        const data=line.slice(6).trim();if(data==='[DONE]')continue;
        try{const json=JSON.parse(data);const token=json.choices?.[0]?.delta?.content||'';if(!token)continue;if(this._firstToken){document.getElementById('typing-indicator').classList.remove('show');this._firstToken=false}fullReply+=token;if(!this._wordBuffer){this._wordBuffer=''}this._wordBuffer+=token;if(/[\s.!?,;:]/.test(token)||this._wordBuffer.split(/\s+/).length>=3){aiDiv.textContent=fullReply;this._wordBuffer=''}messages.scrollTop=messages.scrollHeight}catch{}
      }
    }
    document.getElementById('typing-indicator').classList.remove('show');
  }catch(e){fullReply='Connection error — make sure the server is running.';aiDiv.innerHTML=renderMarkdown(fullReply);document.getElementById('typing-indicator').classList.remove('show')}
  aiDiv.classList.remove('streaming');
  if(this._renderTimer)clearTimeout(this._renderTimer);
  aiDiv.innerHTML=renderMarkdown(fullReply);
  if(fullReply)tutorMessages.push({role:'assistant',content:fullReply});
  tutorStreaming=false;document.getElementById('tutor-send').disabled=false;document.getElementById('tutor-input').focus();
}

function resetTutor(){tutorMessages=[];tutorOpen=false;tutorInitialized=false;tutorStreaming=false;document.getElementById('tutor-body').classList.remove('open');document.getElementById('tutor-toggle-icon').classList.remove('open');document.getElementById('tutor-messages').innerHTML='';document.getElementById('tutor-suggestions').style.display='';document.getElementById('typing-indicator').classList.remove('show')}

// ── INIT ──────────────────────────────────────────────────────────────────────
document.getElementById('timer-row').style.display=S.timedMode?'':'none';
renderRecentQuizzes();
renderHomeStats();
renderWeakTopicsBar();

window.onload = function () {
  const user = localStorage.getItem("currentUser");

  if (user) {
    updateUserDisplay();
    showScreen("screen-home");
  } else {
    showScreen("screen-login");
  }
};

function logout() {
  // remove user session
  localStorage.removeItem("currentUser");

  // optional: clear any cached app state
  localStorage.removeItem("currentQuiz");
  localStorage.removeItem("quizProgress");

  // reset UI inputs (clean state)
  document.getElementById("login-username").value = "";

  const notes = document.getElementById("notes-input");
  if (notes) notes.value = "";

  // reset any toggles if they exist
  const timed = document.getElementById("toggle-timed");
  if (timed) timed.classList.add("on");

  const enhance = document.getElementById("toggle-enhance");
  if (enhance) enhance.classList.remove("on");

  // return to login screen
  showScreen("screen-login");
}

function updateUserDisplay() {
  const user = localStorage.getItem("currentUser");
  const display = document.getElementById("user-display");

  if (!display) return;

  if (user) {
    display.textContent = user;
  } else {
    display.textContent = "";
  }
}

function toggleUserMenu(e) {
  e.stopPropagation();

  const menu = document.getElementById("user-menu");

  // toggle animation class
  menu.classList.toggle("open");
}

// close when clicking outside the user dropdown
document.addEventListener("click", function (e) {
  const dropdown = document.querySelector(".user-dropdown");
  if (dropdown && dropdown.contains(e.target)) return;
  const menu = document.getElementById("user-menu");
  if (menu && menu.classList.contains("open")) menu.classList.remove("open");
});

function openProfile() {
  alert("Profile page coming soon");
}

function openSettings() {
  showScreen("screen-settings");
  loadSettingsUI();
}

function setFontSize(size) {
  document.body.setAttribute('data-font-size', size);
  localStorage.setItem('fontSize', size);
  updateFontTabs(size);
}

function updateFontTabs(activeSize) {
  document.querySelectorAll('#font-size-tabs .tab').forEach(tab => {
    tab.classList.toggle('selected', tab.getAttribute('data-font') === activeSize);
  });
}

// Call this in your init/startup code
const savedFont = localStorage.getItem('fontSize');
if (savedFont) setFontSize(savedFont);

function toggleLightMode() {
  var isLight = document.body.classList.contains('light-mode');
  if (isLight) {
    document.body.classList.remove('light-mode');
    document.getElementById('toggle-light-mode').classList.remove('on');
    localStorage.setItem('lightMode', 'off');
  } else {
    document.body.classList.add('light-mode');
    document.getElementById('toggle-light-mode').classList.add('on');
    localStorage.setItem('lightMode', 'on');
  }
}

function loadSettingsUI() {
  // Load font size
  var savedFont = localStorage.getItem('fontSize') || 'medium';
  setFontSize(savedFont);
  // Load light mode
  var savedLight = localStorage.getItem('lightMode');
  var toggle = document.getElementById('toggle-light-mode');
  if (savedLight === 'on') {
    document.body.classList.add('light-mode');
    if (toggle) toggle.classList.add('on');
  } else {
    document.body.classList.remove('light-mode');
    if (toggle) toggle.classList.remove('on');
  }
  // Load default question count
  var defaultLen = localStorage.getItem('defaultLen') || '5';
  selectLen(+defaultLen);
  // Load default difficulty
  var defaultDiff = localStorage.getItem('defaultDiff') || 'medium';
  selectDiff(defaultDiff);
  // Load default question type
  var defaultQtype = localStorage.getItem('defaultQtype') || 'mixed';
  selectQtype(defaultQtype);
  // Load default timer
  var defaultTimer = localStorage.getItem('defaultTimer') || '20';
  updateSettingsTimerTabs(defaultTimer);
  // Load auto-advance
  var autoAdvance = localStorage.getItem('autoAdvance');
  var toggleAA = document.getElementById('toggle-auto-advance');
  if (toggleAA) toggleAA.classList.toggle('on', autoAdvance === 'on');
}

function setDefaultLen(len) {
  localStorage.setItem('defaultLen', len);
  selectLen(len);
}

function setDefaultDiff(diff) {
  localStorage.setItem('defaultDiff', diff);
  selectDiff(diff);
}

function setDefaultQtype(qtype) {
  localStorage.setItem('defaultQtype', qtype);
  selectQtype(qtype);
}

function setDefaultTimer(timer) {
  localStorage.setItem('defaultTimer', timer);
  updateSettingsTimerTabs(timer);
}

function updateSettingsTimerTabs(activeTimer) {
  document.querySelectorAll('#settings-timer-tabs .tab').forEach(tab => {
    var timerVal = tab.getAttribute('data-timer');
    tab.classList.toggle('selected', String(timerVal) === String(activeTimer));
  });
}

function toggleAutoAdvance() {
  var current = localStorage.getItem('autoAdvance') === 'on';
  var next = !current;
  localStorage.setItem('autoAdvance', next ? 'on' : 'off');
  var toggle = document.getElementById('toggle-auto-advance');
  if (toggle) toggle.classList.toggle('on', next);
}

function tryAutoAdvance() {
  var autoAdvance = localStorage.getItem('autoAdvance') === 'on';
  if (!autoAdvance) return;
  if (S.pendingConf) return;
  clearTimeout(S.autoAdvanceTimeout);
  S.autoAdvanceTimeout = setTimeout(() => {
    var nextBtn = document.getElementById('next-btn');
    if (nextBtn && nextBtn.classList.contains('show')) {
      nextQuestion();
    }
  }, 1500);
}

function toggleCompactMode() {
  var isCompact = document.body.getAttribute('data-compact') === 'true';
  var next = !isCompact;
  document.body.setAttribute('data-compact', next ? 'true' : 'false');
  localStorage.setItem('compactMode', next ? 'on' : 'off');
  var toggle = document.getElementById('toggle-compact');
  if (toggle) toggle.classList.toggle('on', next);
}

// Apply saved settings on page load
(function() {
  var savedFont = localStorage.getItem('fontSize') || 'medium';
  if (savedFont !== 'medium') {
    if (savedFont === 'small') {
      document.body.style.fontSize = '0.9rem';
    } else {
      document.body.setAttribute('data-font-size', savedFont);
    }
  }
  if (localStorage.getItem('lightMode') === 'on') {
    document.body.classList.add('light-mode');
  }
  // Apply default settings to home screen
  var defaultLen = localStorage.getItem('defaultLen');
  if (defaultLen) selectLen(+defaultLen);
  var defaultDiff = localStorage.getItem('defaultDiff');
  if (defaultDiff) selectDiff(defaultDiff);
  var defaultQtype = localStorage.getItem('defaultQtype');
  if (defaultQtype) selectQtype(defaultQtype);
})();

function clearHistory() {
  if (!confirm("Are you sure? This will delete all saved quizzes.")) return;
  try {
    localStorage.removeItem('pastequiz_history_v1');
    var msg = document.getElementById('history-clear-msg');
    if (msg) {
      msg.style.display = 'block';
      setTimeout(() => { msg.style.display = 'none'; }, 3000);
    }
    var list = document.getElementById('history-list');
    if (list) list.innerHTML = '';
    var summary = document.getElementById('history-summary-bar');
    if (summary) summary.innerHTML = '';
    var weak = document.getElementById('history-weak-section');
    if (weak) weak.style.display = 'none';
  } catch(e) { console.error('Clear history failed', e); }
}

function exportHistory() {
  try {
    var history = loadHistory();
    if (!history || history.length === 0) { alert('No history to export.'); return; }
    // CSV header
    var csv = 'Date,Score,Correct,Wrong,TimedOut,Difficulty,TopWeakTopic\n';
    history.forEach(function(r) {
      var date = r.savedAt ? new Date(r.savedAt).toLocaleString() : 'N/A';
      var total = 0;
      if (r.answers && r.answers.length > 0) {
        total = r.answers.length;
      } else {
        total = (r.correctCount || 0) + (r.wrongCount || 0) + (r.timedOutCount || 0);
      }
      var score = r.pct ? r.pct + '%' : ((r.correctCount || 0) + '/' + total);
      var correct = r.correctCount || 0;
      var wrong = (r.wrongCount || 0);
      var timedOut = r.timedOutCount || 0;
      var diff = r.difficulty || 'N/A';
      var topWeak = 'N/A';
      if (r.answers && r.answers.length > 0) {
        var topics = {};
        r.answers.forEach(function(a) {
          if (a.topic) {
            if (!topics[a.topic]) topics[a.topic] = {correct: 0, total: 0};
            topics[a.topic].total++;
            if (a.isCorrect) topics[a.topic].correct++;
          }
        });
        var sorted = Object.keys(topics).sort(function(a, b) {
          return (topics[a].correct / topics[a].total) - (topics[b].correct / topics[b].total);
        });
        if (sorted.length > 0) topWeak = sorted[0];
      }
      csv += '"' + date + '","' + score + '",' + correct + ',' + wrong + ',' + timedOut + ',"' + diff + '","' + topWeak + '"\n';
    });
    // Trigger download
    var blob = new Blob([csv], { type: 'text/csv' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'pastequiz-history.csv';
    a.click();
    URL.revokeObjectURL(url);
  } catch(e) { console.error('Export failed', e); alert('Export failed: ' + e.message); }
}

function resetAllData() {
  if (!confirm("This will delete ALL data including history, preferences, and progress. Cannot be undone.")) return;
  try {
    localStorage.removeItem('currentUser');
    localStorage.removeItem('pastequiz_history_v1');
    localStorage.removeItem('fontSize');
    localStorage.removeItem('lightMode');
    localStorage.removeItem('defaultLen');
    localStorage.removeItem('defaultDiff');
    localStorage.removeItem('defaultQtype');
    localStorage.removeItem('defaultTimer');
    localStorage.removeItem('autoAdvance');
    localStorage.removeItem('compactMode');
    sessionStorage.removeItem('pastequiz_session');
    alert('All data has been reset.');
    window.location.reload();
  } catch(e) { console.error('Reset failed', e); alert('Reset failed: ' + e.message); }
}

function continueAsGuest() {
  try {
    if (typeof localStorage === 'undefined') { alert('localStorage not available - try serving this file via a web server (e.g., python -m http.server)'); return; }
    localStorage.setItem("currentUser", "Guest");
    updateUserDisplay();
    showScreen("screen-home");
  } catch(e) { console.error("guest login error:", e); alert("Error: " + e.message); }
}

// ── TARGETED QUIZ FROM WEAK TOPICS ──────────────────────
function renderSpark(trend){
  if(!trend||trend.length<2)return '';
  const maxH=12,minH=2;
  const max=Math.max(...trend),min=Math.min(...trend);
  const range=max-min||1;
  var dots='';
  for(var i=0;i<trend.length;i++){
    var v=trend[i];
    var h=Math.round(minH+((v-min)/range)*(maxH-minH));
    var color=v>=50?'var(--correct)':v>=30?'var(--warning)':'var(--wrong)';
    dots+='<span class="spark-dot" style="height:'+h+'px;background:'+color+'"></span>';
  }
  return '<span class="spark">'+dots+'</span>';
}

function startTargetedQuiz(topic){
  const h=loadHistory();
  const matchedQuestions=[];
  h.forEach(r=>{(r.answers||[]).forEach(a=>{if(a.topic===topic)matchedQuestions.push({question:a.question,answer:a.correctAnswer,type:a.type||"mc",topic:a.topic,options:a.options||[]})})});
  if(matchedQuestions.length===0){alert("No past questions found for "+topic+".");return}
  S.targetedTopic=topic;
  S.targetedHarder=false;
  showScreen('screen-quiz');
  document.getElementById('quiz-body').style.display='none';
  document.getElementById('loader').classList.add('show');
  document.getElementById('loader-label').textContent='Generating questions for '+topic+'...';
  startQuiz(true,matchedQuestions);
}

function cleanupTargetedMode(){
  S.targetedTopic=null;S.targetedHarder=false;
  document.getElementById('quiz-targeted-badge').classList.remove('show');
  document.getElementById('quiz-breadcrumb').classList.remove('show');
  const toggle=document.getElementById('targeted-harder-toggle');
  if(toggle)toggle.remove();
}

// Patch goHome to include cleanup
const __goHomeOrig=goHome;
goHome=function(){cleanupTargetedMode();__goHomeOrig()};

// Add harder toggle for targeted quizzes
function addTargetedHarderToggle(){
  if(!S.targetedTopic)return;
  const controls=document.getElementById('q-controls');
  if(!controls)return;
  let existing=document.getElementById('targeted-harder-toggle');
  if(existing)return;
  const toggle=document.createElement('button');
  toggle.id='targeted-harder-toggle';
  toggle.className='q-ctrl';
  toggle.textContent=S.targetedHarder?'▲ Harder: ON':'▲ Harder: OFF';
  toggle.onclick=()=>{
    S.targetedHarder=!S.targetedHarder;
    toggle.textContent=S.targetedHarder?'▲ Harder: ON':'▲ Harder: OFF';
  };
  controls.appendChild(toggle);
}

// Patch renderQuestion to show targeted badge and add harder toggle
const _origRenderQuestion=renderQuestion;
  renderQuestion=function(){
    _origRenderQuestion.call(this);
    if(S.targetedTopic){
      const badge=document.getElementById('quiz-targeted-badge');
      badge.textContent='Targeted: '+S.targetedTopic;
      badge.classList.add('show');
      document.getElementById('quiz-breadcrumb').classList.add('show');
      addTargetedHarderToggle();
    }
    if(!S.bookmarked)S.bookmarked=[];
    var btn=document.getElementById('bm-btn');
    if(btn){btn.textContent=S.bookmarked.indexOf(S.currentQ)>-1?'★':'☆';btn.classList.toggle('bookmarked',S.bookmarked.indexOf(S.currentQ)>-1)}
  };

function switchExplTab(tabName) {
  document.querySelectorAll('.expl-content').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.expl-tab').forEach(btn => btn.classList.remove('active'));
  
  const target = document.getElementById('expl-text-' + tabName);
  if (target) target.style.display = 'block';
  
  event.target.classList.add('active');
}

 function renderBookmarkedOnResults() {
    const resEl = document.getElementById('screen-results');
    if (!resEl) return; // Results screen not available

    let el = document.getElementById('bm-results-section');
    if (!el) {
      el = document.createElement('div');
      el.id = 'bm-results-section';
      resEl.appendChild(el);
    }

    if (!S.bookmarked || S.bookmarked.length === 0) {
      el.style.display = 'none';
      return;
    }

    el.style.display = '';

    // Escape HTML to prevent XSS and rendering issues
    const escapeHtml = (text) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };

    let html = '<h3 style="font-size:0.85rem;color:var(--warning);margin:16px 0 8px">★ Bookmarked Questions</h3>';
    S.bookmarked.forEach((idx) => {
      const q = S.questions[idx];
      if (!q) return;
      const questionText = escapeHtml(q.question);
      const answerText = escapeHtml(q.answer);
      html += `<div style="background:var(--panel);border:1px solid var(--border);border-radius:var(--radius);padding:12px 16px;margin-bottom:8px">
        <div style="font-size:0.78rem;font-weight:500;color:var(--text);margin-bottom:6px">Q${idx + 1}: ${questionText}</div>
        <div style="font-size:0.72rem;color:var(--muted)">Correct answer: ${answerText}</div>
      </div>`;
    });

    el.innerHTML = html;
  }
  console.log('Main script END');