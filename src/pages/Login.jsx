import { useState } from "react";
import clinicaBrand from "../assets/clinica-brand.png";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Login() {
  const { login, isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ username: "", password: "", remember: true });
  const [error, setError] = useState(null);

  const redirectTo = location.state?.from?.pathname || "/panel";

  if (isAuthenticated) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError(null);

    const username = form.username.trim();
    const password = form.password;

    if (!username || !password) {
      setError("Ingresa usuario y contraseña");
      return;
    }

    try {
      await login({ username, password, remember: form.remember });
      navigate(redirectTo, { replace: true });
    } catch (exception) {
      const message =
        exception?.payload?.message ||
        exception?.message ||
        "No se pudo iniciar sesión. Verifica tus credenciales.";
      setError(message);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4">
      <div className="w-full max-w-md space-y-6 rounded-2xl bg-white p-8 shadow-xl">
        <header className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Acceso al sistema</h1>
          <img src={clinicaBrand} alt="Clinica Arrupe" className="mx-auto h-32 w-auto" />
          <p className="text-sm text-gray-500">Ingresa tus credenciales para continuar.</p>
        </header>

        <form className="space-y-4" onSubmit={handleSubmit}>
          {error ? <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div> : null}

          <div className="space-y-1">
            <label htmlFor="username" className="text-sm font-medium text-gray-700">
              Usuario
            </label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              value={form.username}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              disabled={isLoading}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium text-gray-700">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={form.password}
              onChange={handleChange}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none"
              disabled={isLoading}
            />
          </div>

          <label className="flex items-center justify-between text-sm text-gray-600">
            <span>Recordar para refrescar token</span>
            <input
              type="checkbox"
              name="remember"
              checked={form.remember}
              onChange={handleChange}
              className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
              disabled={isLoading}
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            disabled={isLoading}
          >
            {isLoading ? "Iniciando sesión..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}

