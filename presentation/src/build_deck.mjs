import fs from "node:fs";
import path from "node:path";
import {
  Presentation,
  PresentationFile,
  row,
  column,
  grid,
  panel,
  text,
  rule,
  fill,
  hug,
  fixed,
  wrap,
  grow,
  fr,
  auto,
  drawSlideToCtx,
} from "@oai/artifact-tool";
import { Canvas } from "skia-canvas";

const W = 1920;
const H = 1080;
const OUT = "output/output.pptx";
const SCRATCH = "scratch";

const C = {
  ink: "#101820",
  muted: "#5E6978",
  soft: "#F6F8FA",
  line: "#D9E0E7",
  green: "#00A878",
  blue: "#2F80ED",
  coral: "#EF6F6C",
  amber: "#F2C94C",
  purple: "#7B61FF",
  white: "#FFFFFF",
};

const title = { fontSize: 58, bold: true, color: C.ink, fontFace: "Aptos Display" };
const subtitle = { fontSize: 28, color: C.muted, fontFace: "Aptos" };
const body = { fontSize: 26, color: C.ink, fontFace: "Aptos" };
const small = { fontSize: 17, color: C.muted, fontFace: "Aptos" };
const label = { fontSize: 18, bold: true, color: C.muted, fontFace: "Aptos" };
const number = { fontSize: 92, bold: true, color: C.ink, fontFace: "Aptos Display" };

const data = JSON.parse(fs.readFileSync("../backend/tests/last_result.json", "utf8"));
const actions = data.actions || [];
const volume = data.action_volume_summary || {};

function addSlide(presentation, titleText, subtitleText, bodyNode, opts = {}) {
  const slide = presentation.slides.add();
  const accent = opts.accent || C.green;
  slide.compose(
    column(
      { name: "slide-root", width: fill, height: fill, padding: { x: 86, y: 58 }, gap: 34 },
      [
        row(
          { name: "top-rail", width: fill, height: hug, gap: 28, align: "start" },
          [
            rule({ name: "accent-rule", width: fixed(8), height: fixed(118), stroke: accent, weight: 8 }),
            column(
              { name: "title-stack", width: fixed(1500), height: hug, gap: 16 },
              [
                text(titleText, { name: "slide-title", width: fixed(1480), height: hug, style: title }),
                text(subtitleText, { name: "slide-subtitle", width: fixed(1360), height: hug, style: subtitle }),
              ],
            ),
            text(String(presentation.slides.items.length).padStart(2, "0"), {
              name: "slide-num",
              width: fixed(64),
              height: hug,
              style: { ...label, fontSize: 20, color: accent, align: "right" },
            }),
          ],
        ),
        bodyNode,
        footer(opts.footer || "Lattice Predict hackathon deck | P4 build"),
      ],
    ),
    { frame: { left: 0, top: 0, width: W, height: H }, baseUnit: 8 },
  );
  return slide;
}

function footer(copy) {
  return row(
    { name: "footer", width: fill, height: hug, gap: 18, align: "center" },
    [
      rule({ name: "footer-rule", width: fixed(120), stroke: C.line, weight: 2 }),
      text(copy, { name: "footer-copy", width: fill, height: hug, style: small }),
    ],
  );
}

function bulletList(items, width = fill) {
  return column(
    { name: "bullets", width, height: hug, gap: 18 },
    items.map((item, i) =>
      row(
        { name: `bullet-${i}`, width: fill, height: hug, gap: 16, align: "start" },
        [
          text(String(i + 1).padStart(2, "0"), {
            name: `bullet-num-${i}`,
            width: fixed(56),
            height: hug,
            style: { ...label, color: C.green },
          }),
          text(item, { name: `bullet-text-${i}`, width: fill, height: hug, style: body }),
        ],
      ),
    ),
  );
}

function chip(copy, color = C.green) {
  return panel(
    {
      name: `chip-${copy}`,
      width: hug,
      height: hug,
      padding: { x: 18, y: 8 },
      fill: C.white,
      stroke: color,
      borderRadius: "rounded-full",
    },
    text(copy, { width: hug, height: hug, style: { ...label, color } }),
  );
}

