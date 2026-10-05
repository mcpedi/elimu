import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import CardVerification from "./pages/CardVerification";
import SuperAdminSetup from "./pages/SuperAdminSetup";

function Router() {
  // make sure to consider if you need authentication for certain routes
  return (
    <Switch>
      <Route path={"/verify-card"} component={CardVerification} />
      <Route path={"/setup/super-admin"} component={SuperAdminSetup} />
      <Route path={"/"} component={Home} />
      <Route path={"/login"} component={Home} />
      <Route path={"/dashboard"} component={Home} />
      <Route path={"/students"} component={Home} />
      <Route path={"/teachers"} component={Home} />
      <Route path={"/academics"} component={Home} />
      <Route path={"/fees"} component={Home} />
      <Route path={"/attendance"} component={Home} />
      <Route path={"/assignments"} component={Home} />
      <Route path={"/timetable"} component={Home} />
      <Route path={"/reports"} component={Home} />
      <Route path={"/settings"} component={Home} />
      <Route path={"/404"} component={NotFound} />
      {/* Final fallback route */}
      <Route component={NotFound} />
    </Switch>
  );
}

// NOTE: About Theme
// - First choose a default theme according to your design style (dark or light bg), than change color palette in index.css
//   to keep consistent foreground/background color across components
// - If you want to make theme switchable, pass `switchable` ThemeProvider and use `useTheme` hook

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        switchable
      >
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
