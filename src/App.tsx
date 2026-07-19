/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import Login from "./components/Login";
import Navbar from "./components/Navbar";
import Dashboard from "./components/Dashboard";
import { KeyRound, ShieldAlert, CheckCircle, AlertCircle } from "lucide-react";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState("");
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);

  // Password change in-app states
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmNewPass, setConfirmNewPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Sync auth state with sessionStorage
  useEffect(() => {
    const sessionUser = sessionStorage.getItem("auth_user");
    if (sessionUser) {
      setIsAuthenticated(true);
      setCurrentUser(sessionUser);
    }
  }, []);

  const handleLoginSuccess = (username: string) => {
    sessionStorage.setItem("auth_user", username);
    setIsAuthenticated(true);
    setCurrentUser(username);
  };

  const handleLogout = () => {
    sessionStorage.removeItem("auth_user");
    setIsAuthenticated(false);
    setCurrentUser("");
  };

  const handleInAppPasswordChange = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const storedPass = localStorage.getItem("sys_password") || "admin123";

    if (currentPass !== storedPass) {
      setError("La contraseña actual es incorrecta.");
      return;
    }

    if (newPass.length < 6) {
      setError("La nueva contraseña debe tener al menos 6 caracteres.");
      return;
    }

    if (newPass !== confirmNewPass) {
      setError("Las nuevas contraseñas no coinciden.");
      return;
    }

    // Save new password
    localStorage.setItem("sys_password", newPass);
    setSuccess("Contraseña cambiada exitosamente.");
    
    // Clear fields after short delay or instantly
    setCurrentPass("");
    setNewPass("");
    setConfirmNewPass("");

    // Automatically close modal after 1.5s
    setTimeout(() => {
      setShowPasswordChangeModal(false);
      setError(null);
      setSuccess(null);
    }, 1500);
  };

  if (!isAuthenticated) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-white text-brand-dark flex flex-col font-sans">
      {/* Institutional Navbar */}
      <Navbar
        username={currentUser}
        onLogout={handleLogout}
        onChangePasswordClick={() => {
          setShowPasswordChangeModal(true);
          setError(null);
          setSuccess(null);
        }}
      />

      {/* Main Panel / Dashboard */}
      <main className="flex-1">
        <Dashboard />
      </main>

      {/* Footer */}
      <footer className="bg-brand-bg border-t border-brand-border py-6 mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between text-xs text-brand-muted font-sans">
          <p>© 2026 Validador de Afiliaciones - Programa de Integridad de Datos.</p>
          <p className="mt-2 sm:mt-0">Fondo Blanco #FFFFFF | Secciones #F8F9FA | Acento #0F4C81</p>
        </div>
      </footer>

      {/* In-App Password Change Modal */}
      {showPasswordChangeModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl border border-brand-border max-w-sm w-full p-6">
            <h3 className="text-sm font-bold text-brand-dark uppercase border-b border-brand-border pb-3 mb-4 flex items-center">
              <KeyRound className="h-4 w-4 text-brand-blue mr-2" />
              Cambiar Contraseña
            </h3>

            {error && (
              <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-3 rounded-r-md">
                <div className="flex">
                  <AlertCircle className="h-4 w-4 text-red-500 mr-2 shrink-0" />
                  <span className="text-[11px] text-red-700 font-sans">{error}</span>
                </div>
              </div>
            )}

            {success && (
              <div className="mb-4 bg-emerald-50 border-l-4 border-emerald-500 p-3 rounded-r-md">
                <div className="flex">
                  <CheckCircle className="h-4 w-4 text-emerald-500 mr-2 shrink-0" />
                  <span className="text-[11px] text-emerald-700 font-sans">{success}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleInAppPasswordChange} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-brand-muted uppercase mb-1">Contraseña Actual</label>
                <input
                  type="password"
                  required
                  value={currentPass}
                  onChange={(e) => setCurrentPass(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3 py-1.5 border border-brand-border bg-brand-bg rounded-md text-xs focus:outline-none focus:ring-brand-blue focus:border-brand-blue text-brand-dark"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-brand-muted uppercase mb-1">Nueva Contraseña</label>
                <input
                  type="password"
                  required
                  value={newPass}
                  onChange={(e) => setNewPass(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  className="w-full px-3 py-1.5 border border-brand-border bg-brand-bg rounded-md text-xs focus:outline-none focus:ring-brand-blue focus:border-brand-blue text-brand-dark"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-brand-muted uppercase mb-1">Confirmar Nueva Contraseña</label>
                <input
                  type="password"
                  required
                  value={confirmNewPass}
                  onChange={(e) => setConfirmNewPass(e.target.value)}
                  placeholder="Confirmar"
                  className="w-full px-3 py-1.5 border border-brand-border bg-brand-bg rounded-md text-xs focus:outline-none focus:ring-brand-blue focus:border-brand-blue text-brand-dark"
                />
              </div>

              <div className="flex space-x-3 pt-3 border-t border-brand-border">
                <button
                  type="button"
                  onClick={() => setShowPasswordChangeModal(false)}
                  className="w-1/2 bg-brand-bg border border-brand-border text-brand-dark py-1.5 rounded text-xs font-bold uppercase cursor-pointer hover:bg-gray-200 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="w-1/2 bg-brand-blue hover:opacity-90 text-white py-1.5 rounded text-xs font-bold uppercase cursor-pointer transition-opacity"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

