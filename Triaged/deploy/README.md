# Platform config

Triaged has no custom frontend. Its screens are served by open-source platforms configured from this folder (Phase 7 of the [build plan](../docs/BUILD_PLAN.md)):

| Folder | Platform | Screens |
| --- | --- | --- |
| `grafana/` | Grafana (AGPL-3.0, run unmodified) | Pipeline, SLA, Insights |
| `langfuse/` | Langfuse (MIT, self-hosted) | Ticket trace, classifier evals |
| `appsmith/` | Appsmith (Apache-2.0) | Review queue, Rules, Admin |
| `keycloak/` | Keycloak (Apache-2.0) | Sign-in and roles for all of the above |

The screen mocks in [`docs/mockups/`](../docs/mockups/) are the spec.