function metric(value, caption, color = C.ink) {
  return column(
    { name: `metric-${caption}`, width: fill, height: hug, gap: 6 },
    [
      text(value, { name: `metric-value-${caption}`, width: fill, height: hug, style: { ...number, color } }),
      text(caption, { name: `metric-caption-${caption}`, width: fill, height: hug, style: { ...label, color: C.muted } }),
    ],
  );
}

function artifact(titleText, lines, color = C.blue) {
  return panel(
    {
      name: `artifact-${titleText}`,
      width: fill,
      height: hug,
      padding: { x: 28, y: 24 },
      fill: C.white,
      stroke: C.line,
      borderRadius: 8,
    },
    column(
      { width: fill, height: hug, gap: 12 },
      [
        text(titleText, { width: fill, height: hug, style: { ...label, color } }),
        ...lines.map((line, i) =>
          text(line, { name: `artifact-line-${i}`, width: fill, height: hug, style: { ...body, fontSize: 23 } }),
        ),
      ],
    ),
  );
}

function flowStep(labelText, detail, color) {
  return column(
    { name: `flow-${labelText}`, width: fill, height: hug, gap: 12 },
    [
      rule({ name: `flow-rule-${labelText}`, width: fill, stroke: color, weight: 8 }),
      text(labelText, { width: fill, height: hug, style: { ...label, color } }),
      text(detail, { width: fill, height: hug, style: { ...body, fontSize: 23 } }),
    ],
  );
}

function actionBars() {
  const order = [
    "MESSAGE_MANAGER",
    "VENT_TO_PEER",
    "REQUEST_EXCEPTION",
    "POST_IN_CHANNEL",
    "UPDATE_LINKEDIN",
    "DO_NOTHING",
    "ADVOCATE",
    "GO_QUIET",
  ];
  const colors = [C.blue, C.coral, C.amber, C.purple, C.green, C.muted, C.green, C.ink];
  const max = Math.max(...Object.values(volume));
  return column(
    { name: "action-bars", width: fill, height: fill, gap: 13 },
    order.map((name, i) => {
      const value = volume[name] || 0;
      const barWidth = Math.max(28, Math.round((value / max) * 900));
      return row(
        { name: `bar-row-${name}`, width: fill, height: hug, gap: 18, align: "center" },
        [
          text(name, { name: `bar-label-${name}`, width: fixed(300), height: hug, style: { ...label, fontSize: 17 } }),
          panel(
            {
              name: `bar-${name}`,
              width: fixed(barWidth),
              height: fixed(28),
              fill: colors[i],
              borderRadius: 4,
            },
            text(" ", { width: fixed(1), height: hug, style: small }),
          ),
          text(String(value), {
            name: `bar-value-${name}`,
            width: fixed(64),
            height: hug,
            style: { ...body, fontSize: 22, bold: true, color: C.ink },
          }),
        ],
      );
    }),
  );
}

function cover(presentation) {
  const slide = presentation.slides.add();
  slide.compose(
    grid(
      {
        name: "cover-root",
        width: fill,
        height: fill,
        columns: [fr(1.1), fr(0.9)],
        rows: [fr(1), auto],
        padding: { x: 96, y: 72 },
        columnGap: 56,
        rowGap: 34,
      },
      [
        column(
          { name: "cover-type", width: fill, height: fill, gap: 28 },
          [
            text("Lattice Predict", {
              name: "cover-title",
              width: wrap(920),
              height: hug,
              style: { ...title, fontSize: 104, lineSpacingMultiple: 0.86 },
            }),
            text("A wind tunnel for people decisions.", {
              name: "cover-subtitle",
              width: wrap(760),
              height: hug,
              style: { ...subtitle, fontSize: 38, color: C.ink },
            }),
            row({ name: "cover-chips", width: fill, height: hug, gap: 14 }, [
              chip("agent actions", C.coral),
              chip("cohort pulse", C.green),
              chip("policy rewrite", C.blue),
            ]),
          ],
        ),
        column(
          { name: "cover-artifact", width: fill, height: fill, gap: 22, justify: "center" },
          [
            artifact("Day 1", ["Policy pasted", "Northwind workforce wakes up"], C.green),
            artifact("Day 7", ["Managers get exception requests", "Peers see visible concern"], C.coral),
            artifact("Day 30", ["Pulse forecast and rewrite are ready", "Decision support, not automation"], C.blue),
          ],
        ),
        text("HackTech 2026 | Lattice x MiroFish-inspired simulation", {
          name: "cover-footer",
          columnSpan: 2,
          width: fill,
          height: hug,
          style: small,
        }),
      ],
    ),
    { frame: { left: 0, top: 0, width: W, height: H }, baseUnit: 8 },
  );
}

