import React, { useRef } from 'react';
import { motion } from 'framer-motion';
import { Star, ChevronLeft, ChevronRight } from 'lucide-react';

import vineetLogo from '../assets/Vineet.png';
import merajLogo from '../assets/Meraj.png';
import jamilLogo from '../assets/Jamil.png';
import rayidLogo from '../assets/Rayid.png';
import arshiLogo from '../assets/Arshi Testimonial.jpg';
import clientsSayIcon from '../assets/what-our-clients-say.png';

const Testimonials = () => {
  const scrollRef = useRef(null);

  const testimonials = [
    {
      name: "Vineet N.",
      role: "Founder, IBW",
      quote: "From day one, their positive attitude and eagerness to learn stood out. Delegating has always been hard for me, but time and time again, our hire has delivered.",
      logo: vineetLogo,
      logoHeight: "h-10"
    },
    {
      name: "Meraj Yahya",
      role: "Founder, 365 Adventures",
      quote: "BYGHires has been the backbone of our scaling strategy at 365 Adventures. We’ve shifted to a remote-first model, and thanks to the incredible talent we’ve sourced through BYG, 80% of our team now operates remotely across all departments, from marketing to administration.",
      logo: merajLogo,
      logoHeight: "h-14"
    },
    {
      name: "Jamil R",
      role: "General Manager, PME",
      quote: "Hiring through BYGHires has been a total game-changer for our content production. We had a massive backlog of raw event footage, so we brought on three video editors, and the results were immediate.",
      logo: jamilLogo,
      logoHeight: "h-10"
    },
    {
      name: "Rayid",
      role: "Manager, Visit South for Tourism",
      quote: "Opening a company in Saudi Arabia, we needed an English-speaking customer service and backend operations team. BYG Hires delivered smart talents and also helped us navigate managing these talents.",
      logo: rayidLogo,
      logoHeight: "h-15"
    },
    {
      name: "Arshi",
      role: "Bumper to Bumper",
      quote: "We needed website development and social media handling for our garage. We started from scratch and decided to build a media team with BYGHires and take from there!",
      logo: arshiLogo,
      logoHeight: "h-12"
    }
  ];

  const scroll = (direction) => {
    if (scrollRef.current) {
      const container = scrollRef.current;
      const scrollAmount = container.offsetWidth / 3; // Scroll by one tile width on desktop
      container.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' });
    }
  };

  return (
    <section className="py-24 bg-gray-50 overflow-hidden">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <motion.h2 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-4xl md:text-5xl font-extrabold text-black mb-4 flex items-center justify-center flex-wrap"
          >
            <span>What Our Clients <span className="text-red">Say</span></span>
            <img src={clientsSayIcon} alt="" className="h-10 md:h-14 object-contain inline-block align-middle ml-4" />
          </motion.h2>
          <p className="text-xl text-gray-800 max-w-2xl mx-auto">
            Don't just take our word for it. See how our talent is transforming businesses.
          </p>
          <div className="flex justify-center gap-4 mt-8">
            <button 
              onClick={() => scroll('left')} 
              className="p-3 rounded-full bg-white border border-gray-200 hover:border-red hover:text-red transition-all shadow-sm focus:outline-none"
              aria-label="Previous testimonials"
            >
              <ChevronLeft size={24} />
            </button>
            <button 
              onClick={() => scroll('right')} 
              className="p-3 rounded-full bg-white border border-gray-200 hover:border-red hover:text-red transition-all shadow-sm focus:outline-none"
              aria-label="Next testimonials"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>

        <div 
          ref={scrollRef}
          className="flex overflow-x-auto gap-6 pb-12 snap-x snap-mandatory hide-scrollbar scroll-smooth"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {testimonials.map((test, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="bg-white p-10 rounded-2xl shadow-sm border border-gray-100 flex flex-col w-[450px] h-[450px] flex-shrink-0 snap-start"
            >
              <div className="flex justify-between items-start mb-8">
                <div className="flex gap-1 text-red">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={20} fill="currentColor" />
                  ))}
                </div>
                <img src={test.logo} alt={`${test.name} company logo`} className={`${test.logoHeight} object-contain max-w-[180px]`} />
              </div>
              
              <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
                <p className="text-gray-800 text-base md:text-lg italic leading-relaxed">
                  "{test.quote}"
                </p>
              </div>

              <div className="mt-8 pt-8 border-t border-gray-100">
                <h4 className="font-bold text-black text-lg">{test.name}</h4>
                <p className="text-gray-500 text-sm font-medium">{test.role}</p>
              </div>
            </motion.div>
          ))}
        </div>
        <div className="mt-12 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <a
              href="https://forms.gle/1xSJiXkfr7kCVdAr7"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block px-10 py-4 bg-transparent border-2 border-red text-red rounded-full font-bold text-xl hover:bg-red hover:text-white transition-all shadow-lg"
            >
              Find A Great Hire
            </a>
          </motion.div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      `}} />
    </section>
  );
};

export default Testimonials;
