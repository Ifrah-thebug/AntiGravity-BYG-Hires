const { supabaseAdmin } = require('../middleware/requireAdmin');

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function calculateDirectoryFeeUsd(monthlyFeeUsd) {
  const base = Number(monthlyFeeUsd) || 0;
  return Math.round(base * 1.1);
}

function buildPricingGuidance(profile, assessmentScores = {}) {
  const years = Number(profile?.experience_years) || 0;
  const skills = (profile?.skills || []).length;
  const scores = Object.values(assessmentScores).filter((n) => Number.isFinite(Number(n)));
  const avgScore = scores.length
    ? scores.reduce((a, b) => a + Number(b), 0) / scores.length
    : null;

  let modelRecommended = 300;
  if (years >= 10) modelRecommended = 750;
  else if (years >= 7) modelRecommended = 600;
  else if (years >= 5) modelRecommended = 500;
  else if (years >= 3) modelRecommended = 400;
  else if (years >= 1) modelRecommended = 350;

  if (skills >= 6) modelRecommended += 40;
  else if (skills >= 4) modelRecommended += 20;

  if (avgScore != null) {
    if (avgScore >= 85) modelRecommended = Math.round(modelRecommended * 1.12);
    else if (avgScore >= 70) modelRecommended = Math.round(modelRecommended * 1.06);
  }

  const dept = String(profile?.department || '').toLowerCase();
  if (/engineering|data|product|design/.test(dept)) modelRecommended += 30;

  modelRecommended = Math.max(250, Math.min(1200, Math.round(modelRecommended / 25) * 25));

  const currentMonthly = Number(profile?.monthly_fee_usd) || 0;
  const currentDirectory = Number(profile?.directory_fee_usd) || calculateDirectoryFeeUsd(currentMonthly);
  const hasCurrent = Number.isFinite(currentMonthly) && currentMonthly > 0;

  // If talent already set pricing, keep chatbot anchored to their latest saved value.
  const recommended = hasCurrent ? Math.round(currentMonthly) : modelRecommended;
  const min = Math.max(200, recommended - 75);
  const max = recommended + 100;

  return {
    currentMonthlyUsd: currentMonthly || null,
    currentDirectoryUsd: currentDirectory || null,
    suggestedMinUsd: min,
    suggestedRecommendedUsd: recommended,
    suggestedMaxUsd: max,
    suggestedDirectoryUsd: calculateDirectoryFeeUsd(recommended),
    modelBaselineUsd: modelRecommended,
    revenueNote:
      'Directory fee shown to clients is monthly fee × 1.1 — competitive pricing with verified skills increases intro requests.',
    factors: {
      experienceYears: years,
      skillCount: skills,
      averageAssessmentScore: avgScore != null ? Math.round(avgScore) : null,
      department: profile?.department || null,
    },
  };
}

function isProfileOnWaitlist(profile) {
  return String(profile?.directory_status || '').toLowerCase() === 'pending_review';
}

