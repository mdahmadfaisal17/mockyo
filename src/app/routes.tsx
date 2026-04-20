import { lazy } from "react";
import { createBrowserRouter } from "react-router";
import Layout from "./components/Layout";

// Eagerly load the landing page for instant first paint
import Home from "./pages/Home";

// Lazy-load every other route so the initial bundle stays small
const Mockups = lazy(() => import("./pages/Mockups"));
const ProductDetails = lazy(() => import("./pages/ProductDetails"));
const Editor = lazy(() => import("./pages/Editor"));
const Login = lazy(() => import("./pages/Login"));
const SignUp = lazy(() => import("./pages/SignUp"));
const Contact = lazy(() => import("./pages/Contact"));
const Reviews = lazy(() => import("./pages/Reviews"));
const AccountSettings = lazy(() => import("./pages/AccountSettings"));
const PrivacyPolicy = lazy(() => import("./pages/PrivacyPolicy"));
const TermsConditions = lazy(() => import("./pages/TermsConditions"));
const VerifyEmail = lazy(() => import("./pages/VerifyEmail"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const HelpCenter = lazy(() => import("./pages/HelpCenter"));
const Admin = lazy(() => import("./pages/Admin"));
const AdminLogin = lazy(() => import("./pages/AdminLogin"));
const AdminRouteGuard = lazy(() => import("./components/AdminRouteGuard"));
const NotFound = lazy(() => import("./pages/NotFound"));

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Layout,
    children: [
      { index: true, Component: Home },
      { path: "mockups", Component: Mockups },
      { path: "mockups/:id", Component: ProductDetails },
      { path: "editor", Component: Editor },
      { path: "editor/:id", Component: Editor },
      { path: "login", Component: Login },
      { path: "signup", Component: SignUp },
      { path: "account-settings", Component: AccountSettings },
      { path: "contact", Component: Contact },
      { path: "reviews", Component: Reviews },
      { path: "privacy-policy", Component: PrivacyPolicy },
      { path: "terms-conditions", Component: TermsConditions },
      { path: "verify-email", Component: VerifyEmail },
      { path: "reset-password", Component: ResetPassword },
      { path: "help-center", Component: HelpCenter },
      { path: "*", Component: NotFound },
    ],
  },
  {
    path: "/admin",
    Component: AdminRouteGuard,
    children: [{ index: true, Component: Admin }],
  },
  {
    path: "/admin-login",
    Component: AdminLogin,
  },
]);
