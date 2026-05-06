import React, { useEffect } from 'react';
import TalentPool from '../components/TalentPool';

const TalentPoolPage = () => {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="pt-20">
      <TalentPool />
    </div>
  );
};

export default TalentPoolPage;
