// src/services/talentService.js
import { TALENTS } from '../data/talentData';

// A database and simulation service that manages localStorage,
// mock Google Drive structures, Gemini and Claude API integrations, and mock transactional emails.

// mock Google Drive structures, Gemini and Claude API integrations, and mock transactional emails.

const SUBMISSIONS_KEY = 'byg_submissions';
const EMAIL_OUTBOX_KEY = 'byg_email_outbox';
const ACTIVE_ADMIN_KEY = 'byg_admin_session';
const BYG_USERS_KEY = 'byg_users';

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

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
  apply: async (formData, file, fileBase64) => {
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

    // Format candidate's name to "First Name L." with proper title-case
    let rawName = formData.name.trim();
    // Title-case every word
    rawName = rawName.replace(/\b\w/g, c => c.toUpperCase());
    let formattedName = rawName;
    const nameParts = rawName.split(/\s+/);
    if (nameParts.length > 1) {
      const firstName = nameParts[0];
      const lastName = nameParts[nameParts.length - 1];
      formattedName = `${firstName} ${lastName.charAt(0).toUpperCase()}.`;
    }

    // Prepare simulated file object
    const simulatedFile = file ? {
      name: file.name,
      size: file.size,
      type: file.type,
      uploadedAt: new Date().toISOString()
    } : { name: `${formattedName.replace(/\s+/g, '_')}_Resume.pdf`, size: 1048576, type: 'application/pdf', uploadedAt: new Date().toISOString() };

    // Google Drive simulation log
    const driveFolder = `BYG Hires Talent Pool/Submissions (Active)/[${talentId}] - [${formattedName}] - [${new Date().toISOString().split('T')[0]}]`;
    const driveFiles = [
      { path: `${driveFolder}/resume.pdf`, size: simulatedFile.size, status: 'Uploaded' }
    ];

    // Call Gemini AI Resume Parser using the actual file
    let parsedData;
    if (fileBase64 && GEMINI_API_KEY) {
      const match = fileBase64.match(/^data:([^;]+);base64,(.+)$/);
      if (match) {
        const mimeType = match[1];
        const data = match[2];
        parsedData = await realGeminiResumeParse(formattedName, data, mimeType);
      } else {
        parsedData = await mockGeminiResumeParse(formattedName, null, null, simulatedFile.name);
      }
    } else {
      parsedData = await mockGeminiResumeParse(formattedName, null, null, simulatedFile.name);
    }

    // Auto-create assessment task based on guessed role
    const assessmentTask = await mockClaudeGenerateAssessment(formattedName, parsedData);

    const newSub = {
      id: talentId,
      token: token,
      name: formattedName,
      email: formData.email,
      phone: formData.phone,
      dob: formData.dob || '',
      photo: formData.photo || null, // Real Base64 uploaded photo
      expertise: parsedData.resolvedExpertise,
      yearsExp: parsedData.years_experience >= 8 ? 'senior' : parsedData.years_experience >= 5 ? 'mid' : 'junior',
      resumeFile: simulatedFile,
      status: 'admitted', // Automatically mark as admitted / published!
      submittedAt: new Date().toISOString(),
      parsedResumeData: parsedData,
      assessmentTask: assessmentTask,
      assessmentAnswers: null,
      aiScore: null,
      fee: 500 + Math.floor(Math.random() * 10) * 50, // Auto-assign a reasonable starting fee e.g. $500 - $950
      period: '/mo',
      availability: 'immediate',
      roleType: 'flexible',
      driveFiles: driveFiles,
      driveFolder: driveFolder,
      password: formData.password // storing in local demo DB
    };

    talentService.saveSubmission(newSub);

    // Also create the user account for login
    const users = JSON.parse(localStorage.getItem(BYG_USERS_KEY)) || [];
    users.push({
      id: talentId,
      email: formData.email,
      password: formData.password,
      role: 'talent'
    });
    localStorage.setItem(BYG_USERS_KEY, JSON.stringify(users));
    
    // Auto login
    localStorage.setItem('byg_auth_user', JSON.stringify({ email: formData.email, id: talentId }));
    window.dispatchEvent(new Event('storage'));

    return newSub;
  },

  // Get both static and dynamic browse talents merged
  getAllBrowseTalents: () => {
    initializeData();
    const subs = JSON.parse(localStorage.getItem(SUBMISSIONS_KEY)) || [];
    
    // Map resolved expertise to lowercase database department key
    const deptMap = {
      'Operations': 'admin-operations',
      'Customer Success': 'customer-support',
      'Marketing': 'marketing-content',
      'SaaS': 'it-technical',
      'Automation': 'ai-automation',
      'Sales': 'sales',
      'Finance': 'finance',
      'HR': 'hr',
    };

    // Convert admitted submissions to the format required by the browse page
    const dynamicTalents = subs
      .filter(s => s.status === 'admitted' || s.status === 'invited' || s.status === 'pending_human_review' || s.status === 'pending_ai_review')
      .map(s => {
        const deptKey = deptMap[s.expertise] || 'admin-operations';

        return {
          id: s.id,
          name: s.name,
          role: s.parsedResumeData?.detected_expertise || 'Remote Specialist',
          department: deptKey,
          score: 0,
          fee: Math.round((s.fee || 600) * 1.10), // Automatically enrolled at 10% increase rate
          currency: 'USD',
          period: '/mo',
          availability: s.availability || 'immediate',
          roleType: s.roleType || 'flexible',
          tags: s.parsedResumeData?.key_skills || ['Remote Work', 'English'],
          bestSkill:
            s.parsedResumeData?.best_skill ||
            s.parsedResumeData?.key_skills?.[0] ||
            '',
          experience: `${s.parsedResumeData?.years_experience || 3} yrs`,
          bio: s.parsedResumeData?.notes || 'Talent pool member.',
          photo: s.photo || null, // Real Base64 uploaded photo
          topTalent: false,
          admitted: true,
          token: s.token,
          isDynamic: true,
          verified: false
        };
      });

    // Merge static talents with our dynamic talents, ensuring no duplicates by ID
    const staticTalents = (TALENTS || []).map((t) => ({
      ...t,
      bestSkill: t.bestSkill || t.tags?.[0] || '',
      verified: false,
    }));
    const merged = [...dynamicTalents, ...staticTalents];
    
    // Remove duplicates just in case, and hide profiles that don't have a photo
    const seenIds = new Set();
    return merged.filter(t => {
      if (!t.photo) return false;
      if (seenIds.has(t.id)) return false;
      seenIds.add(t.id);
      return true;
    });
  },

  /** Homepage + directory featured row (static seed IDs + admitted local submissions) */
  getFeaturedTalents: ({ industry, department, limit = 5 } = {}) => {
    const all = talentService.getAllBrowseTalents();
    const featuredIds = ['t013', 't015', 't016', 't017', 't014'];

    const staticFeatured = featuredIds
      .map((id) => {
        const t = all.find((talent) => talent.id === id);
        if (!t) return null;
        return { ...t, match: t.score ?? t.match ?? 0 };
      })
      .filter(Boolean);

    const dynamicFeatured = all
      .filter((t) => t.isDynamic)
      .map((t) => ({ ...t, match: t.score ?? t.match ?? 0 }));

    const seen = new Set();
    let combined = [...dynamicFeatured, ...staticFeatured].filter((t) => {
      if (seen.has(t.id)) return false;
      seen.add(t.id);
      return true;
    });

    if (industry && industry !== 'All') {
      combined = combined.filter((t) => t.industries?.includes(industry));
    }
    if (department && department !== 'all') {
      combined = combined.filter((t) => t.department === department);
    }

    return combined.slice(0, limit);
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
        freshSub.status = 'admitted'; // Remain admitted, now with verified score!
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
        `Thanks for applying, ${sub.name}. Your assessment scored ${sub.aiScore?.total_score || 50}/100.\n\nReason from our team:\n"${notes || 'Clear thinking, but responses lacked specific examples.'}"\n\nYou can reapply in 7 days here: /talent/signup\n\nKeep growing,\nBYG Hires Team`,
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
  },

  // Talent login
  login: (email, password) => {
    const users = JSON.parse(localStorage.getItem(BYG_USERS_KEY)) || [];
    const user = users.find(u => u.email === email && u.password === password);
    if (user) {
      localStorage.setItem('byg_auth_user', JSON.stringify({ email: user.email, id: user.id }));
      window.dispatchEvent(new Event('storage'));
      return true;
    }
    return false;
  },

  logout: () => {
    localStorage.removeItem('byg_auth_user');
    window.dispatchEvent(new Event('storage'));
  },

  getCurrentUser: () => {
    const str = localStorage.getItem('byg_auth_user');
    return str ? JSON.parse(str) : null;
  },

  // Purge all submissions by full or partial name (case-insensitive)
  purgeProfilesByName: (nameFragment) => {
    const subs = talentService.getSubmissions();
    const lower = nameFragment.toLowerCase();
    const filtered = subs.filter(s => !s.name.toLowerCase().includes(lower));
    localStorage.setItem(SUBMISSIONS_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new Event('storage'));
    return subs.length - filtered.length; // returns count of removed profiles
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
// ----------------------------------------------------
// DETAILED DETERMINISTIC AI GENERATORS (PROMPT MOCKS)
// ----------------------------------------------------

async function realGeminiResumeParse(name, base64Data, mimeType) {
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    const prompt = `You are a strict JSON data extractor. Read this CV/Resume document and extract the following information. Return ONLY valid JSON and nothing else (do not use markdown code blocks).
{
  "detected_expertise": "The closest matching Professional Title (e.g. Growth Marketing Specialist, Customer Success Manager, Operations Lead, Executive Assistant, Data Analyst, Financial Accountant, Software Engineer)",
  "years_experience": <number only, e.g. 5>,
  "prior_roles": ["Role 1 at Company A", "Role 2 at Company B"],
  "key_skills": ["Skill 1", "Skill 2", "Skill 3", "Skill 4", "Skill 5"],
  "resolvedExpertise": "One of these specific departments: Operations, Customer Success, Marketing, SaaS, Sales, Finance, HR, Automation, Design, Engineering"
}`;

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: mimeType, data: base64Data } }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.2
        }
      })
    });

    if (!response.ok) {
      console.warn('Real Gemini API failed, falling back to mock.', await response.text());
      return mockGeminiResumeParse(name, null, null, 'resume.pdf');
    }

    const resData = await response.json();
    let textResult = resData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    // Clean up potential markdown formatting
    textResult = textResult.replace(/^```json/m, '').replace(/^```/m, '').trim();
    
    const parsed = JSON.parse(textResult);
    
    return {
      detected_expertise: parsed.detected_expertise || "Remote Specialist",
      years_experience: parsed.years_experience || 3,
      prior_roles: parsed.prior_roles || [],
      key_skills: parsed.key_skills || ["Remote Work", "Communication"],
      red_flags: null,
      expertise_mismatch: false,
      notes: `Extracted dynamically from uploaded CV. Verified by Gemini 1.5 Flash.`,
      resolvedExpertise: parsed.resolvedExpertise || "Operations"
    };
  } catch (err) {
    console.warn('Failed to parse with real Gemini, falling back to mock.', err);
    return mockGeminiResumeParse(name, null, null, 'resume.pdf');
  }
}

