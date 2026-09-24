# 02b: AI Gateway (any provider, any model, per task)

> **Not in MVP v1.** v1 uses deterministic catalog matching for screenshots and AWS Rekognition for safety. The AI Gateway arrives in Phase 2. It is designed now so that no feature is tied to one AI vendor.

## Goal
Every AI-powered capability is a **port** (a TypeScript interface). **Which provider and model handles it is configuration**, changeable at runtime, testable side by side, and swappable without a deploy.

## 1. Ports (by capability, not by vendor)
```ts
// packages/ai/src/ports.ts
export interface AiGateway {
  parseScanText(input: { lines: OcrLine[]; context: GeoContext }, ctx: Ctx): Promise<ScanParse>;  // screenshot fallback
  extractMenu(input: { image: ImageRef; outletId?: string }, ctx: Ctx): Promise<MenuExtraction>;   // menu-card scan
  verifyPhoto(input: { image: ImageRef; claim: { itemName: string; brand: string } }, ctx: Ctx): Promise<PhotoVerdict>; // AI voter
  classifyVideoMeta(input: VideoMeta, ctx: Ctx): Promise<DishMentions>;                            // YouTube discovery
  embedText(text: string, ctx: Ctx): Promise<Embedding>;
  embedImage(image: ImageRef, ctx: Ctx): Promise<Embedding>;
}
```
Every output type is a **Zod schema** in `packages/shared`. Responses are validated before anything uses them.

## 2. Adapters
| Adapter | Covers | Notes |
|---|---|---|
| `bedrock` | Any model family offered on Amazon Bedrock | Native on AWS: IAM auth, no extra vendor contract, data stays in AWS |
| `anthropic` | Anthropic API | Direct |
| `openai` | OpenAI API | Direct |
| `google` | Gemini (AI Studio / Vertex AI) | Direct |
| `openai-compatible` | OpenRouter, Groq, Together, self-hosted vLLM / Ollama, … | Anything that speaks the OpenAI wire format |
| `self` | Self-hosted models on the worker (e.g. SigLIP embeddings, a CLIP zero-shot filter) | For cheap, high-volume steps |

**Implementation:**
- Adapters are built on the **Vercel AI SDK** (`ai` + `@ai-sdk/*` providers), which gives one TypeScript API for text, vision and **structured output** (`generateObject` with a Zod schema) across providers.
- Our ports wrap it, so replacing the SDK later touches only `packages/ai`.

## 3. Per-task routing config
Stored in **SSM Parameter Store** (`/realdish/<env>/ai/tasks`), cached in memory with a 60 s TTL, and validated by Zod on load.
```json
{
  "scan_parse": {
    "provider": "bedrock", "model": "<model-id>",
    "fallbacks": [{ "provider": "openai-compatible", "model": "<model-id>", "baseUrl": "<url>" }],
    "timeoutMs": 6000, "maxOutputTokens": 600, "maxCostInr": 0.5,
    "promptVersion": "v2",
    "split": { "variantB": { "provider": "google", "model": "<model-id>" }, "percentB": 20 }
  },
  "photo_verify": { "provider": "anthropic", "model": "<model-id>", "mode": "batch", "promptVersion": "v1" },
  "menu_extract": { "provider": "google", "model": "<model-id>", "promptVersion": "v1" },
  "embed_image":  { "provider": "self", "model": "siglip-base-patch16-224", "dim": 768 }
}
```
- **A/B split:** a deterministic hash of `userId + task` picks the variant. It's logged with every call.
- **Overrides:** a per-user override (internal testers) and a per-environment override.
- **Kill switch:** `"enabled": false` sends callers to the non-AI path (for example `CatalogScanParser`).

## 4. Reliability
1. Call the primary with a timeout, then **validate against Zod**.
2. On a timeout, 5xx, rate limit, refusal or validation failure: retry once with backoff, then go to the next `fallbacks` entry.
3. A **circuit breaker per provider+model** opens after N consecutive failures and sends calls to the fallback for a cool-down.
4. If everything fails, callers get a typed `AiUnavailable` and use the non-AI path. **No feature hard-depends on AI.**

## 5. Prompts
- Versioned files: `packages/ai/prompts/<task>/<version>.md`, with optional `<version>.<provider>.md` overrides, because models follow instructions differently.
- The prompt version is part of the config, so rolling back a prompt is just a config change.
- Inputs are **redacted before sending**: phone numbers, emails, addresses and order IDs are stripped; images have EXIF stripped.

## 6. Telemetry: `ai_calls`
| Column | Notes |
|---|---|
| `task`, `provider`, `model`, `prompt_version`, `variant` | Routing facts |
| `input_tokens`, `output_tokens`, `latency_ms`, `est_cost_inr` | Cost from a price table in config (₹ per M tokens per model) |
| `status` | `ok` / `invalid_output` / `timeout` / `error` / `fallback_used` |
| `subject_type`, `subject_id` | e.g. `scan`, `photo`. **No raw prompts or user content stored.** |

**Dashboards:**
- ₹ per scan by model
- validation-failure rate
- p95 latency
- fallback rate
- monthly AI spend against budget alarms.

## 7. Eval harness (how we choose models)
- **Datasets** (versioned, in private S3):
  - `scan_parse`: OCR lines from ~200 screenshots, labelled `{brand, item}`
  - `photo_verify`: ~300 photos labelled match / wrong item / not real
  - `menu_extract`: ~30 menu photos with their item lists.
- **Runner:** `pnpm ai:eval --task scan_parse --candidates bedrock:<id>,google:<id>,openai-compatible:<id>`. Outputs accuracy (top-1/top-3), invalid-output %, p50/p95 latency and ₹/call as a markdown report.
- **Decision rule:** the cheapest model that meets the accuracy bar for that task wins. Re-run the eval whenever a new model or prompt version is proposed.

## 8. Cost guide (illustrative, ₹88 = $1)
| Task | Tokens (in / out) | Small model tier (~$0.1 / $0.4 per M) | Mid tier (~$1 / $5 per M) | Frontier tier (~$5 / $25 per M) |
|---|---|---|---|---|
| `scan_parse` (OCR text) | ~1,000 / 300 | ≈ ₹0.02 | ≈ ₹0.2 | ≈ ₹1.1 |
| `photo_verify` (1 image) | ~1,800 / 200 | ≈ ₹0.02 | ≈ ₹0.25 | ≈ ₹1.2 |
| Batch mode (most providers) | | ~50% off | ~50% off | ~50% off |

**Cascade:** cheap filters (pHash, CLIP/SigLIP zero-shot) → small model → stronger model **only on uncertainty**.

## 9. Embeddings: a special case
- **Vectors from different models are not comparable.** Each index pins `embedding_model` + `dim`, and each row stores the model it used.
- Switching models means a background re-embed job, then dual-read with a comparison, then cutover, then dropping the old vectors.

## 10. Where AI plugs in (roadmap)
| Phase | Task | Replaces / augments |
|---|---|---|
| 2 | `parseScanText` fallback | `CatalogScanParser` when the score is low; local outlets |
| 2 | `verifyPhoto` as **one weighted voter** in community verification | Adds to the human votes; never the only decider at launch |
| 2 | `extractMenu` | Menu-card scans for local outlets ([06](06-place-menu.md)) |
| 2 | `classifyVideoMeta` | YouTube discovery ([04](04-image-acquisition-and-cost.md)) |
| 2 | `embedImage` | Near-duplicate and stolen-photo detection ([07](07-rewards-system.md)) |
