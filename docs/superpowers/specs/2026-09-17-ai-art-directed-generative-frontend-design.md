# AI Art-Directed Generative Frontend

## Objective

WebsiteLeadAgent must produce a new visual interpretation of a customer's website, not a lightly restyled copy. The generated site preserves verified business facts and content while changing the visual language, information hierarchy, composition, interaction model, and emotional impression.

The target reaction is: “This is recognizably our company, presented as a substantially better and more modern website.”

## Product invariant

The source website is a content and evidence source. It is not the design reference.

The following remain source-grounded:

- company identity and contacts;
- services, products, projects, articles, prices, attributes, and claims;
- source photographs that represent real products, projects, people, or certificates;
- navigation destinations and conversion actions.

The following may be redesigned freely:

- information hierarchy and storytelling;
- typography, spacing, palette, surfaces, grids, and section composition;
- navigation presentation, hero composition, cards, galleries, and detail layouts;
- crops, masks, overlays, collages, and other non-destructive treatments of source media;
- decorative AI-generated textures, patterns, abstract illustrations, and atmospheric imagery;
- motion and interaction, subject to accessibility and performance limits.

AI-generated media must never be presented as a real customer project, product, employee, certificate, testimonial, or other evidence.

## Chosen architecture

Use a hybrid of an AI Art Director and a controlled generative frontend.

### Stable platform core

The platform owns:

- the verified content graph and evidence;
- schemas and validation;
- routing and link resolution;
- forms, analytics, SEO, security headers, and accessibility baseline;
- media provenance;
- build, sandbox, screenshot, and publication lifecycle;
- fallback rendering when generated code fails.

### AI Art Director

For each customer, the Art Director produces three independent `CreativeDirection` documents. Each direction defines:

- business idea and intended emotional effect;
- audience and decision stage;
- a named visual territory;
- explicit differences from the original site and sibling concepts;
- information hierarchy and narrative sequence;
- typography system and palette rationale;
- layout grammar and hero composition;
- media treatment and rules for generated decorative assets;
- component language;
- motion principles;
- desktop and mobile behavior;
- implementation risks and prohibited clichés.

At least one direction must be bold but commercially appropriate. Directions must not be variants of the same template.

### Visual reference pass

Before frontend code generation, produce a visual reference for the homepage and representative detail page. References are used as art direction, not as factual content.

The pipeline must reject references that:

- preserve the original site's composition too closely;
- differ from sibling directions mainly by color;
- use generic AI landing-page patterns;
- introduce fake evidence;
- cannot be implemented responsively with available content.

### Controlled generative frontend

Each approved direction generates an isolated, versioned frontend artifact:

```text
generated-sites/{siteId}/{conceptId}/
├── concept.json
├── provenance.json
├── tokens.css
├── entry.tsx
├── pages/
├── components/
├── interactions/
├── visual-assets/
└── build-report.json
```

Generated code may create bespoke React components and CSS, but it must consume only the stable platform content API. It cannot query the database directly, change shared platform code, install arbitrary dependencies, or embed unverified factual copy.

Generation occurs at build time. Built artifacts are immutable and reproducible. Runtime requests only render a previously validated artifact.

## Concept generation stages

1. Build the immutable `ContentTruthGraph` with evidence and media provenance.
2. Capture and analyze source screenshots to identify visual patterns that must not be copied.
3. Generate three CreativeDirections with materially different design grammar.
4. Generate visual references for each direction.
5. Run visual-direction validation and select directions that pass.
6. Generate isolated React/CSS artifacts.
7. Compile and statically validate every artifact.
8. Render via the real site-renderer preview path.
9. Run functional, responsive, accessibility, performance, and visual QA.
10. Allow one bounded AI revision pass for failed visual or implementation criteria.
11. Mark successful output `HUMAN_REVIEW_READY`; never assign `DEMO_READY` automatically.

## Perceptual-distance quality gate

The generated result must be evaluated against both the source website and its sibling concepts.

Passing requires:

- a different hero composition;
- a different page rhythm and section composition;
- a different typography system;
- a different component and card language;
- a different approach to imagery;
- a different navigation or interaction presentation where appropriate;
- no large empty sections, duplicated semantic sections, broken imagery, or overflow;
- no factual drift.

Color changes and section reordering do not count as sufficient differentiation.

The practical human test is: if logos and text are obscured, the original and generated pages must still look like different websites, and the three generated concepts must remain distinguishable from one another.

## Evaluation

Use two complementary evaluators:

1. Deterministic checks for DOM structure, section signatures, typography tokens, component families, CTA behavior, accessibility, overflow, broken assets, console errors, and build integrity.
2. A vision-capable model judging originality, aesthetic coherence, business fit, hierarchy, perceived quality, and similarity to the source and sibling concepts.

Vision evaluation is a gate and diagnostic, not the sole source of truth. Store the model, prompt version, scores, reasons, and screenshots used for each judgment.

## First vertical slice

Implement the architecture for the existing Lishen, Puzzlehouse, and SDKE benchmark plans.

The slice must generate three concept artifacts for each customer and demonstrate at least three distinct visual territories across the benchmark, such as editorial, cinematic portfolio, architectural minimalism, interactive catalog, or technical/data-driven presentation. The exact territories must be chosen from the customer evidence rather than assigned mechanically by client name.

The slice is complete only when screenshots are produced through the production preview route and the reviewer can trace every displayed fact and every AI-generated decorative asset to its provenance.

## Non-goals for the first slice

- unrestricted runtime code generation;
- arbitrary third-party dependencies per site;
- a universal no-code page builder;
- autonomous publishing;
- fabricated portfolio or product imagery;
- infinite self-critique loops.

