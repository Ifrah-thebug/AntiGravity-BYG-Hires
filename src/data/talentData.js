// src/data/talentData.js
// Seed talent profiles for the Browse Talent page

import ahmadImg from '../assets/Ahmad K.png';
import elshaImg from '../assets/Elsha G.png';
import haadiahImg from '../assets/Haadiah S.png';
import nihalImg from '../assets/Nihal S.png';
import rachelleImg from '../assets/Rachelle R.png';

export const DEPARTMENTS = [
  { id: 'all', label: 'All Talent' },
  { id: 'operations', label: 'Operations' },
  { id: 'marketing', label: 'Marketing' },
  { id: 'saas', label: 'SaaS & CRM' },
  { id: 'automation', label: 'Automation' },
  { id: 'customer-success', label: 'Customer Success' },
  { id: 'sales', label: 'Sales' },
  { id: 'finance', label: 'Finance & Admin' },
  { id: 'hr', label: 'HR & Recruitment' },
];

export const SORT_OPTIONS = [
  { value: 'score-desc', label: 'Highest Score' },
  { value: 'fee-asc', label: 'Fee: Low to High' },
  { value: 'fee-desc', label: 'Fee: High to Low' },
  { value: 'name-asc', label: 'Name: A → Z' },
  { value: 'name-desc', label: 'Name: Z → A' },
];

export const AVAILABILITY_OPTIONS = [
  { value: 'immediate', label: 'Available Immediately' },
  { value: '2weeks', label: 'Available in 2 Weeks' },
  { value: '1month', label: 'Available in 1 Month' },
];

export const ROLE_TYPE_OPTIONS = [
  { value: 'night', label: 'Night Roles' },
  { value: 'flexible', label: 'Flexible Hours' },
  { value: 'fulltime', label: 'Full-Time Remote' },
  { value: 'parttime', label: 'Part-Time' },
];

export const TALENTS = [
  {
    id: 't013',
    name: 'Ahmad K.',
    photo: ahmadImg,
    role: 'Customer Service Representative',
    expertise: 'Customer Success & CRM',
    industries: ['E-commerce', 'SaaS', 'Healthcare', 'Logistics', 'Retail'],
    department: 'customer-success',
    score: 97,
    fee: 550,
    currency: 'USD',
    period: '/mo',
    availability: 'immediate',
    roleType: 'fulltime',
    tags: ['CRM', 'Zendesk', 'Customer Success', 'Live Chat'],
    experience: '2 yrs',
    bio: 'Customer support specialist with a 97% CSAT score and deep CRM expertise, trusted by e-commerce and SaaS clients across the GCC.',
    topTalent: true,
    admitted: true,
  },
  {
    id: 't014',
    name: 'Zelsha G.',
    photo: elshaImg,
    role: 'Virtual Administrative Assistant',
    expertise: 'Virtual Administration',
    industries: ['Real Estate', 'SaaS', 'E-commerce', 'Logistics'],
    department: 'operations',
    score: 94,
    fee: 500,
    currency: 'USD',
    period: '/mo',
    availability: 'july',
    roleType: 'flexible',
    tags: ['Calendar Mgmt', 'Data Entry', 'Google Workspace', 'Travel Booking'],
    experience: '2 yrs',
    bio: 'Highly organized virtual admin who keeps executives on track with seamless calendar, travel, and inbox management.',
    topTalent: false,
    admitted: true,
  },
  {
    id: 't015',
    name: 'Haadiah S.',
    photo: haadiahImg,
    role: 'Bookkeeper & Financial Reporter',
    expertise: 'Bookkeeping & Financial Reporting',
    industries: ['SaaS', 'Healthcare', 'Real Estate', 'Finance'],
    department: 'finance',
    score: 96,
    fee: 650,
    currency: 'USD',
    period: '/mo',
    availability: 'immediate',
    roleType: 'flexible',
    tags: ['QuickBooks', 'Xero', 'Reconciliation', 'Financial Reporting'],
    experience: '4 yrs',
    bio: 'Detail-oriented bookkeeper delivering month-end close and investor-ready financial reports for SMEs and startups.',
    topTalent: true,
    admitted: true,
  },
  {
    id: 't016',
    name: 'Nihal S.',
    photo: nihalImg,
    role: 'AI & Marketing Automation Specialist',
    expertise: 'AI & Marketing Automation',
    industries: ['Finance', 'E-commerce', 'Real Estate', 'SaaS', 'Logistics'],
    department: 'automation',
    score: 92,
    fee: 750,
    currency: 'USD',
    period: '/mo',
    availability: 'immediate',
    roleType: 'night',
    tags: ['AI Tools', 'Klaviyo', 'ActiveCampaign', 'Marketing Automation'],
    experience: '5 yrs',
    bio: 'Automation-first marketer leveraging AI tools and email sequencing to build high-converting funnels for DTC and SaaS brands.',
    topTalent: true,
    admitted: true,
  },
  {
    id: 't017',
    name: 'Rachelle R.',
    photo: rachelleImg,
    role: 'Operations & Process Optimisation Lead',
    expertise: 'Operations & Process Optimisation',
    industries: ['Logistics', 'Healthcare', 'E-commerce', 'SaaS'],
    department: 'operations',
    score: 95,
    fee: 800,
    currency: 'USD',
    period: '/mo',
    availability: 'immediate',
    roleType: 'fulltime',
    tags: ['Process Design', 'KPIs', 'Lean Ops', 'ERP'],
    experience: '6 yrs',
    bio: 'Operations leader who designs lean workflows and drives continuous improvement across logistics and e-commerce supply chains.',
    topTalent: true,
    admitted: true,
  },
];
