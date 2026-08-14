# Google Sheets connector — Apps Script

`Code.gs` is the complete script. Paste it into the Apps Script project bound to
your spreadsheet (**Extensions ▸ Apps Script**), save, then reload the sheet.

## Setup

| Step | Menu item | What happens |
| :-- | :-- | :-- |
| 1 | **Configure connection…** | Stores the webhook URL + shared secret in Script Properties (never in the code). |
| 2 | **Build / repair all sheets** | Creates all 12 sheets, exact headers, widths, frozen panes, dropdowns, colour rules. |
| 3 | **Install sync triggers** | Installs the `onEdit` + `onChange` triggers. Approve the OAuth prompt. |
| 4 | **Test connection** | Sends a `PING` and reports the result. |

Add `SHEETS_WEBHOOK_SECRET=<the same secret>` to the portal `.env`.

## Three things that matter

**Installable triggers, not simple ones.** A function literally named `onEdit`
runs unauthorised and cannot call `UrlFetchApp` — a webhook written that way
fails silently forever. The handlers here are `handleEdit` / `handleChange`,
attached as installable triggers. Don't rename them.

**No echo loop.** Writes made through the Sheets API do not fire Apps Script
triggers, so when the portal writes to a sheet nothing bounces back.

**Deletes can't be read.** A removed row is gone before the trigger runs. On
`REMOVE_ROW` the script sends the *surviving* id list (or a `RECONCILE` request
for sheets over 5,000 rows) and the server diffs to find what disappeared.

## Payload contract

`POST` to your webhook URL:

```jsonc
{
  "event": "UPDATE",        // PING | INSERT | UPDATE | DELETE | RECONCILE | UPSERT_BATCH
  "sheet": "Attendance",
  "keyField": "id",
  "rows": [ { "_row": 42, "id": "...", "userId": "...", "date": "2026-08-10" } ],
  "survivingIds": ["..."],  // DELETE only
  "spreadsheetId": "1Nzal…",
  "at": "2026-08-10T09:14:22.000Z"
}
```

Headers:

```
X-KreateUp-Timestamp: 1786345445000
X-KreateUp-Signature: <hex>
X-KreateUp-Source:    apps-script
```

Verify server-side as:

```
message   = timestamp + "." + rawJsonBody
signature = hex( HMAC_SHA256(message, SHEETS_WEBHOOK_SECRET) )
```

Compare with a timing-safe equality check, and reject timestamps older than
~5 minutes to stop replays. **Read the raw body before JSON parsing** — the
signature covers the exact bytes sent.

## Auto-retry (optional)

Failed posts queue in Script Properties. To drain them automatically, add a
time-driven trigger for `flushRetryQueue` every 5 minutes
(Apps Script ▸ Triggers ▸ Add trigger).

## Not included

This is the Sheets→Portal half only. The portal→Sheets half (Phases 1, 3, 5:
service-account SDK, DAL, Prisma extension) and the receiving route
`/api/webhooks/google-sheets-sync` are **not** built yet.