function buildOnboardingChecklist(ctx) {
  const items = [];
  const p = ctx.profile;

  if (!ctx.hasAccount) {
    items.push({ id: 'signup', label: 'Create your account', done: false, priority: 1 });
    return items;
  }

  if (!p) {
    items.push({ id: 'setup', label: 'Complete profile setup', done: false, priority: 1 });
    return items;
  }

  const status = String(p.directory_status || 'draft').toLowerCase();
  const onWaitlist = status === 'pending_review';

  // Profile is already submitted — skip draft/setup gaps (photo, CV, pricing, etc.)
  if (!onWaitlist) {
    if (!p.name?.trim() || !p.job_title?.trim()) {
      items.push({ id: 'portal', label: 'Add name and job title', done: false, priority: 1 });
    }
    if (!p.photo_url?.trim()) {
      items.push({ id: 'portal-photo', label: 'Upload a professional photo', done: false, priority: 2 });
    }
    if (!p.cv_url?.trim()) {
      items.push({ id: 'portal', label: 'Upload your CV', done: false, priority: 2 });
    }
    if (!(p.skills || []).length) {
      items.push({ id: 'portal', label: 'Add core skills', done: false, priority: 3 });
    }
    if (!p.about?.trim()) {
      items.push({ id: 'portal', label: 'Write your about section', done: false, priority: 3 });
    }
    if (!p.monthly_fee_usd || Number(p.monthly_fee_usd) <= 0) {
      items.push({ id: 'portal-pricing', label: 'Set your monthly fee', done: false, priority: 4 });
    }
  }

  if (status === 'draft' || status === 'changes_requested') {
    items.push({
      id: 'submit-review',
      label: status === 'changes_requested' ? 'Fix feedback and resubmit' : 'Submit profile for review',
      done: false,
      priority: 5,
    });
  }

  if (onWaitlist) {
    if (!ctx.calendarConnected) {
      items.push({ id: 'calendar', label: 'Connect your calendar', done: false, priority: 1 });
    }
    if (!ctx.assessmentCount) {
      items.push({ id: 'assessment', label: 'Take a skills test', done: false, priority: 2 });
    }
    if (ctx.calendarConnected && !ctx.introSlotsCount) {
      items.push({ id: 'intro-slots', label: 'Set intro availability', done: false, priority: 3 });
    }
    if (!ctx.portfolioProjectCount) {
      items.push({ id: 'portfolio', label: 'Add portfolio projects', done: false, priority: 4 });
    }
  } else if (status === 'approved') {
    if (!ctx.calendarConnected) {
      items.push({ id: 'calendar', label: 'Connect Cal.com calendar', done: false, priority: 6 });
    }
    if (!ctx.assessmentCount) {
      items.push({ id: 'assessment', label: 'Take a skills test', done: false, priority: 7 });
    }
    if (!ctx.introSlotsCount) {
      items.push({ id: 'intro-slots', label: 'Publish intro availability', done: false, priority: 8 });
    }
    if (!ctx.portfolioProjectCount) {
      items.push({ id: 'portfolio', label: 'Add portfolio projects', done: false, priority: 9 });
    }
  }

  return items
    .filter((i) => !i.done)
    .sort((a, b) => a.priority - b.priority);
}

function buildActionCatalog(ctx) {
  const profileId = ctx.profile?.id;
  const backendBase = ctx.backendBaseUrl || '';
  const userId = ctx.userId;
  const email = ctx.email || '';

  const actions = {
    signup: { label: 'Join as talent', href: '/talent/signup', external: false },
    setup: { label: 'Complete setup', href: '/talent/setup', external: false },
    portal: { label: 'Open my portal', href: '/portal', external: false },
    'portal-pricing': { label: 'Set pricing in portal', href: '/portal#profile-pricing', external: false },
    'portal-photo': { label: 'Update photo', href: '/portal#profile-photo', external: false },
    'submit-review': { label: 'Submit for review', href: '/portal#profile-submit', external: false },
    guide: { label: 'Open talent guide', href: '/portal?guide=1', external: false },
    assessment: { label: 'Take skills test', href: '/assessment', external: false },
    interview: { label: 'AI voice interview', href: '/interview', external: false },
    'intro-slots': { label: 'Publish intro slots', href: '/portal#client-intro-scheduling', external: false },
    portfolio: {
      label: 'Build portfolio',
      href: profileId
        ? `/talent/${profileId}/portfolio?add=1#portfolio-editor`
        : '/portal?portfolio=add#talent-portfolio',
      external: false,
    },
    'portal-portfolio': {
      label: 'Edit portfolio in portal',
      href: '/portal?portfolio=add#talent-portfolio',
      external: false,
    },
  };

  if (userId && backendBase) {
    actions.calendar = {
      label: 'Connect calendar',
      href: `${backendBase}/api/cal/connect/start?talentId=${encodeURIComponent(userId)}&email=${encodeURIComponent(email)}`,
      external: true,
    };
  }

  if (isProfileOnWaitlist(ctx.profile)) {
    delete actions['portal-photo'];
    delete actions['submit-review'];
  }

  return actions;
}

