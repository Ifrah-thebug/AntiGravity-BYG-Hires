/** Decaying reward schedule from Byghires Ambassador Program blueprint (demo amounts). */
const REWARD_SCHEDULE = [
  {
    cycle: 1,
    amountUsd: 50,
    label: '1st job placement',
    rationale: 'High incentive for bringing top-tier talent into the ecosystem.',
  },
  {
    cycle: 2,
    amountUsd: 30,
    label: '2nd job placement',
    rationale: 'Mid-tier payout as matching systems do more of the heavy lifting.',
  },
  {
    cycle: 3,
    amountUsd: 15,
    label: '3rd job placement',
    rationale: 'Scaled reward — candidate is a proven entity on the platform.',
  },
  {
    cycle: 4,
    amountUsd: 10,
    label: '4th+ job placement',
    rationale: 'Lifetime residual floor — passive income without draining margins.',
  },
];

function rewardForCycle(cycle) {
  const n = Math.max(1, Math.floor(Number(cycle) || 1));
  if (n <= 1) return 50;
  if (n === 2) return 30;
  if (n === 3) return 15;
  return 10;
}

function getAppPublicUrl() {
  return String(
    process.env.SITE_URL || process.env.FRONTEND_URL || 'https://byghires.com'
  ).replace(/\/$/, '');
}

function buildSignupUrl(code) {
  const clean = String(code || '').trim().toUpperCase();
  return `${getAppPublicUrl()}/talent/signup?code=${encodeURIComponent(clean)}`;
}

function buildLinkedInAbout({ code, name }) {
  const inviteCode = String(code || '').trim().toUpperCase();
  const displayName = String(name || 'Ambassador').trim() || 'Ambassador';
  return [
    'Get Placed in Premium Remote Roles (Exclusive Access)',
    '',
    `I am a Verified Ambassador for Byghires (${displayName}), unlocking direct access to premium, budget-friendly remote opportunities worldwide.`,
    '',
    'Use my private invitation code below to fast-track your application to top global firms:',
    '',
    `My Invite Code: ${inviteCode}`,
    `Register Here: ${buildSignupUrl(inviteCode)}`,
  ].join('\n');
}

function buildBrandingKit(ambassador) {
  const code = ambassador?.code || '';
  return {
    badgePath: '/byghires-circle-badge.png',
    badgeSvgPath: '/byghires-circle-badge.svg',
    badgeLabel: 'Byghires Circle · Verified Ambassador',
    code,
    signupUrl: buildSignupUrl(code),
    linkedInAbout: buildLinkedInAbout({ code, name: ambassador?.name }),
    linkedInHeadline: 'Exclusive Talent Partner · Byghires Circle',
  };
}

module.exports = {
  REWARD_SCHEDULE,
  rewardForCycle,
  getAppPublicUrl,
  buildSignupUrl,
  buildLinkedInAbout,
  buildBrandingKit,
};
