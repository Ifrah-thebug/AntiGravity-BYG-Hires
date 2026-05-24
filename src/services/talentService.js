// src/services/talentService.js

// A database and simulation service that manages localStorage,
// mock Google Drive structures, Gemini and Claude API integrations, and mock transactional emails.

const SUBMISSIONS_KEY = 'byg_submissions';
const EMAIL_OUTBOX_KEY = 'byg_email_outbox';
const ACTIVE_ADMIN_KEY = 'byg_admin_session';

// standard scenarios by role for fallback / previews
export const standardScenarios = {
  'Operations': {
    level: 'MID-TO-SENIOR',
    time: '25 min',
    title: "Fulfillment & Booking Logistics Crisis",
    desc: "A tour operator managing 40+ daily bookings has noticed a 30% no-show rate over the past 2 weeks. Guides are reporting guests arriving at the wrong pickup point. The operations manager is on leave. You have been handed the shared support inbox, a spreadsheet of bookings, and a customer WhatsApp group. What went wrong, and what do you do right now?",
    checklist: [
      "Diagnose the root cause in 3 sentences or fewer.",
      "Draft the guest message you'd send in the next 60 minutes.",
      "Outline the SOP change you'd implement to prevent recurrence."
    ]
  },
  'Customer Success': {
    level: 'SENIOR',
    time: '30 min',
    title: "High-Value Enterprise Retention Plan",
    desc: "A SaaS enterprise client ($50k ARR) has missed their last three onboarding calls and just sent a formal email stating they 'do not see the value'. Their primary internal sponsor just left the company. You have 24 hours to present a turnaround strategy. What is your action plan?",
    checklist: [
      "Identify the immediate risk factors and diagnostic gaps.",
      "Draft a high-stakes executive re-engagement email.",
      "Propose a 30-day success plan to the new stakeholder."
    ]
  },
  'Marketing': {
    level: 'MID-LEVEL',
    time: '20 min',
    title: "Ad Funnel Audit & Performance Recovery",
    desc: "Your primary Meta ad campaign was crushing it with a 4x ROAS. Suddenly, CPC has doubled and your conversion rate dropped by 50% overnight. The marketing budget is $500/day. You need to present an optimization fix to the founder in 2 hours.",
    checklist: [
      "Audit the acquisition funnel for potential technical or creative breaking points.",
      "Suggest 3 immediate creative, copy, or targeting pivots.",
      "Draft a brief performance report explaining the variance and next steps."
    ]
  },
  'EA': {
    level: 'SENIOR',
    time: '20 min',
    title: "Calendar Tetris & High-Stake Coordination",
    desc: "The CEO is flying to Riyadh for a regional summit. Two major investors just requested emergency 1:1 meetings, their flight is delayed by 4 hours, and there's a conflicting board meeting. You need to reschedule the entire 48-hour block while maintaining 'founder presence'.",
    checklist: [
      "Prioritize the conflicting meetings based on strategic business impact.",
      "Draft 'polite but firm' rescheduling messages to high-profile stakeholders.",
      "Build the updated itinerary including travel buffers and prep time."
    ]
  },
  'Data': {
    level: 'MID-LEVEL',
    time: '35 min',
    title: "Sales Reconciliation & Integrity Audit",
    desc: "The CRM dashboard reports $1.2M in sales for Q1, but the payment gateway only processed $1.05M. There are over 200 transactions to reconcile. You have a messy CSV export and a deadline of 'yesterday'. How do you find the gap?",
    checklist: [
      "Outline the data reconciliation and matching workflow.",
      "Identify the most likely technical causes of the discrepancy.",
      "Create a simple dashboard layout or tracker query to monitor this live."
    ]
  },
  'Finance': {
    level: 'SENIOR',
    time: '35 min',
    title: "Cash Flow Run Rate & Scenario Modeling",
    desc: "A portfolio startup has a bank balance of $300k. Average monthly expenses are $80k, and monthly revenue is $30k. The sales pipeline has slowed down. You need to project the runway and model two scenarios: status quo vs. immediate 25% cost reduction.",
    checklist: [
      "Calculate current monthly burn rate and runway in months.",
      "Draft a scenario model comparison with a cost-reduction strategy.",
      "Write a short memo advising the Board on the recommended course of action."
    ]
  }
};