async function main() {
  fs.mkdirSync(SCRATCH, { recursive: true });
  fs.mkdirSync("output", { recursive: true });

  const presentation = Presentation.create({ slideSize: { width: W, height: H } });
  cover(presentation);

  addSlide(
    presentation,
    "HR learns too late",
    "Pulse surveys are lagging indicators for policy risk.",
    grid(
      { name: "problem-grid", width: fill, height: fill, columns: [fr(1), fr(1)], columnGap: 52 },
      [
        artifact("Current loop", ["Announce policy", "Wait for Slack rumors", "Survey after damage is done"], C.coral),
        artifact("Better loop", ["Paste draft policy", "Watch simulated behavior", "Rewrite before rollout"], C.green),
      ],
    ),
    { accent: C.coral },
  );

  addSlide(
    presentation,
    "The insight: behavior first",
    "The demo wins when judges watch a workforce act, not just a sentiment number move.",
    row(
      { name: "behavior-row", width: fill, height: fill, gap: 44 },
      [
        flowStep("Old model", "Assign sentiment. Aggregate color. Show dashboard.", C.muted),
        flowStep("Lattice Predict", "Agents DM peers, post in channels, request exceptions, go quiet, update LinkedIn.", C.green),
        flowStep("Outcome", "eNPS is derived from action mix and network visibility.", C.blue),
      ],
    ),
    { accent: C.green },
  );

  addSlide(
    presentation,
    "What we built",
    "A policy simulator that turns a draft into action feed, org graph motion, themes, and a rewrite.",
    grid(
      { name: "product-grid", width: fill, height: fill, columns: [fr(1.1), fr(0.9)], columnGap: 58 },
      [
        bulletList([
          "Policy parser extracts tone, affected groups, exception path, and severity.",
          "Persona enricher anchors every employee to the policy.",
          "Action selector produces the feed P2/P3 animate.",
          "P4 theme and recommendation modules read the resulting actions.",
        ]),
        artifact("Frontend contract", [
          "GET /northwind: 50 agents plus edges",
          "POST /simulate: full result JSON",
          "POST /simulate/stream: live SSE action feed",
        ], C.blue),
      ],
    ),
    { accent: C.blue },
  );

  addSlide(
    presentation,
    "Canonical demo: RTO v1",
    "Firm mandate, manager-discretion exceptions, and a Tue-Thu office requirement.",
    row(
      { name: "rto-row", width: fill, height: fill, gap: 46 },
      [
        metric("54 -> 30", "predicted eNPS", C.coral),
        metric("121", "agent actions", C.blue),
        metric("14", "LinkedIn updates", C.purple),
      ],
    ),
    { accent: C.coral, footer: "Source: production cached RTO v1 result pulled into backend/tests/last_result.json" },
  );

  addSlide(
    presentation,
    "Five arcs to reference live",
    "These are real cached action sequences, useful for narration while the graph animates.",
    grid(
      { name: "arcs-grid", width: fill, height: fill, columns: [fr(1), fr(1)], rows: [auto, auto, auto], columnGap: 34, rowGap: 22 },
      [
        artifact("Priya Shah", ["manager message -> exception request", "channel post -> LinkedIn -> quiet"], C.coral),
        artifact("Greg Stevens", ["manager message -> formal exception", "venting after radio silence"], C.blue),
        artifact("Olivia Brooks", ["Boulder care-plan backstory", "exception request then repeated channel posts"], C.green),
        artifact("Isabel Garcia", ["remote caregiver for mother", "manager escalation -> LinkedIn signal"], C.purple),
        artifact("Gabriel Santos", ["updates LinkedIn on day 2", "later says he is lining up interviews"], C.coral),
        artifact("Sarah Kim", ["manager warns VP about attrition", "shows manager-level friction"], C.amber),
      ],
    ),
    { accent: C.purple },
  );

  addSlide(
    presentation,
    "Action mix is the proof layer",
    "The product does not tell users morale dropped; it shows what people did.",
    actionBars(),
    { accent: C.blue, footer: "Source: backend/tests/last_result.json action_volume_summary" },
  );

  addSlide(
    presentation,
    "P4 theme engine",
    "Clusters real action.content strings into 3 themes with quote refs the feed can link back to.",
    grid(
      { name: "theme-grid", width: fill, height: fill, columns: [fr(1), fr(1), fr(1)], columnGap: 28 },
      [
        artifact("Commute strain", ["41 messages", "Representative quote IDs: act_d00_01, act_d03_00, act_d03_02"], C.coral),
        artifact("Loss of flexibility", ["20 messages", "Remote hires and schedule autonomy show up repeatedly"], C.green),
        artifact("Caregiving burden", ["16 messages", "Kids, eldercare, therapy schedules, and pickup windows"], C.blue),
      ],
    ),
    { accent: C.green },
  );

  addSlide(
    presentation,
    "P4 recommendation engine",
    "Turns top concerns into a policy rewrite, not a generic advice paragraph.",
    grid(
      { name: "rec-grid", width: fill, height: fill, columns: [fr(0.9), fr(1.1)], columnGap: 54 },
      [
        column({ name: "impact-stack", width: fill, height: fill, gap: 24 }, [
          metric("60%", "negative action reduction", C.green),
          metric("6", "LinkedIn updates avoided", C.purple),
        ]),
        artifact("Recommended rewrite", [
          "Move to phased hybrid rollout.",
          "Guarantee caregiving, medical, accessibility, commute-hardship, and remote-role exceptions through People Ops.",
          "Use June-August as a ramp, then pulse at 30 and 90 days.",
        ], C.green),
      ],
    ),
    { accent: C.green },
  );

  addSlide(
    presentation,
    "Where P4 plugs in",
    "The modules sit after deterministic sentiment aggregation and before final result JSON.",
    row(
      { name: "pipeline", width: fill, height: fill, gap: 22 },
      [
        flowStep("Actions", "121 workplace actions over 30 simulated days.", C.coral),
        flowStep("Themes", "Cluster content and attach real action_id quote refs.", C.green),
        flowStep("Rewrite", "Generate HR-ready v2 text with projected impact.", C.blue),
        flowStep("Cohorts", "Use themes for top_concern by department.", C.purple),
      ],
    ),
    { accent: C.blue },
  );

  addSlide(
    presentation,
    "Privacy and governance",
    "This has to feel safe for Lattice: cohort-level support, not automated HR action.",
    grid(
      { name: "governance-grid", width: fill, height: fill, columns: [fr(1), fr(1)], columnGap: 46 },
      [
        bulletList([
          "Minimum cohort thresholds before exposing heat maps.",
          "RBAC: execs see aggregate risk; managers see their own cohorts; HR owns exception workflow.",
          "Quotes are simulated outputs for decision support, not employee records.",
        ]),
        artifact("Positioning line", [
          "Decision support, not automation.",
          "No individual employment decisions.",
          "Use the model to rewrite the policy before employees ever see it.",
        ], C.green),
      ],
    ),
    { accent: C.amber },
  );

  addSlide(
    presentation,
    "MiroFish lineage, Lattice product",
    "We borrow the multi-agent simulation posture, then specialize it for workforce decisions.",
    grid(
      { name: "lineage-grid", width: fill, height: fill, columns: [fr(1), fr(1)], columnGap: 44 },
      [
        artifact("Inspired by MiroFish", ["Seed material creates a parallel world.", "Agents interact and produce emergent trajectories.", "A report is generated from the simulated world."], C.purple),
        artifact("Unique to us", ["Northwind workforce personas.", "Lattice pulse, eNPS, cohort metrics.", "Policy rewrite loop tied to action feed evidence."], C.green),
      ],
    ),
    { accent: C.purple },
  );

  addSlide(
    presentation,
    "Frontend handoff contract",
    "P2 and P3 can build confidently against stable IDs, enums, and event types.",
    grid(
      { name: "contract-grid", width: fill, height: fill, columns: [fr(1), fr(1)], columnGap: 42 },
      [
        artifact("Action enum", ["VENT_TO_PEER, POST_IN_CHANNEL", "MESSAGE_MANAGER, GO_QUIET", "UPDATE_LINKEDIN, ADVOCATE", "REQUEST_EXCEPTION, DO_NOTHING"], C.blue),
        artifact("SSE events", ["stage", "parsed", "action", "tick", "result", "error"], C.green),
      ],
    ),
    { accent: C.blue, footer: "Schema: contracts/simulation_result.schema.json" },
  );

  addSlide(
    presentation,
    "Demo script",
    "Keep the live path tight and leave room for the judge's own policy.",
    bulletList([
      "Hook: HR announces on Tuesday; learns what broke through Slack and resignations by Friday.",
      "Paste RTO v1 and run the simulation.",
      "Narrate arcs as the graph and action feed move.",
      "Open results: eNPS, heat map, themes, quotes.",
      "Apply recommendation, run v2, compare action volume.",
      "Bonus: ask a judge to paste their policy.",
    ]),
    { accent: C.coral },
  );

  addSlide(
    presentation,
    "Backup demo video",
    "Record one clean full-screen flow so Wi-Fi never owns the outcome.",
    grid(
      { name: "video-grid", width: fill, height: fill, columns: [fr(1), fr(1)], columnGap: 44 },
      [
        bulletList([
          "Start on the Scenario Builder.",
          "Run cached RTO v1 through SSE stream.",
          "Show graph pulses and live feed.",
          "Open results and recommendation.",
          "Run/apply v2 and compare.",
        ]),
        artifact("Narration beat", [
          "Watch this: we are not predicting feelings.",
          "We are watching the workforce act.",
          "The pulse score is downstream of behavior.",
        ], C.green),
      ],
    ),
    { accent: C.green },
  );

  addSlide(
    presentation,
    "Validation checklist",
    "What needs to pass before the release tag.",
    grid(
      { name: "validation-grid", width: fill, height: fill, columns: [fr(1), fr(1)], columnGap: 44 },
      [
        bulletList([
          "Run P4 module checks.",
          "Run verify_v1_v2 with production credentials.",
          "Re-warm cache after theme and recommendation integration.",
          "Production smoke: /health, /northwind, /simulate, /simulate/stream.",
        ]),
        artifact("Wild policies", ["comp freeze", "4-day workweek", "layoff round"], C.amber),
      ],
    ),
    { accent: C.amber },
  );

  addSlide(
    presentation,
    "Risk cuts",
    "If something breaks twice, protect the cinematic path.",
    grid(
      { name: "risk-grid", width: fill, height: fill, columns: [fr(1), fr(1)], columnGap: 44 },
      [
        artifact("Keep", ["Action feed", "Org graph pulses", "RTO v1 to v2 comparison"], C.green),
        artifact("Cut first", ["Extra filters", "Dense chart detail", "Any nonessential settings"], C.coral),
      ],
    ),
    { accent: C.coral },
  );

  addSlide(
    presentation,
    "Ask and next steps",
    "Turn this from hackathon proof into Lattice Predict.",
    row(
      { name: "ask-row", width: fill, height: fill, gap: 44 },
      [
        flowStep("Now", "Demo canonical RTO and one judge policy.", C.green),
        flowStep("Next", "Backtest against historical Lattice pulse and attrition outcomes.", C.blue),
        flowStep("Later", "Custom workforce upload, manager FAQ, and governance controls.", C.purple),
      ],
    ),
    { accent: C.green },
  );

  const pptxBlob = await PresentationFile.exportPptx(presentation);
  await pptxBlob.save(OUT);

  for (let i = 0; i < presentation.slides.items.length; i += 1) {
    const slide = presentation.slides.items[i];
    const canvas = new Canvas(W, H);
    const ctx = canvas.getContext("2d");
    await drawSlideToCtx(slide, presentation, ctx);
    await canvas.toFile(path.join(SCRATCH, `slide-${String(i + 1).padStart(2, "0")}.png`));
  }

  fs.writeFileSync(
    path.join(SCRATCH, "qa-summary.json"),
    JSON.stringify(
      {
        slides: presentation.slides.items.length,
        pptx: path.resolve(OUT),
        previews: path.resolve(SCRATCH),
        source: "backend/tests/last_result.json",
      },
      null,
      2,
    ),
  );

  console.log(JSON.stringify({ slides: presentation.slides.items.length, pptx: OUT }, null, 2));
}

await main();
