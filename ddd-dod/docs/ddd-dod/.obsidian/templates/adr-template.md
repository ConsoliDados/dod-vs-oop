<%*
const id = await tp.system.prompt("ADR ID (e.g. 0001)");
const title = await tp.system.prompt("ADR title");
const phase = await tp.system.prompt("Milestone or sprint (e.g. M1)");
const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
await tp.file.rename(`${id}-${slug}`);
await tp.file.move(`/adrs/${id}-${slug}`);
const date = tp.date.now("YYYY-MM-DD");
-%>
# ADR-<% id %> — <% title %>

- **Status:** Draft
- **Date:** <% date %>
- **Milestone / Sprint:** <% phase %>

## Context

<!-- What problem are we solving? What constraints exist? Cite the SRS/SAD/SDD this stems from. -->

## Decision

<!-- State the decision in one sentence: "We will use X." Then expand with detail. -->

## Alternatives considered

- **(a)** ... — rejected because ...
- **(b)** ... — rejected because ...

## Consequences

<!-- Positive and negative. What becomes easier? What becomes harder? Follow-up actions? -->

## References

<!-- Links to issues, prior art, related ADRs/SDDs, external docs. -->
