import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import logo from '../assets/BYG Hires Logo.png';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);

  const navLinks = [
    { name: 'Remote Sales Team', href: '/remote-sales-team' },
    { name: 'Remote Support Team', href: '/remote-support-team' },
    { name: 'How It Works', href: '/how-it-works' },
    { name: 'Case Studies', href: '/case-studies' },
    { name: 'Why Us', href: '/why-us' },
  ];

  return (
    <nav className="fixed w-full bg-white z-50 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <div className="flex-shrink-0 flex items-center">
            <Link to="/" className="flex items-center">
              <img src={logo} alt="BYG Hires" className="h-10 w-auto" />
            </Link>
          </div>
          
          {/* Desktop Nav */}
          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.href}
                className="text-black font-medium hover:text-red transition-colors duration-200"
              >
                {link.name}
              </Link>
            ))}
            <a
              href="https://forms.gle/1xSJiXkfr7kCVdAr7"
              target="_blank"
              rel="noopener noreferrer"
              className="bg-transparent border-2 border-red text-red px-6 py-2 rounded-full font-semibold hover:bg-red hover:text-white transition-colors duration-200 text-center leading-tight text-sm"
            >
              Find A<br />Great Hire
            </a>
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsOpen(!isOpen)}
              className="text-black hover:text-red focus:outline-none"
            >
              {isOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Nav */}
      {isOpen && (
        <div className="md:hidden bg-white border-t border-gray-100">
          <div className="px-4 pt-2 pb-6 space-y-1">
            {navLinks.map((link) => (
              <Link
                key={link.name}
                to={link.href}
                onClick={() => setIsOpen(false)}
                className="block px-3 py-3 text-base font-medium text-black hover:text-red hover:bg-gray-50 rounded-md"
              >
                {link.name}
              </Link>
            ))}
            <a
              href="https://forms.gle/1xSJiXkfr7kCVdAr7"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsOpen(false)}
              className="block mt-4 text-center bg-transparent border-2 border-red text-red px-6 py-3 rounded-full font-semibold hover:bg-red hover:text-white transition-colors"
            >
              Find A Great Hire
            </a>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
