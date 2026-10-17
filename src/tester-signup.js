// The endpoint is public form configuration, not an API key. Only generated
// Formspree form IDs are accepted; legacy email URLs cannot receive signups.
export function formspreeEndpoint(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.host !== 'formspree.io' || url.username || url.password || url.search || url.hash || !/^\/f\/[a-zA-Z0-9]+\/?$/.test(url.pathname)) return null;
    return url.href;
  } catch { return null; }
}

export function initTesterSignup(form) {
  const endpoint = formspreeEndpoint(form.dataset.endpoint);
  const email = form.elements.namedItem('email');
  const button = form.querySelector('button[type="submit"]');
  const status = form.querySelector('#signup-status');
  let busy = false, completed = false;
  const message = (text, state = '') => { status.textContent = text; status.dataset.state = state; };
  if (endpoint) { form.action = endpoint; button.disabled = false; message(''); }
  email.addEventListener('input', () => email.removeAttribute('aria-invalid'));
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || completed) return;
    if (!endpoint) { message('Tester signup is being set up. Please check back soon.'); return; }
    email.value = email.value.trim();
    if (!form.reportValidity()) return;
    if (form.elements.namedItem('_gotcha').value) { message('Please reload the page and try again.', 'error'); return; }
    busy = true; button.disabled = true; button.textContent = 'Sending…'; form.setAttribute('aria-busy', 'true'); message('');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(endpoint, { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' }, signal: controller.signal, credentials: 'omit' });
      if (!response.ok) {
        if (response.status === 422) { email.setAttribute('aria-invalid', 'true'); email.focus(); throw new Error('Please check your email address and try again.'); }
        if (response.status === 429) throw new Error('Too many attempts. Please try again later.');
        throw new Error('Signup is unavailable right now. Please try again later.');
      }
      const result = await response.json();
      if (!result || typeof result !== 'object' || result.ok === false || result.errors?.length) throw new Error('We couldn’t confirm your signup. Please try again later.');
      completed = true; email.disabled = true; button.textContent = 'Joined';
      message('Thank you — you’re on the list. We’ll email you about testing.', 'success');
      form.reset();
    } catch (error) {
      message(error instanceof SyntaxError ? 'We couldn’t confirm your signup. Please try again later.' : error instanceof TypeError ? 'Couldn’t send your signup. Check your connection and try again.' : error.name === 'AbortError' ? 'We couldn’t confirm your signup. Please try again in a moment.' : error.message, 'error');
    } finally {
      clearTimeout(timeout); busy = false; form.removeAttribute('aria-busy');
      if (!completed) { button.disabled = false; button.textContent = 'Join testing'; }
    }
  });
}