async function fetchAssessmentScores(talentId) {
  if (!supabaseAdmin || !talentId) return {};
  const { data, error } = await supabaseAdmin
    .from('skill_assessments')
    .select('skill, total_score, status')
    .eq('talent_id', talentId)
    .eq('status', 'completed')
    .order('submitted_at', { ascending: false });
  if (error) return {};

  const scores = {};
  for (const row of data || []) {
    const key = String(row.skill || '').trim();
    if (!key || scores[key] != null) continue;
    scores[key] = Number(row.total_score) || 0;
  }
  return scores;
}

async function buildTalentOnboardingContext({ user, profile, currentPath, backendBaseUrl }) {
  const talentId = profile?.id;
  let assessmentCount = 0;
  let introSlotsCount = 0;
  let portfolioProjectCount = 0;
  let interviewUnlocked = false;
  let interviewCompleted = false;
  let assessmentScores = {};

  if (supabaseAdmin && talentId) {
    const [assessRes, slotsRes, portfolioRes, interviewReqRes, interviewRes] = await Promise.all([
      supabaseAdmin
        .from('skill_assessments')
        .select('id', { count: 'exact', head: true })
        .eq('talent_id', talentId)
        .eq('status', 'completed'),
      supabaseAdmin
        .from('talent_intro_slots')
        .select('id', { count: 'exact', head: true })
        .eq('talent_id', talentId)
        .in('status', ['open', 'held', 'booked']),
      supabaseAdmin
        .from('talent_portfolio_projects')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', talentId),
      supabaseAdmin
        .from('voice_interview_requests')
        .select('id')
        .eq('talent_id', talentId)
        .eq('status', 'active')
        .limit(1),
      supabaseAdmin
        .from('voice_interview_results')
        .select('id')
        .eq('talent_id', talentId)
        .limit(1),
    ]);

    assessmentCount = assessRes.count || 0;
    introSlotsCount = slotsRes.count || 0;
    portfolioProjectCount = portfolioRes.count || 0;
    interviewUnlocked = (interviewReqRes.data || []).length > 0;
    interviewCompleted = (interviewRes.data || []).length > 0;
    assessmentScores = await fetchAssessmentScores(talentId);
  }

  const pricing = buildPricingGuidance(profile, assessmentScores);

  const ctx = {
    hasAccount: Boolean(user?.id),
    userId: user?.id || null,
    email: user?.email || null,
    currentPath: currentPath || null,
    backendBaseUrl: backendBaseUrl || null,
    profile: profile
      ? {
          id: profile.id,
          name: profile.name,
          job_title: profile.job_title,
          about: profile.about ? profile.about.slice(0, 500) : '',
          skills: profile.skills || [],
          best_skill: profile.best_skill,
          experience_years: profile.experience_years,
          department: profile.department,
          monthly_fee_usd: profile.monthly_fee_usd,
          directory_fee_usd: profile.directory_fee_usd,
          availability: profile.availability,
          role_type: profile.role_type,
          directory_status: profile.directory_status || 'draft',
          review_notes: profile.review_notes || '',
          review_issues: profile.review_issues || [],
          has_photo: Boolean(profile.photo_url?.trim()),
          has_cv: Boolean(profile.cv_url?.trim()),
          cal_username: profile.cal_username || null,
        }
      : null,
    calendarConnected: Boolean(profile?.cal_username?.trim()),
    assessmentCount,
    assessmentScores,
    introSlotsCount,
    portfolioProjectCount,
    interviewUnlocked,
    interviewCompleted,
    pricing,
  };

  ctx.nextSteps = buildOnboardingChecklist(ctx);
  ctx.actionCatalog = buildActionCatalog(ctx);

  return ctx;
}

module.exports = {
  buildTalentOnboardingContext,
  buildPricingGuidance,
  buildOnboardingChecklist,
  buildActionCatalog,
  calculateDirectoryFeeUsd,
  isProfileOnWaitlist,
};
