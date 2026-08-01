import React from "react";
import {
  Search,
  Bell,
  ChevronDown,
  Flame,
  Target,
  Trophy,
  Calendar,
  BookOpen,
  Play,
  ArrowRight,
  Sparkles,
  TrendingUp,
  TrendingDown,
  FileText,
  BarChart3,
  Bookmark,
  Zap,
  Star,
  Brain,
  Clock,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import Logo from "../../public/logo2.png";
/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface WeakTopic {
  id: number;
  title: string;
  subject: string;
  difficulty: "Hard" | "Medium" | "Easy";
}

interface TestResult {
  id: number;
  name: string;
  date: string;
  score: string;
  accuracy: number;
  rank: string;
  trend: number;
}

interface SubjectProgressItem {
  id: number;
  name: string;
  done: number;
  total: number;
  barColor: string;
  trackColor: string;
}

interface Achievement {
  id: number;
  label: string;
  icon: React.ElementType;
  unlocked: boolean;
  accent: string;
}

/* ------------------------------------------------------------------ */
/*  Sample data — replace with real data from your API / state         */
/* ------------------------------------------------------------------ */

const weakTopics: WeakTopic[] = [
  { id: 1, title: "Nervous System Coordination", subject: "Biology", difficulty: "Hard" },
  { id: 2, title: "Thermodynamics Laws", subject: "Physics", difficulty: "Medium" },
  { id: 3, title: "Organic Reaction Mechanisms", subject: "Chemistry", difficulty: "Hard" },
];

const testResults: TestResult[] = [
  { id: 1, name: "NEET Full Mock #12", date: "Jul 12", score: "680/720", accuracy: 92, rank: "#142", trend: 15 },
  { id: 2, name: "Chemistry Test #5", date: "Jul 10", score: "95/120", accuracy: 84, rank: "#523", trend: 8 },
  { id: 3, name: "Physics Test #8", date: "Jul 8", score: "88/120", accuracy: 76, rank: "#1204", trend: -3 },
  { id: 4, name: "Biology Test #11", date: "Jul 5", score: "112/120", accuracy: 96, rank: "#87", trend: 22 },
  { id: 5, name: "NEET Full Mock #11", date: "Jul 1", score: "665/720", accuracy: 89, rank: "#157", trend: 11 },
];

const subjectProgress: SubjectProgressItem[] = [
  { id: 1, name: "Physics", done: 108, total: 200, barColor: "bg-indigo-500", trackColor: "bg-indigo-100" },
  { id: 2, name: "Chemistry", done: 142, total: 200, barColor: "bg-emerald-500", trackColor: "bg-emerald-100" },
  { id: 3, name: "Biology", done: 136, total: 200, barColor: "bg-pink-500", trackColor: "bg-pink-100" },
];

const achievements: Achievement[] = [
  { id: 1, label: "7-Day Streak", icon: Flame, unlocked: true, accent: "bg-orange-100 text-orange-500" },
  { id: 2, label: "Quick Learner", icon: Zap, unlocked: true, accent: "bg-indigo-100 text-indigo-500" },
  { id: 3, label: "Top Performer", icon: Trophy, unlocked: true, accent: "bg-amber-100 text-amber-500" },
  { id: 4, label: "Perfectionist", icon: Star, unlocked: false, accent: "bg-slate-100 text-slate-300" },
];

/* ------------------------------------------------------------------ */
/*  Small helpers                                                      */
/* ------------------------------------------------------------------ */

function getAccuracyStyle(accuracy: number) {
  if (accuracy >= 90) return "bg-emerald-50 text-emerald-700";
  if (accuracy >= 80) return "bg-amber-50 text-amber-700";
  return "bg-rose-50 text-rose-600";
}

function getDifficultyStyle(difficulty: WeakTopic["difficulty"]) {
  switch (difficulty) {
    case "Hard":
      return "bg-rose-500/20 text-rose-300";
    case "Medium":
      return "bg-amber-500/20 text-amber-300";
    default:
      return "bg-emerald-500/20 text-emerald-300";
  }
}

/* ------------------------------------------------------------------ */
/*  Navbar                                                              */
/* ------------------------------------------------------------------ */

function Navbar() {
  return (
    <header className="flex items-center justify-between gap-4 px-6 py-4">
      <div className="flex items-center gap-2">
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-700 text-sm font-bold text-white">
           <img
      src={Logo}
      alt="Lumen Academy"
      className="h-full w-full object-cover"
    />
        </div>
        <div className="leading-tight">
          <p className="text-sm font-extrabold tracking-tight text-slate-900">LUMEN</p>
          <p className="text-[10px] font-semibold tracking-widest text-slate-400">ACADEMY</p>
        </div>
      </div>

      <button className="hidden items-center gap-1 rounded-full border border-teal-100 bg-teal-50 px-4 py-2 text-sm font-semibold text-teal-800 sm:flex">
        🎓 NEET 2026
        <ChevronDown className="h-4 w-4" />
      </button>

      <div className="flex flex-1 max-w-md items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-400 shadow-sm">
        <Search className="h-4 w-4" />
        <span className="hidden sm:inline">Search topics, chapters...</span>
      </div>

      <div className="flex items-center gap-4">
        <button className="relative flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white">
          <Bell className="h-4 w-4 text-slate-500" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-amber-400" />
        </button>

        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-teal-700 text-sm font-bold text-white">
            D
          </div>
          <div className="hidden leading-tight sm:block">
            <p className="text-sm font-bold text-slate-900">Deepan</p>
            <p className="text-xs text-slate-400">NEET 2026</p>
          </div>
          <ChevronDown className="h-4 w-4 text-slate-400" />
        </div>
      </div>
    </header>
  );
}

/* ------------------------------------------------------------------ */
/*  Hero banner                                                        */
/* ------------------------------------------------------------------ */

function HeroBanner() {
  return (
    <div className="mx-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[#0c2b3a] to-[#17707d] px-8 py-8 text-white shadow-lg">
      <div className="flex flex-col justify-between gap-8 lg:flex-row lg:items-center">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">
            Welcome back, Deepan <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-2 text-sm text-teal-100 sm:text-base">
            Every study session brings you closer to becoming a doctor.
          </p>

          <div className="mt-6 flex flex-wrap gap-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                <Flame className="h-5 w-5 text-orange-300" />
              </div>
              <div>
                <p className="text-sm font-bold">7-Day Streak</p>
                <p className="text-xs text-teal-200">Keep it up!</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                <Target className="h-5 w-5 text-teal-100" />
              </div>
              <div>
                <p className="text-sm font-bold">62% Overall</p>
                <p className="text-xs text-teal-200">248/400 Lessons</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
                <Trophy className="h-5 w-5 text-amber-300" />
              </div>
              <div>
                <p className="text-sm font-bold">Rank #142</p>
                <p className="text-xs text-teal-200">Among 50K students</p>
              </div>
            </div>
          </div>
        </div>

        <div className="w-full max-w-[220px] rounded-2xl bg-white/10 px-6 py-5 text-center backdrop-blur-sm">
          <p className="text-xs font-semibold tracking-widest text-teal-100">NEET 2026</p>
          <p className="mt-1 text-5xl font-extrabold">187</p>
          <p className="mt-1 text-sm text-teal-100">Days Remaining</p>
          <div className="mt-2 flex items-center justify-center gap-1 text-xs text-teal-200">
            <Calendar className="h-3.5 w-3.5" />
            May 3, 2026
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Preparation progress card (with circular progress + next lesson)   */
/* ------------------------------------------------------------------ */

function CircularProgress({ percent }: { percent: number }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative flex h-36 w-36 items-center justify-center">
      <svg width="144" height="144" viewBox="0 0 144 144" className="-rotate-90">
        <circle cx="72" cy="72" r={radius} stroke="#E2E8F0" strokeWidth="12" fill="none" />
        <circle
          cx="72"
          cy="72"
          r={radius}
          stroke="#0f6f7d"
          strokeWidth="12"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-2xl font-extrabold text-slate-900">{percent}%</span>
        <span className="text-xs text-slate-400">Complete</span>
      </div>
    </div>
  );
}

function PreparationCard() {
      const navigate = useNavigate();

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100">
            <BookOpen className="h-5 w-5 text-slate-500" />
          </div>
          <div>
            <p className="text-base font-bold text-slate-900">NEET 2026 Preparation</p>
            <p className="text-sm text-slate-400">Full Syllabus · 400 Lessons</p>
          </div>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
          In Progress
        </span>
      </div>

      <div className="mt-6 flex flex-col items-center gap-6 sm:flex-row sm:items-center">
        <CircularProgress percent={62} />

        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Next Lesson</p>
          <p className="mt-1 text-lg font-bold text-slate-900">Human Physiology</p>
          <p className="text-sm text-slate-400">Chapter 21: Neural Control and Coordination</p>

          <div className="mt-4 grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-slate-400">Done</p>
              <p className="text-sm font-bold text-slate-900">248 / 400</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Completion</p>
              <p className="text-sm font-bold text-slate-900">Mar 15, 2026</p>
            </div>
            <div>
              <p className="text-xs text-slate-400">Remaining</p>
              <p className="text-sm font-bold text-slate-900">~62 hours</p>
            </div>
          </div>

         <button
      onClick={() => navigate("/overview")}
      className="mt-5 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#0c2b3a] to-[#17707d] px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
    >
      <Play className="h-4 w-4" fill="currentColor" />
      Continue Learning
      <ArrowRight className="h-4 w-4" />
    </button>
        </div>
      </div>

      {/* Subject progress mini bars */}
      <div className="mt-6 grid grid-cols-1 gap-4 border-t border-slate-100 pt-6 sm:grid-cols-3">
        {subjectProgress.map((subject) => (
          <div key={subject.id}>
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-700">{subject.name}</span>
              <span className="text-slate-400">
                {subject.done}/{subject.total} topics
              </span>
            </div>
            <div className={`mt-2 h-2 w-full overflow-hidden rounded-full ${subject.trackColor}`}>
              <div
                className={`h-full rounded-full ${subject.barColor}`}
                style={{ width: `${(subject.done / subject.total) * 100}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Stats grid (Lessons / Mock Tests / Study Hours / Avg Score)         */
/* ------------------------------------------------------------------ */

function StatsGrid() {
  const stats = [
    { icon: BookOpen, value: "248", label: "Lessons Done", sub: "of 400 total", subColor: "text-slate-400" },
    { icon: FileText, value: "12", label: "Mock Tests", sub: "All India", subColor: "text-indigo-500" },
    { icon: Clock, value: "156h", label: "Study Hours", sub: "This month", subColor: "text-emerald-500" },
    { icon: BarChart3, value: "78.4%", label: "Avg Score", sub: "+2.3% this week", subColor: "text-amber-500" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {stats.map((stat, i) => (
        <div key={i} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-50">
            <stat.icon className="h-5 w-5 text-slate-500" />
          </div>
          <p className="mt-3 text-2xl font-extrabold text-slate-900">{stat.value}</p>
          <p className="text-sm text-slate-400">{stat.label}</p>
          <p className={`text-xs font-semibold ${stat.subColor}`}>{stat.sub}</p>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Recent Test Performance table                                       */
/* ------------------------------------------------------------------ */

function TrendBadge({ trend }: { trend: number }) {
  const isPositive = trend >= 0;
  const Icon = isPositive ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 text-sm font-semibold ${
        isPositive ? "text-emerald-600" : "text-rose-500"
      }`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2.5} />
      {isPositive ? "+" : ""}
      {trend}
    </span>
  );
}

function RecentTestPerformance() {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Recent Test Performance</h2>
          <p className="text-sm text-slate-400">Last 5 assessments</p>
        </div>
        <button className="flex items-center gap-1 text-sm font-semibold text-teal-700 hover:text-teal-800">
          View all
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[600px] border-collapse text-left">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Test Name</th>
              <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Date</th>
              <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Score</th>
              <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Accuracy</th>
              <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Rank</th>
              <th className="pb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Trend</th>
            </tr>
          </thead>
          <tbody>
            {testResults.map((test, idx) => (
              <tr
                key={test.id}
                className={`transition-colors hover:bg-slate-50 ${
                  idx !== testResults.length - 1 ? "border-b border-slate-100" : ""
                }`}
              >
                <td className="py-4 pr-4 text-sm font-semibold text-slate-900">{test.name}</td>
                <td className="py-4 pr-4 text-sm text-slate-400">{test.date}</td>
                <td className="py-4 pr-4 text-sm font-bold text-slate-900">{test.score}</td>
                <td className="py-4 pr-4">
                  <span
                    className={`inline-block rounded-full px-3 py-1 text-sm font-semibold ${getAccuracyStyle(
                      test.accuracy
                    )}`}
                  >
                    {test.accuracy}%
                  </span>
                </td>
                <td className="py-4 pr-4 text-sm font-bold text-teal-800">{test.rank}</td>
                <td className="py-4">
                  <TrendBadge trend={test.trend} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  AI Recommended card                                                 */
/* ------------------------------------------------------------------ */

function AIRecommended() {
  return (
    <div className="rounded-2xl bg-gradient-to-br from-[#0c2b3a] to-[#123f4d] p-6 text-white shadow-sm">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-amber-300">
        <Sparkles className="h-4 w-4" />
        AI Recommended
      </div>
      <h3 className="mt-2 text-lg font-extrabold">Study These Topics Now</h3>
      <p className="mt-1 text-sm text-teal-100/80">3 weak areas detected in your recent performance</p>

      <div className="mt-5 space-y-3">
        {weakTopics.map((topic) => (
          <div
            key={topic.id}
            className="flex items-center gap-3 rounded-xl bg-white/5 p-3 transition-colors hover:bg-white/10"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10">
              <Brain className="h-4 w-4 text-teal-100" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold">{topic.title}</p>
              <p className="text-xs text-teal-200">{topic.subject}</p>
            </div>
            <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${getDifficultyStyle(topic.difficulty)}`}>
              {topic.difficulty}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Mock test countdown card                                            */
/* ------------------------------------------------------------------ */

function MockTestCountdown() {
  const units = [
    { value: "02", label: "Days" },
    { value: "14", label: "Hours" },
    { value: "32", label: "Mins" },
    { value: "18", label: "Secs" },
  ];
  const tags = ["180 Questions", "720 Marks", "3 Hours", "All Subjects"];

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <h3 className="text-base font-extrabold text-slate-900">NEET Full Mock Test #13</h3>
      <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-400">
        <Calendar className="h-4 w-4" />
        July 20, 2026 · 10:00 AM IST
      </div>

      <div className="mt-5 grid grid-cols-4 gap-2">
        {units.map((unit) => (
          <div key={unit.label} className="rounded-xl bg-slate-100 py-3 text-center">
            <p className="text-xl font-extrabold text-slate-800">{unit.value}</p>
            <p className="text-[11px] text-slate-400">{unit.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span key={tag} className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-700">
            {tag}
          </span>
        ))}
      </div>

      <button className="mt-5 w-full rounded-full bg-gradient-to-r from-[#0c2b3a] to-[#17707d] py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90">
        Prepare Now
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Quick actions                                                       */
/* ------------------------------------------------------------------ */

function QuickActions() {
  const actions = [
    { icon: BookOpen, label: "Continue Course", accent: "bg-indigo-50 text-indigo-500" },
    { icon: FileText, label: "Take Mock Test", accent: "bg-violet-50 text-violet-500" },
    { icon: BarChart3, label: "View Results", accent: "bg-amber-50 text-amber-500" },
    { icon: Bookmark, label: "Study Materials", accent: "bg-pink-50 text-pink-500" },
  ];

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <h3 className="mb-4 text-base font-extrabold text-slate-900">Quick Actions</h3>
      <div className="grid grid-cols-2 gap-3">
        {actions.map((action) => (
          <button
            key={action.label}
            className="flex flex-col items-center gap-2 rounded-xl border border-slate-100 py-5 text-center transition-colors hover:bg-slate-50"
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${action.accent}`}>
              <action.icon className="h-5 w-5" />
            </div>
            <span className="text-sm font-semibold text-slate-700">{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Achievements                                                        */
/* ------------------------------------------------------------------ */

function Achievements() {
  const featured = achievements[0];

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-base font-extrabold text-slate-900">Achievements</h3>
        <span className="text-sm text-slate-400">3 / 8 earned</span>
      </div>

      <div className="flex items-center gap-3 rounded-xl bg-amber-50 p-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-100">
          <Flame className="h-5 w-5 text-orange-500" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-slate-900">7-Day Streak!</p>
          <p className="text-xs text-slate-400">Studied every day this week</p>
        </div>
        <span aria-hidden="true" className="text-xl">🔥</span>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {achievements.map((a) => (
          <div
            key={a.id}
            className={`flex flex-col items-center gap-2 rounded-xl p-3 text-center ${
              a.unlocked ? "bg-slate-50" : "bg-slate-50/50"
            }`}
          >
            <div className={`flex h-10 w-10 items-center justify-center rounded-full ${a.accent}`}>
              <a.icon className="h-5 w-5" />
            </div>
            <span className={`text-[11px] font-semibold leading-tight ${a.unlocked ? "text-slate-700" : "text-slate-300"}`}>
              {a.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Dashboard root                                                      */
/* ------------------------------------------------------------------ */

export default function StudentDashboard() {
  return (
    <div className="min-h-screen bg-[#F7F6F2] pb-10">
      <Navbar />
      <div className="mt-2">
        <HeroBanner />
      </div>

      <div className="mx-6 mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          <PreparationCard />
          <StatsGrid />
          <RecentTestPerformance />
        </div>

        {/* Sidebar column */}
        <div className="space-y-6">
          <AIRecommended />
          <MockTestCountdown />
          <QuickActions />
          <Achievements />
        </div>
      </div>
    </div>
  );
}