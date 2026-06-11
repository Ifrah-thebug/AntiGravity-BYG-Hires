/** Keep in sync with src/lib/talentDepartments.js */

const TALENT_DEPARTMENTS = [
  { id: 'ai-automation', label: 'AI Automation Specialist' },
  { id: 'admin-operations', label: 'Administrative & Operations' },
  { id: 'account-coordinators', label: 'Account Coordinators' },
  { id: 'marketing-content', label: 'Marketing & Content Creation' },
  { id: 'virtual-assistants', label: 'Virtual Assistants' },
  { id: 'customer-support', label: 'Customer Support & Client Success' },
  { id: 'sales', label: 'Sales & Business Development' },
  { id: 'hr', label: 'HR Coordinators' },
  { id: 'it-technical', label: 'IT & Technical Support' },
  { id: 'finance', label: 'Finance, Accounting & Bookkeeping' },
];

const TALENT_DEPARTMENT_IDS = TALENT_DEPARTMENTS.map((d) => d.id);
const DEFAULT_TALENT_DEPARTMENT = 'admin-operations';

const ID_BY_LABEL = Object.fromEntries(
  TALENT_DEPARTMENTS.map((d) => [d.label.toLowerCase(), d.id])
);

function normalizeTalentDepartment(value) {
  const raw = String(value || '').trim();
  if (!raw) return DEFAULT_TALENT_DEPARTMENT;
  const lower = raw.toLowerCase();
  if (TALENT_DEPARTMENT_IDS.includes(lower)) return lower;
  if (ID_BY_LABEL[lower]) return ID_BY_LABEL[lower];
  return DEFAULT_TALENT_DEPARTMENT;
}

function geminiDepartmentPromptLines() {
  return TALENT_DEPARTMENTS.map((d) => `  - "${d.id}" → ${d.label}`).join('\n');
}

module.exports = {
  TALENT_DEPARTMENTS,
  TALENT_DEPARTMENT_IDS,
  DEFAULT_TALENT_DEPARTMENT,
  normalizeTalentDepartment,
  geminiDepartmentPromptLines,
};
