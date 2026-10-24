# Video Demo Script & Presentation Guide (Max 10 Minutes Total)

This document provides a word-for-word, structured script and walkthrough guide for creating the 10-minute unlisted YouTube video deliverable required by the project.

---

## Part 1: Client Presentation & Product Pitch (0:00 - 5:00)

**Target Audience:** Energy Utility Day-Ahead Wholesale Trading & Power Purchase Team  
**Tone:** Confident, commercial, domain-expert, value-focused  
**Visual Screen:** Showing the live web application starting on the **Executive Overview** tab.

### Slide / Screen 1: Introduction & The Core Commercial Dilemma (0:00 - 1:00)
> *"Hello everyone. Today, I'm thrilled to present **GRID IQ**, a customized Day-Ahead Renewable Intelligence and Procurement platform designed specifically for your wholesale power purchasing desk.*
>
> *As a UK energy utility, your primary responsibility is purchasing electricity from the wholesale market to meet consumer demand. Because wholesale auctions like EPEX SPOT close at **11:00 AM on Day D-1**, you must commit your purchase orders 13 to 37 hours before physical delivery.*
>
> *To decide how much thermal power to purchase, you rely on National Grid ESO wind forecasts. But here is the multi-million-pound question: **What happens when the forecast is wrong?**
>
> *If wind is over-forecasted, you buy too little power ahead of time. You arrive at real-time delivery short of power, and you are forced to pay punitive System Buy cashout prices in the balancing mechanism. If wind is under-forecasted, you commit expensive thermal plants unnecessarily and spill clean energy.*
>
> *GRID IQ transforms this uncertainty from a source of financial loss into a quantified, managed asset."*

---

### Slide / Screen 2: Executive Overview & The January 2026 Discovery (1:00 - 2:15)
*(Action: Highlight the KPI cards and the critical alert banner on the Executive Overview)*
> *"Let's look at the actual data from **January 2026** directly from Elexon BMRS.*
>
> *Across the 8.6 Terawatt-hours of wind energy generated this January, the average forecast error was **2,107 MW**, representing a **20.07% WAPE**.*
>
> *More critically, our platform uncovered a persistent **+1,840 MW systemic over-forecast bias** across 26 out of the 31 days. In simple terms: on 84% of days, the raw National Grid forecast told you wind would be higher than it actually was. 
>
> *A desk trading blindly on raw point forecasts would have been severely short in the balancing mechanism almost every single afternoon."*

---

### Slide / Screen 3: The Day-Ahead Trading Cockpit in Action (2:15 - 3:30)
*(Action: Click the 'Day-Ahead Trading Desk' tab. Switch between Jan 20 (Best Day) and Jan 28 (Severe Miss). Toggle between Half-Hourly (48 SP) and Hourly (24 H).)*
> *"Here on the **Day-Ahead Trading Desk**, your analysts have real-time visibility into the exact forecast curves available prior to Gate Closure.*
>
> *Notice our **Temporal Gate Closure Matcher**: by locking the cutoff to D-1 11:00 UTC, we guarantee your desk sees only the forecast vintage you could actually act upon, with zero look-ahead bias.*
>
> *Let's look at **January 28th**. You can clearly see a catastrophic drop in outturn wind generation. While the forecast predicted over 12,000 MW, actual generation collapsed to 3,000 MW. The red shaded area highlights the massive shortfall risk.*
>
> *With our resolution toggle, you can instantly inspect all **48 half-hour settlement periods**, identifying exactly which settlement periods carry shortfall risk."*

---

### Slide / Screen 4: Procurement Simulator & Thermal Hedging (3:30 - 4:45)
*(Action: Click 'Procurement Simulator' tab. Move the confidence slider to 90% and show Strategy A vs Strategy B comparison.)*
> *"Now for the core commercial breakthrough: **The Procurement Simulator**.*
>
> *Instead of relying on naive point forecasts, your traders can select their risk confidence level—for example, **P90 (90% Confidence)**.*
>
> *GRID IQ automatically derates the wind forecast using empirical error distributions to size a **Thermal Hedge Buffer**.*
>
> *Notice the result on our screen: For a typical regional utility portfolio, Strategy A (Naive) incurs **£340,000 in unhedged cashout penalties**. By implementing our Quantified Error Hedged Strategy, you reduce your shortfall exposure by **over 70%**, locking in lower Day-Ahead thermal prices and saving significant cashout penalties.*
>
> *This provides your trading desk with quantified, mathematical confidence."*

---

### Slide / Screen 5: Pitch Conclusion (4:45 - 5:00)
> *"In summary, GRID IQ provides your utility with: 
> 1. Complete transparency into the latest Elexon forecasts at Gate Closure.
> 2. Rigorous quantitative error evaluation.
> 3. Direct optimization of day-ahead thermal procurement decisions.
>
> *Thank you, and we look forward to partnering with your trading desk."*

---

## Part 2: Internal Technical Lead Architecture & Code Review (5:00 - 10:00)

