# Payment Recovery Handler - Workflow Documentation

## Overview

This is the main n8n workflow. It handles two Paystack webhook events:
- `charge.failed` - triggers the payment recovery sequence (immediate retry or notification flow)
- `charge.success` - marks the payment resolved and cancels active waiting retry schedules

The workflow also contains a retry scheduler which runs hourly to follow up on unresolved payment events.

---

## Webhook Trigger

**Node:** `Receive Paystack Webhook`  
**Type:** Webhook  
**Method:** POST  
**Path:** `/paystack/charge-failed`  
**Full URL:** `{base_url}/webhook/paystack/charge-failed?token={business_id}`  

The `token` query parameter matches the business `id` in the `businesses` table. It identifies which business owns the incoming webhook.

---

## Charge Failed Flow

### 1. Route By Event Type
**Type:** Switch  
Routes the incoming webhook by `body.event`:
- `charge.success` -> Success branch (routed to the Success Flow)
- `charge.failed` -> Failed branch (routed to step 2)

### 2. Fetch Business By Webhook Token
**Type:** Supabase  
Queries the `businesses` table using the `token` query parameter from the webhook URL. It fetches the business credentials needed for the recovery sequence: Paystack secret key, WhatsApp credentials, Slack webhook URL, and billing portal URL.

### 3. Is Business Valid?
**Type:** If  
Checks whether a business record was found for the token. If not found, the flow stops and throws a structured error.
- `true` -> Extract Business Context
- `false` -> Prepare Error Message -> Throw No Business Found Error

### 4. Extract Business Context
**Type:** Set  
Maps business fields from the Supabase response into clean variables:
- `business_id`
- `paystack_secret_key`
- `whatsapp_phone_id`
- `whatsapp_access_token`
- `slack_webhook_url`
- `billing_portal_url`

### 5. Extract Failed Payment Fields
**Type:** Set  
Maps payment event fields from the Paystack webhook body:
- `customer_email`
- `customer_code`
- `amount` (in kobo)
- `display_amount` (formatted NGN currency)
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

### 6. Store Payment Event
**Type:** Supabase Insert  
Inserts a new row into `payment_events` with the extracted payment fields. Returns the stored record including its generated `id`.

### 7. Is Payment Details Stored?
**Type:** If  
Verifies that the database insert succeeded. If it failed, throws a structured error.
- `true` -> Can Retry Payment?
- `false` -> Prepare Error Message1 -> Throw Event Storage Error

### 8. Can Retry Payment?
**Type:** If  
Checks whether `reusable = true`. 
- **`true` (Immediate Retry Flow):** Bypasses initial notifications to attempt charging the card authorization again immediately.
  - **Retry Card Charge:** HTTP POST to `https://api.paystack.co/transaction/charge_authorization` using the business's `paystack_secret_key`.
  - **is Retry Card Charge Successful?:** If the charge succeeds, it routes to `Extract Reference` -> `Call 'Resolve Payment Sequence'` to mark the payment resolved and terminate wait schedules. If it fails, execution stops (handled by the hourly scheduler).
- **`false` (Notification Flow):** Routes to the customer notification sequence starting at step 9.

### 9. Is Billing Portal Url Available?
**Type:** If  
Checks whether `billing_portal_url` is configured for the business.
- `true` -> Send Recovery Email (with "Update Payment Details" CTA button)
- `false` -> Send Recovery Email Without Deep Link (softer message, no button)

### 10. Send Recovery Email / Send Recovery Email Without Deep Link
**Type:** Resend  
Sends the first recovery email (Email 1) to the customer email address extracted from the Paystack webhook body.

### 11. Prepare Recovery Context
**Type:** Set  
Sets up the flat variables mapping business and payment fields needed for downstream customer communication.

### 12. Fetch Customer From Paystack
**Type:** HTTP Request  
Calls `GET https://api.paystack.co/customer/{customer_code}` using the business's `paystack_secret_key` to retrieve the customer's name and phone number.

### 13. Has Phone Number?
**Type:** If  
Checks whether `data.phone` exists on the retrieved Paystack customer record.
- **`true`:** Routes to `Prepare WhatsApp And Slack Context` to dispatch chat alerts:
  - **Slack Webhook Available?:** If true, posts a slack alert to the business's Slack incoming webhook URL.
  - **Deep Link Available?:** If true, sends a WhatsApp message with the billing portal link. If false, sends a WhatsApp message with a generic contact support prompt.
