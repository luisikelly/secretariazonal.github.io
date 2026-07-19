/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { Shield, KeyRound, CheckCircle, AlertCircle, Eye, EyeOff, Loader2 } from "lucide-react";
import { googleSignIn } from "../utils/firebaseAuth";
import scoutLogo from "../assets/images/scout_logo.jpg";

interface LoginProps {
  onLoginSuccess: (username: string) => void;
}

export default function Login({ onLoginSuccess }: LoginProps) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Password change form states
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmNewPass, setConfirmNewPass] = useState("");
  
  // Messages and status
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Initialize default credentials if not present
  useEffect(() => {
    if (!localStorage.getItem("sys_username")) {
      localStorage.setItem("sys_username", "admin");
    }
    if (!localStorage.getItem("sys_password")) {
      localStorage.setItem("sys_password", "admin123");
    }
  }, []);

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await googleSignIn();
      if (result) {
        onLoginSuccess(result.user.displayName || result.user.email || "Usuario Google");
      }
    } catch (err: any) {
      console.error("Error signing in with Google:", err);
      setError("Error al iniciar sesión con Google: " + (err.message || err));
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const storedUser = localStorage.getItem("sys_username") || "admin";
    const storedPass = localStorage.getItem("sys_password") || "admin123";

    if (username.trim().toLowerCase() === storedUser.toLowerCase() && password === storedPass) {
      onLoginSuccess(username);
    } else {
      setError("Usuario o contraseña incorrectos. (Demo: admin / admin123)");
    }
  };

  const handlePasswordChangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

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
    setSuccessMsg("Contraseña modificada con éxito. Ya puedes iniciar sesión.");
    setIsChangingPassword(false);
    
    // Clear fields
    setCurrentPass("");
    setNewPass("");
    setConfirmNewPass("");
    setPassword(""); // Clear password input
  };

  return (
    <div id="login-container" className="min-h-screen bg-brand-bg flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="h-24 w-24 rounded-full bg-white flex items-center justify-center shadow-md border border-brand-border p-1">
            <img 
              src={scoutLogo} 
              alt="Logo Secretaría Zonal" 
              className="h-20 w-20 object-contain rounded-full"
              referrerPolicy="no-referrer"
            />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-fredoka font-bold tracking-tight text-brand-blue uppercase">
          Asistente Secretaría Zonal
        </h2>
        <p className="mt-2 text-center text-sm text-brand-muted font-sans font-medium">
          Validación de datos de autorizaciones
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-sm rounded-lg sm:px-10 border border-brand-border">
          
          {/* Status Alerts */}
          {error && (
            <div className="mb-4 bg-red-50 border-l-4 border-red-500 p-4 rounded-r-md">
              <div className="flex">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2 shrink-0" />
                <span className="text-sm text-red-700 font-sans font-medium">{error}</span>
              </div>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-r-md">
              <div className="flex">
                <CheckCircle className="h-5 w-5 text-emerald-500 mr-2 shrink-0" />
                <span className="text-sm text-emerald-700 font-sans font-medium">{successMsg}</span>
              </div>
            </div>
          )}

          {/* LOGIN FORM */}
          {!isChangingPassword ? (
            <div className="space-y-6">
              {/* Primary Google Login Button */}
              <div>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full flex justify-center items-center py-3 px-4 border border-brand-border rounded-md shadow-sm text-sm font-bold text-brand-dark bg-white hover:bg-gray-50 focus:outline-none transition-colors uppercase font-sans tracking-wider cursor-pointer space-x-3"
                >
                  {loading ? (
                    <Loader2 className="h-5 w-5 animate-spin text-brand-blue" />
                  ) : (
                    <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
                      <path fill="#EA4335" d="M12 5.04c1.65 0 3.13.57 4.3 1.69l3.21-3.21C17.56 1.83 14.99 1 12 1 7.35 1 3.41 3.67 1.48 7.56l3.87 3a6.99 6.99 0 0 1 6.65-5.52z"/>
                      <path fill="#4285F4" d="M23.49 12.27c0-.81-.07-1.59-.2-2.35H12v4.51h6.43a5.52 5.52 0 0 1-2.4 3.63l3.72 2.89c2.18-2 3.74-4.96 3.74-8.68z"/>
                      <path fill="#FBBC05" d="M5.35 14.56A7.05 7.05 0 0 1 5 12c0-.89.15-1.74.43-2.54l-3.87-3A11.95 11.95 0 0 0 0 12c0 2.01.5 3.91 1.4 5.61l3.95-3.05z"/>
                      <path fill="#34A853" d="M12 23c3.24 0 5.97-1.07 7.96-2.91l-3.72-2.89a6.98 6.98 0 0 1-4.24 1.2c-3.66 0-6.77-2.47-7.88-5.8l-3.95 3.05C2.18 19.89 6.7 23 12 23z"/>
                    </svg>
                  )}
                  <span>Iniciar Sesión con Google</span>
                </button>
              </div>

              {/* Divider */}
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-brand-border"></div>
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-white px-3 text-brand-muted font-sans font-semibold">O continuar con</span>
                </div>
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-6">
                <div>
                  <label htmlFor="username" className="block text-xs font-semibold text-brand-muted uppercase tracking-wider font-sans">
                    Usuario
                  </label>
                  <div className="mt-1">
                    <input
                      id="username"
                      name="username"
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="admin@aga.org.ar"
                      className="appearance-none block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand-blue focus:border-brand-blue sm:text-sm font-sans"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="password" className="block text-xs font-semibold text-brand-muted uppercase tracking-wider font-sans">
                    Contraseña
                  </label>
                  <div className="mt-1 relative">
                    <input
                      id="password"
                      name="password"
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="appearance-none block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand-blue focus:border-brand-blue sm:text-sm font-sans"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <button
                    type="submit"
                    className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-white bg-brand-blue/90 hover:bg-brand-blue focus:outline-none transition-colors uppercase font-sans tracking-wider cursor-pointer"
                  >
                    Iniciar Sesión con Contraseña
                  </button>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-brand-border">
                  <button
                    type="button"
                    onClick={() => {
                      setIsChangingPassword(true);
                      setError(null);
                      setSuccessMsg(null);
                    }}
                    className="text-xs font-semibold text-brand-blue hover:underline transition-colors font-sans flex items-center cursor-pointer"
                  >
                    <KeyRound className="h-3 w-3 mr-1" />
                    ¿Modificar contraseña?
                  </button>
                  <span className="text-xs text-brand-muted font-sans font-medium">
                    Demo: admin / admin123
                  </span>
                </div>
              </form>
            </div>
          ) : (
            /* CHANGE PASSWORD FORM */
            <form onSubmit={handlePasswordChangeSubmit} className="space-y-6">
              <h3 className="text-lg font-fredoka font-bold text-brand-dark border-b border-brand-border pb-2 flex items-center uppercase tracking-wide">
                <KeyRound className="h-5 w-5 text-brand-blue mr-2" />
                Modificar Contraseña
              </h3>

              <div>
                <label htmlFor="currentPass" className="block text-xs font-semibold text-brand-muted uppercase tracking-wider font-sans">
                  Contraseña Actual
                </label>
                <div className="mt-1">
                  <input
                    id="currentPass"
                    type="password"
                    required
                    value={currentPass}
                    onChange={(e) => setCurrentPass(e.target.value)}
                    placeholder="••••••••"
                    className="appearance-none block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand-blue focus:border-brand-blue sm:text-sm font-sans"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="newPass" className="block text-xs font-semibold text-brand-muted uppercase tracking-wider font-sans">
                  Nueva Contraseña
                </label>
                <div className="mt-1">
                  <input
                    id="newPass"
                    type="password"
                    required
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="appearance-none block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand-blue focus:border-brand-blue sm:text-sm font-sans"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirmNewPass" className="block text-xs font-semibold text-brand-muted uppercase tracking-wider font-sans">
                  Confirmar Nueva Contraseña
                </label>
                <div className="mt-1">
                  <input
                    id="confirmNewPass"
                    type="password"
                    required
                    value={confirmNewPass}
                    onChange={(e) => setConfirmNewPass(e.target.value)}
                    placeholder="Confirmar"
                    className="appearance-none block w-full px-3 py-2 border border-brand-border rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-brand-blue focus:border-brand-blue sm:text-sm font-sans"
                  />
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsChangingPassword(false);
                    setError(null);
                    setSuccessMsg(null);
                  }}
                  className="w-1/2 flex justify-center py-2 px-4 border border-brand-border rounded-md shadow-sm text-sm font-semibold text-brand-dark bg-brand-bg hover:bg-gray-200 transition-colors uppercase font-sans tracking-wider cursor-pointer"
                >
                  Volver
                </button>
                <button
                  type="submit"
                  className="w-1/2 flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-semibold text-white bg-brand-blue hover:opacity-90 transition-opacity uppercase font-sans tracking-wider cursor-pointer"
                >
                  Guardar
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
