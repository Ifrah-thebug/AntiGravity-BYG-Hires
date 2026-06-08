import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, FileText, Shield } from 'lucide-react';

export const LegalSection = ({
  id,
  number,
  title,
  icon: Icon,
  children,
  variant = 'default',
  delay = 0,
}) => {
  const variants = {
    default: 'bg-white border border-gray-100 shadow-sm hover:shadow-md hover:border-red/20',
    highlight: 'bg-gradient-to-br from-red/5 via-white to-gray-50 border border-red/10 shadow-sm hover:shadow-md hover:border-red/25',
    dark: 'bg-black text-white border border-gray-800 shadow-xl',
  };

  const isDark = variant === 'dark';

  return (
    <motion.section
      id={id}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.45, delay }}
      className={`scroll-mt-36 rounded-3xl p-6 md:p-8 transition-all duration-300 ${variants[variant]}`}
    >
      <div className="flex items-start gap-4 mb-5">
        {Icon && (
          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
            isDark ? 'bg-red text-white' : 'bg-red/10 text-red'
          }`}>
            <Icon size={20} strokeWidth={2.5} />
          </div>
        )}
        <div className="min-w-0">
          <p className={`text-[10px] font-black uppercase tracking-[0.2em] mb-1 ${isDark ? 'text-red' : 'text-gray-400'}`}>
            Section {number}
          </p>
          <h2 className={`text-xl md:text-2xl font-black tracking-tight uppercase leading-tight ${isDark ? 'text-white' : 'text-black'}`}>
            {title}
          </h2>
        </div>
      </div>
      <div className={`space-y-4 text-[15px] leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-600'}`}>
        {children}
      </div>
    </motion.section>
  );
};

export const LegalCallout = ({ children, tone = 'neutral' }) => {
  const tones = {
    neutral: 'bg-gray-50 border-gray-100 text-gray-600',
    accent: 'bg-red/5 border-red/15 text-gray-700',
    dark: 'bg-gray-900 border-gray-800 text-gray-300',
  };

  return (
    <div className={`rounded-2xl border p-5 md:p-6 ${tones[tone]}`}>
      {children}
    </div>
  );
};