// Seed initial data if localStorage is empty
export const initializeData = () => {
  if (!localStorage.getItem(SUBMISSIONS_KEY)) {
    const seed = [
      {
        id: 'tal_1',
        token: 'tok_maria',
        name: 'Maria S.',
        email: 'maria@example.com',
        phone: '+971 50 123 4567',
        expertise: 'Operations',
        yearsExp: '6-10',
        resumeFile: { name: 'Maria_S_Resume_2024.pdf', size: 1048576 },
        status: 'admitted',
        submittedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
        parsedResumeData: {
          detected_expertise: "Operations Manager",
          years_experience: 7,
          prior_roles: ["Ops Lead at TravelCo", "Fulfillment Manager at ShopCo"],
          key_skills: ["Asana", "SOPs", "Process design", "Vendor management"],
          red_flags: null,
          expertise_mismatch: false,
          notes: "Strong operations background with 7 years experience. Skills align well with claimed expertise."
        },
        assessmentTask: {
          scenario: "A tour operator managing 40+ daily bookings has noticed a 30% no-show rate over the past 2 weeks. Guides are reporting guests arriving at the wrong pickup point. The operations manager is on leave. You have been handed the shared support inbox, a spreadsheet of bookings, and a customer WhatsApp group. What went wrong, and what do you do right now?",
          deliverable_1: "Diagnose the root cause in 3 sentences or fewer.",
          deliverable_2: "Draft the guest message you'd send in the next 60 minutes.",
          deliverable_3: "Outline the SOP change you'd implement to prevent recurrence.",
          estimated_time_minutes: 25
        },
        assessmentAnswers: {
          deliverable1: "The primary root cause is a breakdown in communications regarding pickup points. Guests are receiving conflicting directions from old email templates that do not match the current coordinates sent on WhatsApp, compounded by the manager's absence.",
          deliverable2: "Hi [Guest Name], we're excited to have you today! To make sure we connect easily, please note our official pickup point is [Exact Point] (coordinates: Link). Our guide in the red cap is waiting for you! If you have any trouble, call us here directly.",
          deliverable3: "Update all email automation flows to dynamically pull pickup locations from a single master Google Sheet database. Train guides to cross-verify guest lists on a shared dashboard rather than relying on disparate WhatsApp group updates.",
          submittedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000 + 30 * 60 * 1000).toISOString()
        },
        aiScore: {
          clarity_score: 24,
          clarity_feedback: "Maria's answers are extremely direct, professional, and completely free of filler words.",
          relevance_score: 23,
          relevance_feedback: "Directly solves the booking issues. Guest messaging is friendly and action-oriented.",
          speed_score: 24,
          speed_feedback: "SOP change is highly actionable and would take less than a day to completely implement.",
          problem_solving_score: 23,
          problem_solving_feedback: "Identifies systemic automation errors instead of just blaming the absent ops manager.",
          total_score: 94,
          recommendation: "Strong Admit",
          summary: "Highly skilled operations leader with clear communication and a sharp, logical approach to process problems."
        },
        reviewerNotes: "Excellent candidate, matched very quickly with travel client requirements.",
        reviewerName: "Admin User",
        decisionTimestamp: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'tal_2',
        token: 'tok_reject_test',
        name: 'Alex Johnson',
        email: 'alex@test.com',
        phone: '+966 55 987 6543',
        expertise: 'Marketing',
        yearsExp: '1-2',
        resumeFile: { name: 'Alex_Marketing_Intern.pdf', size: 524288 },
        status: 'rejected',
        submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        parsedResumeData: {
          detected_expertise: "Marketing Coordinator",
          years_experience: 1.5,
          prior_roles: ["Marketing Intern at LocalAgency"],
          key_skills: ["Canva", "Social media posting"],
          red_flags: "Lacks core technical marketing skills like Meta Ads optimization or funnel analytics.",
          expertise_mismatch: false,
          notes: "Entry level marketing applicant. Skills are very basic."
        },
        assessmentTask: {
          scenario: "Your primary Meta ad campaign was crushing it with a 4x ROAS. Suddenly, CPC has doubled and your conversion rate dropped by 50% overnight. The marketing budget is $500/day. You need to present an optimization fix to the founder in 2 hours.",
          deliverable_1: "Audit the acquisition funnel for potential technical or creative breaking points.",
          deliverable_2: "Suggest 3 immediate creative, copy, or targeting pivots.",
          deliverable_3: "Draft a brief performance report explaining the variance and next steps.",
          estimated_time_minutes: 20
        },
        assessmentAnswers: {
          deliverable1: "I would check if the Facebook site is down or if internet was disconnected.",
          deliverable2: "1. Make a prettier post. 2. Post on Instagram stories. 3. Ask friends to share the post.",
          deliverable3: "The ads stopped working. I will fix it by uploading a new picture tomorrow.",
          submittedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 40 * 60 * 1000).toISOString()
        },
        aiScore: {
          clarity_score: 13,
          clarity_feedback: "Extremely vague answers. Provides very little detail or clarity on action points.",
          relevance_score: 10,
          relevance_feedback: "Does not address Meta ads optimization or ROAS diagnostics at all.",
          speed_score: 12,
          speed_feedback: "Lacks urgency or proper technical diagnostics to recover a $500/day budget.",
          problem_solving_score: 8,
          problem_solving_feedback: "Surface-level thinking. Does not understand digital acquisition funnel mechanics.",
          total_score: 43,
          recommendation: "Reject",
          summary: "Applicant lacks the required experience and technical marketing knowledge to handle active client campaigns."
        },
        reviewerNotes: "Applicant failed basic concepts of ad optimization. Rejecting application.",
        reviewerName: "Admin User",
        decisionTimestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'tal_3',
        token: 'tok_pending_test',
        name: 'Sarah Connor',
        email: 'sarah@resistance.org',
        phone: '+971 52 999 8888',
        expertise: 'CS',
        yearsExp: '3-5',
        resumeFile: { name: 'Sarah_Connor_CS_Resume.pdf', size: 900222 },
        status: 'pending_human_review',
        submittedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        parsedResumeData: {
          detected_expertise: "Customer Success Manager",
          years_experience: 4,
          prior_roles: ["CS Specialist at TechCorp", "Support Lead at Cyberdyne"],
          key_skills: ["Zendesk", "Churn reduction", "Enterprise onboarding"],
          red_flags: null,
          expertise_mismatch: false,
          notes: "Solid mid-level CS professional. Experience matches requested expertise perfectly."
        },
        assessmentTask: {
          scenario: "A SaaS enterprise client ($50k ARR) has missed their last three onboarding calls and just sent a formal email stating they 'do not see the value'. Their primary internal sponsor just left the company. You have 24 hours to present a turnaround strategy. What is your action plan?",
          deliverable_1: "Identify the immediate risk factors and diagnostic gaps.",
          deliverable_2: "Draft a high-stakes executive re-engagement email.",
          deliverable_3: "Propose a 30-day success plan to the new stakeholder.",
          estimated_time_minutes: 30
        },
        assessmentAnswers: {
          deliverable1: "The primary risk factors are: 1. Complete loss of executive sponsorship, 2. Complete absence of client onboarding activity, which indicates zero platform adoption, 3. Strong churn intent explicitly written by the client.",
          deliverable2: "Subject: Strategic Partnership Review: Aligning [Company] and [Client]\n\nDear [Name],\n\nFirst, congratulations on taking the helm. I know transition periods are incredibly busy. I wanted to reach out because we're committed to helping you hit your Q2 targets. Let's schedule a brief 15-min sync to align our tools with your immediate priorities.",
          deliverable3: "Days 1-7: Conduct an executive alignment call to define new success metrics. Days 8-15: Host a custom bootcamp for end-users. Days 16-30: Establish a bi-weekly telemetry check-in and dashboard audit.",
          submittedAt: new Date(Date.now() - 2 * 60 * 60 * 1000 + 25 * 60 * 1000).toISOString()
        },
        aiScore: {
          clarity_score: 22,
          clarity_feedback: "Clear and highly structured answers, very direct and professional.",
          relevance_score: 21,
          relevance_feedback: "Identifies onboarding misses and stakeholder churn correctly.",
          speed_score: 20,
          speed_feedback: "Re-engagement email is written with appropriate urgency.",
          problem_solving_score: 21,
          problem_solving_feedback: "30-day plan outlines user adoption and executive metrics thoroughly.",
          total_score: 84,
          recommendation: "Admit",
          summary: "Strong CS mindset. Excellent email copy and highly actionable 30-day plan. Recommended to admit."
        }
      }
    ];
    localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(seed));
  }
};