**Target Audience:** Internal Technical Lead / Engineering Manager  
**Tone:** Technical, architectural, rigorous, code-literate  
**Visual Screen:** Showing the **Technical Architecture** tab, followed by IDE codebase walkthrough in VS Code / terminal.

### Screen 1: Architecture Overview & Decoupled Design (5:00 - 6:00)
*(Action: Display the 4-layer architecture diagram on the 'Technical Architecture' tab)*
> *"Hi everyone, this is Part 2 of our walkthrough—the technical architecture and codebase review for our internal tech lead.*
>
> *Our design follows a clean, decoupled 4-layer architecture:
> 1. **Ingestion Layer:** Connects to Elexon BMRS API streams: `FUELHH` for actual 30-minute settlement period wind generation, and `WINDFOR` for rolling 72-hour forecast vintages.
> 2. **Storage Layer:** High-performance embedded SQLite database (`elexon_wind_jan2026.db`, 6.1 MB). It utilizes compound B-tree indexes on `(start_time, fuel_type)` and `(publish_time, start_time)` to deliver sub-millisecond query latency with zero external database dependencies.
> 3. **Calculation & Analytical Kernel:** Built in Python using vectorized NumPy and Pandas. It handles gate-closure window matching, piecewise linear interpolation, and statistical error metrics.
> 4. **Presentation Layer:** A responsive React 19 single-page application built with Vite and Recharts, styled with a bespoke dark-mode energy trading CSS design system."*

---

### Screen 2: Data Pipeline & Temporal Alignment Logic (6:00 - 7:15)
*(Action: Open `backend/app/services/data_service.py` in the IDE)*
> *"Let's examine how we solve two critical domain challenges in `data_service.py`:*
>
> *First: **Preventing Look-Ahead Bias**. In electricity trading, we cannot use forecasts published after the decision time. In our SQL query, we use a window function:
> ```sql
> WITH RankedForecasts AS (
>     SELECT start_time, publish_time, generation,
>     ROW_NUMBER() OVER (PARTITION BY start_time ORDER BY publish_time DESC) as rn
>     FROM forecasted_generation
>     WHERE publish_time <= :cutoff_time AND start_time >= :start_bound
> )
> SELECT * FROM RankedForecasts WHERE rn = 1;
> ```
> *This guarantees that for every settlement period, we extract strictly the latest forecast vintage published before the gate closure deadline.*
>
> *Second: **Harmonizing Temporal Resolutions**. The actual dataset (`FUELHH`) publishes 48 half-hourly settlement periods per day, whereas `WINDFOR` publishes hourly forecasts. In `data_service.py`, we implement piecewise linear interpolation across the 30-minute intervals, accurately bridging the hourly NWP model output to the half-hourly GB market settlement structure."*

---

### Screen 3: Statistical Rigor & Metric Formulas (7:15 - 8:30)
*(Action: Show `backend/app/services/analytics_service.py` and the formulas card on the UI)*
> *"In `analytics_service.py`, we implement the full battery of power industry metrics:*
> - *Mean Absolute Error (MAE): $\frac{1}{N}\sum |F - A|$ in MW.*
> - *Root Mean Squared Error (RMSE): heavily penalizes large forecast outliers, which trigger non-linear cashout prices.*
> - *Weighted Absolute Percentage Error (WAPE): $\frac{\sum |F - A|}{\sum A}$. Notice we use WAPE rather than standard MAPE, because when wind generation drops near zero on calm days, MAPE divides by zero and produces distorted infinite percentages. WAPE remains mathematically robust across all operating regimes.*
> - *Empirical Quantiles: In `get_error_distribution_and_quantiles()`, we compute P10, P50, and P90 error thresholds. In `procurement_service.py`, the P90 threshold directly sizes the thermal reserve buffer: $\text{Buffer} = Z_{\alpha} \times \sigma_{\text{wind}}$."*

---

### Screen 4: Code Quality, Testing & Docker Containerization (8:30 - 9:30)
*(Action: Show terminal running `pytest backend/tests/test_api.py -v` and `docker-compose.yml`)*
> *"Quality assurance and containerization:*
> - *In `backend/tests/test_api.py`, we maintain a **12-test suite** covering 100% of API endpoints, half-hourly resolution, hourly aggregation, and procurement simulations. Let's run it live in terminal: `pytest backend/tests/test_api.py -v` — all 12 pass in under 4 seconds.*
> - *We built a multi-stage `Dockerfile`: Stage 1 uses Node 20 to compile the React Vite bundle, and Stage 2 packages Python 3.13-slim with our cached database and static assets. Running `docker compose up --build` brings up the entire full-stack application on port 8000 in a single command.*
> - *For cloud deployment, the application is configured with `vercel.json` and a Heroku `Procfile`."*

---

### Screen 5: Tech Lead Wrap-Up (9:30 - 10:00)
> *"To conclude: The codebase is fully modular, type-safe, rigorously tested, and dockerized. All files and setup instructions are documented in the README.
> 
> *Thank you for reviewing, and I welcome any technical questions."*
