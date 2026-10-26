import { prepareProfileForSave, validateProfileFields, formatAvailabilityLabel } from '@/features/profile/utils/profileContentPolicy';
import { formatDisplayName, normalizeProfileName } from '@/shared/lib/formatDisplayName';
import { normalizeTalentDepartment } from '@/shared/lib/talentDepartments';

jest.mock('@/app/navigation/routes', () => ({
  ROUTES: {
    Setup: 'Setup',
    Portal: 'Portal',
    Assessment: 'Assessment',
    VoiceInterview: 'VoiceInterview',
    Portfolio: 'Portfolio',
  },
}));

const { routeForWebHref, webPathForRoute } = require('@/features/chat/utils/webPathMapping');

describe('profile content policy (same rules as web)', () => {
  it('normalizes names and adds the 10% directory markup', () => {
    const res = prepareProfileForSave({
      name: '  ifrah   irshad ',
      job_title: 'Virtual Assistant',
      skills: ['Asana', 'HubSpot'],
      best_skill: 'hubspot',
      monthly_fee_usd: '500',
      availability: 'immediate',
      role_type: 'night',
      department: 'Virtual Assistants',
    });
    expect(res.ok).toBe(true);
    expect(res.data.name).toBe('Ifrah Irshad');
    expect(res.data.best_skill).toBe('HubSpot');
    expect(res.data.directory_fee_usd).toBe(550);
    expect(res.data.department).toBe('virtual-assistants');
  });

  it('blocks contact details in profile text', () => {
    const errors = validateProfileFields({ name: 'Ali', job_title: 'Dev', about: 'Email me at ali@test.com', skills: [] });
    expect(errors[0]).toMatch(/About: remove email address/);
  });

  it('requires a date when availability is from a specific date', () => {
    const res = prepareProfileForSave({ name: 'A B', job_title: 'X', availability: 'from_month', availability_from_month: '' });
    expect(res.ok).toBe(false);
  });

  it('formats availability labels', () => {
    expect(formatAvailabilityLabel('2weeks')).toBe('In 2 Weeks');
  });
});

describe('display helpers', () => {
  it('formats public names as "First L."', () => {
    expect(formatDisplayName('IfRaH irshad')).toBe('Ifrah I.');
    expect(normalizeProfileName('mary-jane o\'brien')).toBe("Mary-Jane O'Brien");
  });

  it('falls back to the default department', () => {
    expect(normalizeTalentDepartment('unknown')).toBe('admin-operations');
  });
});

describe('BGuides web href → mobile route mapping', () => {
  it('maps portal sections', () => {
    expect(routeForWebHref('/portal#client-intro-scheduling')).toEqual({
      name: 'Portal',
      params: { section: 'client-intro-scheduling', guide: undefined },
    });
    expect(routeForWebHref('/portal?portfolio=add').params.section).toBe('talent-portfolio');
  });

  it('maps portfolio, assessment and interview pages', () => {
    expect(routeForWebHref('/talent/abc-123/portfolio?add=1')).toEqual({
      name: 'Portfolio',
      params: { profileId: 'abc-123', add: '1' },
    });
    expect(routeForWebHref('/assessment')).toEqual({ name: 'Assessment' });
    expect(routeForWebHref('/interview')).toEqual({ name: 'VoiceInterview' });
    expect(routeForWebHref('/talent')).toBeNull();
  });

  it('builds the web path for the current screen', () => {
    expect(webPathForRoute({ name: 'Portfolio', params: { profileId: 'p1' } })).toBe('/talent/p1/portfolio');
    expect(webPathForRoute({ name: 'Portal', params: {} })).toBe('/portal');
  });
});
