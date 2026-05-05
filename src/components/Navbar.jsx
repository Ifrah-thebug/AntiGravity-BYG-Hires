import React, { useState } from 'react';
import { Menu, X, ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import logo from '../assets/BYG Hires Logo.png';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [isScaleOpen, setIsScaleOpen] = useState(false);

  const navLinks = [
    { 
      name: 'Scale', 
      dropdown: [
        { name: 'Remote Sales Team', href: '/remote-sales-team' },
        { name: 'Remote Support Team', href: '/remote-support-team' },
      ]
    },
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
              link.dropdown ? (
                <div 
                  key={link.name} 
                  className="relative group"
                  onMouseEnter={() => setIsScaleOpen(true)}
                  onMouseLeave={() => setIsScaleOpen(false)}
                >
                  <button className="flex items-center text-black font-medium hover:text-red transition-colors duration-200 py-2">
                    {link.name}
                    <ChevronDown size={16} className={`ml-1 transition-transform duration-200 ${isScaleOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isScaleOpen && (
                    <div className="absolute left-0 mt-0 w-56 bg-white border border-gray-100 shadow-lg rounded-md py-2 z-50">
                      {link.dropdown.map((subItem) => (
                        <Link
                          key={subItem.name}
                          to={subItem.href}
                          className="block px-4 py-2 text-sm text-black hover:bg-gray-50 hover:text-red transition-colors"
                        >
                          {subItem.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={link.name}
                  to={link.href}
                  className="text-black font-medium hover:text-red transition-colors duration-200"
                >
                  {link.name}
                </Link>
              )
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
              link.dropdown ? (
                <div key={link.name} className="space-y-1">
                  <button
                    onClick={() => setIsScaleOpen(!isScaleOpen)}
                    className="flex items-center justify-between w-full px-3 py-3 text-base font-medium text-black hover:text-red hover:bg-gray-50 rounded-md"
                  >
                    {link.name}
                    <ChevronDown size={20} className={`transition-transform duration-200 ${isScaleOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isScaleOpen && (
                    <div className="pl-6 space-y-1">
                      {link.dropdown.map((subItem) => (
                        <Link
                          key={subItem.name}
                          to={subItem.href}
                          onClick={() => {
                            setIsOpen(false);
                            setIsScaleOpen(false);
                          }}
                          className="block px-3 py-2 text-sm font-medium text-black hover:text-red hover:bg-gray-50 rounded-md"
                        >
                          {subItem.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={link.name}
                  to={link.href}
                  onClick={() => setIsOpen(false)}
                  className="block px-3 py-3 text-base font-medium text-black hover:text-red hover:bg-gray-50 rounded-md"
                >
                  {link.name}
                </Link>
              )
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

