import React from 'react';
import { Link } from 'react-router-dom';
import {
  FileCheck,
  Briefcase,
  Ban,
  Users,
  Building2,
  Lock,
  Copyright,
  UserX,
  AlertTriangle,
  Scale,
  RefreshCw,
  Mail,
  ClipboardList,
  ShieldCheck,
  Share2,
  LogOut,
} from 'lucide-react';
import LegalPageLayout, {
  LegalSection,
  LegalCallout,
  LegalContactCard,
} from '../components/legal/LegalPageLayout';

const SECTIONS = [
  { id: 'acceptance', number: 1, title: 'Acceptance of Terms' },
  { id: 'services', number: 2, title: 'Services Description' },
  { id: 'website-use', number: 3, title: 'Website Use' },
  { id: 'candidate-terms', number: 4, title: 'Candidate Talent Pool Terms' },
  { id: 'client-terms', number: 5, title: 'Client Terms' },
  { id: 'confidentiality', number: 6, title: 'Confidentiality' },
  { id: 'intellectual-property', number: 7, title: 'Intellectual Property' },
  { id: 'no-employment', number: 8, title: 'No Employment Relationship' },
  { id: 'liability', number: 9, title: 'Limitation of Liability' },
  { id: 'governing-law', number: 10, title: 'Governing Law & Dispute Resolution' },
  { id: 'changes', number: 11, title: 'Changes to These Terms' },
  { id: 'contact', number: 12, title: 'Contact Us' },
];

const CANDIDATE_SUBSECTIONS = [
  {
    icon: ClipboardList,
    title: '4.1 Talent Pool Registration',
    text: 'By joining the Talent Pool, you agree to be considered for remote employment, freelance, contractual, or recruitment opportunities. Registration does not create an employment relationship between BYG Hires and you. BYG Hires does not guarantee placement, interviews, employment offers, or minimum opportunities.',
  },
  {
    icon: ShieldCheck,
    title: '4.2 Information & Authorization',
    text: 'You authorize BYG Hires to collect, process, store, and maintain your personal and professional information, including your name, contact details, resume/CV, employment history, qualifications, portfolio, interview feedback, and verification documents where required. You confirm that all submitted information is accurate, complete, and lawful.',
  },
  {
    icon: Share2,
    title: '4.3 Use & Sharing of Information',
    text: 'BYG Hires may use your information for recruitment, candidate evaluation, matching with potential employers, scheduling interviews, and future employment opportunities. You authorize BYG Hires to share relevant information with prospective employers or clients strictly for hiring-related purposes.',
  },
  {
    icon: Users,
    title: '4.4 Candidate Obligations',
    text: 'You agree that all information provided is truthful and up to date; submitted materials do not violate confidentiality obligations owed to third parties; you will conduct yourself professionally during recruitment processes; and you will not misuse confidential information received during interviews or assessments.',
  },
  {
    icon: LogOut,
    title: '4.5 Withdrawal & Termination',
    text: 'You may request removal from the Talent Pool at any time by written request. BYG Hires reserves the right to suspend, restrict, or terminate your access for fraudulent activity, misrepresentation, unprofessional conduct, violation of these Terms, or unlawful activities.',
  },
];

