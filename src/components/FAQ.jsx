import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp } from 'lucide-react';

const FAQItem = ({ question, answer }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-gray-200 py-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex justify-between items-center w-full text-left focus:outline-none group"
      >
        <span className="text-lg font-semibold text-black group-hover:text-red transition-colors">
          {question}
        </span>
        <span className="ml-6 flex-shrink-0 text-gray-400 group-hover:text-red transition-colors">
          {isOpen ? <ChevronUp size={24} /> : <ChevronDown size={24} />}
        </span>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <p className="pt-4 text-gray-800 leading-relaxed">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const FAQ = () => {
  const faqs = [
    {
      question: "Where do you source your talent from?",
      answer: "We source exceptional talent from Pakistan, the Philippines, India, and other leading markets to support the GCC with skilled professionals who bring strong English proficiency, cultural fit, and a clear understanding of local business needs."
    },
    {
      question: "What types of roles can I hire for?",
      answer: "You can hire across Admin, Operations, Marketing, Customer Support, Finance, and other niche roles."
    },
    {
      question: "How long does the hiring process take?",
      answer: "On average, we place talent in 10 to 14 days or less."
    },
    {
      question: "What is the typical cost?",
      answer: "Most roles are $350–$600/month, while highly specialized advanced roles start at $1000+/month. There are no hidden fees."
    },
    {
      question: "What if the hire isn't a good fit?",
      answer: "We offer a risk-free replacement guarantee. If it's not working out, we will find a replacement at no additional cost."
    }
  ];

  return (
    <section className="py-24 bg-white">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-black mb-6">
            Frequently Asked Questions
          </h2>
          <p className="text-xl text-gray-800">
            Everything you need to know about hiring with BYGHires.
          </p>
        </div>

        <div className="space-y-2">
          {faqs.map((faq, index) => (
            <FAQItem key={index} question={faq.question} answer={faq.answer} />
          ))}
        </div>
      </div>
    </section>
  );
};

export default FAQ;