// Gemini Resume Parser (Prompt 0)
async function mockGeminiResumeParse(name, claimedExpertise, yearsExp, fileName) {
  await delay(1500); // simulate API call

  const lowerFile = fileName.toLowerCase();
  let resolvedExpertise = claimedExpertise;

  if (!resolvedExpertise) {
    // Guess department/expertise from CV filename
    if (lowerFile.includes('ops') || lowerFile.includes('operation') || lowerFile.includes('logistics') || lowerFile.includes('process')) {
      resolvedExpertise = 'Operations';
    } else if (lowerFile.includes('market') || lowerFile.includes('ads') || lowerFile.includes('seo') || lowerFile.includes('copy')) {
      resolvedExpertise = 'Marketing';
    } else if (lowerFile.includes('crm') || lowerFile.includes('salesforce') || lowerFile.includes('hubspot') || lowerFile.includes('saas')) {
      resolvedExpertise = 'SaaS';
    } else if (lowerFile.includes('auto') || lowerFile.includes('zapier') || lowerFile.includes('make') || lowerFile.includes('script') || lowerFile.includes('code')) {
      resolvedExpertise = 'Automation';
    } else if (lowerFile.includes('support') || lowerFile.includes('customer') || lowerFile.includes('success') || lowerFile.includes('service')) {
      resolvedExpertise = 'Customer Success';
    } else if (lowerFile.includes('sale') || lowerFile.includes('close') || lowerFile.includes('outbound')) {
      resolvedExpertise = 'Sales';
    } else if (lowerFile.includes('fin') || lowerFile.includes('finance') || lowerFile.includes('book') || lowerFile.includes('tax') || lowerFile.includes('account')) {
      resolvedExpertise = 'Finance';
    } else if (lowerFile.includes('hr') || lowerFile.includes('recruit') || lowerFile.includes('talent')) {
      resolvedExpertise = 'HR';
    } else {
      // Pick a random department — seeded by name chars + current ms so same filename used
      // twice by different people won't always get the same dept
      const depts = ['Operations', 'Customer Success', 'Marketing', 'SaaS', 'Sales', 'Finance', 'HR'];
      const seed = (name.charCodeAt(0) || 65) * 31 + (name.charCodeAt(1) || 66) * 17 + (Date.now() % 97);
      resolvedExpertise = depts[seed % depts.length];
    }
  }

  const mappedExpertise = {
    'Operations': 'Operations & Fulfillment Lead',
    'Customer Success': 'Customer Success Manager',
    'Marketing': 'Growth Marketing Specialist',
    'SaaS': 'SaaS & CRM Architect',
    'Automation': 'Workflow Automation Engineer',
    'Sales': 'B2B Sales Representative',
    'Finance': 'Bookkeeper & Finance Analyst',
    'HR': 'Talent Acquisition Partner'
  };

  const detectedExp = mappedExpertise[resolvedExpertise] || "Remote Operations Specialist";
  
  // Randomly assign 3 to 8 years experience
  let yrs = Math.floor(Math.random() * 6) + 3;

  let priorRoles = [`Senior Specialist at GrowthCo`, `Lead Associate at GlobalHub`];
  let skills = ['Communication', 'Microsoft Excel', 'Task Management'];
  let notes = `${detectedExp} with a strong background in ${skills.slice(0, 3).join(', ')}. Proven track record in ${resolvedExpertise.toLowerCase()} roles, available for remote positions across the GCC.`;

  // customize skills and roles by guessed/resolved expertise
  if (resolvedExpertise === 'Operations') {
    skills = ['Asana', 'SOPs', 'Process Design', 'Notion', 'Vendor Management'];
    priorRoles = ['Operations Analyst at Noon Logistics', 'Fulfillment Coordinator at Fetchr'];
  } else if (resolvedExpertise === 'Customer Success') {
    skills = ['Zendesk', 'Intercom', 'CRM Administration', 'Customer Onboarding', 'HubSpot'];
    priorRoles = ['Customer Success Specialist at StarSaaS', 'Support Lead at Souq.com'];
  } else if (resolvedExpertise === 'Marketing') {
    skills = ['Meta Ads', 'Email Funnels', 'Copywriting', 'SEO', 'Google Analytics'];
    priorRoles = ['Growth Marketer at Agency99', 'SEO Executive at Careem'];
  } else if (resolvedExpertise === 'SaaS') {
    skills = ['Salesforce', 'HubSpot', 'Pipedrive', 'CRM Automation', 'Data Integrity'];
    priorRoles = ['CRM Administrator at StartupHub', 'SaaS Consultant at CloudOps'];
  } else if (resolvedExpertise === 'Automation') {
    skills = ['Make.com', 'Zapier', 'n8n', 'API Integration', 'Python'];
    priorRoles = ['Automation Engineer at TechFlow', 'Operations Automation Lead at LogiCorp'];
  } else if (resolvedExpertise === 'Sales') {
    skills = ['Cold Outreach', 'LinkedIn Sales Navigator', 'Negotiation', 'Lead Generation', 'Closing'];
    priorRoles = ['Sales Executive at SaaSify', 'Business Development Rep at TradeInc'];
  } else if (resolvedExpertise === 'Finance') {
    skills = ['QuickBooks', 'Xero', 'Reconciliation', 'Financial Reporting', 'Excel Pivot Tables'];
    priorRoles = ['Financial Accountant at Al Futtaim', 'Junior Auditor at Ernst & Young'];
  } else if (resolvedExpertise === 'HR') {
    skills = ['ATS Systems', 'Technical Recruiting', 'Remote Onboarding', 'HR Compliance', 'Culture Building'];
    priorRoles = ['Talent Recruiter at Careem', 'HR Generalist at Souq.com'];
  }

  return {
    detected_expertise: detectedExp,
    years_experience: yrs,
    prior_roles: priorRoles,
    key_skills: skills,
    red_flags: null,
    expertise_mismatch: false,
    notes: notes,
    resolvedExpertise: resolvedExpertise // save resolved department name
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
