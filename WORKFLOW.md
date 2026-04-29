# Payment Recovery Handler — Workflow Documentation

## Overview

This is the main n8n workflow. It handles two Paystack webhook events:
- `charge.failed` — triggers the full recovery sequence
- `charge.success` — marks the payment resolved and cancels waiting retries

The workflow also contains the retry scheduler which runs hourly to follow up on unresolved payment events.

---

## Trigger

**Node:** `Receive Paystack Webhook`
**Type:** Webhook
**Method:** POST
**Path:** `/paystack/charge-failed`
**Full URL:** `{base_url}/webhook/paystack/charge-failed?token={business_id}`

The `token` query parameter is the business `id` from the `businesses` table. It is used to identify which business owns the incoming webhook.

---

## Charge Failed Flow

### 1. Route By Event Type
**Type:** Switch

Routes the incoming webhook by `body.event`:
- `charge.success` → success branch
- `charge.failed` → failed branch

---

### 2. Fetch Business By Webhook Token
**Type:** Supabase

Queries the `businesses` table using the `token` query parameter from the webhook URL. Fetches all business credentials needed for the recovery sequence — Paystack secret key, WhatsApp credentials, Slack webhook URL, and billing portal URL.

---

### 3. Is Business Valid?
**Type:** If

Checks whether a business record was found for the token. If not found, the flow stops and throws a structured error.

- `true` → Extract Business Context
- `false` → Prepare Error Message → Throw No Business Found Error

---

### 4. Extract Business Context
**Type:** Set

Maps business fields from the Supabase response into clean variables:
- `business_id`
- `paystack_secret_key`
- `whatsapp_phone_id`
- `whatsapp_access_token`
- `slack_webhook_url`
- `billing_portal_url`

---

### 5. Extract Failed Payment Fields
**Type:** Set

Maps payment event fields from the Paystack webhook body:
- `customer_email`
- `customer_code`
- `amount` (in kobo)
- `display_amount` (formatted as NGN currency)
- `currency`
- `reference`
- `failure_reason` (from `gateway_response`)
- `event_time`
- `display_event_time` (formatted as `dd-MM-yyyy, hh:mma`)
- `authorization_code`
- `reusable`
- `channel`
- `retry_count` (set to `0`)
- `next_retry_at` (set to 24 hours from now if card is reusable, otherwise null)
- `n8n_execution_id`
- `business_id`

---

### 6. Store Payment Event
**Type:** Supabase insert

Inserts a new row into `payment_events` with all fields from the previous step. Returns the stored record including its generated `id`.

---

### 7. Is Payment Details Stored?
**Type:** If

Verifies the insert succeeded and the record exists. If it failed, throws a structured error.

- `true` → Can Retry Payment?
- `false` → Prepare Error Message → Throw Event Storage Error

---

### 8. Can Retry Payment?
**Type:** If

Checks whether `reusable = true`. If the card is reusable, the scheduler will attempt to charge it again on retry. If not reusable, retries will only send follow-up emails.

---

### 9. Fetch Customer From Paystack
**Type:** HTTP Request

Calls `GET https://api.paystack.co/customer/{customer_code}` using the business's `paystack_secret_key` as the Bearer token. Retrieves the customer's `first_name`, `last_name`, and `phone` number.

---

### 10. Has Phone Number?
**Type:** If

Checks whether `data.phone` exists on the Paystack customer record. Phone is optional on Paystack so this prevents null values downstream.

- `true` → Prepare Recovery Context (with phone)
- `false` → Prepare Recovery Context (skips WhatsApp)

---

### 11. Prepare Recovery Context
**Type:** Set

Merges business context, payment fields, and customer data into a single flat object for use in email, WhatsApp, and Slack nodes:
- `customer_first_name`
- `customer_phone` (formatted with calling code)
- `display_amount`
- `billing_portal_url`
- `whatsapp_phone_id`
- `whatsapp_access_token`
- `slack_webhook_url`

---

### 12. Is Billing Portal URL Available?
**Type:** If

Checks whether `billing_portal_url` is set for the business.

- `true` → Send Recovery Email (with CTA button)
- `false` → Send Recovery Email Without Deep Link (softer message, no button)

---

### 13. Send Recovery Email / Send Recovery Email Without Deep Link
**Type:** Resend

Sends Email 1 to the customer. The template differs based on whether a billing portal URL is available:
- With URL — includes an "Update Payment Details" CTA button
- Without URL — softer message, no button, contact prompt

