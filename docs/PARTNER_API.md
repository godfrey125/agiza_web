# Partner verification API contract

This document describes the contract expected by the Agiza web frontend. The
endpoints are **not implemented** in the existing Django project at the time of
writing. The frontend never simulates them: when `VITE_PARTNER_API_BASE_URL` is
blank, submission, tracking and staff decisions remain disabled.

## Conventions

- Base URL: `VITE_PARTNER_API_BASE_URL`, without a trailing slash.
- Authentication: `Authorization: Bearer <JWT access token>` from the existing
  Django OTP login. Reject missing, expired or insufficiently privileged tokens.
- Content type: JSON unless stated otherwise. Validation errors should return a
  4xx status with a JSON object containing a readable `detail`, `message` or
  field error.
- CORS: allow the deployed website origin and the local development origin
  `http://localhost:8080`.
- Enforce all validation, authorization, file scanning and status transitions on
  the server. The browser checks are usability helpers only.

## Application types

`application_type` is one of:

- `vendor`
- `rider`

## Document requirements

```http
GET /application-requirements/?application_type=vendor
```

Response: an array, or `{ "results": [...] }`.

```json
[
  {
    "id": 1,
    "code": "business_licence",
    "application_type": "vendor",
    "label": "Business licence",
    "label_sw": "Leseni ya biashara",
    "description": "A current licence for the food business.",
    "description_sw": "Leseni ya sasa ya biashara ya chakula.",
    "mandatory": true,
    "allowed_types": ["application/pdf", "image/jpeg", "image/png"],
    "max_size_mb": 10,
    "applies_to": [],
    "category": "business",
    "sort_order": 10
  }
]
```

- `category` is used to place a requirement in the correct application step:
  `business`, `identity`, `vehicle`, `profile` or `other`.
- `applies_to` filters requirements by vehicle type (for example
  `["motorcycle", "car"]`). An empty array applies to every vehicle.
- `mandatory` drives the required badge and the client-side completeness check.
  The server must validate it again.
- `label_sw` and `description_sw` are optional but recommended for Kiswahili.

## Vendor application submission

```http
POST /vendor-applications/
Content-Type: multipart/form-data
```

Form fields:

| Field | Type | Notes |
| --- | --- | --- |
| `payload` | JSON string | Applicant, business, vehicle (rider), location and consent data |
| `document_<code>` | File | One file per requirement code |
| `profile_image` | File | Optional vendor profile image |
| `logo` | File | Optional vendor logo |
| `premises_photo_1..3` | File | Optional business photos |
| `food_photo_1..3` | File | Optional food photos |

Example `payload` for a vendor:

```json
{
  "fullName": "Applicant name",
  "email": "optional@example.com",
  "businessName": "Business name",
  "vendorType": "restaurant",
  "businessDescription": "What the business sells",
  "businessPhone": "+255700000000",
  "alternativePhone": "",
  "category": "tanzanian",
  "region": "dar_es_salaam",
  "district": "Kinondoni",
  "ward": "Mikocheni",
  "street": "Street or landmark",
  "openingHours": "Mon-Sat 10:00-22:00",
  "consentTerms": true,
  "consentAccuracy": true,
  "consentReview": true,
  "phone": "+255700000000",
  "latitude": -6.75,
  "longitude": 39.25,
  "documents": [
    { "code": "business_licence", "label": "Business licence", "mandatory": true }
  ]
}
```

The rider payload uses the rider fields (`dateOfBirth`, `region`, `district`,
`residentialAddress`, `emergencyContact`, `vehicleType`,
`vehicleRegistration`, `vehicleMake`, `vehicleModel`, `vehicleOwnership`) plus
the shared phone, coordinates, consent and document metadata.

Expected success response:

```json
{
  "reference": "server-generated reference",
  "submitted_at": "2026-01-01T10:00:00Z",
  "status": "SUBMITTED"
}
```

The frontend displays a reference only if the server returns one. It never
generates a local reference.

Server requirements:

- Verify the JWT and the applicant role.
- Reject unknown document codes.
- Enforce allowed MIME types, extension and size limits.
- Store files outside the public web root, preferably in private object storage.
- Scan files for malware and strip unsafe metadata before review.
- Return validation details that the applicant can act on.
- Never trust the client-supplied `mandatory` flag or document labels.

## Applicant status

```http
GET /vendor-applications/me/
GET /rider-applications/me/
```

Return the authenticated applicant's latest application, or `404` when none
exists. The frontend also accepts `{ "results": [...] }` or
`{ "application": { ... } }` shapes.

```json
{
  "id": 42,
  "reference": "server-generated reference",
  "application_type": "vendor",
  "status": "UNDER_REVIEW",
  "submitted_at": "2026-01-01T10:00:00Z",
  "updated_at": "2026-01-02T09:30:00Z",
  "reviewer": "Reviewer name or null",
  "decision_reason": null,
  "requested_information": null,
  "documents": [
    { "code": "business_licence", "label": "Business licence", "status": "ACCEPTED" }
  ]
}
```

Status values:

- `DRAFT`
- `SUBMITTED`
- `PENDING_REVIEW`
- `UNDER_REVIEW`
- `ADDITIONAL_INFORMATION_REQUIRED`
- `APPROVED`
- `REJECTED`
- `SUSPENDED`

Only server-confirmed statuses are displayed. Internal reviewer notes must not
be returned to applicants.

## Staff review

```http
GET /admin/applications/?type=vendor&status=UNDER_REVIEW
```

Response: an array or `{ "results": [...] }` with at least:

```json
{
  "id": 42,
  "reference": "server-generated reference",
  "application_type": "vendor",
  "applicant_name": "Applicant name",
  "status": "UNDER_REVIEW",
  "submitted_at": "2026-01-01T10:00:00Z",
  "updated_at": "2026-01-02T09:30:00Z"
}
```

```http
POST /admin/applications/42/decision/
Content-Type: application/json
```

```json
{
  "decision": "approve",
  "reason": ""
}
```

`decision` is one of `approve`, `reject`, `request_info` or `suspend`. A reason is
required for `reject`, `request_info` and `suspend` and should be returned to the
applicant as `decision_reason` or `requested_information`.

The server must:

- Require an authorised staff/admin role, not merely any authenticated user.
- Record the reviewer, timestamp and previous status.
- Keep internal notes separate from applicant-visible reasons.
- Prevent invalid state transitions and duplicate decisions.

## Contact form

```http
POST <VITE_CONTACT_ENDPOINT>
Content-Type: application/json
```

```json
{
  "name": "Sender name",
  "phone": "+255700000000",
  "email": "optional@example.com",
  "topic": "support",
  "message": "Message body"
}
```

The endpoint must be a trusted HTTPS service with spam protection and a clear
privacy notice. No verified Agiza contact address, phone number or social
account is shipped with this frontend.

## Suggested server-side hardening

- Rate-limit OTP, application submission, status reads and contact requests.
- Validate all uploads by magic bytes, not just MIME headers.
- Use private, short-lived signed URLs for document review.
- Encrypt sensitive personal data at rest and restrict access by role.
- Log administrative decisions with an immutable audit trail.
- Add retention and deletion policies before launch.
- Redact personal data from application logs and error reporting.
