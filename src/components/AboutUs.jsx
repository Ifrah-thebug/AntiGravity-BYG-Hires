import React from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CreditCard,
  Building2,
  Layers,
  Gem,
  Sparkles,
} from 'lucide-react';
import { getDiscoveryBookingUrl } from '../lib/discoveryBooking';

const STORY = {
  num: '01',
  label: 'Our Story',
  title: 'The gap we set out to close',
  paragraphs: [
    'Local businesses were stuck between rising overheads and talent gaps — founders buried in admin instead of growth. We connect them with curated global talent so revenue stays the focus.',
  ],
  highlights: ['High overheads', 'Talent instability', 'Founder burnout'],
};

const GCC_PILLARS = [
  {
    icon: Building2,
    title: 'Regional Expertise',
    body: '50+ years of family business legacy across the GCC.',
  },
  {
    icon: CreditCard,
    title: 'Localized Flexibility',
    body: 'Invoice in QAR, SAR, or AED — no cross-border friction.',
    currencies: ['QAR', 'SAR', 'AED'],
  },
  {
    icon: Layers,
    title: 'Beyond Staffing',
    body: 'Social, company formation, and 360° growth across Qatar, KSA, and the UAE.',
  },
];

const INDUSTRIES = ['E-Commerce', 'Real Estate', 'Hospitality', 'Healthcare'];

const INFO_CARD_CLASS =
  'rounded-2xl border-2 border-black/10 bg-white p-6 text-left transition-colors duration-300 hover:border-red/30';

const EASE = [0.22, 1, 0.36, 1];

const reveal = (delay = 0, x = 0) => ({
  initial: { opacity: 0, y: 24, x },
  whileInView: { opacity: 1, y: 0, x: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.55, delay, ease: EASE },
});

const cardReveal = (delay = 0, x = 0) => ({
  initial: { opacity: 0, y: 36, scale: 0.96, x },
  whileInView: { opacity: 1, y: 0, scale: 1, x: 0 },
  viewport: { once: true, amount: 0.2 },
  transition: { duration: 0.6, delay, ease: EASE },
});

