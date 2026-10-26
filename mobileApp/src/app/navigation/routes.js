/** Route names — one per web talent page. */
export const ROUTES = {
  Launch: 'Launch', //            (decides where to go after auth)
  Login: 'Login', //              /login
  Signup: 'Signup', //            /talent/signup
  ForgotPassword: 'ForgotPassword', // /forgot-password
  ResetPassword: 'ResetPassword', //   /reset-password?token=
  Activate: 'Activate', //        /talent/activate?token=
  Setup: 'Setup', //              /talent/setup
  Portal: 'Portal', //            /portal
  Assessment: 'Assessment', //    /assessment
  VoiceInterview: 'VoiceInterview', // /interview
  Portfolio: 'Portfolio', //      /talent/:id/portfolio
  NotTalent: 'NotTalent', //      client / admin / ambassador accounts
};

/** Screens where the BGuides chat button is shown (talent is signed in). */
export const TALENT_ROUTES = new Set([
  ROUTES.Setup,
  ROUTES.Portal,
  ROUTES.Assessment,
  ROUTES.VoiceInterview,
  ROUTES.Portfolio,
]);
