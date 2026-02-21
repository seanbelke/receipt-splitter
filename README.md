# Receipt Splitter

Basic full-stack app for splitting restaurant receipts when one person pays.

## Usage

1. Upload a receipt image
2. Parse line items with GPT-5 vision via OpenAI API
3. Add people (unique names required)
4. Assign each item unit to one or more people
5. Auto-calculate what each person owes, including proportional tax and tip

## Tech

- Next.js (App Router) + TypeScript
- Tailwind CSS
- OpenAI API (`responses` endpoint)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local`:

```bash
OPENAI_API_KEY=your_openai_api_key_here
OPENAI_MODEL=gpt-5-mini
```

3. Run dev server:

```bash
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## Notes

- Receipt rows with `quantity > 1` are expanded into separate assignable units.