// Database APIs
export const talentService = {
  // Get all submissions
  getSubmissions: () => {
    initializeData();
    return JSON.parse(localStorage.getItem(SUBMISSIONS_KEY)) || [];
  },

  // Get single submission by ID
  getSubmission: (id) => {
    const subs = talentService.getSubmissions();
    return subs.find(s => s.id === id);
  },

  // Get single submission by Token
  getSubmissionByToken: (token) => {
    const subs = talentService.getSubmissions();
    return subs.find(s => s.token === token);
  },

  // Save/Update submission
  saveSubmission: (sub) => {
    const subs = talentService.getSubmissions();
    const idx = subs.findIndex(s => s.id === sub.id);
    if (idx >= 0) {
      subs[idx] = sub;
    } else {
      subs.push(sub);
    }
    localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(subs));
    
    // Dispatch a storage event so components can update live if open in multiple panels
    window.dispatchEvent(new Event('storage'));
  },

  // Create active application metadata (Intake Submit)
  apply: async (formData, file) => {
    initializeData();
    const talentId = 'tal_' + Math.random().toString(36).substr(2, 9);
    const token = 'tok_' + Math.random().toString(36).substr(2, 12);
    
    // Check reapply block
    const subs = talentService.getSubmissions();
    const recentRejection = subs.find(s => 
      s.email.toLowerCase() === formData.email.toLowerCase() && 
      s.status === 'rejected' &&
      s.decisionTimestamp &&
      (Date.now() - new Date(s.decisionTimestamp).getTime()) < 7 * 24 * 60 * 60 * 1000 // 7 days cooldown
    );

    if (recentRejection) {
      const remainingDays = Math.ceil((7 * 24 * 60 * 60 * 1000 - (Date.now() - new Date(recentRejection.decisionTimestamp).getTime())) / (24 * 60 * 60 * 1000));
      throw new Error(`You have recently applied and were rejected. Please wait ${remainingDays} days before reapplying.`);
    }

    // Prepare simulated file object
    const simulatedFile = file ? {
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: new Date().toISOString()
    } : { name: `${formData.name.replace(/\s+/g, '_')}_Resume.pdf`, size: 1048576, type: 'application/pdf', uploadedAt: new Date().toISOString() };

    // 1. Google Drive simulation log
    const driveFolder = `BYG Hires Talent Pool/Submissions (Active)/[${talentId}] - [${formData.name}] - [${new Date().toISOString().split('T')[0]}]`;
    const driveFiles = [
      { path: `${driveFolder}/resume.pdf`, size: simulatedFile.size, status: 'Uploaded' }
    ];

    // 2. Call Gemini AI Resume Parser simulation (Prompt 0)
    // Dynamic generation based on selected role to make it look professional, but with some variety!
    const parsedData = await mockGeminiResumeParse(formData.name, formData.expertise, formData.yearsExp, simulatedFile.name);

    // 3. Generate role-specific assessment via Mock Claude (Prompt 1)
    const assessmentTask = await mockClaudeGenerateAssessment(formData.name, parsedData);

    const newSub = {
      id: talentId,
      token: token,
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      expertise: formData.expertise,
      yearsExp: formData.yearsExp,
      resumeFile: simulatedFile,
      status: 'invited', // Stage: Application received, assessment link generated
      submittedAt: new Date().toISOString(),
      parsedResumeData: parsedData,
      assessmentTask: assessmentTask,
      assessmentAnswers: null,
      aiScore: null,
      driveFiles: driveFiles,
      driveFolder: driveFolder
    };

    talentService.saveSubmission(newSub);

    // 4. Trigger Assessment Invite Email
    sendMockEmail(
      newSub.email,
      'Your BYG Hires Assessment is Ready',
      `Dear ${newSub.name},\n\nComplete this ${assessmentTask.estimated_time_minutes}-min task to join our pool.\n\nUnique Link: /assessment?token=${newSub.token}\n\nThis assessment link will expire in 7 days.\n\nBest of luck,\nBYG Hires Team`,
      'assessment_invite',
      newSub.token
    );

    return newSub;
  },

  // Save draft answers
  saveDraftAnswers: (token, answers) => {
    const sub = talentService.getSubmissionByToken(token);
    if (!sub) return;
    sub.assessmentAnswers = {
      ...sub.assessmentAnswers,
      ...answers,
      savedAt: new Date().toISOString()
    };
    talentService.saveSubmission(sub);
  },

  // Final submit assessment
  submitAssessment: async (token, answers) => {
    const sub = talentService.getSubmissionByToken(token);
    if (!sub) throw new Error('Submission not found.');

    sub.assessmentAnswers = {
      ...answers,
      submittedAt: new Date().toISOString()
    };
    sub.status = 'pending_ai_review';
    talentService.saveSubmission(sub);

    // Simulated Google Drive update
    const responseFile = `${sub.driveFolder}/assessment_response.txt`;
    if (sub.driveFiles) {
      sub.driveFiles.push({ path: responseFile, size: 2048, status: 'Uploaded' });
    }

    // Trigger AI Scoring in background after small delay to show processing
    setTimeout(async () => {
      try {
        const freshSub = talentService.getSubmissionByToken(token);
        const scoreResult = await mockClaudeScoreAssessment(freshSub);
        freshSub.aiScore = scoreResult;
        freshSub.status = 'pending_human_review';
        talentService.saveSubmission(freshSub);
      } catch (err) {
        console.error('AI scoring failed', err);
      }
    }, 4000);

    return sub;
  },

  // Admin make decision
  makeAdminDecision: (id, decision, notes, reviewerName) => {
    const sub = talentService.getSubmission(id);
    if (!sub) throw new Error('Submission not found');

    sub.status = decision; // 'admitted' | 'rejected' | 'revision_requested'
    sub.reviewerNotes = notes;
    sub.reviewerName = reviewerName;
    sub.decisionTimestamp = new Date().toISOString();

    talentService.saveSubmission(sub);

    // Send emails based on decision
    if (decision === 'admitted') {
      sendMockEmail(
        sub.email,
        "You're in the BYG Hires Talent Pool! 🎉",
        `Congratulations, ${sub.name}. Your assessment scored ${sub.aiScore?.total_score || 90}/100.\n\nYou're now visible to our clients.\n\nLog in to see matches here: /talent/dashboard?id=${sub.id}\n\nWelcome aboard!\nBYG Hires Team`,
        'admit_email',
        null,
        sub.id
      );
    } else if (decision === 'rejected') {
      sendMockEmail(
        sub.email,
        "Next Steps — Your BYG Hires Assessment",
        `Thanks for applying, ${sub.name}. Your assessment scored ${sub.aiScore?.total_score || 50}/100.\n\nReason from our team:\n"${notes || 'Clear thinking, but responses lacked specific examples.'}"\n\nYou can reapply in 7 days here: /talent-pool/apply\n\nKeep growing,\nBYG Hires Team`,
        'reject_email'
      );
    } else if (decision === 'revision_requested') {
      sendMockEmail(
        sub.email,
        "One More Step — Please Revise Your Assessment",
        `Dear ${sub.name},\n\nYour assessment was strong (${sub.aiScore?.total_score || 75}/100), but we'd like to see more detail on:\n\n"${notes || 'Please elaborate on the SOP implementation plan.'}"\n\nResubmit your revised response here: /assessment?token=${sub.token}\n\nNew deadline: 7 days.\n\nBest regards,\nBYG Hires Team`,
        'revision_email',
        sub.token
      );
    }

    return sub;
  },

  // Email outbox handlers
  getEmails: () => {
    return JSON.parse(localStorage.getItem(EMAIL_OUTBOX_KEY)) || [];
  },

  clearEmails: () => {
    localStorage.setItem(EMAIL_OUTBOX_KEY, JSON.stringify([]));
    window.dispatchEvent(new Event('storage'));
  },

  // Admin session helpers
  adminLogin: (code) => {
    if (code === '12345') {
      localStorage.setItem(ACTIVE_ADMIN_KEY, 'true');
      return true;
    }
    return false;
  },

  isAdminLoggedIn: () => {
    return localStorage.getItem(ACTIVE_ADMIN_KEY) === 'true';
  },

  adminLogout: () => {
    localStorage.removeItem(ACTIVE_ADMIN_KEY);
  }
};

