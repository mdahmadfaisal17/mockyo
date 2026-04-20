import { Navigate, Outlet } from "react-router";
import { readAdminSession } from "../imports/adminAuthStore";

export default function AdminRouteGuard() {
  const admin = readAdminSession();

  if (!admin) {
    return <Navigate to="/admin-login" replace />;
  }

  return <Outlet />;
}