---

### 14. Prepare WhatsApp And Slack Context
**Type:** Set

Prepares the WhatsApp message body and Slack alert message as strings, branching on `billing_portal_url` availability using a ternary expression. Both messages are stored as fields on the item.

---

### 15. Deep Link Available? → WhatsApp
**Type:** If → HTTP Request

Checks billing portal URL availability again for the WhatsApp message.

- `true` → Send WhatsApp Message (includes billing portal link)
- `false` → Send WhatsApp Message Without DeepLink (contact prompt message)

Both nodes POST to `https://graph.facebook.com/v18.0/{whatsapp_phone_id}/messages` using the business's `whatsapp_access_token` as the Bearer token. Credentials are injected dynamically — the native WhatsApp node is not used because it only supports static credentials.

---

### 16. Slack Webhook Available? → Send Slack Founder Slack Alert
**Type:** If → HTTP Request

Checks whether `slack_webhook_url` is set. If yes, POSTs a formatted Slack alert to the business's incoming webhook URL containing customer email, amount, failure reason, reference, and timestamp.

---

### 17. Done Scheduler Continues The Job
**Type:** No Operation

Passthrough node. All three notification branches (WhatsApp with link, WhatsApp without link, Slack) connect here. Marks the end of the charge failed sequence.

---

## Charge Success Flow

### 1. Extract References
**Type:** Set

Extracts `reference` from the `charge.success` webhook body.

---

### 2. Retrieve Supabase Reference
**Type:** Supabase

Queries `payment_events` by `reference` to find the matching unresolved event.

---

### 3. Is Retry Card Charge Successful? / Extract Supabase Payment Fields
Extracts the `n8n_execution_id` and `id` from the stored payment event record.

---

### 4. Mark Payment Resolved
**Type:** Supabase update

Updates the `payment_events` row:
- `is_resolved = true`
- `resolved_at = now()`

---

### 5. Cancel Resolve Payment Sequence
**Type:** n8n sub-workflow call

Calls the `resolve-payment-sequence` sub-workflow, passing the `n8n_execution_id`. The sub-workflow cancels any waiting retry executions for this payment so no further follow-up emails are sent.

---

## Retry Scheduler Flow

### Trigger
**Node:** `Schedule Retry Card Charge Job`
**Type:** Schedule Trigger
**Interval:** Every 1 hour

---

### 1. Get Pending Card Charge Jobs
**Type:** Supabase

Queries `payment_events` where:
- `is_resolved = false`
- `reusable = true`
- `retry_count < 3`
- `next_retry_at <= now()`

Returns all payment events due for a retry attempt.

---

### 2. Loop Over Items
**Type:** Loop

Iterates over each pending payment event one at a time.

---

### 3. Fetch Business For Retry
**Type:** Supabase

Fetches the business record for the current payment event using `business_id`. Retrieves Paystack secret key and email credentials needed for the retry.

---

### 4. Extract Business Context For Retry Payment Context
**Type:** Set

Maps business credentials into clean variables for use in retry nodes.

---

### 5. Retry Card Charge Job
**Type:** HTTP Request

Calls `POST https://api.paystack.co/transaction/charge_authorization` using the business's `paystack_secret_key`. Passes `authorization_code`, `email`, and `amount` to attempt the card charge again.

**Continue on Fail: enabled** — if this node fails, the loop continues to the next item.

---

### 6. Is Retry Card Charge Job Successful?
**Type:** If

Checks whether the Paystack charge response indicates success.

- `true` → Get "Resolve Payment Sequence" Retry → Call "Resolve Payment Sequence" Sub-workflow → mark resolved
- `false` → Update Next Retry → Map Email Templates And Context → send follow-up email

---

### 7. Update Next Retry (on failure)
**Type:** Supabase update

Increments `retry_count` by 1 and sets `next_retry_at` to 24 hours from now.

---

### 8. Map Email Templates And Context
**Type:** Set

Determines which follow-up email to send based on `retry_count`:
- `retry_count = 1` → Email 2
- `retry_count = 2` → Email 3

---

### 9. Is Second Retry?
**Type:** If

- `true` → Send Second Recovery Email
- `false` → Send Third Recovery Email

---

### 10. Process Other Job In Queue
**Type:** No Operation

Passthrough. Both email branches connect here, then loop back to `Loop Over Items` to process the next pending job.
