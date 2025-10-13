import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function ProtectedRoute({ required = [], requireAny = [], children }) {
  const { isAuthenticated, isLoading, hasAllPermissions, hasAnyPermissions } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex min-h-[16rem] items-center justify-center">
        <div className="rounded-xl bg-white px-4 py-2 text-sm text-gray-600 shadow">
          Verificando permisos...
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (required && required.length > 0 && !hasAllPermissions(required)) {
    return <Navigate to="/403" replace state={{ from: location }} />;
  }

  if (requireAny && requireAny.length > 0 && !hasAnyPermissions(requireAny)) {
    return <Navigate to="/403" replace state={{ from: location }} />;
  }

  return children;
}
