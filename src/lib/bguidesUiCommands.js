/**
 * BGuides ↔ page UI sync command contract.
 * Chat emits these; page listeners apply them (UI controller mode — no form writes).
 */

export const BGUIDES_UI_EVENT = 'byg-bguides-ui-command';

export const BGUIDES_DIRECTORY_FILTERS_KEY = 'bguides-directory-filters';

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
 * Persist directory filters that do not fit cleanly in the URL (fee / availability / roleType / sort).
 * @param {Record<string, unknown>} payload
 */
export function persistDirectoryFilterPayload(payload) {
  if (typeof window === 'undefined' || !payload || typeof payload !== 'object') return;
  try {
    const stored = {
      availability: Array.isArray(payload.availability) ? payload.availability.map(String) : [],
      roleType: Array.isArray(payload.roleType) ? payload.roleType.map(String) : [],
      maxFee:
        Number.isFinite(Number(payload.maxFee)) && Number(payload.maxFee) > 0
          ? Number(payload.maxFee)
          : null,
      sort: payload.sort ? String(payload.sort) : null,
      at: Date.now(),
    };
    window.sessionStorage.setItem(BGUIDES_DIRECTORY_FILTERS_KEY, JSON.stringify(stored));
  } catch {
    // ignore quota / private mode
  }
}

/**
 * @returns {{ availability: string[], roleType: string[], maxFee: number|null, sort: string|null } | null}
 */
export function readPersistedDirectoryFilters() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(BGUIDES_DIRECTORY_FILTERS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    return {
      availability: Array.isArray(parsed.availability) ? parsed.availability.map(String) : [],
      roleType: Array.isArray(parsed.roleType) ? parsed.roleType.map(String) : [],
      maxFee:
        Number.isFinite(Number(parsed.maxFee)) && Number(parsed.maxFee) > 0
          ? Number(parsed.maxFee)
          : null,
      sort: parsed.sort ? String(parsed.sort) : null,
    };
  } catch {
    return null;
  }
}

/**
 * Build /talent search string from filter payload (dept + q only in URL).
 * @param {Record<string, unknown>} payload
 * @returns {string} search including leading ? or empty string
 */
export function directoryFiltersToSearch(payload) {
  const next = new URLSearchParams();
  if (payload?.dept && payload.dept !== 'all') next.set('dept', String(payload.dept));
  if (payload?.q) next.set('q', String(payload.q));
  if (payload?.sort) next.set('sort', String(payload.sort));
  const qs = next.toString();
  return qs ? `?${qs}` : '';
}

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
