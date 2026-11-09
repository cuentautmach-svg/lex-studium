/* Progressive configuration for the existing assessment engine. */
(() => {
  'use strict';

  function initializePracticeFlow() {
    const flow = document.getElementById('practiceFlow');
    if (!flow || flow.dataset.flowReady === 'true') return;
    const steps = [...flow.querySelectorAll('.practice-step[data-practice-step]')]
      .sort((left, right) => Number(left.dataset.practiceStep) - Number(right.dataset.practiceStep));
    if (steps.length !== 3) return;
    flow.dataset.flowReady = 'true';

    const jumps = [...document.querySelectorAll('[data-practice-jump]')];
    const previous = document.getElementById('practicePrevious');
    const next = document.getElementById('practiceNext');
    const label = document.getElementById('practiceStepLabel');
    const progress = document.getElementById('practiceStepProgress');
    const error = document.getElementById('practiceFlowError');
    const studyText = document.getElementById('studyText');
    const submit = flow.querySelector('.practice-submit');
    let current = 0;

    function clearError() {
      if (error) error.textContent = '';
      if (!studyText) return;
      studyText.removeAttribute('aria-invalid');
      const descriptions = (studyText.getAttribute('aria-describedby') || '')
        .split(/\s+/).filter(value => value && value !== 'practiceFlowError');
      if (descriptions.length) studyText.setAttribute('aria-describedby', descriptions.join(' '));
      else studyText.removeAttribute('aria-describedby');
    }

    function materialIsReady() {
      const text = studyText?.value.trim() || '';
      const completeSentences = typeof window.sentences === 'function'
        ? window.sentences(text)
        : text.replace(/\n+/g, ' ').split(/(?<=[.!?;:])\s+/)
          .map(sentence => sentence.trim()).filter(sentence => sentence.length > 45 && sentence.length < 420);
      const message = text.length < 120
        ? 'Añade un poco más de material: necesitas al menos 120 caracteres para empezar.'
        : completeSentences.length < 3
          ? 'Incluye al menos tres oraciones completas para construir una práctica útil.'
          : '';
      if (!message) { clearError(); return true; }
      if (error) error.textContent = message;
      if (studyText) {
        studyText.setAttribute('aria-invalid', 'true');
        const descriptions = new Set((studyText.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean));
        descriptions.add('practiceFlowError');
        studyText.setAttribute('aria-describedby', [...descriptions].join(' '));
        studyText.focus({ preventScroll: true });
        studyText.scrollIntoView({ block: 'nearest', behavior: 'auto' });
      }
      return false;
    }

    function showStep(index, { focus = true, pointer = false } = {}) {
      if (!Number.isInteger(index) || index < 0 || index >= steps.length) return false;
      if (index > current && !materialIsReady()) return false;
      clearError();
      current = index;
      const withMotion = pointer && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      steps.forEach((step, stepIndex) => {
        step.hidden = stepIndex !== index;
        step.dataset.current = String(stepIndex === index);
        step.dataset.motion = String(withMotion && stepIndex === index);
        if (!step.id) step.id = 'practiceStep' + stepIndex;
      });
      jumps.forEach(button => {
        const stepIndex = Number(button.dataset.practiceJump);
        button.type = 'button';
        button.classList.toggle('is-current', stepIndex === index);
        button.classList.toggle('is-complete', stepIndex < index);
        if (steps[stepIndex]) button.setAttribute('aria-controls', steps[stepIndex].id);
        if (stepIndex === index) button.setAttribute('aria-current', 'step');
        else button.removeAttribute('aria-current');
      });
      const title = steps[index].dataset.stepTitle || steps[index].querySelector('h3')?.textContent || '';
      if (label) label.textContent = `Paso ${index + 1} de ${steps.length}${title ? ' · ' + title : ''}`;
      if (progress) {
        progress.max = steps.length;
        progress.value = index + 1;
        progress.setAttribute('aria-valuetext', `Paso ${index + 1} de ${steps.length}`);
      }
      if (previous) {
        previous.type = 'button';
        previous.hidden = index === 0;
        previous.disabled = index === 0;
      }
      if (next) {
        next.type = 'button';
        next.hidden = index === steps.length - 1;
        next.disabled = index === steps.length - 1;
      }
      if (submit) submit.hidden = index !== steps.length - 1;
      if (focus) {
        const heading = steps[index].querySelector('h3');
        if (heading) {
          heading.tabIndex = -1;
          heading.focus({ preventScroll: true });
          heading.scrollIntoView({ block: 'nearest', behavior: 'auto' });
        }
      }
      return true;
    }

    previous?.addEventListener('click', event => showStep(current - 1, { pointer: event.detail > 0 }));
    next?.addEventListener('click', event => showStep(current + 1, { pointer: event.detail > 0 }));
    jumps.forEach(button => button.addEventListener('click', event => showStep(Number(button.dataset.practiceJump), { pointer: event.detail > 0 })));
    studyText?.addEventListener('input', clearError);
    flow.addEventListener('click', event => {
      if (event.target.closest('button[onclick*="loadDemo"]')) clearError();
    });
    if (flow.tagName === 'FORM') flow.addEventListener('submit', event => {
      event.preventDefault();
      if (current < steps.length - 1) showStep(current + 1);
    });
    showStep(0, { focus: false });
    window.lexPracticeFlow = Object.freeze({
      goTo: index => showStep(index),
      get currentStep() { return current; },
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initializePracticeFlow, { once: true });
  else initializePracticeFlow();
})();
