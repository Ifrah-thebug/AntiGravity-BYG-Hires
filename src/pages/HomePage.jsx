import React from 'react';
import Hero from '../components/Hero';
import Leadership from '../components/Leadership';
import Mission from '../components/Mission';
import Scale from '../components/Scale';
import Problem from '../components/Problem';
import Solutions from '../components/Solutions';
import Roles from '../components/Roles';
import Industries from '../components/Industries';
import Testimonials from '../components/Testimonials';
import FAQ from '../components/FAQ';

const HomePage = () => {
  return (
    <div className="pt-20">
      <Hero />
      <Leadership />
      <Mission />
      <Scale />
      <Problem />
      <Solutions />
      <Roles />
      <Industries />
      <Testimonials />
      <FAQ />
    </div>
  );
};

export default HomePage;
