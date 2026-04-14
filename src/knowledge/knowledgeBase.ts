/**
 * Fund OS Knowledge Base
 *
 * Sourced directly from the user's Notion workspace.
 * This is the complete investing operating system that powers all AI responses.
 * Cached with prompt caching - only paid for once per hour.
 */

export const KNOWLEDGE_BASE = `
# FUND OS - COMPLETE INVESTING KNOWLEDGE BASE

---

## LAYER 1: FOUNDATIONS

### Core Market Model
The stock market is a system for transferring partial ownership of businesses to the public in exchange for capital. When you buy a share, you become a fractional owner of a company - entitled to participate in its growth and receive dividends from profits. You do not manage the company. You hold a claim on its future earnings.

The market operates through exchanges (NYSE, NASDAQ) and is measured by indices:
- S&P 500 → 500 largest U.S. companies by market cap → broadest U.S. market signal
- NASDAQ 100 → top 100 non-financial companies → tech/growth signal
- Dow → 30 prominent companies → legacy/industrial signal

These indices are barometers, not portfolios.

**How money flows:** Consumer spending → Business revenue → Shareholder return. Owning equity means positioning yourself at the end of this pipeline.

**Three forces that favor the investor:**
1. Money flows to the investor - every consumer transaction ultimately benefits shareholders
2. Inflation benefits the investor - inflation can increase nominal revenues and support equities over time
3. The tax code favors the investor - capital gains tax (max ~20%) is structurally lower than income tax (max ~37%)

**Why long-term ownership works:** Markets are not consistently predictable short-term, but have historically compounded positively over long horizons. Missing the best 10 market days per decade reduces long-term returns from 3,793% to a fraction of that. Those days are unpredictable.

**Why the market is not the economy:** The economy measures current productive output. The market measures expectations about future cash flows. They can and do move in opposite directions - 2022 produced 9.1% inflation while markets hit record highs.

### Default Investor Posture
- 97% of day traders lose money long-term. Active traders underperform the market by 6.5% annually.
- Passive investing (index ETFs) is the structural foundation - not a starting point to leave behind.
- The correct default posture is investor, not trader.
- The default position is hold. Action requires a specific, pre-defined reason.
- Do not act because the economy looks bad, inflation is rising, a macro event creates fear, or short-term price movement feels threatening.

### ETF Selection - The MACE Method
MACE is the minimum due diligence standard before any ETF enters the portfolio:

**M - Mandate:** Read the fund's stated investment objective in the prospectus. Cross-check: does the actual sector allocation match what the fund claims to track? The label is not the product.

**A - Assets:** Total assets are a proxy for institutional confidence, liquidity, and fund stability. Low total assets create liquidity risk on exit, not just entry.

**C - Composition:** Review the top holdings and their weights. A fund can hold the same companies as an index while concentrating 60% in the top three names. What you're buying is the weighted average of the holdings.

**E - Expense Ratio:** Every ETF charges an annual management fee deducted automatically. Always model it in absolute dollar terms over your actual time horizon. At 0.0945% over 40 years on $1,000/month, the cost is $304,000 on an investment that grows to $11.4 million.

**ETF risk hierarchy:**
- Index tracker → broadest diversification → Low risk → Matches market
- Industry tracker → one sector, many companies → Medium risk → Sector-dependent
- Niche ETF → specific subsector → High risk → Highest upside and downside

**Non-negotiable ETF rules:**
1. Manager screen before MACE - always
2. Verify composition, never trust the label
3. Model AUM as an exit test, not an entry metric
4. Calculate expense ratios in absolute dollars
5. Classify ETF type before analyzing any numbers
6. No action on macro fear - ever
7. Default position is hold; action requires a pre-specified trigger
8. Passive foundation first - active positions come after

### Key Mental Models
- "The stock market is not the economy" - two separate systems that regularly diverge
- "The label is not the product" - always verify actual sector allocation
- "Liquidity is an exit problem, not an entry problem" - evaluate every position for exit
- "Time in the market dominates timing the market" - missing best days collapses returns
- "Inflation is not the investor's enemy" - rising prices increase business revenue for shareholders

---

## LAYER 2: ANALYSIS ENGINE

### The 8-Phase Framework
Before committing capital, produce the most complete picture of a business - in the right sequence.

**Stage 0 - Market Catalyst Scanning:** Five categories of catalysts that historically precede investable dislocations:
- Institutional Flow - large institutions moving capital create momentum before retail investors notice
- Consumer Behavior Shift - durable changes in how people spend; distinguish structural (lasting) from cyclical (temporary)
- Technology Disruption - new technologies that lower costs, open markets, or obsolete business models
- Policy & Regulatory Shift - government actions that alter competitive dynamics
- Macro Regime Shift - changes in interest rates, inflation, or economic cycles

For each catalyst: map second and third-order ripple effects. The first-order beneficiary is usually already priced in.

**Phase 1 - Business Foundation:** What exactly does this company sell and to whom? Revenue mix by segment. Position in the value chain. Strategic changes in the last 1-2 years. Evaluate the business before looking at any numbers.

**Phase 2 - Industry Analysis:** Where is the industry in its cycle (recovery/expansion/peak/contraction)? Supply-demand dynamics. Competitive structure and barriers to entry. Regulatory environment.

**Phase 3 - Business Breakdown:** Complete: "This company makes money by ___." Identify the primary profit driver (volume vs. price vs. mix). Pricing power evidence. Revenue is what a company earns. Profit is what it keeps.

**Phase 4 - Financial Quality:** Read all three statements as a trajectory, not a snapshot.
- Balance Sheet: What does the company own and owe? Liabilities should not grow faster than assets or income.
- Income Statement: Is the company making money and growing? Apply a multi-year view - three years reveals trend.
- Cash Flow Statement: Operating cash flow is the most operationally honest number.

Key ratios:
- OCF/NI Ratio (Operating Cash Flow ÷ Net Income): above 1.0 = strong; below 0.8 over 3-5 years = concern
- FCF/NI Ratio: consistently above 0.8 = business generates real discretionary cash
- Accruals Ratio: consistently above +5% = potential earnings manipulation signal

**Phase 5 - Governance:** Insider ownership (skin in the game test). Share dilution or buyback history. Management compensation alignment. Capital allocation track record. ROIC trend. Governance failures often precede financial failures.

**Phase 6 - Market Sentiment:** Build a genuine bull case and a genuine bear case. Define verification nodes. Consult analyst consensus only after forming your own view - not before. Every analysis must include a rigorous bear case.

**Phase 7 - Valuation & Moat:**
Moat rating (0-5): 5 = exceptional multi-source moat; 4 = strong with 1-2 durable sources; 3 = moderate; 2 = weak but real; 1 = minimal; 0 = no moat.
Moat sources: brand, switching costs, network effects, cost advantages, intangibles, efficient scale, distribution.

Valuation tools: P/E (profitable stable companies), P/S (pre-profit growth), EV/EBITDA (cross-company comparison), Book Value (asset-heavy companies).

DCF three scenarios - Bull (high growth, expanding margins, lower WACC), Base (mid-range historical), Bear (conservative, compressing margins, higher WACC). The margin of safety is the gap between bear-case intrinsic value and current market price.

**Phase 8 - Final Synthesis:**
- 🟢🟢🟢 Strong Buy: moat ≥4, >30% DCF upside, OCF/NI consistently >1.0, no governance concerns, at/below historical multiples
- 🟡🟡🟡 Hold: moat 3-4, <15% upside, OCF/NI 0.8-1.0, no material governance concerns
- 🔴🔴 Avoid: moat ≤2, overvalued vs bull-case DCF, OCF/NI declining 3+ years, or material governance concerns

### Critical Analysis Rules
- Business foundation before financials - always
- Your own analysis before analyst consensus - always
- OCF/NI measured over 3-5 years, not one year
- Never apply P/E to a pre-profit company
- Never use a single valuation metric as a conclusion
- A high multiple is a question, not a verdict
- Strong financials do not override governance or business red flags

---

## LAYER 3: STRATEGY & PORTFOLIO DESIGN

### The Three Investing Archetypes

**Growth Investing:** Buy companies whose future trajectory - not current financials - justifies a premium. Monitor quarterly for deceleration. Primary risk: growth deceleration (even to still-positive rates reprices the stock down). Primary valuation tool: PEG Ratio (P/E ÷ Earnings Growth Rate %). PEG below 1.0 = potentially undervalued.

**Value Investing:** Buy mature, moat-protected companies temporarily on sale due to market irrationality. Three-step process: (1) value markers check, (2) on-sale determination - was the cause temporary or permanent?, (3) valuation confirmation. Value trap warning signs: falling earnings (multi-period), no innovation, no moat (Buffett's $100B test).

**Income Investing:** Buy securities for regular cash flow output. The power comes from disciplined long-term reinvestment (DRIP). A 2-3% dividend growing 10% annually compounds to far higher yield-on-cost than an 8% yield that gets cut in year three. High yield (8-10%+) is a warning signal, not a reward.

**The four income strategies:** Dividend Growth (2-3%, 20+ years of consecutive increases), High-Yield (4-8%+, sustainability check required), Bond Laddering (staggered maturities), REIT Stacking (4-7%+, 90%+ income distribution required by law).

**Choosing your archetype - three questions:**
1. What is your primary goal? (appreciation → growth; discount buying → value; cash flow → income)
2. What is your time horizon? (under 5 years: avoid growth; 15+ years: DRIP becomes transformative)
3. What is your risk tolerance - honestly? (30-50% decline without panic-selling? growth viable)

### The 60/40 Core/Satellite Portfolio Framework
**Core Holdings (60%):** 40% dividend growth stocks (consumer staples, financials, healthcare) + 20% bonds (10% intermediate-term government + 10% short-term corporate)
**Satellite Holdings (40%):** 20% REITs + 15% high-yield dividend stocks + 5% speculative

**Rebalancing protocol:** Review at minimum annually. Trigger: any allocation drifts more than 5% from target. Mechanism: sell overweight, buy underweight. During accumulation: direct new contributions to underweight before selling.

### Monitoring & Sell Discipline
**Three pillars of monitoring:**
1. News: daily 15-20 minutes + company Google alerts
2. SEC filings: 8-K immediately when filed; 10-Q quarterly; 10-K annually
3. Trend analysis: revenue/margin trajectory + valuation at historical context

**Classify before acting:** Every price decline is either a temporary setback (macro-driven, thesis intact) or a fundamental problem (thesis broken). Do not act until classified.

**Temporary setback (hold):** Market-wide macro event, single quarter miss by small margin, temporary supply disruption.
**Fundamental problem (sell trigger review):** Consistently falling revenue, leadership turmoil, desperate actions (selling divisions), delisting threat.

**Three valid sell criteria - only three:**
1. Fundamentals have deteriorated (thesis broken - sell regardless of gain or loss)
2. Stock has hit the price target (thesis played out)
3. Life goals have changed (portfolio alignment)

Invalid sell reasons: price has dropped, paper loss exists, fear it might keep falling, everyone else is selling.

---

## LAYER 4: EXECUTION SYSTEM

### The Playbook Architecture
Every investment decision falls into one of three categories:

**Category 1 - Execution Plays (always active):**
- Dollar-Cost Averaging: fixed amount at fixed intervals; automate
- Lump Sum Investing: statistically outperforms DCA two-thirds of the time (markets trend upward)
- Rebalancing: restore target allocation when any position drifts 5%+

**Category 2 - Market Condition Plays (situational):**
- Buy the Dip: 5-10% portfolio in dry powder; deploy at pre-defined 10%, 15%, 20% market decline thresholds; target index funds and established companies
- Raising Cash (Defensive): activate when S&P 500 P/E is significantly above historical average (~15-16); always define re-entry conditions simultaneously
- Momentum: capped at 5-10% of portfolio maximum; trailing stop loss 10-15% below current price

**Category 3 - Personal Situation Plays:**
- Raise: maintain the same percentage of income invested, not dollar amount
- Job loss: reduce to minimum sustainable contribution; do not stop entirely; do not sell assets unless emergency fund exhausted
- Windfall: apply DCA vs. lump sum framework before acting
- Buying a house: shift funds out of equities in the months before closing
- Approaching retirement: begin shifting toward income 5-10 years before - not at retirement

### Core Execution Doctrines
- Write the decision before you need to make it. Rules written under analytical clarity can be executed mechanically when pressure makes reasoning unreliable.
- Every defensive cash position requires a re-entry condition written at the same time.
- Percentages compound; dollar amounts stagnate. Maintain the same percentage of income invested.
- Do not stop investing entirely during income disruption - reduce to minimum, preserve the habit.

---

## LAYER 5: EXTENSIONS

### Alternatives (The Non-Correlation Layer)
Precious metals and crypto don't move in sync with equities - providing non-correlated diversification and inflation protection.

**Allocation ranges:**
- Conservative: 3-7% total (3-5% precious metals, 0-2% crypto)
- Moderate: 7-15% total (5-8% precious metals, 2-7% crypto)
- Aggressive: 10-25% total (8-12% precious metals, 7-13% crypto)

Primary failure mode: FOMO during price surges. Protocol: stick to pre-specified percentage, ignore social media during volatile periods.

### Advanced Tools (The Precision Layer)
Most investors can build substantial wealth without options. DCF is the exception - its value as a thinking framework is immediately applicable.

**Three appropriate options strategies:**
1. Protective puts - insurance against decline on a large position you can't sell (tax reasons)
2. Covered calls - premium income on 100+ shares you intend to hold long-term
3. Cash-secured puts - get paid while waiting to acquire a stock at your target entry price

**Five Principles for all advanced strategies:** Master basics first. Start small (1-2% of portfolio). Understand fully before trading. Match the tool to the job. Risk management above all.

### Fixed Income (The Certainty Layer)
Fixed income is certainty, not return. When you need to know that X dollars will arrive on a specific date, only fixed income provides that contractual guarantee.

**Most important concept:** Interest rates and bond prices move inversely. This only affects investors who sell before maturity.

**Bond types by risk:** Treasury (lowest) → Investment grade corporate → Municipal (tax-exempt, best at higher brackets) → TIPS (inflation-adjusted principal) → Emerging market (highest)

**Three bond strategies:** Ladder (staggered maturities, continuous liquidity), Barbell (short + long only), Bullet (all same maturity date, purpose-built for a specific goal)

**Life-stage allocation:**
- 20s-30s: 80-90% stocks / 10-20% fixed income
- 40s: 60-70% stocks / 30-40% fixed income
- 50s-early 60s: 40-50% stocks / 50-60% fixed income
- 65+: 20-30% stocks / 70-80% fixed income (stocks remain - retirement still needs growth)

---

## LAYER 6: ACCOUNTABILITY

### The 16-Point Checklist
1. I understand how the stock market works: market cap, exchanges, indices
2. I understand macroeconomic forces: interest rates, GDP, inflation, the Fed
3. I can evaluate an ETF using the MACE method
4. I understand what a market catalyst is and can identify examples
5. I know the difference between growth, value, and income investing - and which fits my goals
6. I can read a basic income statement, balance sheet, and cash flow statement
7. I can calculate and interpret P/E, P/B, market cap, and EV/EBITDA
8. I have a written investment playbook with execution, market condition, and personal situation plays
9. I know my risk tolerance and have set a target asset allocation
10. I have an emergency fund fully funded before investing aggressively
11. I understand what alternative investments are and whether/how they fit my portfolio
12. I understand DCF valuation as a thinking framework for business value
13. I can explain what a call option and a put option are
14. I know what futures contracts are and why they're not for most retail investors
15. I understand the fixed income landscape: bonds, CDs, annuities
16. I am actively investing - not just studying (the only one that produces wealth)

### Behavioral Doctrine
1. Understanding and doing are two different things. Knowledge without deployed capital produces zero wealth.
2. The playbook holds when emotions do not. The written playbook was created precisely for moments of market pressure.
3. The market will test you - always. Corrections, crashes, and FOMO are not exceptional events. They are the normal operating environment.
4. Small outperformance compounded is large wealth. Even 1-2% annual outperformance over 30 years creates a significant edge through compounding.
5. Honest "no" is more valuable than dishonest "yes." The checklist is only useful if applied honestly.

### The Graduation Standard
"Investing like a pro means: do the research, build a fundamentals-rooted strategy, stick to the playbook when emotions run hot, and stay in the game long enough for compound growth to work its mechanism. No single correct stock pick, no perfect market timing - just consistent execution of a sound system across the corrections, crashes, and FOMO-inducing surges that will come without exception."
`;
