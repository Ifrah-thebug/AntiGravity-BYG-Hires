import React from 'react';
import { Link } from 'react-router-dom';
import { getDiscoveryBookingUrl } from '../lib/discoveryBooking';

const Footer = () => {
  return (
    <footer id="contact" className="bg-black text-white pt-24 pb-10 border-t border-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-2 gap-12 mb-16 text-left">
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold mb-4">Where is your business feeling the most pressure right now?</h2>
            <p className="text-lg text-red font-bold mb-6">Let's Transform your Operations.</p>
            <a
              href={getDiscoveryBookingUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block bg-transparent border-2 border-red text-red px-5 py-2.5 rounded-full font-bold text-sm hover:bg-red hover:text-white transition-colors shadow-lg"
            >
              Discuss Your Requirements.
            </a>
          </div>
          
          <div className="bg-gray-900 rounded-3xl p-8 border border-gray-800">
            <h3 className="text-base md:text-lg font-bold mb-4 text-white">Yalla, Bringing You Great Hires</h3>
            <div className="space-y-2.5 text-gray-300 text-xs">
              <p><strong>Email:</strong> <a href="mailto:hires@bnyahyagroup.com" className="hover:text-red transition-colors">hires@bnyahyagroup.com</a></p>
              <p><strong>Phone:</strong> <a href="tel:+971507274365" className="hover:text-red transition-colors">+971 50 727 4365</a></p>
              <p><strong>Website:</strong> <a href="https://www.bnyahyagroup.com" target="_blank" rel="noopener noreferrer" className="hover:text-red transition-colors">www.bnyahyagroup.com</a></p>
              <div className="pt-4 mt-4 border-t border-gray-800">
                <Link to="/talent/signup" className="block w-full bg-black border border-gray-700 hover:border-red hover:bg-gray-800 rounded-2xl p-3.5 transition-all group shadow-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider block mb-0.5">For Candidates</span>
                      <span className="text-white font-bold text-sm group-hover:text-red transition-colors">Join the Talent Pool</span>
                    </div>
                    <div className="w-7 h-7 rounded-full bg-red/20 flex items-center justify-center group-hover:bg-red transition-colors">
                      <span className="text-red group-hover:text-white text-base font-bold">&rarr;</span>
                    </div>
                  </div>
                </Link>
              </div>
            </div>
          </div>
        </div>

        <div className="pt-8 border-t border-gray-900 flex flex-col md:flex-row items-center justify-between gap-4 text-center md:text-left">
          <p className="text-gray-500 text-sm">
            &copy; {new Date().getFullYear()} BYG Hires (Remote Staffing Agency). All rights reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center md:justify-end gap-4 sm:gap-6">
            <Link to="/about" className="text-gray-500 hover:text-white text-sm transition-colors font-semibold">
              About Us
            </Link>
            <Link to="/privacy" className="text-gray-500 hover:text-white text-sm transition-colors font-semibold">
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
