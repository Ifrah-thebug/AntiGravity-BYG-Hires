import React, { useEffect } from 'react';
import { motion } from 'framer-motion';

const PrivacyPolicyPage = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="bg-white text-black min-h-screen pt-32 pb-24 font-sans leading-relaxed">
      <div className="max-w-4xl mx-auto px-6">
        
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-left border-b border-gray-100 pb-10 mb-12"
        >
          <p className="text-red font-black tracking-[0.2em] text-[10px] uppercase mb-4">Legal Obligations</p>
          <h1 className="text-4xl md:text-6xl font-black text-black tracking-tight leading-tight mb-4 uppercase">
            Privacy Policy
          </h1>
          <p className="text-gray-400 text-sm font-semibold tracking-wide">
            Effective Date: May 30, 2026
          </p>
        </motion.div>

        {/* Content Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="prose prose-lg max-w-none text-gray-700 space-y-10"
        >
          <div>
            <p className="text-lg font-medium text-gray-800 leading-relaxed mb-4">
              Welcome to BYG Hires (“BYG Hires”, “we”, “our”, or “us”).
            </p>
            <p className="leading-relaxed text-gray-600">
              BYG Hires is committed to protecting your privacy and handling personal data responsibly in accordance with applicable international data protection standards, including the UAE Personal Data Protection Law (PDPL) and other applicable privacy regulations.
              This Privacy Policy explains how we collect, use, store, share, and protect your information when you use our website or services.
            </p>
          </div>

          {/* Section 1 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black tracking-tight uppercase flex items-center gap-3">
              <span className="text-red">1.</span> Information We Collect
            </h2>
            <p className="text-gray-600">We may collect the following information:</p>
            
            <div className="grid md:grid-cols-3 gap-6 pt-2">
              <div className="bg-gray-50 border border-gray-100 p-6 rounded-2xl">
                <h3 className="font-black text-xs text-black uppercase tracking-wider mb-3">Candidate Information</h3>
                <ul className="space-y-2 text-[13px] text-gray-600 font-medium list-disc list-inside">
                  <li>Name & Contact details</li>
                  <li>CV/Resume & portfolio links</li>
                  <li>Employment & educational background</li>
                  <li>Interview feedback & assessments</li>
                  <li>Salary expectations & preferences</li>
                </ul>
              </div>

              <div className="bg-gray-50 border border-gray-100 p-6 rounded-2xl">
                <h3 className="font-black text-xs text-black uppercase tracking-wider mb-3">Client Information</h3>
                <ul className="space-y-2 text-[13px] text-gray-600 font-medium list-disc list-inside">
                  <li>Company name & contact info</li>
                  <li>Billing & invoicing information</li>
                  <li>Hiring requirements & details</li>
                  <li>Written and oral communications</li>
                </ul>
              </div>

              <div className="bg-gray-50 border border-gray-100 p-6 rounded-2xl">
                <h3 className="font-black text-xs text-black uppercase tracking-wider mb-3">Technical Information</h3>
                <ul className="space-y-2 text-[13px] text-gray-600 font-medium list-disc list-inside">
                  <li>IP address & technical details</li>
                  <li>Browser & device information</li>
                  <li>Website usage statistics</li>
                  <li>Cookies & analytics tracking</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black tracking-tight uppercase flex items-center gap-3">
              <span className="text-red">2.</span> How We Use Information
            </h2>
            <p className="text-gray-600">We use personal data to:</p>
            <ul className="grid md:grid-cols-2 gap-x-8 gap-y-2.5 pl-5 list-disc text-gray-600 font-medium">
              <li>Provide recruitment and remote staffing services</li>
              <li>Source, screen, and present candidates</li>
              <li>Coordinate interviews and placements</li>
              <li>Communicate with candidates and clients</li>
              <li>Improve our website and service quality</li>
              <li>Process invoices and business operations</li>
              <li>Maintain security and prevent fraud</li>
              <li>Comply with legal and regulatory obligations</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black tracking-tight uppercase flex items-center gap-3">
              <span className="text-red">3.</span> Sharing of Information
            </h2>
            <p className="text-gray-600">
              We may share personal data with:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-gray-600">
              <li><strong>Client companies</strong> for recruitment and staffing evaluation purposes</li>
              <li><strong>Service providers</strong> and technology partners who assist our operations</li>
              <li><strong>Legal or regulatory authorities</strong> where required by applicable laws</li>
            </ul>
            <div className="bg-red/5 border border-red/10 rounded-2xl p-4 mt-2">
              <p className="text-xs text-red font-black uppercase tracking-wider">
                We do not sell personal data to third parties.
              </p>
            </div>
          </section>

          {/* Section 4 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black tracking-tight uppercase flex items-center gap-3">
              <span className="text-red">4.</span> International Data Transfers
            </h2>
            <p className="text-gray-600">
              As a global remote staffing agency, BYG Hires may process and transfer data internationally, including within the GCC and other countries where our clients, candidates, or service providers operate. We take reasonable measures to ensure personal data remains protected during such transfers.
            </p>
          </section>

          {/* Section 5 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black tracking-tight uppercase flex items-center gap-3">
              <span className="text-red">5.</span> Data Retention
            </h2>
            <p className="text-gray-600">
              We retain personal data only for as long as necessary for recruitment, legal, operational, and business purposes, unless a longer retention period is required or permitted by law.
            </p>
          </section>

          {/* Section 6 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black tracking-tight uppercase flex items-center gap-3">
              <span className="text-red">6.</span> Data Security
            </h2>
            <p className="text-gray-600">
              We implement reasonable technical and organizational measures to protect personal data against unauthorized access, misuse, disclosure, or loss. However, no electronic system or internet transmission can be guaranteed to be completely secure.
            </p>
          </section>

          {/* Section 7 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black tracking-tight uppercase flex items-center gap-3">
              <span className="text-red">7.</span> Cookies
            </h2>
            <p className="text-gray-600">
              Our website may use cookies and similar technologies to improve website functionality, analyze traffic, and enhance user experience. Users may disable cookies through their individual browser settings.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black tracking-tight uppercase flex items-center gap-3">
              <span className="text-red">8.</span> Third-Party Links
            </h2>
            <p className="text-gray-600">
              Our website may contain links to third-party websites or platforms. BYG Hires is not responsible for the privacy practices or content of third-party services.
            </p>
          </section>

          {/* Section 9 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black tracking-tight uppercase flex items-center gap-3">
              <span className="text-red">9.</span> Your Rights
            </h2>
            <p className="text-gray-600">Subject to applicable laws, you may have the right to:</p>
            <ul className="grid md:grid-cols-2 gap-x-8 gap-y-2 pl-5 list-disc text-gray-600">
              <li>Access your stored personal data</li>
              <li>Request correction of inaccurate information</li>
              <li>Request the deletion of your personal data</li>
              <li>Withdraw consent where processing relies on it</li>
              <li>Object to certain data processing activities</li>
            </ul>
            <p className="text-[13px] text-gray-400 font-bold mt-2">
              Requests may be submitted through our contact details below.
            </p>
          </section>

          {/* Section 10 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black tracking-tight uppercase flex items-center gap-3">
              <span className="text-red">10.</span> Confidentiality
            </h2>
            <p className="text-gray-600">
              All candidate, client, and business information shared with BYG Hires shall be treated confidentially and handled in accordance with applicable privacy obligations.
            </p>
          </section>

          {/* Section 11 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black tracking-tight uppercase flex items-center gap-3">
              <span className="text-red">11.</span> Children’s Privacy
            </h2>
            <p className="text-gray-600">
              Our services are not intended for individuals under the age of 18. We do not knowingly collect personal data from minors.
            </p>
          </section>

          {/* Section 12 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black tracking-tight uppercase flex items-center gap-3">
              <span className="text-red">12.</span> Changes to This Privacy Policy
            </h2>
            <p className="text-gray-600">
              BYG Hires may update this Privacy Policy from time to time. Updated versions will be posted on this page with a revised effective date.
            </p>
          </section>

          {/* Section 13 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black tracking-tight uppercase flex items-center gap-3">
              <span className="text-red">13.</span> Contact Us
            </h2>
            <p className="text-gray-600">
              For privacy-related questions or requests, please contact:
            </p>
            <div className="bg-gray-50 border border-gray-100 p-6 rounded-2xl space-y-2 mt-2">
              <p className="font-black text-sm text-black uppercase tracking-wider">BYG Hires</p>
              <p className="text-sm font-semibold">
                <span className="text-gray-400">Website:</span>{' '}
                <a href="https://www.bnyahyagroup.com" target="_blank" rel="noopener noreferrer" className="text-red hover:underline font-bold">
                  BYG Hires Official Website
                </a>
              </p>
              <p className="text-sm font-semibold">
                <span className="text-gray-400">Email:</span>{' '}
                <a href="mailto:hr@bnyahyagroup.com" className="text-red hover:underline font-bold">
                  hr@bnyahyagroup.com
                </a>
              </p>
            </div>
          </section>
        </motion.div>

        {/* Footer Acknowledgement */}
        <div className="mt-16 pt-8 border-t border-gray-100 text-center text-xs font-semibold text-gray-400 uppercase tracking-widest">
          By using our website or services, you acknowledge and agree to this Privacy Policy.
        </div>

      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
