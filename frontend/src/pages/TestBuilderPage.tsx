import { useState } from "react";
import { useLocation } from "react-router-dom";
import { ClipboardList, Sparkles } from "lucide-react";
import { PageContainer } from "../components/layout/PageContainer";
import { RecommendedTest } from "../components/study-plan/RecommendedTest";
import { useStudyPlan } from "../hooks/useStudyPlan";
import { useToast } from "../context/ToastContext";
import { NEET_SYLLABUS } from "../data/neetSyllabus";
import { SUBJECT_META } from "../utils/subjectMeta";
import type { SubjectId } from "../types/syllabus";
import type { TestConfig } from "../types/test";

const QUESTION_COUNTS = [10, 20, 30, 50];
const DIFFICULTIES: { id: NonNullable<TestConfig["difficulty"]>; label: string }[] = [
  { id: "easy", label: "Easy" },
  { id: "medium", label: "Medium" },
  { id: "hard", label: "Hard" },
  { id: "mixed", label: "Mixed" },
];

export function TestBuilderPage() {
  const location = useLocation();
  const preconfigured = (location.state as TestConfig | undefined) ?? undefined;
  const { getRecommendedTest } = useStudyPlan();
  const { showToast } = useToast();

  const recommended = !preconfigured ? getRecommendedTest() : null;

  const [subjectId, setSubjectId] = useState<SubjectId>("physics");
  const [chapterId, setChapterId] = useState<string>("");
  const [topicId, setTopicId] = useState<string>("");
  const [questionCount, setQuestionCount] = useState(30);
  const [difficulty, setDifficulty] = useState<TestConfig["difficulty"]>("mixed");

  const subject = NEET_SYLLABUS.find((s) => s.id === subjectId)!;
  const chapter = subject.chapters.find((c) => c.id === chapterId);

  const handleStartTest = (config: TestConfig) => {
    showToast(`Test builder opened${config.chapterName ? ` for ${config.chapterName}` : ""} (demo)`);
  };

  const handleBuildCustom = () => {
    const config: TestConfig = {
      source: "manual",
      subjectId,
      subjectName: SUBJECT_META[subjectId].label,
      chapterId: chapter?.id,
      chapterName: chapter?.name,
      topicId: topicId || undefined,
      topicName: chapter?.topics.find((t) => t.id === topicId)?.name,
      questionCount,
      difficulty,
    };
    handleStartTest(config);
  };

  return (
    <PageContainer>
      <h1 className="text-2xl font-extrabold text-navy">Build Test</h1>
      <p className="mb-6 text-sm text-muted">Configure a test manually, or launch one straight from your study plan.</p>

      {preconfigured && (
        <div className="card mb-6 border-l-4 p-5" style={{ borderLeftColor: SUBJECT_META[preconfigured.subjectId ?? "physics"].color }}>
          <div className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-gold">
            <Sparkles size={14} />
            Recommended from your Study Plan
          </div>
          <p className="text-xs font-bold uppercase tracking-wide" style={{ color: SUBJECT_META[preconfigured.subjectId ?? "physics"].color }}>
            {preconfigured.subjectName}
          </p>
          <p className="mt-0.5 text-base font-bold text-navy-text">{preconfigured.chapterName}</p>
          {preconfigured.topicName && <p className="text-sm text-muted">{preconfigured.topicName}</p>}
          <p className="mt-2 text-sm font-medium text-muted">{preconfigured.questionCount} Questions</p>
          <button type="button" onClick={() => handleStartTest(preconfigured)} className="btn btn-gold mt-4">
            Build Recommended Test
          </button>
        </div>
      )}

      {recommended && (
        <div className="mb-6">
          <RecommendedTest config={recommended} onBuild={() => handleStartTest(recommended)} />
        </div>
      )}

      {(preconfigured || recommended) && (
        <div className="mb-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted">
          <span className="h-px flex-1 bg-border-soft" /> OR <span className="h-px flex-1 bg-border-soft" />
        </div>
      )}

      <div className="card p-5">
        <div className="mb-4 flex items-center gap-2">
          <ClipboardList size={18} className="text-teal" />
          <h2 className="text-base font-bold text-navy">Build Custom Test</h2>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-navy-text" htmlFor="tb-subject">
              Subject
            </label>
            <select
              id="tb-subject"
              value={subjectId}
              onChange={(e) => {
                setSubjectId(e.target.value as SubjectId);
                setChapterId("");
                setTopicId("");
              }}
              className="w-full rounded-md border border-border-soft px-3 py-2.5 text-sm text-navy-text"
            >
              {NEET_SYLLABUS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-navy-text" htmlFor="tb-chapter">
              Chapter <span className="font-normal text-muted">(optional)</span>
            </label>
            <select
              id="tb-chapter"
              value={chapterId}
              onChange={(e) => {
                setChapterId(e.target.value);
                setTopicId("");
              }}
              className="w-full rounded-md border border-border-soft px-3 py-2.5 text-sm text-navy-text"
            >
              <option value="">All chapters</option>
              {subject.modules.map((m) => (
                <optgroup key={m.id} label={m.name}>
                  {m.chapters.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-navy-text" htmlFor="tb-topic">
              Topic <span className="font-normal text-muted">(optional)</span>
            </label>
            <select
              id="tb-topic"
              value={topicId}
              onChange={(e) => setTopicId(e.target.value)}
              disabled={!chapter}
              className="w-full rounded-md border border-border-soft px-3 py-2.5 text-sm text-navy-text disabled:opacity-50"
            >
              <option value="">All topics</option>
              {chapter?.topics.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-navy-text">Difficulty</label>
            <div className="flex flex-wrap gap-2">
              {DIFFICULTIES.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDifficulty(d.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 ${
                    difficulty === d.id ? "border-teal bg-teal text-white" : "border-border-soft bg-white text-navy-text hover:border-teal"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <label className="mb-1.5 block text-sm font-semibold text-navy-text">Question count</label>
          <div className="flex flex-wrap gap-2">
            {QUESTION_COUNTS.map((count) => (
              <button
                key={count}
                type="button"
                onClick={() => setQuestionCount(count)}
                className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-all duration-150 hover:-translate-y-0.5 active:translate-y-0 ${
                  questionCount === count ? "border-teal bg-teal text-white" : "border-border-soft bg-white text-navy-text hover:border-teal"
                }`}
              >
                {count}
              </button>
            ))}
          </div>
        </div>

        <button type="button" onClick={handleBuildCustom} className="btn btn-primary mt-5">
          Build Custom Test
        </button>
      </div>
    </PageContainer>
  );
}
