import { useState, useCallback } from 'react';
import { callClaudeRaw } from '@/api/claudeClient';
import type { AnalysisSlide, SkillId } from '@/types';

// ─── Shared rules appended to every prompt ────────────────────────────────────

const SHARED_RULES = `
General rules (apply to every slide):
- Return ONLY valid JSON - no markdown fences, no explanation, just the raw JSON object.
- Never include markdown syntax (**, ##, _, etc.) inside any JSON string value.
- Keep all text extremely concise - this is read on a mobile screen.
- Every bullet must be under 12 words and open with a strong noun or verb.
- Omit optional fields entirely if not needed for that slide type.
- The "metrics" type supports up to 4 metric cards arranged in a 2×2 grid.
- Score emojis (🟢 🟡 🔴) are allowed inside value fields for scorecards.

JSON schema:
{
  "title": "<2–4 word title naming the subject>",
  "slides": [
    {
      "type": "cover" | "section" | "bullets" | "metrics" | "summary",
      "title": "<string>",
      "subtitle": "<string, optional>",
      "badge": "<string, optional - section label or phase name>",
      "bullets": ["<string under 12 words>"],
      "metrics": [{"label": "<string>", "value": "<string>", "note": "<string, optional>"}]
    }
  ]
}`;

// ─── ETF Analyzer (MACE) ──────────────────────────────────────────────────────

const ETF_SLIDE_PROMPT = `You convert ETF analyses (MACE framework) into mobile presentation slides.

Build exactly this slide sequence, in this order:

Slide 1 - type "cover"
  title: the ETF ticker (e.g. "VOO")
  subtitle: one crisp sentence - the overall verdict on this ETF's construction quality

Slide 2 - type "bullets", badge "TL;DR", title "At a Glance"
  4–5 bullets capturing the most important findings across all four MACE dimensions.
  Each bullet names the dimension it refers to and gives the key insight.

Slide 3 - type "metrics", title "MACE Scorecard"
  Exactly 4 metrics, one per MACE dimension:
  label = dimension name (Mandate / Assets / Composition / Expense)
  value = the score emoji from the analysis (🟢 / 🟡 / 🔴)
  note = the one-phrase descriptor from the analysis (e.g. "Clear & durable")

Slide 4 - type "bullets", badge "M - Mandate"
  title: what the fund tracks (e.g. "Tracks the S&P 500")
  3–4 bullets: mandate clarity, index tracked, passive vs active, any drift risks

Slide 5 - type "metrics", badge "A - Assets"
  title: "Fund Scale"
  Include total assets figure as one metric. Fill remaining slots with other relevant fund-size data points (bid-ask spread quality, institutional adoption, closure risk indicator).

Slide 6 - type "bullets", badge "C - Composition"
  title: "What You Actually Own"
  3–5 bullets: top holdings by name/weight, sector concentration, any flags raised

Slide 7 - type "metrics", badge "E - Expense"
  title: "Cost Analysis"
  metrics: expense ratio, category average, cost gap or advantage

Slide 8 - type "summary", title "Key Takeaways"
  3–5 bullets: final verdict, strongest dimension, weakest dimension, key educational insight

${SHARED_RULES}`;

// ─── Portfolio Reviewer (Four-Dimension) ─────────────────────────────────────

const PORTFOLIO_SLIDE_PROMPT = `You convert portfolio reviews (Four-Dimension framework) into mobile presentation slides.

Build exactly this slide sequence, in this order:

Slide 1 - type "cover"
  title: "Portfolio Review"
  subtitle: one crisp sentence - the overall health assessment of this portfolio

Slide 2 - type "bullets", badge "TL;DR", title "At a Glance"
  4–5 bullets capturing the most critical findings. Each bullet names the dimension it addresses and gives the headline finding. Include the overall score.

Slide 3 - type "metrics", title "Four-Dimension Scorecard"
  Exactly 4 metrics, one per dimension:
  label = dimension name (Overlap & Concentration / Allocation vs Goal / Diversification Health / Internal Consistency)
  value = score emoji (🟢 / 🟡 / 🔴)
  note = the one-phrase descriptor from the analysis

Slide 4 - type "bullets", badge "Dimension 1"
  title: "Overlap & Concentration"
  3–5 bullets: specific overlapping stocks named, effective exposure percentages, any single-stock concentration flags

Slide 5 - type "metrics", badge "Dimension 2"
  title: "Allocation vs Goal"
  metrics: equity %, bond %, cash % (or geographic splits if more relevant). Use actual figures from the analysis.

Slide 6 - type "bullets", badge "Dimension 3"
  title: "Diversification Health"
  3–4 bullets: sector gaps, geographic gaps, factor exposure issues

Slide 7 - type "bullets", badge "Dimension 4"
  title: "Internal Consistency"
  3–4 bullets: any contradictions, duplicate exposures, tensions between holdings

Slide 8 - type "summary", title "Key Takeaways"
  3–5 bullets: overall verdict, most important structural issue, strongest aspect, one educational insight

${SHARED_RULES}`;

// ─── Stock Researcher (8-Phase) ───────────────────────────────────────────────

