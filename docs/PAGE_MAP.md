# Final v1 page map

## Placement display (DB keys unchanged)
| DB key | UI label |
|--------|----------|
| assessment | Active job search / Assessment |
| screening | Recruiter screening |
| technical | Interview scheduled / Technical |
| panel | Final round / Panel |
| offer | Offer received |

## Payment status
`unpaid` (default) | `partial` | `paid` | `waived` | `n/a`

Separate columns: `payment_amount`, `payment_date`, `payment_method`, `payment_notes`

Use `n/a` for free trials / non-applicable cases.

## Feature flags (off in v1)
- `resumeModule`
- `appDetailsModule`
- `trialChatModule`
