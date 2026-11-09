/* Accessible presentation around the unchanged assessment generator and scoring functions. */
(() => {
  'use strict';
  document.addEventListener('keydown', () => { document.documentElement.dataset.input = 'keyboard'; }, { capture: true });
  document.addEventListener('pointerdown', () => { document.documentElement.dataset.input = 'pointer'; }, { capture: true });

  function updateAnswerProgress() {
    const exam = window.__lexExam;
    if (!exam) return;
    const answered = exam.questions.filter((question, index) => question.options
      ? document.querySelector(`input[name="sqn${index}"]:checked`)
      : document.querySelector(`#sq${index} textarea`)?.value.trim()).length;
    const progress = document.getElementById('standaloneProgress');
    if (progress) progress.style.width = `${exam.questions.length ? answered / exam.questions.length * 100 : 0}%`;
    const status = document.getElementById('examAnswerProgress');
    if (status) status.textContent = `${answered} de ${exam.questions.length} preguntas respondidas`;
  }
  function prepareExamPresentation() {
    const shell = document.getElementById('standaloneExam');
    if (!shell || shell.dataset.feedbackReady) return;
    shell.dataset.feedbackReady = 'true';
    const header = shell.querySelector('.exam-v6-head');
    const heading = header?.querySelector('h1');
    const meta = header?.querySelector('div > span');
    if (heading && meta) heading.after(meta);
    const status = document.createElement('p');
    status.id = 'examAnswerProgress'; status.className = 'exam-answer-progress'; status.setAttribute('role', 'status');
    shell.querySelector('.exam-v6-progress')?.after(status);
    const result = document.createElement('p');
    result.id = 'examResultSummary'; result.className = 'exam-result-summary'; result.setAttribute('role', 'status');
    status.after(result);
    shell.querySelectorAll('.exam-question').forEach((card, index) => {
      const title = card.querySelector('.exam-qtitle');
      if (title) { title.id = `examQuestionTitle${index}`; card.setAttribute('aria-labelledby', title.id); card.setAttribute('role', 'group'); }
    });
    shell.addEventListener('input', updateAnswerProgress);
    updateAnswerProgress();
    if (!window.__lexExam.questions.some(question => question.options)) document.getElementById('standaloneScore').hidden = true;
  }
  const render = window.renderStandaloneExam;
  window.renderStandaloneExam = function (...args) { const result = render.apply(this, args); prepareExamPresentation(); return result; };
  const check = window.checkStandaloneExam;
  window.checkStandaloneExam = function (...args) {
    const result = check.apply(this, args);
    prepareExamPresentation();
    const exam = window.__lexExam;
    if (!exam) return result;
    let correct = 0, objective = 0, unanswered = 0;
    exam.questions.forEach((question, index) => {
      const card = document.getElementById(`sq${index}`);
      if (!card) return;
      let label = card.querySelector('.exam-result-label');
      if (!label) { label = document.createElement('p'); label.className = 'exam-result-label'; card.append(label); }
      if (!question.options) { label.textContent = 'Respuesta abierta: contrasta tu explicación con la guía.'; return; }
      objective++;
      const chosen = card.querySelector('input:checked');
      if (!chosen) { unanswered++; label.textContent = 'Sin responder'; }
      else if (card.classList.contains('right')) { correct++; label.textContent = 'Respuesta correcta'; }
      else label.textContent = 'Revisa esta respuesta';
    });
    const summary = document.getElementById('examResultSummary');
    if (summary) summary.textContent = objective
      ? `${correct} de ${objective} respuestas correctas.${unanswered ? ` Te quedan ${unanswered} por responder.` : ' Puedes revisar la guía de respuestas.'}`
      : 'Autoevaluación: compara tus explicaciones con la guía. Las respuestas abiertas no se califican automáticamente.';
    updateAnswerProgress();
    return result;
  };
  const toggle = window.toggleStandaloneAnswers;
  window.toggleStandaloneAnswers = function (...args) {
    const result = toggle.apply(this, args);
    const button = document.querySelector('button[onclick="toggleStandaloneAnswers()"]');
    if (button) { button.textContent = window.__lexAnswers ? 'Ocultar respuestas' : 'Mostrar respuestas'; button.setAttribute('aria-pressed', String(window.__lexAnswers)); }
    return result;
  };
  prepareExamPresentation();
})();
