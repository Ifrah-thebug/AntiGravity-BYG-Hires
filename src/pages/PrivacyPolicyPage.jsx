import React from 'react';
import { Link } from 'react-router-dom';
import {
  Database,
  Settings,
  Share2,
  Globe,
  Clock,
  Shield,
  Cookie,
  ExternalLink,
  UserCheck,
  Lock,
  Users,
  RefreshCw,
  Mail,
  User,
  Building2,
  Monitor,
} from 'lucide-react';
import LegalPageLayout, {
  LegalSection,
  LegalCallout,
  LegalInfoCard,
  LegalContactCard,
} from '../components/legal/LegalPageLayout';

const SECTIONS = [
  { id: 'information-collect', number: 1, title: 'Information We Collect' },
  { id: 'how-we-use', number: 2, title: 'How We Use Information' },
  { id: 'sharing', number: 3, title: 'Sharing of Information' },
  { id: 'international', number: 4, title: 'International Data Transfers' },
  { id: 'retention', number: 5, title: 'Data Retention' },
  { id: 'security', number: 6, title: 'Data Security' },
  { id: 'cookies', number: 7, title: 'Cookies' },
  { id: 'third-party', number: 8, title: 'Third-Party Links' },
  { id: 'your-rights', number: 9, title: 'Your Rights' },
  { id: 'confidentiality', number: 10, title: 'Confidentiality' },
  { id: 'children', number: 11, title: "Children's Privacy" },
  { id: 'changes', number: 12, title: 'Changes to This Policy' },
  { id: 'contact', number: 13, title: 'Contact Us' },
];