const STOCK_SLIDE_PROMPT = `You convert 8-phase stock research reports into mobile presentation slides.

Build exactly this slide sequence, in this order:

Slide 1 - type "cover"
  title: the company name or ticker
  subtitle: the Signal Rating from the report (e.g. "🟢🟢🟢 Strong Research Case") plus a one-line description of what the company does

Slide 2 - type "bullets", badge "TL;DR", title "Investment Thesis"
  This is the most important slide. Include:
  - The Signal Rating as the first bullet (e.g. "🟢🟢🟢 Strong Research Case - moat 4/5, undervalued")
  - The 3-sentence investment thesis condensed to 3 tight bullets (what it is / the opportunity / what needs to be true)
  - The single most important risk in the final bullet

Slide 3 - type "bullets", badge "Phase 1–2"
  title: "Business & Industry"
  4–5 bullets: what the company sells, primary revenue source, where the industry is in its cycle, key structural dynamics

Slide 4 - type "bullets", badge "Phase 3"
  title: "How It Makes Money"
  3–4 bullets: profit engine, pricing power evidence, recurring vs one-time revenue

Slide 5 - type "metrics", badge "Phase 4"
  title: "Financial Quality"
  4 metrics with key financial figures from the report - prioritise: revenue CAGR, ROIC or ROE, gross margin, OCF/NI ratio (or FCF margin). Use actual numbers from the analysis.

Slide 6 - type "bullets", badge "Phase 5–6"
  title: "Governance & Sentiment"
  4–5 bullets: insider ownership, capital allocation quality, the bull case in one bullet, the bear case in one bullet

Slide 7 - type "metrics", badge "Phase 7"
  title: "Valuation & Moat"
  4 metrics: moat score (e.g. "4 / 5"), current PE or EV/EBITDA, implied growth rate from reverse DCF, margin of safety % (or valuation vs historical average)

Slide 8 - type "bullets", badge "Phase 8"
  title: "Risks & What to Watch"
  3 risk bullets + 2–3 monitoring checklist bullets (specific metrics or events to track)

Slide 9 - type "summary", title "Research Verdict"
  3–5 bullets: signal rating, core thesis, biggest risk, one key metric to monitor

${SHARED_RULES}`;

// ─── Market Catalyst Scanner (Five-Category) ─────────────────────────────────

const CATALYST_SLIDE_PROMPT = `You convert market catalyst analyses (Five-Category framework) into mobile presentation slides.

Build exactly this slide sequence, in this order:

Slide 1 - type "cover"
  title: the event or topic being analysed (keep it short - 3–5 words)
  subtitle: the primary category classification + one-line implication (e.g. "Policy & Regulatory Shift · Medium-term horizon")

Slide 2 - type "bullets", badge "TL;DR", title "At a Glance"
  4–5 bullets: primary category, duration, confidence level, the single most important implication, and what indicator to watch first

Slide 3 - type "metrics", title "Catalyst Profile"
  4 metrics:
  - label "Category", value = the primary category name
  - label "Duration", value = Short / Medium / Long-term
  - label "Confidence", value = 🟢 / 🟡 / 🔴
  - label "Secondary", value = secondary category if present, otherwise "-"

Slide 4 - type "bullets", badge "Classification"
  title: the primary category name (e.g. "Policy & Regulatory Shift")
  3–4 bullets: why it fits this category, what signals confirm it, what distinguishes it from adjacent categories

Slide 5 - type "bullets", badge "Historical Context"
  title: "Comparable Events"
  3–4 bullets: 1–2 historical analogues named specifically, what happened then, the key educational takeaway

Slide 6 - type "bullets", badge "What to Watch"
  title: "Signals to Monitor"
  4–5 bullets: specific data points, indicators, or events that will show how this catalyst develops

Slide 7 - type "summary", title "Key Takeaways"
  3–4 bullets: classification confirmed, duration expectation, most important signal to track, key educational insight about this category

${SHARED_RULES}`;

// ─── Prompt map ───────────────────────────────────────────────────────────────

const SLIDE_PROMPTS: Record<SkillId, string> = {
  'etf-analyzer':            ETF_SLIDE_PROMPT,
  'portfolio-reviewer':      PORTFOLIO_SLIDE_PROMPT,
  'stock-researcher':        STOCK_SLIDE_PROMPT,
  'market-catalyst-scanner': CATALYST_SLIDE_PROMPT,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface SlideGenerationResult {
  title: string;
  slides: AnalysisSlide[];
}

export function useSlideGeneration() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async (
    analysisContent: string,
    skillId: SkillId,
  ): Promise<SlideGenerationResult | null> => {
    setIsGenerating(true);
    setError(null);

    const prompt = SLIDE_PROMPTS[skillId];

    try {
      const raw = await callClaudeRaw(
        prompt,
        `Convert this analysis into slides:\n\n${analysisContent}`,
        60_000,
      );

      // Strip any accidental markdown fences before parsing
      const cleaned = raw
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```$/, '')
        .trim();

      const parsed = JSON.parse(cleaned) as SlideGenerationResult;

      if (!parsed.title || !Array.isArray(parsed.slides) || parsed.slides.length === 0) {
        throw new Error('Unexpected response structure from slide generation.');
      }

      return parsed;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate slides. Please try again.');
      return null;
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return { isGenerating, error, generate };
}
