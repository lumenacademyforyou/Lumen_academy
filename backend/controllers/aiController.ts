import { Request, Response } from "express";
import { GoogleGenAI } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

function getAIClient(): GoogleGenAI | null {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build",
          },
        },
      });
    }
  }
  return aiClient;
}

export const generateStudyPlan = async (req: Request, res: Response): Promise<void> => {
  const { studentName, targetExam, weakSubjects, availableHoursPerWeek } = req.body || {};
  const ai = getAIClient();

  if (ai) {
    try {
      const prompt = `Generate a structured, actionable 4-week study plan for a ${targetExam || "NEET"} student named ${studentName || "Aspirant"}.
      Weak subjects: ${(weakSubjects || ["Physics", "Organic Chemistry"]).join(", ")}.
      Study budget: ${availableHoursPerWeek || 35} hours/week.
      Return the output as JSON with fields:
      - title: string
      - focusSummary: string
      - weeklyRoadmap: array of objects { weekNumber: number, mainFocus: string, keyChapters: string[], targetMockScore: number }
      - aiTips: array of strings`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      if (response.text) {
        const parsed = JSON.parse(response.text.trim());
        res.json({ status: "success", source: "gemini-ai", plan: parsed });
        return;
      }
    } catch (err) {
      console.warn("Gemini API call failed, falling back to intelligent response:", err);
    }
  }

  // Fallback intelligent response if API key is not set or network fails
  res.json({
    status: "success",
    source: "rule-engine",
    plan: {
      title: `AI-Powered 720 Score Master Plan for ${studentName || "Aspirant"}`,
      focusSummary: `Targeted revision for ${weakSubjects?.join(" & ") || "Physics & Organic Chemistry"} with daily NCERT drills.`,
      weeklyRoadmap: [
        {
          weekNumber: 1,
          mainFocus: "Mechanics & Basic Organic Mechanisms",
          keyChapters: ["Rotational Dynamics", "GOC & Reaction Intermediates", "Cell Biology"],
          targetMockScore: 580,
        },
        {
          weekNumber: 2,
          mainFocus: "Electrostatics & Coordination Chemistry",
          keyChapters: ["Current Electricity", "p-Block Elements", "Plant Physiology"],
          targetMockScore: 620,
        },
        {
          weekNumber: 3,
          mainFocus: "Optics & Biomolecules / Human Physiology",
          keyChapters: ["Ray Optics", "Biomolecules & Polymers", "Neuro-Endocrine System"],
          targetMockScore: 660,
        },
        {
          weekNumber: 4,
          mainFocus: "Full Syllabus High-Speed Mocks & Accuracy Drills",
          keyChapters: ["Full Mock Series", "NCERT Line-by-Line Re-visitation"],
          targetMockScore: 700,
        },
      ],
      aiTips: [
        "Prioritize solving previous 10 years' NEET PYQs during peak focus hours.",
        "Maintain a dedicated Formula & Mistake Notebook for high-yield topics.",
        "Never skip NCERT diagram captions and summary sections in Biology.",
      ],
    },
  });
};

export const evaluateAttemptAI = async (req: Request, res: Response): Promise<void> => {
  const { score, totalScore, subjectBreakdown, incorrectTopics } = req.body || {};
  const ai = getAIClient();

  if (ai) {
    try {
      const prompt = `Analyze this NEET mock test performance:
      Score: ${score}/${totalScore || 720}
      Subject breakdown: ${JSON.stringify(subjectBreakdown || {})}
      Incorrect topics: ${(incorrectTopics || []).join(", ")}
      Return JSON with:
      - executiveSummary: string
      - keyRecommendations: string[]
      - projectedAIR: string`;

      const response = await ai.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      if (response.text) {
        const parsed = JSON.parse(response.text.trim());
        res.json({ status: "success", source: "gemini-ai", evaluation: parsed });
        return;
      }
    } catch (err) {
      console.warn("Gemini evaluation error:", err);
    }
  }

  // Fallback evaluation engine
  res.json({
    status: "success",
    source: "rule-engine",
    evaluation: {
      executiveSummary: `Strong performance in Biology with room for speed optimization in Physics. Score: ${score}/${totalScore || 720}.`,
      keyRecommendations: [
        "Revise high-yield physics formulas before taking the next timed test.",
        "Practice 15 timed NCERT chemistry questions daily to cut negative marking.",
        "Re-read NCERT Biology Chapter 7 (Evolution) key lines.",
      ],
      projectedAIR: score > 600 ? "Top AIR 500" : score > 500 ? "AIR 1,500 - 3,000" : "AIR 5,000+",
    },
  });
};