// Transactional Email Simulator Engine
function sendMockEmail(to, subject, body, type, token = null, id = null) {
  const emails = JSON.parse(localStorage.getItem(EMAIL_OUTBOX_KEY)) || [];
  const newEmail = {
    id: 'em_' + Math.random().toString(36).substr(2, 9),
    to,
    subject,
    body,
    type,
    token,
    talentId: id,
    timestamp: new Date().toISOString()
  };
  emails.unshift(newEmail);
  localStorage.setItem(EMAIL_OUTBOX_KEY, JSON.stringify(emails));
  
  // Dispatch a storage event so components can update live
  window.dispatchEvent(new Event('storage'));
}

// ----------------------------------------------------
// DETAILED DETERMINISTIC AI GENERATORS (PROMPT MOCKS)
// ----------------------------------------------------

// Gemini Resume Parser (Prompt 0)
async function mockGeminiResumeParse(name, claimedExpertise, yearsExp, fileName) {
  await delay(1500); // simulate API call

  const mappedExpertise = {
    'Operations': 'Operations Manager',
    'Customer Success': 'Customer Success Manager',
    'Marketing': 'Digital Marketing Specialist',
    'EA': 'Executive Assistant to CEO',
    'Data': 'Data & Reporting Analyst',
    'Finance': 'Senior Financial Analyst'
  };

  const detectedExp = mappedExpertise[claimedExpertise] || "Professional Coordinator";
  
  let yrs = 4;
  if (yearsExp === 'junior') yrs = 2;
  else if (yearsExp === 'mid') yrs = 5;
  else if (yearsExp === 'senior') yrs = 9;

  let priorRoles = [`Lead at GrowthCo`, `Associate at GlobalHub`];
  let skills = ['Communication', 'Microsoft Excel', 'Task Management'];
  let mismatch = false;
  let notes = "Resume parsed successfully. Clean layout. Strong match with claimed role.";

  // Create an interesting dynamic mismatch check if the file name contains a mismatched word!
  const lowerFile = fileName.toLowerCase();
  if ((claimedExpertise === 'Operations' && lowerFile.includes('marketing')) ||
      (claimedExpertise === 'Customer Success' && lowerFile.includes('developer')) ||
      (lowerFile.includes('mismatch') || lowerFile.includes('fake') || lowerFile.includes('wrong'))) {
    mismatch = true;
    notes = `WARNING: Mismatch detected. Candidate applied for ${claimedExpertise} but resume file highly implies background in Web Development/Design. Flagged for review.`;
  }

  // customize skills by role
  if (claimedExpertise === 'Operations') {
    skills = ['Asana', 'SOPs', 'Process design', 'Vendor management', 'ClickUp'];
    priorRoles = ['Operations Analyst at Noon Logistics', 'Fulfillment Coordinator at Fetchr'];
  } else if (claimedExpertise === 'Customer Success') {
    skills = ['Zendesk', 'Intercom', 'Churn prevention', 'CRM administration', 'HubSpot'];
    priorRoles = ['Customer Retention Specialist at StarSaaS', 'Support Advocate at Souq.com'];
  } else if (claimedExpertise === 'Marketing') {
    skills = ['Meta Ads Manager', 'Google Analytics', 'SEO copywriting', 'Email campaigns', 'Vite'];
    priorRoles = ['Growth Specialist at Agency99', 'SEO Executive at Careem'];
  } else if (claimedExpertise === 'EA') {
    skills = ['Calendar Management', 'Travel planning', 'Expense reporting', 'Founder representation', 'Slack'];
    priorRoles = ['Executive Assistant to VP at Majid Al Futtaim', 'Personal Assistant at KPMG'];
  } else if (claimedExpertise === 'Data') {
    skills = ['SQL', 'Tableau', 'Excel Pivot Tables', 'Python data wrangling', 'Looker Studio'];
    priorRoles = ['BI Engineer at Delivery Hero', 'Reporting Analyst at Talabat'];
  } else if (claimedExpertise === 'Finance') {
    skills = ['Financial Modeling', 'GAAP budgeting', 'Cost optimization', 'Pitch deck metrics', 'Xero'];
    priorRoles = ['Corporate Finance Associate at PwC', 'Accountant at Al Tayer Group'];
  }

  return {
    detected_expertise: detectedExp,
    years_experience: yrs,
    prior_roles: priorRoles,
    key_skills: skills,
    red_flags: mismatch ? "Claimed operations background, but resume lists 3 years of react frontend engineering only." : null,
    expertise_mismatch: mismatch,
    notes: notes
  };
}

