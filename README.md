# Lumen Academy

Lumen Academy is a comprehensive, single-page web application designed for students preparing for competitive exams like NEET, JEE Mains, JEE Advanced, and Olympiads. The platform provides a focused environment for taking mock tests, reviewing performance, and accessing study materials.

## Features & Functionalities

- **Targeted Exam Preparation:** Select from streams like NEET Aspirant, NEET Repeaters, JEE Mains, JEE Advanced, and Olympiad.
- **Mock Tests & Evaluations:** A dedicated test-taking interface with a timer and question navigation, followed by an evaluation view that reviews attempted answers.
- **Study Plans & Course Area:** Access syllabus units, structured study materials, and track completion progress.
- **Interactive Dashboard:** View analytics, recent attempts, and overall performance metrics.
- **Authentication:** Integrated Google Sign-In via Firebase Auth, alongside a "Demo Account" for quick access and a basic Admin Portal interface.
- **Responsive Design & Dark Mode:** A fully responsive UI that seamlessly toggles between light and dark themes using a refined color palette.

## Technology Stack

- **Frontend Framework:** React 19 + TypeScript
- **Build Tool:** Vite 6
- **Styling:** Tailwind CSS v4 (CSS-first configuration)
- **Animations:** `motion` (Framer Motion) for smooth UI transitions and route animations
- **Icons:** `lucide-react`
- **Authentication:** Firebase Authentication (Google Auth)
- **State Management:** React `useState` and conditional rendering for a single state machine architecture
- **AI Integration:** `@google/genai` for AI-assisted study plans and evaluation feedback

## Architecture Note

The application operates as a single state machine housed in `src/frontend/App.tsx`. Screen transitions are managed purely through conditional rendering based on state variables (`currentScreen`, `currentTab`, `isAuthenticated`, `isAdmin`), purposefully avoiding complex routing libraries to maintain strict architectural boundaries.