- **`false`:** Routes to `Skip SMS No Phone Number` (No Operation) and terminates the notification flow since WhatsApp is unavailable.

---

## Inactive and Draft Nodes (on Canvas)

The workflow canvas contains the following additional nodes which are defined but remain disconnected or inactive in the current execution paths:

### 1. Wait 24 Hours
- **Type:** Wait
- **Interval:** Pauses execution for 24 hours.

### 2. Send SMS Via Termii
- **Type:** HTTP Request
- **Method:** POST
- **URL:** `https://v3.api.termii.com/api/sms/send`
- **Payload:** Sends an SMS using the business's Termii API key to the customer phone number with custom retry and reference context.

### 3. Skip SMS No Phone Number
- **Type:** No Operation
- **Purpose:** Terminal path for when customer records contain no phone number.

---

## Charge Success Flow

### 1. Route By Event Type
**Type:** Switch  
Routes the `charge.success` webhook event from Step 1 of the webhook trigger.

### 2. Is Retry Payment?
**Type:** If  
Checks whether this successful charge was initiated by our own retry scheduler.
- `true` -> Skip (No Operation) to avoid redundant cancellations.
- `false` -> Extract Reference1 (extracts payment reference) -> Call 'Resolve Payment Sequence' (triggers the sequence resolution flow).

---

## Resolve Payment Sequence (Sub-Workflow Trigger)

**Node:** `Resolve Payment Sequence`  
**Type:** Execute Workflow Trigger  
Invoked internally when a payment is successfully completed (either via immediate retry, scheduler retry, or manual customer resolution).

### 1. Extract Success Payment Fields
**Type:** Set  
Extracts the `reference` of the successful payment.

### 2. Mark Payment Resolved
**Type:** Supabase Update  
Updates the matching `payment_events` row:
- `is_resolved = true`
- `resolved_at = now()`

### 3. Cancel Recovery Sequence
**Type:** Execute Workflow  
Calls the sub-workflow to cancel any active waiting retry jobs in the n8n execution queue.

---

## Retry Scheduler Flow

### Trigger
**Node:** `Schedule Retry Card Charge Job`  
**Type:** Schedule Trigger  
**Interval:** Runs every 1 hour.

### 1. Get Pending Card Charge Jobs
**Type:** Supabase  
Queries `payment_events` for records where:
- `is_resolved = false`
- `reusable = true`
- `retry_count < 3`
- `next_retry_at <= now()`

### 2. Loop Over Items
**Type:** Loop  
Iterates through each pending retry payment event.

### 3. Fetch Business For Retry
**Type:** Supabase  
Queries the `businesses` table for credentials using the `business_id` of the payment event.

### 4. Extract Business Context For Retry
**Type:** Set  
Maps business credentials and secret keys into variables for the retry operation.

### 5. Retry Card Charge Job
**Type:** HTTP Request  
Submits a POST request to `https://api.paystack.co/transaction/charge_authorization` to charge the customer's card again. (Has "Continue on Fail" enabled so a single failed card does not crash the loop).

### 6. Is Retry Card Charge Job Successful?
**Type:** If  
Checks whether Paystack approved the transaction:
- **`true`:** Routes to `Extract Reference` -> `Call 'Resolve Payment Sequence'` (marks the database record resolved and cancels waiting retry items).
- **`false`:** Routes to step 7.

### 7. Update Next Retry (on failure)
**Type:** Supabase Update  
Increments `retry_count` by 1 and sets `next_retry_at` to 24 hours from the current time.

### 8. Map Email Templates And Context
**Type:** Set  
Determines which email copy to send based on the new `retry_count`:
- `retry_count = 1` -> Email 2
- `retry_count = 2` -> Email 3

### 9. Is Second Retry?
**Type:** If  
- `true` -> Send Second Recovery Email (via Resend)
- `false` -> Send Third Recovery Email (via Resend)

### 10. Process Other Job In Queue
**Type:** No Operation  
Ends current item iteration and loops back to loop through the next pending job.