const TermsOfServicePage = () => (
  <LegalPageLayout
    title="Terms & Conditions"
    effectiveDate="May 30, 2026"
    sections={SECTIONS}
    siblingPage={{ href: '/privacy', label: 'Privacy Policy', shortLabel: 'Privacy Policy' }}
    acknowledgement="By using our website or services, you acknowledge and agree to these Terms & Conditions."
    intro={(
      <>
        <p className="text-lg font-bold text-gray-900">
          Welcome to BYG Hires (&ldquo;BYG Hires&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;).
        </p>
        <p>
          These Terms &amp; Conditions (&ldquo;Terms&rdquo;) govern your access to and use of the BYG Hires website,
          platform, and recruitment and remote staffing services. By accessing our website, registering for our
          services, or using our platform, you agree to be bound by these Terms. Please read them carefully.
        </p>
      </>
    )}
  >
    <LegalSection id="acceptance" number={1} title="Acceptance of Terms" icon={FileCheck}>
      <p>
        By using the BYG Hires website or services, you confirm that you have read, understood, and agree to
        these Terms and our{' '}
        <Link to="/privacy" className="text-red hover:underline font-bold">
          Privacy Policy
        </Link>
        . If you do not agree, you must not use our website or services.
      </p>
    </LegalSection>

    <LegalSection id="services" number={2} title="Services Description" icon={Briefcase} variant="highlight">
      <p>
        BYG Hires is a remote staffing and recruitment agency that connects candidates with employers and
        clients. We provide talent sourcing, screening, matching, interview coordination, and related staffing
        services. BYG Hires acts as an intermediary and does not guarantee employment, placement, interviews,
        or specific outcomes.
      </p>
    </LegalSection>

    <LegalSection id="website-use" number={3} title="Website Use" icon={Ban}>
      <p>When using our website and platform, you agree that you will not:</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {[
          'Use the platform for unlawful or fraudulent purposes',
          'Submit false, misleading, or inaccurate information',
          'Attempt to gain unauthorized access to systems or data',
          'Interfere with the proper functioning of the website',
          'Copy, scrape, or misuse platform content without permission',
          'Harass, abuse, or harm other users or BYG Hires staff',
        ].map((item) => (
          <div key={item} className="flex items-start gap-2.5 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            <Ban size={14} className="text-red mt-0.5 shrink-0" />
            <span className="text-sm font-medium">{item}</span>
          </div>
        ))}
      </div>
    </LegalSection>

    <LegalSection id="candidate-terms" number={4} title="Candidate Talent Pool Terms" icon={Users} delay={0.05}>
      <p>The following terms apply to candidates who register for or participate in the BYG Hires Talent Pool.</p>
      <div className="space-y-4">
        {CANDIDATE_SUBSECTIONS.map(({ icon: Icon, title, text }) => (
          <div
            key={title}
            className="group relative bg-gray-50 border border-gray-100 rounded-2xl p-5 md:p-6 hover:border-red/25 hover:shadow-md transition-all duration-300 overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-1 h-full bg-red/0 group-hover:bg-red transition-colors rounded-l-2xl" />
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-white border border-gray-100 text-red flex items-center justify-center shrink-0 group-hover:bg-red group-hover:text-white group-hover:border-red transition-colors">
                <Icon size={18} strokeWidth={2.5} />
              </div>
              <div>
                <h3 className="font-black text-xs text-black uppercase tracking-wider mb-2">{title}</h3>
                <p className="text-sm leading-relaxed">{text}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </LegalSection>

    <LegalSection id="client-terms" number={5} title="Client Terms" icon={Building2}>
      <p>
        Clients engaging BYG Hires for recruitment or staffing services agree to provide accurate hiring
        requirements, cooperate in good faith during the recruitment process, comply with applicable employment
        and labor laws, and treat candidate information received through BYG Hires as confidential and used
        solely for evaluation and hiring purposes.
      </p>
    </LegalSection>

    <LegalSection id="confidentiality" number={6} title="Confidentiality" icon={Lock} variant="highlight">
      <p>
        Any documents, assessments, interview materials, employer information, platform systems, or recruitment
        processes shared by BYG Hires shall remain confidential. Users shall not reproduce, distribute, disclose,
        or misuse confidential information without prior written consent from BYG Hires or the relevant party.
      </p>
    </LegalSection>

    <LegalSection id="intellectual-property" number={7} title="Intellectual Property" icon={Copyright}>
      <p>
        All website content, branding, systems, databases, templates, recruitment materials, and platform
        intellectual property remain the exclusive property of BYG Hires unless otherwise stated. No license or
        right to use BYG Hires intellectual property is granted except as necessary to access and use our
        services in accordance with these Terms.
      </p>
    </LegalSection>

    <LegalSection id="no-employment" number={8} title="No Employment Relationship" icon={UserX}>
      <p>
        BYG Hires acts solely as a staffing and recruitment intermediary. Nothing in these Terms shall be
        interpreted as creating an employer-employee relationship, partnership, joint venture, or agency
        relationship between BYG Hires and any candidate, client, or user.
      </p>
    </LegalSection>

    <LegalSection id="liability" number={9} title="Limitation of Liability" icon={AlertTriangle} variant="highlight">
      <p>
        To the fullest extent permitted by applicable law, BYG Hires shall not be liable for hiring decisions
        made by clients, rejection of applications, employment termination by clients, compensation disputes,
        or indirect, consequential, or business losses arising from use of our website or services. Users
        engage with prospective employers and clients at their own discretion and responsibility.
      </p>
      <LegalCallout tone="accent">
        <p className="text-xs font-black uppercase tracking-wider text-red">
          Our services are provided on an &ldquo;as is&rdquo; and &ldquo;as available&rdquo; basis.
        </p>
      </LegalCallout>
    </LegalSection>

    <LegalSection id="governing-law" number={10} title="Governing Law & Dispute Resolution" icon={Scale}>
      <p>
        These Terms shall be governed by and construed in accordance with the laws of the United Arab Emirates.
        The parties shall first attempt to resolve disputes through good faith negotiations. Any unresolved
        dispute shall be subject to arbitration under the rules of the Dubai International Arbitration Centre
        (DIAC), with the seat of arbitration in Dubai, UAE.
      </p>
    </LegalSection>

    <LegalSection id="changes" number={11} title="Changes to These Terms" icon={RefreshCw}>
      <p>
        BYG Hires may update these Terms from time to time. Updated versions will be posted on this page with
        a revised effective date. Continued use of our website or services after changes are posted constitutes
        acceptance of the updated Terms.
      </p>
    </LegalSection>

    <LegalSection id="contact" number={12} title="Contact Us" icon={Mail}>
      <p>For questions regarding these Terms, please contact us using the details below.</p>
      <LegalContactCard />
    </LegalSection>
  </LegalPageLayout>
);

export default TermsOfServicePage;
