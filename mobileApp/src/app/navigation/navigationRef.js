import { createNavigationContainerRef } from '@react-navigation/native';

/** Lets non-screen components (BGuides chat) read the route and navigate. */
export const navigationRef = createNavigationContainerRef();

export function getCurrentRoute() {
  return navigationRef.isReady() ? navigationRef.getCurrentRoute() : null;
}
