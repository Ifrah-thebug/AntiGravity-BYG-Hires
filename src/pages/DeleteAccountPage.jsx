import React, { useEffect } from 'react';
import { motion } from 'framer-motion';

const SUPPORT_EMAIL = 'hr@bnyahyagroup.com';
const MAIL_SUBJECT = 'Delete my BYG Hires account';
const MAIL_BODY =
  'Hello BYG Hires team,\n\nPlease delete my BYG Hires account and all associated data.\n\nFull name:\nRegistered email:\n\nThank you.';
const MAILTO = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(MAIL_SUBJECT)}&body=${encodeURIComponent(MAIL_BODY)}`;

const DeleteAccountPage = () => {
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
          <p className="text-red font-black tracking-[0.2em] text-[10px] uppercase mb-4">Account &amp; Data</p>
          <h1 className="text-4xl md:text-6xl font-black text-black tracking-tight leading-tight mb-4 uppercase">
            Delete Your Account
          </h1>
          <p className="text-gray-500 text-base font-medium">
            How to request deletion of your BYG Hires account and data — for the <strong className="text-black">BYG Hires Talent</strong> app and byghires.com.
          </p>
        </motion.div>

        {/* Content Section */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="prose prose-lg max-w-none text-gray-700 space-y-10"
        >
          {/* Section 1 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black tracking-tight uppercase flex items-center gap-3">
              <span className="text-red">1.</span> How to Request Deletion
            </h2>
            <ol className="list-decimal pl-5 space-y-2.5 text-gray-600 font-medium">
              <li>
                Send an email to{' '}
                <a href={MAILTO} className="text-red hover:underline font-bold">{SUPPORT_EMAIL}</a>{' '}
                from the email address registered with your BYG Hires account.
              </li>
              <li>Use the subject line <strong className="text-black">“{MAIL_SUBJECT}”</strong>.</li>
              <li>Include your full name so we can find your account.</li>
              <li>We will verify the request comes from the account owner and confirm by email once your account and data have been deleted.</li>
            </ol>
            <div className="pt-2">
              <a
                href={MAILTO}
                className="inline-block bg-red text-white font-black text-xs uppercase tracking-[0.15em] px-6 py-4 rounded-full hover:opacity-90 transition-opacity no-underline"
              >
                Email a deletion request
              </a>
            </div>
            <div className="bg-red/5 border border-red/10 rounded-2xl p-4 mt-2">
              <p className="text-xs text-red font-black uppercase tracking-wider">
                Deletion requests are completed within 30 days.
              </p>
            </div>
          </section>

          {/* Section 2 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black tracking-tight uppercase flex items-center gap-3">
              <span className="text-red">2.</span> Data We Delete
            </h2>
            <p className="text-gray-600">When your account is deleted, we permanently remove:</p>
            <ul className="grid md:grid-cols-2 gap-x-8 gap-y-2.5 pl-5 list-disc text-gray-600 font-medium">
              <li>Your login (email address and password)</li>
              <li>Your profile: name, title, bio, skills, experience and rate</li>
              <li>Your CV / resume file</li>
              <li>Your profile photo and studio photo</li>
              <li>Portfolio projects, images and links</li>
              <li>Skills test answers and scores</li>
              <li>Voice interview recordings and transcripts</li>
              <li>BGuides chat messages</li>
              <li>Intro call availability and calendar connection</li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black tracking-tight uppercase flex items-center gap-3">
              <span className="text-red">3.</span> Data We May Keep
            </h2>
            <p className="text-gray-600">
              We may keep limited records only where we are legally required to — for example, placement, contract or invoice records if you were hired through BYG Hires. These records are kept only for as long as the law requires and are then deleted.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-4">
            <h2 className="text-2xl font-black text-black tracking-tight uppercase flex items-center gap-3">
              <span className="text-red">4.</span> Contact Us
            </h2>
            <div className="bg-gray-50 border border-gray-100 p-6 rounded-2xl space-y-2 mt-2">
              <p className="font-black text-sm text-black uppercase tracking-wider">BYG Hires</p>
              <p className="text-sm font-semibold">
                <span className="text-gray-400">Email:</span>{' '}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="text-red hover:underline font-bold">
                  {SUPPORT_EMAIL}
                </a>
              </p>
              <p className="text-sm font-semibold">
                <span className="text-gray-400">Privacy Policy:</span>{' '}
                <a href="/privacy" className="text-red hover:underline font-bold">
                  byghires.com/privacy
                </a>
              </p>
            </div>
          </section>
        </motion.div>

      </div>
    </div>
  );
};

export default DeleteAccountPage;
