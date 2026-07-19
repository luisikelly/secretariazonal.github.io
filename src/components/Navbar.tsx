/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { LogOut, KeyRound, User, ShieldCheck, Database, Menu, X, HelpCircle } from "lucide-react";
import scoutLogo from "../assets/images/scout_logo.jpg";

interface NavbarProps {
  username: string;
  onLogout: () => void;
  onChangePasswordClick: () => void;
}

export default function Navbar({ username, onLogout, onChangePasswordClick }: NavbarProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  return (
    <nav className="bg-brand-blue text-white shadow-sm border-b border-white/10 relative z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          {/* Logo / Brand Section */}
          <div className="flex items-center">
            <div className="flex-shrink-0 flex items-center space-x-3">
              <div className="bg-white rounded-lg p-1 border border-white/20 h-10 w-10 flex items-center justify-center overflow-hidden">
                <img 
                  src={scoutLogo} 
                  alt="Logo" 
                  className="h-8 w-8 object-contain rounded" 
                  referrerPolicy="no-referrer"
                />
              </div>
              <span className="font-fredoka font-extrabold tracking-wider text-base sm:text-lg uppercase text-white">
                SECRETARIA ZONA
              </span>
            </div>
            {/* Desktop Navigation links */}
            <div className="hidden md:flex ml-10 space-x-4">
              <span className="px-3 py-1.5 rounded text-xs font-semibold uppercase tracking-wider font-sans bg-white/10 text-white flex items-center space-x-1.5 border border-white/10">
                <Database className="h-3.5 w-3.5" />
                <span>Panel de Validación</span>
              </span>
            </div>
          </div>

          {/* User profile & Actions */}
          <div className="hidden md:flex items-center space-x-4">
            <div className="relative">
              <button
                onClick={() => setShowUserDropdown(!showUserDropdown)}
                className="flex items-center space-x-2 px-3 py-1.5 rounded text-xs font-semibold hover:bg-white/10 transition-colors font-sans focus:outline-none cursor-pointer border border-transparent hover:border-white/10"
              >
                <div className="h-6 w-6 rounded-full bg-white text-brand-blue flex items-center justify-center font-bold text-xs uppercase">
                  {username.charAt(0).toUpperCase()}
                </div>
                <span>{username}</span>
              </button>

              {/* Dropdown Menu */}
              {showUserDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 border border-brand-border text-brand-dark">
                  <div className="px-4 py-2 border-b border-brand-border">
                    <p className="text-[10px] text-brand-muted uppercase font-bold tracking-wider">Rol de Usuario</p>
                    <p className="text-xs font-bold text-brand-blue uppercase">Administrador</p>
                  </div>
                  <button
                    onClick={() => {
                      onChangePasswordClick();
                      setShowUserDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 text-xs font-sans text-brand-dark hover:bg-brand-bg flex items-center space-x-2 cursor-pointer transition-colors"
                  >
                    <KeyRound className="h-3.5 w-3.5 text-brand-muted" />
                    <span>Cambiar Contraseña</span>
                  </button>
                  <button
                    onClick={onLogout}
                    className="w-full text-left px-4 py-2 text-xs font-sans text-red-600 hover:bg-red-50 flex items-center space-x-2 cursor-pointer transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5 text-red-500" />
                    <span>Cerrar Sesión</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden items-center">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-white hover:bg-white/10 focus:outline-none transition-colors"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-brand-blue/95 border-t border-white/10 px-2 pt-2 pb-4 space-y-1">
          <div className="px-3 py-2 border-b border-white/10 mb-2">
            <div className="text-xs font-bold font-sans uppercase tracking-wider">{username}</div>
            <div className="text-[10px] text-white/70 font-sans uppercase">Administrador</div>
          </div>
          <button
            onClick={() => {
              onChangePasswordClick();
              setMobileMenuOpen(false);
            }}
            className="w-full text-left px-3 py-2 rounded text-xs font-semibold uppercase tracking-wider font-sans text-white hover:bg-white/10 flex items-center space-x-2"
          >
            <KeyRound className="h-4 w-4" />
            <span>Cambiar Contraseña</span>
          </button>
          <button
            onClick={onLogout}
            className="w-full text-left px-3 py-2 rounded text-xs font-semibold uppercase tracking-wider font-sans text-red-300 hover:bg-white/10 flex items-center space-x-2"
          >
            <LogOut className="h-4 w-4" />
            <span>Cerrar Sesión</span>
          </button>
        </div>
      )}
    </nav>
  );
}
