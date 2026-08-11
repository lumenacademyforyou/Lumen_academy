# Question content contract

## Supported examination tracks

- `NEET`: single-correct questions.
- `JEE_MAIN`: single-correct and numerical questions.
- `JEE_ADVANCED`: single-correct, multiple-correct, numerical, matching, and
  assertion-reason questions.

`examTypes` is an applicability list. A question valid for NEET and JEE Main is
stored once with both tracks; it is not duplicated.

## Server-only scoring contract

`Question.scoringConfig` is validated by the content publishing service and is
never returned before an attempt is submitted.

```json
{
  "mode": "ALL_OR_NOTHING",
  "correctMarks": 4,
  "incorrectMarks": -1,
  "unattemptedMarks": 0
}
```

For JEE Advanced partial marking, use a validated contract such as:

```json
{
  "mode": "PARTIAL",
  "correctMarks": 4,
  "incorrectMarks": -2,
  "partialMarksByCorrectSelections": {
    "1": 1,
    "2": 2,
    "3": 4
  },
  "unattemptedMarks": 0
}
```

## Matching interaction contract

For `MATCHING`, `interactionConfig` contains only public left and right items.
The answer mapping remains only in `scoringConfig`.

```json
{
  "leftItems": [
    { "id": "l1", "textEn": "Quantity A" }
  ],
  "rightItems": [
    { "id": "r1", "label": "P", "textEn": "Value P" }
  ]
}
```

The attempt service saves the public display data in
`AttemptQuestion.contentSnapshot` when an attempt starts. It writes the
answer-key snapshot only during the submitted-attempt scoring transaction.