export const LegalInfoCard = ({ title, items, icon: Icon }) => (
  <div className="group bg-white border border-gray-100 rounded-2xl p-5 md:p-6 shadow-sm hover:shadow-lg hover:border-red/25 hover:-translate-y-0.5 transition-all duration-300">
    <div className="flex items-center gap-3 mb-4">
      {Icon && (
        <div className="w-9 h-9 rounded-xl bg-red/10 text-red flex items-center justify-center group-hover:bg-red group-hover:text-white transition-colors">
          <Icon size={16} strokeWidth={2.5} />
        </div>
      )}
      <h3 className="font-black text-xs text-black uppercase tracking-wider">{title}</h3>
    </div>
    <ul className="space-y-2 text-[13px] text-gray-600 font-medium">
      {items.map((item) => (
        <li key={item} className="flex items-start gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-red mt-1.5 shrink-0" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  </div>
);

export const LegalContactCard = () => (
  <div className="relative overflow-hidden rounded-3xl bg-black text-white p-6 md:p-8 border border-gray-800 shadow-2xl">
    <div className="absolute top-0 right-0 w-40 h-40 bg-red/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none" />
    <div className="relative">
      <p className="text-red font-black text-[10px] uppercase tracking-[0.2em] mb-2">Get in Touch</p>
      <p className="font-black text-lg uppercase tracking-tight mb-5">BYG Hires</p>
      <div className="space-y-3">
        <p className="text-sm">
          <span className="text-gray-500 font-bold uppercase text-[10px] tracking-wider block mb-0.5">Website</span>
          <a href="https://www.bnyahyagroup.com" target="_blank" rel="noopener noreferrer" className="text-white hover:text-red font-bold transition-colors">
            www.bnyahyagroup.com
          </a>
        </p>
        <p className="text-sm">
          <span className="text-gray-500 font-bold uppercase text-[10px] tracking-wider block mb-0.5">Email</span>
          <a href="mailto:hr@bnyahyagroup.com" className="text-white hover:text-red font-bold transition-colors">
            hr@bnyahyagroup.com
          </a>
        </p>
      </div>
    </div>
  </div>
);

const LegalPageLayout = ({
  title,
  effectiveDate,
  intro,
  sections,
  siblingPage,
  acknowledgement,
  children,
}) => {
  const [activeSection, setActiveSection] = useState(sections[0]?.id ?? '');

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    const observers = sections.map(({ id }) => {
      const el = document.getElementById(id);
      if (!el) return null;

      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActiveSection(id);
        },
        { rootMargin: '-30% 0px -55% 0px', threshold: 0 }
      );

      observer.observe(el);
      return observer;
    });

    return () => observers.forEach((o) => o?.disconnect());
  }, [sections]);

  const scrollToSection = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="bg-gray-50 text-black min-h-screen font-sans">
      {/* Hero */}
      <div className="relative bg-black text-white pt-28 pb-16 md:pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(255,61,61,0.18),_transparent_55%)]" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-red/60 to-transparent" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-red/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-6">
              <Link to="/" className="hover:text-white transition-colors">Home</Link>
              <ChevronRight size={12} className="text-gray-600" />
              <span className="text-red">Legal</span>
              <ChevronRight size={12} className="text-gray-600" />
              <span className="text-gray-300">{title}</span>
            </div>

            <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-8">
              <div className="max-w-3xl">
                <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-full px-4 py-1.5 mb-5">
                  <Shield size={12} className="text-red" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-300">Legal Obligations</span>
                </div>
                <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tight leading-[0.95] uppercase mb-4">
                  {title}
                </h1>
                <p className="text-gray-400 text-sm font-semibold tracking-wide">
                  Effective Date: {effectiveDate}
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link
                  to={siblingPage.href}
                  className="inline-flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-red/40 rounded-2xl px-5 py-3 text-sm font-bold transition-all group"
                >
                  <FileText size={16} className="text-red" />
                  <span>{siblingPage.label}</span>
                  <ChevronRight size={14} className="text-gray-500 group-hover:translate-x-0.5 transition-transform" />
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-16">
        <div className="grid lg:grid-cols-[260px_1fr] gap-10 xl:gap-14 items-start">

          {/* Sticky TOC */}
          <aside className="hidden lg:block sticky top-28">
            <motion.div
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white border border-gray-100 rounded-3xl p-5 shadow-sm"
            >
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-4 px-1">On This Page</p>
              <nav className="space-y-0.5 max-h-[calc(100vh-10rem)] overflow-y-auto pr-1">
                {sections.map(({ id, number, title: sectionTitle }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => scrollToSection(id)}
                    className={`w-full text-left px-3 py-2.5 rounded-xl text-[12px] font-semibold transition-all flex items-start gap-2 ${
                      activeSection === id
                        ? 'bg-red/10 text-red'
                        : 'text-gray-500 hover:text-black hover:bg-gray-50'
                    }`}
                  >
                    <span className={`font-black shrink-0 ${activeSection === id ? 'text-red' : 'text-gray-300'}`}>
                      {number}.
                    </span>
                    <span className="leading-snug">{sectionTitle}</span>
                  </button>
                ))}
              </nav>
            </motion.div>
          </aside>

          {/* Mobile TOC */}
          <div className="lg:hidden col-span-full -mt-2 mb-2">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {sections.map(({ id, number, title: sectionTitle }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => scrollToSection(id)}
                  className={`shrink-0 px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wide border transition-all ${
                    activeSection === id
                      ? 'bg-red text-white border-red shadow-md shadow-red/25'
                      : 'bg-white text-gray-500 border-gray-200 hover:border-red/30'
                  }`}
                >
                  {number}. {sectionTitle}
                </button>
              ))}
            </div>
          </div>

          {/* Main content */}
          <div className="min-w-0 space-y-8 lg:col-start-2">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white border border-gray-100 rounded-3xl p-6 md:p-8 shadow-sm"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-red text-white flex items-center justify-center shrink-0 shadow-lg shadow-red/25">
                  <FileText size={22} strokeWidth={2.5} />
                </div>
                <div className="text-[15px] leading-relaxed text-gray-600 space-y-3">
                  {intro}
                </div>
              </div>
            </motion.div>

            <div className="space-y-6">
              {children}
            </div>

            {/* Acknowledgement */}
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="relative overflow-hidden rounded-3xl bg-black text-white p-8 md:p-10 text-center border border-gray-800"
            >
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(255,61,61,0.12),_transparent_70%)]" />
              <p className="relative text-xs md:text-sm font-bold text-gray-400 uppercase tracking-[0.15em] leading-relaxed max-w-2xl mx-auto">
                {acknowledgement}
              </p>
              <div className="relative flex flex-wrap justify-center gap-3 mt-6">
                <Link
                  to={siblingPage.href}
                  className="inline-flex items-center gap-2 bg-white/10 hover:bg-red border border-white/10 hover:border-red rounded-full px-5 py-2.5 text-xs font-black uppercase tracking-wider transition-all"
                >
                  Read {siblingPage.shortLabel}
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LegalPageLayout;
