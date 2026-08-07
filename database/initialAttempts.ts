import { TestAttempt } from "../types";

export const INITIAL_ATTEMPTS: TestAttempt[] = [
  {
    id: "mock_04",
    title: "NEET Full Syllabus Mock 04",
    date: "2026-07-15",
    totalScore: 580,
    accuracy: 94,
    percentile: 88.4,
    correctAnswers: 148,
    incorrectAnswers: 12,
    skippedAnswers: 20,
    timeTakenMinutes: 164,
    averageTimePerQuestionSeconds: 54,
    questionTimeData: [
      { questionId: 1, subject: "Physics", timeSpentSeconds: 120 },
      { questionId: 2, subject: "Physics", timeSpentSeconds: 110 },
      { questionId: 3, subject: "Biology", timeSpentSeconds: 40 },
      { questionId: 4, subject: "Chemistry", timeSpentSeconds: 65 }
    ],
    subjectBreakdown: {
      Physics: { score: 88, growth: 12.4, status: "Strong" },
      Chemistry: { score: 76, growth: 5.2, status: "Average" },
      Biology: { score: 92, growth: 2.1, status: "Expert" }
    },
    aiRecommendation: {
      topics: ["Inorganic Chemistry", "Rotational Mechanics"],
      potentialGain: 15,
      focusAreas: [
        { topic: "p-Block Elements", level: "Critical" },
        { topic: "Circular Motion", level: "Improvement" },
        { topic: "Genetics Basics", level: "Done" }
      ]
    },
    laggingTopics: [
      {
        topic: "XeF4 Hybridization & Geometry",
        unit: "p-Block & Inorganic Chemistry",
        subject: "Chemistry",
        accuracy: 45,
        negativeMarksLost: 8,
        conceptGap: "Confused steric number calculation with lone pair distribution in Xenon noble gas fluorides.",
        improvementSteps: [
          "Recalculate steric number: V (8) + M (4) / 2 = 6 -> sp3d2 hybridization.",
          "Note 2 lone pairs occupy axial positions, yielding square planar geometry.",
          "Solve 10 practice questions on noble gas compounds."
        ],
        ncertReference: {
          book: "NCERT Class 12 Chemistry Vol 1",
          chapter: "Chapter 7: The p-Block Elements",
          pages: "Pages 207 - 209 (Section 7.21 Group 18)",
          keyLines: "XeF4 has sp3d2 hybridization with square planar geometry (2 lone pairs & 4 bond pairs)."
        }
      },
      {
        topic: "Wurtz Reaction Intermediate",
        unit: "Organic Chemistry - Reactions",
        subject: "Chemistry",
        accuracy: 50,
        negativeMarksLost: 4,
        conceptGap: "Misidentified carbocation intermediate instead of free-radical mechanism in sodium/dry ether coupling.",
        improvementSteps: [
          "Review organometallic free radical generation in alkyl halide reactions.",
          "Memorize side reactions (disproportionation yielding alkanes and alkenes)."
        ],
        ncertReference: {
          book: "NCERT Class 12 Chemistry Vol 2",
          chapter: "Chapter 10: Haloalkanes & Haloarenes",
          pages: "Page 311 (Reaction with Metals)",
          keyLines: "R-X + 2Na + X-R → R-R + 2NaX via free radical mechanism in dry ether."
        }
      },
      {
        topic: "Solid vs Hollow Sphere Acceleration",
        unit: "Rotational Dynamics & Mechanics",
        subject: "Physics",
        accuracy: 55,
        negativeMarksLost: 4,
        conceptGap: "Mistook hollow sphere's moment of inertia as smaller than solid sphere.",
        improvementSteps: [
          "Compare Moment of Inertia: Solid Sphere = (2/5) MR² = 0.4 MR², Hollow Sphere = (2/3) MR² = 0.67 MR².",
          "Formula for rolling acceleration: a = g sinθ / (1 + I / MR²). Lower I gives higher acceleration down incline."
        ],
        ncertReference: {
          book: "NCERT Class 11 Physics Part 1",
          chapter: "Chapter 7: System of Particles & Rotational Motion",
          pages: "Pages 178 - 182 (Section 7.14 Pure Rolling)",
          keyLines: "Acceleration in pure rolling down an incline is inversely proportional to (1 + k²/R²)."
        }
      }
    ]
  },
  {
    id: "mock_05",
    title: "NEET Full Syllabus Mock 05 (720 Marks)",
    date: "Available",
    totalScore: 0,
    accuracy: 0,
    percentile: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    skippedAnswers: 0,
    timeTakenMinutes: 0,
    averageTimePerQuestionSeconds: 0,
    questionTimeData: [],
    subjectBreakdown: {
      Physics: { score: 0, growth: 0, status: "Average" },
      Chemistry: { score: 0, growth: 0, status: "Average" },
      Biology: { score: 0, growth: 0, status: "Average" }
    },
    aiRecommendation: {
      topics: ["Complete Syllabus"],
      potentialGain: 85,
      focusAreas: [
        { topic: "Time Management", level: "Critical" },
        { topic: "Physics Problem Solving Speed", level: "Improvement" }
      ]
    },
    laggingTopics: []
  },
  {
    id: "mock_08",
    title: "NEET Chemistry Mini-Mock #08",
    date: "Available",
    totalScore: 0,
    accuracy: 0,
    percentile: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    skippedAnswers: 0,
    timeTakenMinutes: 0,
    averageTimePerQuestionSeconds: 0,
    questionTimeData: [],
    subjectBreakdown: {
      Physics: { score: 0, growth: 0, status: "Average" },
      Chemistry: { score: 0, growth: 0, status: "Average" },
      Biology: { score: 0, growth: 0, status: "Average" }
    },
    aiRecommendation: {
      topics: ["p-Block Elements", "Periodic Trends"],
      potentialGain: 15,
      focusAreas: [
        { topic: "p-Block Exceptions", level: "Critical" }
      ]
    },
    laggingTopics: []
  },
  {
    id: "mock_12",
    title: "NEET Biology Mini-Mock #12",
    date: "Available",
    totalScore: 0,
    accuracy: 0,
    percentile: 0,
    correctAnswers: 0,
    incorrectAnswers: 0,
    skippedAnswers: 0,
    timeTakenMinutes: 0,
    subjectBreakdown: {
      Physics: { score: 0, growth: 0, status: "Average" },
      Chemistry: { score: 0, growth: 0, status: "Average" },
      Biology: { score: 0, growth: 0, status: "Average" }
    },
    aiRecommendation: {
      topics: ["Genetics", "Evolution", "Ecology"],
      potentialGain: 20,
      focusAreas: [
        { topic: "Genetic Translation", level: "Critical" },
        { topic: "DNA Replication Fork", level: "Improvement" },
        { topic: "Hardy-Weinberg Principle", level: "Critical" }
      ]
    },
    laggingTopics: [
      {
        topic: "Hardy-Weinberg Heterozygote Frequency (2pq)",
        unit: "Genetics & Evolution",
        subject: "Biology",
        accuracy: 40,
        negativeMarksLost: 4,
        conceptGap: "Confused p² (homozygous dominant) with 2pq (heterozygous carrier frequency).",
        improvementSteps: [
          "Remember the binomial expansion equation: p² + 2pq + q² = 1.",
          "Practice calculating carrier frequencies when recessive phenotype frequency q² is given."
        ],
        ncertReference: {
          book: "NCERT Class 12 Biology",
          chapter: "Chapter 7: Evolution",
          pages: "Pages 136 - 137 (Hardy-Weinberg Equilibrium)",
          keyLines: "Frequency of allele p and q in a population remains constant; 2pq represents frequency of heterozygous individuals."
        }
      }
    ]
  }
];
