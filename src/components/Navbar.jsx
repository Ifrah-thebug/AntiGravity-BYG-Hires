// src/components/Navbar.jsx
import React, { useState } from 'react';
import { Menu, X, ChevronDown, LogOut, LayoutDashboard } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import logo from '../assets/BYG Hires Logo.png';
import { useAuth } from '../context/AuthContext';

/** Match current route to nav href (directory vs signup/login, etc.) */
function isNavLinkActive(pathname, href) {
  if (href === '/talent') {
    if (
      pathname === '/talent/login' ||
      pathname === '/talent/signup' ||
      pathname === '/talent/setup'
    ) {
      return false;
    }
    return pathname === '/talent' || pathname.startsWith('/talent/');
  }
  if (href === '/talent/signup') {
    return pathname === '/talent/signup' || pathname === '/talent/setup';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { pathname } = location;
  const { user, signOut } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isScaleOpen, setIsScaleOpen] = useState(false);

  const isScaleSectionActive = (dropdown) =>
    dropdown?.some((item) => isNavLinkActive(pathname, item.href));

  const desktopLinkClass = (href, isCta = false) => {
    const active = isNavLinkActive(pathname, href);
    if (isCta) {
      return `font-bold transition-colors duration-200 border-b-2 pb-0.5 ${
        active
          ? 'text-red border-red'
          : 'text-red border-transparent hover:text-red-700 hover:border-red/40'
      }`;
    }
    return `font-medium transition-colors duration-200 border-b-2 pb-0.5 ${
      active
        ? 'text-red border-red font-bold'
        : 'text-black border-transparent hover:text-red'
    }`;
  };

  const mobileLinkClass = (href, isCta = false) => {
    const active = isNavLinkActive(pathname, href);
    if (isCta) {
      return `block px-3 py-3 text-base font-medium rounded-md ${
        active
          ? 'text-red bg-red/5 font-bold'
          : 'text-red hover:text-red-700 hover:bg-gray-50'
      }`;
    }
    return `block px-3 py-3 text-base font-medium rounded-md ${
      active
        ? 'text-red bg-red/5 font-bold'
        : 'text-black hover:text-red hover:bg-gray-50'
    }`;
  };

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (e) {
      // swallow
    }
    navigate('/');
    setIsOpen(false);
  };

  const navLinks = [
    {
      name: 'Scale',
      dropdown: [
        { name: 'Remote Sales Team', href: '/remote-sales-team' },
        { name: 'Remote Support Team', href: '/remote-support-team' },
      ],
    },
    { name: 'Talent Directory', href: '/talent' },
    { name: 'How It Works', href: '/how-it-works' },
    { name: 'Join Talent Pool', href: '/talent/signup' },
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
            {navLinks.map((link) =>
              link.dropdown ? (
                <div
                  key={link.name}
                  className="relative group"
                  onMouseEnter={() => setIsScaleOpen(true)}
                  onMouseLeave={() => setIsScaleOpen(false)}
                >
                  <button
                    type="button"
                    className={`flex items-center transition-colors duration-200 py-2 border-b-2 pb-0.5 ${
                      isScaleSectionActive(link.dropdown)
                        ? 'text-red border-red font-bold'
                        : 'text-black border-transparent font-medium hover:text-red'
                    }`}
                  >
                    {link.name}
                    <ChevronDown size={16} className={`ml-1 transition-transform duration-200 ${isScaleOpen ? 'rotate-180' : ''}`} />
                  </button>

                  {isScaleOpen && (
                    <div className="absolute left-0 mt-0 w-56 bg-white border border-gray-100 shadow-lg rounded-md py-2 z-50">
                      {link.dropdown.map((subItem) => {
                        const subActive = isNavLinkActive(pathname, subItem.href);
                        return (
                          <Link
                            key={subItem.name}
                            to={subItem.href}
                            className={`block px-4 py-2 text-sm transition-colors ${
                              subActive
                                ? 'text-red bg-red/5 font-bold'
                                : 'text-black hover:bg-gray-50 hover:text-red'
                            }`}
                          >
                            {subItem.name}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <Link
                  key={link.name}
                  to={link.href}
                  className={desktopLinkClass(link.href, link.name === 'Join Talent Pool')}
                >
                  {link.name}
                </Link>
              )
            )}

            {/* Auth state */}
            {user ? (
              <div className="flex items-center gap-4 border-l border-gray-200 pl-6 ml-2">
                <Link
                  to="/portal"
                  className={`text-sm font-bold flex items-center gap-2 transition-colors border-b-2 pb-0.5 ${
                    pathname === '/portal' || pathname.startsWith('/portal/')
                      ? 'text-red border-red'
                      : 'text-black border-transparent hover:text-red'
                  }`}
                >
                  <LayoutDashboard size={15} /> My Portal
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-sm font-bold text-gray-500 hover:text-red flex items-center gap-1 transition-colors"
                >
                  <LogOut size={15} /> Logout
                </button>
              </div>
            ) : (
              <div className="border-l border-gray-200 pl-6 ml-2">
                <Link
                  to="/talent/login"
                  className={`text-sm font-bold transition-colors border-b-2 pb-0.5 ${
                    pathname === '/talent/login'
                      ? 'text-red border-red'
                      : 'text-red border-transparent hover:text-black'
                  }`}
                >
                  Log In
                </Link>
              </div>
            )}
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
            {navLinks.map((link) =>
              link.dropdown ? (
                <div key={link.name} className="space-y-1">
                  <button
                    type="button"
                    onClick={() => setIsScaleOpen(!isScaleOpen)}
                    className={`flex items-center justify-between w-full px-3 py-3 text-base font-medium rounded-md ${
                      isScaleSectionActive(link.dropdown)
                        ? 'text-red bg-red/5 font-bold'
                        : 'text-black hover:text-red hover:bg-gray-50'
                    }`}
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
                          onClick={() => { setIsOpen(false); setIsScaleOpen(false); }}
                          className={mobileLinkClass(subItem.href)}
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
                  className={mobileLinkClass(link.href, link.name === 'Join Talent Pool')}
                >
                  {link.name}
                </Link>
              )
            )}

            <div className="pt-4 mt-4 border-t border-gray-100">
              {user ? (
                <>
                  <Link
                    to="/portal"
                    onClick={() => setIsOpen(false)}
                    className={mobileLinkClass('/portal')}
                  >
                    My Portal
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex w-full text-left px-3 py-3 text-base font-medium text-gray-500 hover:text-red hover:bg-gray-50 rounded-md"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <Link
                  to="/talent/login"
                  onClick={() => setIsOpen(false)}
                  className={mobileLinkClass('/talent/login', true)}
                >
                  Log In
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
