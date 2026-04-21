import { Suspense } from "react";
import { RouterProvider } from "react-router";
import { router } from "./routes";
import PageLoader from "./components/PageLoader";
import ErrorBoundary from "./components/ErrorBoundary";

export default function App() {
  return (
    <ErrorBoundary>
      <Suspense fallback={<PageLoader />}>
        <RouterProvider router={router} />
      </Suspense>
    </ErrorBoundary>
  );
}