// Claude Assessment Generator (Prompt 1)
async function mockClaudeGenerateAssessment(name, parsedResume) {
  await delay(1000); // simulate API call
  
  const role = parsedResume.detected_expertise;
  const yrs = parsedResume.years_experience;
  const skills = parsedResume.key_skills.join(", ");

  let scenario = "";
  let d1 = "";
  let d2 = "";
  let d3 = "";
  let time = 25;

  if (role.includes("Operations")) {
    scenario = `You are the Lead Operations Manager for a GCC-based food-delivery logistics aggregator handling 2,000 orders daily. Over the past week, courier dispatch delays in Dubai Marina have surged by 22%, causing a wave of cold food complaints and order cancellations. The local dispatch dispatcher has gone offline without warning, leaving a backlog of unresolved complaints, a chaotic Slack channel of couriers, and a tracking sheet showing unassigned drivers. You have 25 minutes to restore order.`;
    d1 = "Diagnose the primary operational bottleneck in 3 sentences or fewer based on courier driver shortages and route allocation.";
    d2 = "Draft a direct, reassuring dispatch notice to the courier fleet (max 150 words) establishing new queue coordination rules.";
    d3 = "Outline a permanent 3-step SOP change utilizing geo-fencing or route optimization tools to prevent future driver drop-offs.";
    time = 25;
  } else if (role.includes("Customer Success")) {
    scenario = `A VIP enterprise client in Riyadh ($60k ARR SaaS platform) has suddenly requested a call with their director to discuss cancellation. Their usage telemetry shows user activity dropped by 65% after the platform update two weeks ago. The main success manager is currently out of office, and you have been pulled in to save the account, with the critical alignment call happening tomorrow morning.`;
    d1 = "Perform an account health analysis identifying the 3 highest risk issues causing the sudden drop-off.";
    d2 = "Draft a high-impact pre-call email to the VIP Director (max 200 words) framing the agenda and offering immediate custom user bootcamps.";
    d3 = "Draft a 30-day customer recovery plan focusing on high-touch engagement and onboarding metrics to stabilize retention.";
    time = 30;
  } else if (role.includes("Marketing")) {
    scenario = `A fast-growing direct-to-consumer e-commerce brand selling organic coffee in Riyadh and Dubai is spending $1,500 daily across Meta and TikTok. Yesterday morning, Meta ad CPC doubled and purchase ROAS plummeted from 3.5x to 1.1x overnight, threatening the monthly customer acquisition cost limit. You have a meeting with the founder in one hour.`;
    d1 = "List 3 high-probability causes for this immediate ad funnel variance (e.g. ad fatigue, billing cap limits, pixel disconnect).";
    d2 = "Propose a tactical meta campaign recovery plan suggesting 3 creative adjustments or audience adjustments to deploy in 24 hours.";
    d3 = "Outline a brief 4-sentence summary report explaining this marketing challenge to the founder in non-technical terms.";
    time = 20;
  } else if (role.includes("Executive Assistant")) {
    scenario = `Your CEO is scheduled to present at a tech summit in Riyadh. She has 3 crucial venture backer coffee meetings, a delayed flight of 3 hours, a board meeting that cannot be moved, and an urgent press interview request. Her calendar is double-booked and she has reached out to you from the airport terminal expressing intense stress.`;
    d1 = "Rank the conflicting appointments in order of strategic value, outlining the exact rationale in 4 sentences.";
    d2 = "Draft the exact WhatsApp communications to be sent to the venture partners to delay meetings gracefully without losing leverage.";
    d3 = "Rebuild a compact, stress-free 48-hour itinerary incorporating travel buffers, airport lounge work slots, and Riyadh airport transit.";
    time = 20;
  } else if (role.includes("Data")) {
    scenario = `The sales dashboard for a premium regional retail client reports total Q1 sales of AED 3,450,000, but bank transaction files show only AED 3,120,000 was settled, highlighting a massive AED 330,000 variance. There are thousands of rows of transaction data. You have a spreadsheet of payment attempts and the database ledger.`;
    d1 = "Identify the step-by-step SQL or Excel reconciliation query logic to match bank logs against the CRM sales records.";
    d2 = "Explain the 3 most likely systemic processing bugs that could cause transactions to successfully log in CRM but fail to settle in stripe.";
    d3 = "Draft a layout description for an automated transaction discrepancy dashboard to flag reconciliation gaps instantly.";
    time = 35;
  } else {
    scenario = `The company is transitioning its core customer management database to a new centralized CRM platform. The sales team is resistant, complaining of software complexity, and several important client contact details were lost during the initial manual import last weekend. You are task manager for this transition.`;
    d1 = "Diagnose the 3 primary process failures during the data import stage and software onboarding.";
    d2 = "Draft an encouraging team memo (max 200 words) addressing sales concerns, establishing training schedules, and securing buy-in.";
    d3 = "Create a 3-step action plan to recover the lost client contact information and build a clean data validation SOP.";
    time = 25;
  }

  return {
    scenario: scenario,
    deliverable_1: d1,
    deliverable_2: d2,
    deliverable_3: d3,
    estimated_time_minutes: time
  };
}