const PrivacyPolicyPage = () => (
  <LegalPageLayout
    title="Privacy Policy"
    effectiveDate="May 30, 2026"
    sections={SECTIONS}
    siblingPage={{ href: '/terms', label: 'Terms & Conditions', shortLabel: 'Terms' }}
    acknowledgement="By using our website or services, you acknowledge and agree to this Privacy Policy."
    intro={(
      <>
        <p className="text-lg font-bold text-gray-900">
          Welcome to BYG Hires (&ldquo;BYG Hires&rdquo;, &ldquo;we&rdquo;, &ldquo;our&rdquo;, or &ldquo;us&rdquo;).
        </p>
        <p>
          BYG Hires is committed to protecting your privacy and handling personal data responsibly in accordance
          with applicable international data protection standards, including the UAE Personal Data Protection Law
          (PDPL) and other applicable privacy regulations. This Privacy Policy explains how we collect, use,
          store, share, and protect your information when you use our website or services. For general use of
          our platform, please also review our{' '}
          <Link to="/terms" className="text-red hover:underline font-bold">
            Terms &amp; Conditions
          </Link>
          .
        </p>
      </>
    )}
  >
    <LegalSection id="information-collect" number={1} title="Information We Collect" icon={Database}>
      <p>We may collect the following information:</p>
      <div className="grid md:grid-cols-3 gap-4 pt-1">
        <LegalInfoCard
          title="Candidate Information"
          icon={User}
          items={[
            'Name & contact details',
            'CV/Resume & portfolio links',
            'Employment & educational background',
            'Interview feedback & assessments',
            'Salary expectations & preferences',
          ]}
        />
        <LegalInfoCard
          title="Client Information"
          icon={Building2}
          items={[
            'Company name & contact info',
            'Billing & invoicing information',
            'Hiring requirements & details',
            'Written and oral communications',
          ]}
        />
        <LegalInfoCard
          title="Technical Information"
          icon={Monitor}
          items={[
            'IP address & technical details',
            'Browser & device information',
            'Website usage statistics',
            'Cookies & analytics tracking',
          ]}
        />
      </div>
    </LegalSection>

    <LegalSection id="how-we-use" number={2} title="How We Use Information" icon={Settings} delay={0.05}>
      <p>We use personal data to:</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {[
          'Provide recruitment and remote staffing services',
          'Source, screen, and present candidates',
          'Coordinate interviews and placements',
          'Communicate with candidates and clients',
          'Improve our website and service quality',
          'Process invoices and business operations',
          'Maintain security and prevent fraud',
          'Comply with legal and regulatory obligations',
        ].map((item) => (
          <div key={item} className="flex items-start gap-2.5 bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
            <span className="w-1.5 h-1.5 rounded-full bg-red mt-2 shrink-0" />
            <span className="text-sm font-medium">{item}</span>
          </div>
        ))}
      </div>
    </LegalSection>

    <LegalSection id="sharing" number={3} title="Sharing of Information" icon={Share2} variant="highlight" delay={0.05}>
      <p>We may share personal data with:</p>
      <div className="space-y-3">
        {[
          { label: 'Client companies', desc: 'for recruitment and staffing evaluation purposes' },
          { label: 'Service providers', desc: 'and technology partners who assist our operations' },
          { label: 'Legal or regulatory authorities', desc: 'where required by applicable laws' },
        ].map(({ label, desc }) => (
          <div key={label} className="flex items-start gap-3 bg-white/80 rounded-xl p-4 border border-red/10">
            <span className="font-black text-red text-sm shrink-0">{label}</span>
            <span className="text-sm text-gray-500">— {desc}</span>
          </div>
        ))}
      </div>
      <LegalCallout tone="accent">
        <p className="text-xs font-black uppercase tracking-wider text-red">
          We do not sell personal data to third parties.
        </p>
      </LegalCallout>
    </LegalSection>

    <LegalSection id="international" number={4} title="International Data Transfers" icon={Globe}>
      <p>
        As a global remote staffing agency, BYG Hires may process and transfer data internationally,
        including within the GCC and other countries where our clients, candidates, or service providers
        operate. We take reasonable measures to ensure personal data remains protected during such transfers.
      </p>
    </LegalSection>

    <LegalSection id="retention" number={5} title="Data Retention" icon={Clock}>
      <p>
        We retain personal data only for as long as necessary for recruitment, legal, operational, and
        business purposes, unless a longer retention period is required or permitted by law.
      </p>
    </LegalSection>

    <LegalSection id="security" number={6} title="Data Security" icon={Shield} variant="highlight">
      <p>
        We implement reasonable technical and organizational measures to protect personal data against
        unauthorized access, misuse, disclosure, or loss. However, no electronic system or internet
        transmission can be guaranteed to be completely secure.
      </p>
    </LegalSection>

    <LegalSection id="cookies" number={7} title="Cookies" icon={Cookie}>
      <p>
        Our website may use cookies and similar technologies to improve website functionality, analyze
        traffic, and enhance user experience. Users may disable cookies through their individual browser settings.
      </p>
    </LegalSection>

    <LegalSection id="third-party" number={8} title="Third-Party Links" icon={ExternalLink}>
      <p>
        Our website may contain links to third-party websites or platforms. BYG Hires is not responsible
        for the privacy practices or content of third-party services.
      </p>
    </LegalSection>

    <LegalSection id="your-rights" number={9} title="Your Rights" icon={UserCheck} delay={0.05}>
      <p>Subject to applicable laws, you may have the right to:</p>
      <div className="grid sm:grid-cols-2 gap-3">
        {[
          'Access your stored personal data',
          'Request correction of inaccurate information',
          'Request the deletion of your personal data',
          'Withdraw consent where processing relies on it',
          'Object to certain data processing activities',
        ].map((right) => (
          <div key={right} className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
            <UserCheck size={16} className="text-red shrink-0" />
            <span className="text-sm font-medium">{right}</span>
          </div>
        ))}
      </div>
      <p className="text-[13px] text-gray-400 font-bold">
        Requests may be submitted through our contact details below.
      </p>
    </LegalSection>

    <LegalSection id="confidentiality" number={10} title="Confidentiality" icon={Lock}>
      <p>
        All candidate, client, and business information shared with BYG Hires shall be treated
        confidentially and handled in accordance with applicable privacy obligations.
      </p>
    </LegalSection>

    <LegalSection id="children" number={11} title="Children's Privacy" icon={Users}>
      <p>
        Our services are not intended for individuals under the age of 18. We do not knowingly collect
        personal data from minors.
      </p>
    </LegalSection>

    <LegalSection id="changes" number={12} title="Changes to This Privacy Policy" icon={RefreshCw}>
      <p>
        BYG Hires may update this Privacy Policy from time to time. Updated versions will be posted on
        this page with a revised effective date.
      </p>
    </LegalSection>

    <LegalSection id="contact" number={13} title="Contact Us" icon={Mail}>
      <p>For privacy-related questions or requests, please contact us using the details below.</p>
      <LegalContactCard />
    </LegalSection>
  </LegalPageLayout>
);

export default PrivacyPolicyPage;
