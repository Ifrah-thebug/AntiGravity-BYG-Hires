import React from 'react';
import { motion } from 'framer-motion';

const Leadership = () => {
  return (
    <section className="py-20 bg-gray-50 border-y border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          
          {/* Chat Bubbles */}
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-6 relative"
          >
            {/* Bubble 1: Right (Red) */}
            <div className="bg-red text-white p-5 rounded-3xl rounded-tr-sm shadow-sm max-w-sm ml-auto text-right">
              <p className="font-medium">Hey, quick check. Where are we on the task?</p>
            </div>
            
            {/* Bubble 2: Left (White) */}
            <div className="bg-white text-gray-800 p-5 rounded-3xl rounded-tl-sm shadow-sm max-w-sm border border-gray-100">
              <p className="font-medium">Almost done. I just want to make sure it’s right.</p>
            </div>
            
            {/* Bubble 3: Right (Red) */}
            <div className="bg-red text-white p-5 rounded-3xl rounded-tr-sm shadow-sm max-w-sm ml-auto text-right">
              <p className="font-medium">Perfect. I’d rather have it right than fast.</p>
            </div>
            
            {/* Bubble 4: Left (White) */}
            <div className="bg-white text-gray-800 p-5 rounded-3xl rounded-tl-sm shadow-sm max-w-sm border border-gray-100 relative">
              <p className="font-medium">Good, because I was going to say the same thing.</p>
            </div>

            {/* Stamp visual - Aligned to the right */}
            <div className="absolute bottom-28 right-0 transform rotate-[15deg] bg-white border-4 border-red px-3 py-1 rounded-md shadow-lg z-20">
              <span className="text-red font-black text-lg tracking-tighter uppercase">HIRED</span>
            </div>
            
            <div className="pt-20 text-center lg:text-left">
              <p className="text-xl text-black font-medium tracking-tight">
                When you hire right, remote doesn't mean disconnected. It means driven.
              </p>
            </div>
          </motion.div>

          {/* Quote */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="bg-black text-white p-12 rounded-[40px] relative overflow-hidden shadow-2xl min-h-[400px] flex flex-col justify-center"
          >
            <div className="absolute top-0 right-0 w-32 h-32 bg-red opacity-20 rounded-bl-full"></div>
            <div className="relative z-10">
              <div className="text-red mb-8">
                <svg width="48" height="36" viewBox="0 0 48 36" fill="currentColor">
                  <path d="M0 36V18.6C0 12.6 1.13333 7.8 3.4 4.2C5.73333 0.533333 9.4 0 14.4 0V7.2C11.6667 7.2 9.8 8 8.8 9.6C7.86667 11.2 7.4 13.5333 7.4 16.6H14.4V36H0ZM24.4 36V18.6C24.4 12.6 25.5333 7.8 27.8 4.2C30.1333 0.533333 33.8 0 38.8 0V7.2C36.0667 7.2 34.2 8 33.2 9.6C32.2667 11.2 31.8 13.5333 31.8 16.6H38.8V36H24.4Z" />
                </svg>
              </div>
              <p className="text-2xl md:text-3xl leading-snug font-medium mb-10 tracking-tight">
                "A remote career is an interesting TV Show. We don't evaluate our team by their pilot, but by their daily episodes. We provide the environment for our 'diamonds' to find their shine."
              </p>
              <div className="flex items-center">
                <div className="w-12 h-1.5 bg-red mr-4 rounded-full"></div>
                <p className="font-black uppercase tracking-widest text-base">BYG Leadership</p>
              </div>
            </div>
          </motion.div>

        </div>
      </div>
    </section>
  );
};

export default Leadership;
