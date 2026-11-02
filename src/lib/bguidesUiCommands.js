/**
 * BGuides ↔ page UI sync command contract.
 * Chat emits these; page listeners apply them (UI controller mode — no form writes).
 */

export const BGUIDES_UI_EVENT = 'byg-bguides-ui-command';

export const BGuidesCommandType = {
  APPLY_DIRECTORY_FILTERS: 'APPLY_DIRECTORY_FILTERS',
  OPEN_TALENT_CARD: 'OPEN_TALENT_CARD',
  OPEN_BOOKING: 'OPEN_BOOKING',
  HIGHLIGHT_SECTION: 'HIGHLIGHT_SECTION',
  SCROLL_TO: 'SCROLL_TO',
  NAVIGATE: 'NAVIGATE',
  REFRESH_PORTAL: 'REFRESH_PORTAL',
};

/**
 * @param {{ type: string, payload?: Record<string, unknown> }} command
 */
export function dispatchBGuidesUiCommand(command) {
  if (!command?.type || typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent(BGUIDES_UI_EVENT, {
      detail: {
        type: String(command.type),
        payload: command.payload && typeof command.payload === 'object' ? command.payload : {},
        at: Date.now(),
      },
    })
  );
}

/**
 * @param {Array<{ type: string, payload?: Record<string, unknown> }>} commands
 */
export function dispatchBGuidesUiCommands(commands) {
  if (!Array.isArray(commands)) return;
  for (const cmd of commands) {
    dispatchBGuidesUiCommand(cmd);
  }
}

/**
 * @param {(detail: { type: string, payload: Record<string, unknown>, at: number }) => void} handler
 * @returns {() => void}
 */
export function subscribeBGuidesUiCommands(handler) {
  if (typeof window === 'undefined') return () => {};
  const listener = (event) => {
    if (event?.detail?.type) handler(event.detail);
  };
  window.addEventListener(BGUIDES_UI_EVENT, listener);
  return () => window.removeEventListener(BGUIDES_UI_EVENT, listener);
}

/**
 * Briefly pulse a section so chat-driven navigation is visible.
 * @param {string} sectionId
 * @param {number} [durationMs]
 */
export function highlightDomSection(sectionId, durationMs = 2200) {
  const id = String(sectionId || '').replace(/^#/, '');
  if (!id) return;
  const el = document.getElementById(id);
  if (!el) return;

  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  el.classList.add('bguides-section-highlight');
  window.setTimeout(() => {
    el.classList.remove('bguides-section-highlight');
  }, durationMs);
}
