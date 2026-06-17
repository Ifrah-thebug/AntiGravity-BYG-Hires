require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const assessment = require('../src/services/geminiAssessmentService');

async function main() {
  const profile = {
    job_title: 'Customer Support Specialist',
    experience_years: 3,
    department: 'Support',
  };
  const skill = 'Customer Support';

  const infoEvents = [];
  const warnEvents = [];
  const originalInfo = console.info;
  const originalWarn = console.warn;
  console.info = (...args) => {
    infoEvents.push(args.map(String).join(' '));
    originalInfo(...args);
  };
  console.warn = (...args) => {
    warnEvents.push(args.map(String).join(' '));
    originalWarn(...args);
  };

  try {
    const generated = await assessment.generateQuestions(profile, skill);
    console.log('\n=== GENERATION RESULT ===');
    console.log('questionSource:', generated.questionSource);
    console.log(
      'questions:',
      generated.questions.map((q) => `${q.id}:${q.type}`).join(', ')
    );

    const answers = {};
    for (const q of generated.questions) {
      answers[q.id] =
        "I would acknowledge the customer issue quickly, clarify impact, and provide a clear resolution path with timelines. I would document ownership, follow up proactively, and share a concise recap to build trust.";
    }

    const grade = await assessment.gradeAnswers(
      profile,
      skill,
      generated.questions,
      answers
    );
    const gradeSource =
      [...infoEvents].reverse().find((line) => /graded via/i.test(line)) || 'unknown';

    console.log('\n=== GRADING RESULT ===');
    console.log('gradeSource:', gradeSource);
    console.log('total_score:', grade.total_score);
    console.log(
      'per_question:',
      (grade.per_question || []).map((r) => `${r.id}:${r.score}/${r.max_points}`).join(', ')
    );

    if (warnEvents.length) {
      console.log('\n=== WARNINGS (if any) ===');
      for (const line of warnEvents.slice(-10)) console.log(line);
    }
  } finally {
    console.info = originalInfo;
    console.warn = originalWarn;
  }
}

main().catch((err) => {
  console.error('Test failed:', err?.message || err);
  process.exit(1);
});
