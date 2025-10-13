import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Forbidden() {
  const { landingRoute } = useAuth();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center space-y-6">
      <div className="text-center space-y-2">
        <p className="text-7xl font-extrabold text-gray-200">403</p>
        <h1 className="text-2xl font-semibold text-gray-900">Acceso restringido</h1>
        <p className="text-sm text-gray-600 max-w-md">
          Tu usuario no cuenta con los permisos necesarios para ver este módulo. Si crees que se trata de un error,
          contacta al administrador del sistema.
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Link
          to={landingRoute || "/panel"}
          className="inline-flex items-center rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Ir a mi inicio
        </Link>
        <Link
          to="/login"
          className="inline-flex items-center rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-100"
        >
          Cambiar de cuenta
        </Link>
      </div>
    </div>
  );
}
