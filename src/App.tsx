import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { StudyPlanProvider } from "./context/StudyPlanContext";
import { ToastProvider } from "./context/ToastContext";
import { ConsoleHeader } from "./components/layout/ConsoleHeader";
import { OverviewPage } from "./pages/OverviewPage";
import { StudyPlanPage } from "./pages/StudyPlanPage";
import { SyllabusPage } from "./pages/SyllabusPage";
import { TestBuilderPage } from "./pages/TestBuilderPage";
import { ResultsPage } from "./pages/ResultsPage";
import { TestHistoryPage } from "./pages/TestHistoryPage";

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <StudyPlanProvider>
          <div className="min-h-screen bg-ivory">
            <ConsoleHeader />
            <Routes>
              <Route path="/" element={<Navigate to="/overview" replace />} />
              <Route path="/overview" element={<OverviewPage />} />
              <Route path="/study-plan/*" element={<StudyPlanPage />} />
              <Route path="/syllabus/*" element={<SyllabusPage />} />
              <Route path="/build-test" element={<TestBuilderPage />} />
              <Route path="/results" element={<ResultsPage />} />
              <Route path="/test-history" element={<TestHistoryPage />} />
              <Route path="*" element={<Navigate to="/overview" replace />} />
            </Routes>
          </div>
        </StudyPlanProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
