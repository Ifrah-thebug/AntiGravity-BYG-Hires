import React from 'react';
import Hero from '../components/Hero';
import Leadership from '../components/Leadership';
import Mission from '../components/Mission';
import Scale from '../components/Scale';
import TalentMatchmaking from '../components/TalentMatchmaking';
import Problem from '../components/Problem';
import Solutions from '../components/Solutions';
import HowItWorks from '../components/HowItWorks';
import Roles from '../components/Roles';
import Industries from '../components/Industries';
import Testimonials from '../components/Testimonials';
import FAQ from '../components/FAQ';

const HomePage = () => {
  return (
    <div className="pt-20">
      <Hero />
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
    </div>
  );
};

export default HomePage;
