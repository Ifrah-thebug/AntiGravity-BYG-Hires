import { env } from '@/core/config/env';
import { ROUTES } from './routes';

/**
 * Deep links. `byghires://reset-password?token=…` works out of the box.
 * Email links point at the web domain; to open them in the app, add Android App Links /
 * iOS Universal Links for WEB_APP_URL (needs assetlinks.json / apple-app-site-association on the site).
 */
export const linking = {
  prefixes: ['byghires://', env.webAppUrl].filter(Boolean),
  config: {
    screens: {
      [ROUTES.Login]: 'login',
      [ROUTES.Signup]: 'talent/signup',
      [ROUTES.ForgotPassword]: 'forgot-password',
      [ROUTES.ResetPassword]: 'reset-password',
      [ROUTES.Activate]: 'talent/activate',
      [ROUTES.Portal]: 'portal',
      [ROUTES.Assessment]: 'assessment',
      [ROUTES.VoiceInterview]: 'interview',
      [ROUTES.Portfolio]: 'talent/:profileId/portfolio',
    },
  },
};
