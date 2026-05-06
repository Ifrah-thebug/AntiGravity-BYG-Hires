import React from 'react';
import { Link } from 'react-router-dom';

const Footer = () => {
  return (
    <footer id="contact" className="bg-black text-white pt-24 pb-10 border-t border-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-12 mb-16 text-left">
          <div>
            <h2 className="text-3xl md:text-4xl font-extrabold mb-6">Where is your business feeling the most pressure right now?</h2>
            <p className="text-2xl text-red font-bold mb-8">Let's Transform your Operations.</p>
            <a
              href="https://calendly.com/recruitment-bnyahyagroup/30min"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-transparent border-2 border-red text-red px-8 py-4 rounded-full font-bold text-lg hover:bg-red hover:text-white transition-colors shadow-lg"
            >
              Discuss Your Requirements.
            </a>
          </div>
          
          <div className="bg-gray-900 rounded-3xl p-10 border border-gray-800">
            <h3 className="text-xl md:text-2xl font-bold mb-8 text-white">Yalla, Bringing You Great Hires</h3>
            <div className="space-y-4 text-gray-300">
              <p><strong>Email:</strong> <a href="mailto:hires@bnyahyagroup.com" className="hover:text-red transition-colors">hires@bnyahyagroup.com</a></p>
              <p><strong>Phone:</strong> <a href="tel:+971507274365" className="hover:text-red transition-colors">+971 50 727 4365</a></p>
              <p><strong>Website:</strong> <a href="https://www.bnyahyagroup.com" target="_blank" rel="noopener noreferrer" className="hover:text-red transition-colors">www.bnyahyagroup.com</a></p>
              <div className="pt-6 mt-6 border-t border-gray-800">
                <Link to="/talent-pool" className="block w-full bg-black border border-gray-700 hover:border-red hover:bg-gray-800 rounded-2xl p-5 transition-all group shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-gray-400 text-sm font-bold uppercase tracking-wider block mb-1">For Candidates</span>
                      <span className="text-white font-bold text-lg group-hover:text-red transition-colors">Join the Talent Pool</span>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-red/20 flex items-center justify-center group-hover:bg-red transition-colors">
                      <span className="text-red group-hover:text-white text-xl font-bold">&rarr;</span>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-gray-900 text-center">
          <p className="text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} BYG Hires (Remote Staffing Agency). All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