function ChapterMarker({ num, label, align = 'left' }) {
  const isRight = align === 'right';
  return (
    <motion.div {...reveal(0, isRight ? 20 : -20)} className={`mb-8 flex w-full ${isRight ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`inline-flex items-center gap-3 md:gap-4 shrink-0 ${
          isRight ? 'flex-row-reverse' : ''
        }`}
      >
        <span className="text-5xl md:text-6xl font-extrabold text-red/15 leading-none tabular-nums select-none">
          {num}
        </span>
        <div className="w-12 md:w-14 h-0.5 bg-red shrink-0" aria-hidden />
        <span className="text-red font-bold tracking-[0.18em] uppercase text-xs shrink-0">
          {label}
        </span>
      </div>
    </motion.div>
  );
}

function ZigzagRow({ align, children, wide = false }) {
  const isRight = align === 'right';
  return (
    <div
      className={`${wide ? 'max-w-3xl lg:max-w-4xl' : 'max-w-2xl lg:max-w-3xl'} ${
        isRight ? 'ml-auto' : 'mr-auto'
      } ${isRight ? 'text-right' : 'text-left'}`}
    >
      {children}
    </div>
  );
}

function AnimatedCard({ children, className = '', delay = 0, x = 0, hoverLift = true }) {
  return (
    <motion.div
      {...cardReveal(delay, x)}
      whileHover={
        hoverLift
          ? { y: -5, boxShadow: '0 12px 40px rgba(0,0,0,0.08)', transition: { duration: 0.25 } }
          : undefined
      }
      className={className}
    >
      {children}
    </motion.div>
  );
}

const AboutUs = () => {
  return (
    <div className="relative overflow-hidden bg-white text-black">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.25]"
        aria-hidden
        style={{
          backgroundImage: 'radial-gradient(circle at 1px 1px, rgb(0 0 0 / 0.07) 1px, transparent 0)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Hero */}
      <section className="relative pt-8 pb-16 md:pt-12 md:pb-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-12 gap-10 lg:gap-6 items-end">
            <motion.div
              initial={{ opacity: 0, x: -32 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.65, ease: EASE }}
              className="lg:col-span-7"
            >
              <h1 className="text-[2.75rem] sm:text-5xl md:text-6xl lg:text-[4.25rem] font-extrabold leading-[1.02] tracking-tight">
                Our Story:
                <br />
                <span className="text-red">Bringing</span>
                <br />
                <span className="text-red">You Great</span>
              </h1>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.65, delay: 0.15, ease: EASE }}
              className="lg:col-span-5 lg:pb-4"
            >
              <AnimatedCard
                delay={0.2}
                x={20}
                className="border-l-4 border-red pl-6 md:pl-8 py-2"
                hoverLift={false}
              >
                <p className="text-lg md:text-xl text-black/80 font-medium leading-relaxed">
                  At BYG Hires, our name is our promise —{' '}
                  <span className="text-black font-bold">Bringing You Great.</span>
                </p>
                <p className="mt-4 text-sm text-black/50 font-semibold tracking-wide">
                  Remote staffing · GCC roots · Global talent
                </p>
              </AnimatedCard>
            </motion.div>
          </div>

          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.35, ease: EASE }}
            className="mt-14 h-1 bg-gradient-to-r from-red via-black/20 to-transparent origin-left rounded-full"
          />
        </div>
      </section>

      {/* 01 — left */}
      <section className="relative py-16 md:py-24 border-t border-black/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ZigzagRow align="left">
            <ChapterMarker num={STORY.num} label={STORY.label} align="left" />
            <motion.h2 {...reveal(0.05, -16)} className="text-3xl md:text-4xl font-extrabold leading-tight mb-6">
              {STORY.title}
            </motion.h2>
            <div className="flex flex-wrap gap-2 mb-8 justify-start">
              {STORY.highlights.map((tag, i) => (
                <AnimatedCard
                  key={tag}
                  delay={0.1 + i * 0.07}
                  x={-12}
                  className="px-3 py-1.5 rounded-lg bg-black text-white text-xs font-bold tracking-wide"
                  hoverLift
                >
                  {tag}
                </AnimatedCard>
              ))}
            </div>
            <AnimatedCard
              delay={0.28}
              x={-20}
              className="space-y-5 text-black/75 text-[17px] leading-relaxed border-l-4 border-red pl-6"
            >
              {STORY.paragraphs.map((p) => (
                <p key={p.slice(0, 40)}>{p}</p>
              ))}
            </AnimatedCard>
          </ZigzagRow>
        </div>
      </section>

      {/* 02 — right */}
      <section className="relative py-16 md:py-24 border-t border-black/10 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ZigzagRow align="right">
            <ChapterMarker num="02" label="Philosophy" align="right" />
            <AnimatedCard
              delay={0.08}
              x={24}
              hoverLift={false}
              className="rounded-3xl border-2 border-black bg-white p-8 md:p-10 shadow-sm"
            >
              <div className="flex items-start gap-4 mb-5 justify-end flex-row-reverse text-right">
                <div className="w-12 h-12 rounded-2xl bg-red flex items-center justify-center shrink-0">
                  <Gem size={22} className="text-white" />
                </div>
                <h2 className="text-2xl md:text-3xl font-extrabold leading-tight text-black">
                  Polish the <span className="text-red">Diamonds</span>
                </h2>
              </div>
              <p className="text-black/75 font-medium leading-relaxed mb-8 text-[17px] text-right">
                Hire right and &ldquo;remote&rdquo; means <span className="text-black font-bold">driven</span> — not disconnected.
              </p>

              <div className="space-y-4">
                <AnimatedCard delay={0.18} x={16} hoverLift={false} className={INFO_CARD_CLASS}>
                  <div className="flex items-center gap-2 text-red font-bold text-xs uppercase tracking-widest mb-3">
                    <Sparkles size={14} />
                    Daily performance
                  </div>
                  <p className="text-black/70 leading-relaxed text-[15px]">
                    We measure <span className="text-black font-semibold">consistent daily performance</span> — not just day one.
                  </p>
                </AnimatedCard>

                <AnimatedCard delay={0.26} x={16} hoverLift={false} className={INFO_CARD_CLASS}>
                  <div className="flex items-center gap-2 text-red font-bold text-xs uppercase tracking-widest mb-3">
                    <Gem size={14} />
                    Talent &amp; clients
                  </div>
                  <p className="text-black/70 leading-relaxed text-[15px]">
                    We help our &ldquo;diamonds&rdquo; shine — supporting talent as seriously as we support your business.
                  </p>
                </AnimatedCard>
              </div>
            </AnimatedCard>
          </ZigzagRow>
        </div>
      </section>

      {/* 03 — left */}
      <section className="relative py-16 md:py-24 border-t border-black/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ZigzagRow align="left" wide>
            <ChapterMarker num="03" label="GCC Advantage" align="left" />
            <motion.h2 {...reveal(0.05, -16)} className="text-3xl md:text-4xl font-extrabold leading-tight mb-5">
              Regional roots. <span className="text-red">Global reach.</span>
            </motion.h2>
            <motion.p {...reveal(0.1, -12)} className="text-black/70 text-lg leading-relaxed mb-10 max-w-xl">
              Global talent, regional roots — your partner in operational excellence across the GCC.
            </motion.p>

            <div className="space-y-4">
              {GCC_PILLARS.map((pillar, i) => (
                <AnimatedCard
                  key={pillar.title}
                  delay={0.12 + i * 0.1}
                  x={-20}
                  className="group rounded-2xl border-2 border-black/10 bg-white p-6 hover:border-red transition-colors duration-300"
                >
                  <div className="flex gap-4 items-start">
                    <div className="w-10 h-10 rounded-xl bg-red text-white flex items-center justify-center shrink-0">
                      <pillar.icon size={18} strokeWidth={2.25} />
                    </div>
                    <div className="text-left">
                      <h3 className="text-lg font-bold mb-1.5 text-black">{pillar.title}</h3>
                      <p className="text-black/65 leading-relaxed text-sm">{pillar.body}</p>
                      {pillar.currencies && (
                        <div className="flex gap-2 mt-3">
                          {pillar.currencies.map((c) => (
                            <span
                              key={c}
                              className="px-2.5 py-1 rounded-md bg-black text-white text-xs font-bold"
                            >
                              {c}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </AnimatedCard>
              ))}
            </div>
          </ZigzagRow>
        </div>
      </section>

      {/* 04 — right: single partner card + one CTA */}
      <section className="relative py-16 md:pb-28 border-t border-black/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <ZigzagRow align="right" wide>
            <ChapterMarker num="04" label="Partner With Us" align="right" />
            <AnimatedCard
              delay={0.1}
              x={24}
              className="rounded-3xl border-2 border-black bg-white p-8 md:p-10 shadow-sm text-right"
            >
              <h2 className="text-3xl md:text-4xl font-extrabold leading-tight mb-5">
                Build the right team.
                <br />
                <span className="text-red">Scale with less stress.</span>
              </h2>
              <motion.div
                {...reveal(0.2, 12)}
                className="flex flex-wrap gap-2 justify-end mb-8"
              >
                {INDUSTRIES.map((industry) => (
                  <span
                    key={industry}
                    className="px-3 py-1.5 rounded-lg bg-black text-white text-xs font-bold tracking-wide"
                  >
                    {industry}
                  </span>
                ))}
              </motion.div>

              <a
                href={getDiscoveryBookingUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex w-full sm:w-auto items-center justify-center gap-2 bg-red hover:bg-black text-white font-bold px-8 py-4 rounded-full transition-colors border-2 border-red shadow-lg sm:ml-auto"
              >
                Discuss Your Requirements
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </a>
            </AnimatedCard>
          </ZigzagRow>
        </div>
      </section>
    </div>
  );
};

export default AboutUs;
