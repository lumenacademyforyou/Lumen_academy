const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf-8');

// I will just look for {currentTab === "courses" && ( ... )} and {currentTab === "study_plan" && ( ... )}
// using split or safer string replacements

const targetCoursesStart = '{currentTab === "courses" && (';
const targetCoursesEnd = ')}';

const targetStudyPlanStart = '{currentTab === "study_plan" && (';
const targetStudyPlanEnd = ')}';

// This might be tricky. Let's do it manually with regex that captures well.
const blockRegex = /\{currentTab === "courses" && \([\s\S]*?onNavigateTab=\{.*?\}\s*\/>\s*\)\}/;
code = code.replace(blockRegex, '');

const blockRegex2 = /\{currentTab === "study_plan" && \([\s\S]*?onNavigateTab=\{.*?\}\s*\/>\s*<\/div>\s*\)\}/;
code = code.replace(blockRegex2, `{currentTab === "course" && (
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
console.log("Patched App.tsx 2");
