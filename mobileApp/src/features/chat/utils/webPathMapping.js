import { ROUTES } from '@/app/navigation/routes';

/**
 * BGuides is shared with the web app: the backend reasons about web paths
 * ("/portal#client-intro-scheduling") and returns web hrefs in chat actions.
 * These helpers translate between mobile routes and those web paths.
 */

/** Current mobile route → web path sent as `path` to /api/talent/chat. */
export function webPathForRoute(route) {
  if (!route) return '';
  const params = route.params || {};
  switch (route.name) {
    case ROUTES.Setup:
      return '/talent/setup';
    case ROUTES.Portal:
      return params.section ? `/portal#${params.section}` : '/portal';
    case ROUTES.Assessment:
      return '/assessment';
    case ROUTES.VoiceInterview:
      return '/interview';
    case ROUTES.Portfolio:
      return params.profileId ? `/talent/${params.profileId}/portfolio` : '/portal';
    default:
      return '';
  }
}

function splitHref(href) {
  const raw = String(href || '').trim();
  const hashIndex = raw.indexOf('#');
  const pathPart = hashIndex >= 0 ? raw.slice(0, hashIndex) : raw;
  const hash = hashIndex >= 0 ? raw.slice(hashIndex + 1) : '';
  const queryIndex = pathPart.indexOf('?');
  const pathname = queryIndex >= 0 ? pathPart.slice(0, queryIndex) : pathPart;
  const search = new URLSearchParams(queryIndex >= 0 ? pathPart.slice(queryIndex + 1) : '');
  return { pathname: pathname.replace(/\/$/, '') || '/', search, hash };
}

const PORTAL_SECTIONS = new Set([
  'profile-photo',
  'profile-pricing',
  'profile-submit',
  'portfolio-requests',
  'talent-portfolio',
  'client-intro-scheduling',
]);

/**
 * Web href from a chat action → { name, params } for navigation, or null when
 * the page only exists on the website.
 */
export function routeForWebHref(href) {
  const { pathname, search, hash } = splitHref(href);

  if (pathname === '/portal' || pathname === '/talent/setup') {
    const section = hash === 'portfolio' || search.get('portfolio') === 'add' ? 'talent-portfolio' : hash;
    return {
      name: ROUTES.Portal,
      params: {
        section: PORTAL_SECTIONS.has(section) ? section : undefined,
        guide: search.get('guide') === '1' ? true : undefined,
      },
    };
  }
  if (pathname === '/assessment') return { name: ROUTES.Assessment };
  if (pathname === '/interview') return { name: ROUTES.VoiceInterview };

  const portfolio = pathname.match(/^\/talent\/([^/]+)\/portfolio$/);
  if (portfolio) {
    const add = search.get('add');
    return {
      name: ROUTES.Portfolio,
      params: { profileId: portfolio[1], add: add === '1' || add === 'chapter' ? '1' : undefined },
    };
  }

  return null;
}
