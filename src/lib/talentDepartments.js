/** Talent departments — aligned with homepage “Remote Roles we fill” tiles. */

export const TALENT_DEPARTMENTS = [
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

export const TALENT_DEPARTMENT_IDS = TALENT_DEPARTMENTS.map((d) => d.id);

export const DEFAULT_TALENT_DEPARTMENT = 'admin-operations';

/** Directory tabs: All Talent + each department */
export const DIRECTORY_DEPARTMENTS = [
  { id: 'all', label: 'All Talent' },
  ...TALENT_DEPARTMENTS,
];

const LABEL_BY_ID = Object.fromEntries(TALENT_DEPARTMENTS.map((d) => [d.id, d.label]));
const ID_BY_LABEL = Object.fromEntries(TALENT_DEPARTMENTS.map((d) => [d.label.toLowerCase(), d.id]));

export function getTalentDepartmentLabel(id) {
  return LABEL_BY_ID[id] || TALENT_DEPARTMENTS.find((d) => d.id === DEFAULT_TALENT_DEPARTMENT)?.label;
}

export function normalizeTalentDepartment(value) {
  const raw = String(value || '').trim();
  if (!raw) return DEFAULT_TALENT_DEPARTMENT;
  const lower = raw.toLowerCase();
  if (TALENT_DEPARTMENT_IDS.includes(lower)) return lower;
  if (ID_BY_LABEL[lower]) return ID_BY_LABEL[lower];
  return DEFAULT_TALENT_DEPARTMENT;
}

export function talentDirectoryUrlForRole(roleLabel) {
  const dept = TALENT_DEPARTMENTS.find((d) => d.label === roleLabel)?.id;
  if (!dept) return '/talent';
  return `/talent?dept=${encodeURIComponent(dept)}`;
}

export function parseTalentDirectorySearchParams(searchParams) {
  const dept = searchParams.get('dept');
  const activedept =
    dept && TALENT_DEPARTMENT_IDS.includes(dept) ? dept : 'all';
  return {
    activedept,
    search: searchParams.get('q') || '',
    roleLabel: activedept !== 'all' ? getTalentDepartmentLabel(activedept) : '',
  };
}

/** Prompt fragment for Gemini CV parsers */
export function geminiDepartmentPromptLines() {
  return TALENT_DEPARTMENTS.map((d) => `  - "${d.id}" → ${d.label}`).join('\n');
}
