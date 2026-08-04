const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// replace imports
code = code.replace(
  /import CoursesView from ".\/components\/CoursesView";\nimport StudyPlanView from ".\/components\/StudyPlanView";/,
  'import CourseAreaView from "./components/CourseAreaView";'
);

// replace {currentTab === "courses" && ... } and {currentTab === "study_plan" && ... }
const coursesRegex = /\{currentTab === "courses" && \([\s\S]*?\}\s*\}\s*onNavigateTab=\{\(tab\) => setTab\(tab\)\}\s*\/>\s*\)\}/;
const studyPlanRegex = /\{currentTab === "study_plan" && \([\s\S]*?\}\s*\}\s*onNavigateTab=\{\(tab\) => setTab\(tab\)\}\s*\/>\s*<\/div>\s*\)\}/;

code = code.replace(coursesRegex, '');
code = code.replace(studyPlanRegex, `{currentTab === "course" && (
                      <CourseAreaView
                        studentName={studentName}
                        chapterGoals={chapterGoals}
                        setChapterGoals={setChapterGoals}
                        onStartCustomTest={(config) => {
                          setCustomTestConfig(config);
                          setCurrentScreen("lobby");
                        }}
                        onNavigateTab={(tab) => setTab(tab)}
                      />
                    )}`);

fs.writeFileSync('src/App.tsx', code);
console.log("Patched App.tsx");