// Claude Assessment Scorer (Prompt 2)
async function mockClaudeScoreAssessment(sub) {
  await delay(2000); // simulate API call

  const ans = sub.assessmentAnswers || {};
  const d1Len = (ans.deliverable1 || '').length;
  const d2Len = (ans.deliverable2 || '').length;
  const d3Len = (ans.deliverable3 || '').length;
  
  // Calculate a dynamic score based on the length and quality of input (simulating actual thinking!)
  let clarity = 18;
  let relevance = 17;
  let speed = 16;
  let problem = 18;

  if (d1Len > 150) clarity += 4;
  else if (d1Len > 50) clarity += 2;
  else clarity -= 4;

  if (d2Len > 150) relevance += 4;
  else if (d2Len > 50) relevance += 2;
  else relevance -= 4;

  if (d3Len > 250) problem += 5;
  else if (d3Len > 100) problem += 3;
  else problem -= 4;

  // bounds checking
  clarity = Math.max(5, Math.min(25, clarity));
  relevance = Math.max(5, Math.min(25, relevance));
  speed = Math.max(5, Math.min(25, speed));
  problem = Math.max(5, Math.min(25, problem));

  const total = clarity + relevance + speed + problem;
  
  let rec = "Borderline";
  if (total >= 88) rec = "Strong Admit";
  else if (total >= 70) rec = "Admit";
  else if (total >= 50) rec = "Borderline";
  else rec = "Reject";

  // Provide deterministic feedback messages based on score
  let clarityFeedback = "Answers were somewhat brief, missing structural bullet points.";
  if (clarity >= 22) clarityFeedback = "Excellent conciseness. Bullet points are used perfectly to partition thoughts with zero fluff.";
  else if (clarity >= 17) clarityFeedback = "Direct answers, but could benefit from stronger formatting and direct calls-to-action.";

  let relevanceFeedback = "Directly addresses the scenarios but neglects local market realities in Dubai/Riyadh.";
  if (relevance >= 22) relevanceFeedback = "Highly relevant response that demonstrates an intimate understanding of high-stakes environments.";
  else if (relevance >= 17) relevanceFeedback = "Answers solve the immediate client issue, though they miss subtle stakeholder dynamics.";

  let speedFeedback = "Action points feel slightly hesitant and could be deployed faster.";
  if (speed >= 22) speedFeedback = "Outstanding speed and confidence. The candidate frames decisions in hours rather than weeks.";
  
  let problemFeedback = "Surface-level recommendations that don't address systemic software or process failures.";
  if (problem >= 22) problemFeedback = "Excellent systemic process analysis. Demonstrates a clear ability to build sustainable, self-correcting SOPs.";

  let summary = `Candidate shows potential, but assessment answers lack the depth, metrics, or detailed structure required for senior placements.`;
  if (total >= 88) {
    summary = `Outstanding submission. The candidate shows rapid operational diagnosis, highly articulate communication, and bulletproof process controls. Ideal client fit.`;
  } else if (total >= 70) {
    summary = `Solid application that clearly meets standard role qualifications. Communication is professional, and deliverables are fully completed with practical suggestions.`;
  } else if (total < 50) {
    summary = `Unacceptable level of detail. The answers do not address the technical scope of the challenge and miss critical bottlenecks entirely.`;
  }

  return {
    clarity_score: clarity,
    clarity_feedback: clarityFeedback,
    relevance_score: relevance,
    relevance_feedback: relevanceFeedback,
    speed_score: speed,
    speed_feedback: speedFeedback,
    problem_solving_score: problem,
    problem_solving_feedback: problemFeedback,
    total_score: total,
    recommendation: rec,
    summary: summary
  };
}

// Utility delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
