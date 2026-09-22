import React, { Suspense, lazy } from 'react';
import Hero from '../components/Hero';

/** Below-the-fold sections load after Hero so the first paint stays light. */
const TalentMatchmaking = lazy(() => import('../components/TalentMatchmaking'));
const Leadership = lazy(() => import('../components/Leadership'));
const Mission = lazy(() => import('../components/Mission'));
const Scale = lazy(() => import('../components/Scale'));
const Problem = lazy(() => import('../components/Problem'));
const Solutions = lazy(() => import('../components/Solutions'));
const HowItWorks = lazy(() => import('../components/HowItWorks'));
const Roles = lazy(() => import('../components/Roles'));
const Industries = lazy(() => import('../components/Industries'));
const Testimonials = lazy(() => import('../components/Testimonials'));
const FAQ = lazy(() => import('../components/FAQ'));

function SectionFallback() {
  return <div className="h-24 w-full" aria-hidden="true" />;
}

const HomePage = () => {
  return (
    <div className="pt-20 overflow-x-hidden max-w-full">
      <Hero />
      <Suspense fallback={<SectionFallback />}>
        <TalentMatchmaking />
        <Leadership />
        <Mission />
        <Scale />
        <Problem />
        <Solutions />
        <HowItWorks />
        <Roles />
        <Industries />
        <Testimonials />
        <FAQ />
      </Suspense>
    </div>
  );
};

export default HomePage;
