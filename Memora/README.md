# Memora

> Your Alexa, but smarter — powered by Claude with persistent memory across every conversation.

Memora is a custom Alexa skill that replaces Alexa's built-in brain with Claude AI and gives it a long-term memory. Tell it things once; it remembers them. Ask it anything; it answers with context.

---

## How it works

```
You speak  →  Echo (STT)  →  Alexa Skill  →  Lambda
                                                ├─ reads history + facts from DynamoDB
                                                ├─ calls Claude with full context
                                                ├─ writes updated memory back
                                                └─ speaks Claude's reply aloud
```

---

## Project layout

```
Memora/
├── interaction-model/
│   └── en-US.json          Alexa interaction model (invocation, intents, slots)
├── lambda/
│   ├── index.js            Lambda handler (all request types)
│   ├── claude.js           Anthropic API call + fact extraction
│   ├── memory.js           DynamoDB read/write helpers
│   ├── package.json
│   └── .env.example        Local env var template
└── infra/
    ├── dynamodb-table.json CloudFormation snippet for the memory table
    └── iam-policy.json     Minimum IAM policy for the Lambda role
```

---

## Prerequisites

| What | Where to get it |
|------|----------------|
| Amazon Developer account | developer.amazon.com |
| AWS account | aws.amazon.com |
| Anthropic API key | console.anthropic.com |
| Node.js 18+ | nodejs.org |

---

## Setup

### 1. DynamoDB table

Create the `MemoraMemory` table (or use the CloudFormation snippet in `infra/`):

```
Partition key : userId  (String)
Billing       : On-demand (PAY_PER_REQUEST)
```

### 2. Lambda function

```bash
cd lambda
npm install --omit=dev
zip -r ../memora-lambda.zip .
```

Create a Lambda function (Node.js 18+) and upload `memora-lambda.zip`.

Set these environment variables on the function:

| Variable | Value |
|----------|-------|
| `ANTHROPIC_API_KEY` | Your key from console.anthropic.com |
| `MEMORY_TABLE` | `MemoraMemory` (or your table name) |
| `CLAUDE_MODEL` | `claude-haiku-4-5-20251001` (fast, low-latency) |

Attach the IAM policy from `infra/iam-policy.json` to the Lambda execution role (alongside `AWSLambdaBasicExecutionRole`).

Set the timeout to **8 seconds** (Alexa's hard limit) and memory to **256 MB**.

### 3. Alexa Skill

1. Go to the [Alexa Developer Console](https://developer.amazon.com/alexa/console/ask) and create a new **Custom** skill.
2. Under **Interaction Model → JSON Editor**, paste the contents of `interaction-model/en-US.json` and save/build.
3. Under **Endpoint**, choose **AWS Lambda ARN** and paste your Lambda's ARN.
4. Enable the skill for your account and test in the simulator or on your Echo.

---

## Usage examples

```
"Alexa, open Memora"
"My favourite coffee is a flat white with oat milk"
"What's the weather like today?"
"Do you remember my coffee order?"
"Help me write a short birthday message for my mum"
```

---

## Latency notes

Alexa enforces an **8-second response deadline**. Memora is tuned to stay well under it:

- Uses `claude-haiku-4-5-20251001` by default — fastest available model.
- `max_tokens` is capped at 250 — voice-length replies only.
- Only the rolling history window (last 20 turns) is sent to Claude.
- A progressive `"Let me think."` directive signals activity while the call is in flight.

---

## Memory model

| Field | What it stores |
|-------|---------------|
| `history` | Last 20 turns (role + text), trimmed each write |
| `facts` | Durable facts the user has told Memora (deduplicated) |
| `updatedAt` | ISO timestamp of last write |

When Claude replies with something worth remembering it appends a `<MEMORA_FACTS>[...]</MEMORA_FACTS>` block; the handler strips that from the spoken response and merges the facts into DynamoDB.

---

## Phase 2 (not yet built)

PC control from voice with a phone-approval step. A lightweight agent on the PC polls a queue for pending commands; Lambda pushes an approval prompt to your phone before anything executes. Designed once Phase 1 is reliably live.
