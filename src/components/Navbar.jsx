// src/components/Navbar.jsx
import React, { useState, useEffect } from 'react';
import { Menu, X, ChevronDown, LogOut, LayoutDashboard } from 'lucide-react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import logo from '../assets/BYG Hires Logo.png';
import { useAuth } from '../context/AuthContext';
import { useAccountType } from '../hooks/useAccountType';

const PUBLIC_NAV_LINKS = [
  { name: 'Talent Directory', href: '/talent' },
  { name: 'How It Works', href: '/how-it-works' },
  { name: 'Join Talent Pool', href: '/talent/signup' },
  { name: 'About', href: '/about' },
];

const ADMIN_NAV_LINKS = [
  { name: 'Browse Candidates', href: '/admin/dashboard' },
  { name: 'Bulk CV Import', href: '/admin/talent/import' },
  { name: 'Browse Clients', href: '/admin/clients' },
  { name: 'Reviews', href: '/admin/reviews' },
];

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
  if (href === '/admin/dashboard') {
    return pathname === '/admin/dashboard' || pathname === '/admin';
  }
  if (href === '/admin/clients') {
    return pathname === '/admin/clients';
  }
  if (href === '/admin/reviews') {
    return pathname === '/admin/reviews';
  }
  if (href === '/admin/talent/import') {
    return pathname === '/admin/talent/import';
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

const Navbar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { pathname } = location;
  const { user, signOut } = useAuth();
  const accountType = useAccountType(user);
  const isAdminUser = accountType === 'admin';
  const isClientUser = accountType === 'client';
  const isTalentUser = accountType === 'talent';
  const [isOpen, setIsOpen] = useState(false);
  const [isScaleOpen, setIsScaleOpen] = useState(false);

  const baseNavLinks = isAdminUser ? ADMIN_NAV_LINKS : PUBLIC_NAV_LINKS;
  const navLinks = isClientUser
    ? baseNavLinks.filter((link) => link.href !== '/talent/signup')
    : baseNavLinks;
  const homeHref = isAdminUser ? '/admin/dashboard' : isClientUser ? '/client' : '/';

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

  const renderNavLink = (link, onNavigate) => {
    if (link.dropdown) {
      return (
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
              {link.dropdown.map((subItem) => (
                <Link
                  key={subItem.name}
                  to={subItem.href}
                  onClick={onNavigate}
                  className={`block px-4 py-2 text-sm transition-colors ${
                    isNavLinkActive(pathname, subItem.href)
                      ? 'text-red bg-red/5 font-bold'
                      : 'text-black hover:bg-gray-50 hover:text-red'
                  }`}
                >
                  {subItem.name}
                </Link>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <Link
        key={link.name}
        to={link.href}
        onClick={onNavigate}
        className={desktopLinkClass(link.href, link.name === 'Join Talent Pool')}
      >
        {link.name}
      </Link>
    );
  };

  const closeMobile = () => setIsOpen(false);

  return (
    <nav className="fixed w-full bg-white z-50 border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-20 items-center">
          <div className="flex-shrink-0 flex items-center">
            <Link to={homeHref} className="flex items-center">
              <img src={logo} alt="BYG Hires" className="h-10 w-auto" />
            </Link>
          </div>

          <div className="hidden md:flex items-center space-x-8">
            {navLinks.map((link) => renderNavLink(link))}

            {user ? (
              <div className="flex items-center gap-4 border-l border-gray-200 pl-6 ml-2">
                {isClientUser && (
                  <Link
                    to="/client"
                    className={`text-sm font-bold flex items-center gap-2 transition-colors border-b-2 pb-0.5 ${
                      pathname === '/client' || pathname.startsWith('/client/')
                        ? 'text-red border-red'
                        : 'text-black border-transparent hover:text-red'
                    }`}
                  >
                    <LayoutDashboard size={15} /> My Dashboard
                  </Link>
                )}
                {isTalentUser && (
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
                )}
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-sm font-bold text-gray-500 hover:text-red flex items-center gap-1 transition-colors"
                >
                  <LogOut size={15} /> Logout
                </button>
              </div>
            ) : (
              <div className="border-l border-gray-200 pl-6 ml-2">
                <Link
                  to="/login"
                  className={`text-sm font-bold transition-colors border-b-2 pb-0.5 ${
                    pathname === '/login' || pathname === '/talent/login' || pathname === '/client/login'
                      ? 'text-red border-red'
                      : 'text-red border-transparent hover:text-black'
                  }`}
                >
                  Log In
                </Link>
              </div>
            )}
          </div>

          <div className="md:hidden flex items-center">
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="text-black hover:text-red focus:outline-none"
              aria-label="Menu"
            >
              {isOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>
      </div>

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
                          onClick={closeMobile}
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
                  onClick={closeMobile}
                  className={mobileLinkClass(link.href, link.name === 'Join Talent Pool')}
                >
                  {link.name}
                </Link>
              )
            )}

            <div className="pt-4 mt-4 border-t border-gray-100">
              {user ? (
                <>
                  {isClientUser && (
                    <Link to="/client" onClick={closeMobile} className={mobileLinkClass('/client')}>
                      My Dashboard
                    </Link>
                  )}
                  {isTalentUser && (
                    <Link to="/portal" onClick={closeMobile} className={mobileLinkClass('/portal')}>
                      My Portal
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex w-full text-left px-3 py-3 text-base font-medium text-gray-500 hover:text-red hover:bg-gray-50 rounded-md"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <Link to="/login" onClick={closeMobile} className={mobileLinkClass('/login', true)}>
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
