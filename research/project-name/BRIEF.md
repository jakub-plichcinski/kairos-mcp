# KAIROS naming brief: product spirit and local correctness

Status: active brief, revised 2026-10-01. **No name is selected for adoption.**
See the [ranked research recommendation](RESEARCH-2026-10-01.md) for three finalists.
This supersedes the 2026-09-09 Tacitloom recommendation. Naming research only:
no product rename, migration, registration or purchase.

## Product understanding

KAIROS is an **agent-facing persistent protocol system**. It bridges what a
model learned about how people usually work and how this user, project or team
actually works. Agents are the primary runtime users; humans author, manage
and review protocols.

> Your model knows how the world usually works. This tells it how you work.

The model already knows many plausible ways to perform a task. KAIROS supplies
the applicable local procedure, preserves it beyond a model or conversation,
and guides execution through explicit contracts. Its distinctive combination
is **discover local procedural knowledge + execute under explicit contracts +
preserve that knowledge across sessions**.

## Generic correctness versus local correctness

Consider the complete request: **“Create PR.”** The agent knows Git and GitHub,
but that knowledge does not establish this team's procedure.

| Generic competence | Local procedural knowledge |
| --- | --- |
| Create a branch and open a PR | Which base branch and naming convention apply? |
| Commit, push and describe a change | Which artifacts, commit format and PR template are required? |
| Open a draft or ready PR | Must the PR exist before implementation and start as draft? |
| Run tests and inspect CI | Which checks are mandatory, and what happens when CI fails? |
| Request review and merge | Is independent review required, which approvals apply, and where must the agent stop? |

These are examples of what local protocols can specify, not universal KAIROS
defaults. A technically valid PR can still follow the wrong reasonable
process. **Generic correctness is insufficient when local correctness is required.**
Even familiar intents should consult the applicable protocol before the agent
trusts its generic procedure. Familiarity makes this valuable: confidence can
hide missing local context. Routing is not a fallback reserved for unfamiliar tasks.

## Philosophy

**Do not replace the model's intelligence. Give it the correct local rules.**

- Generic knowledge supplies mechanics and reasoning. Protocols supply the
  delta: what is different, required or already decided here.
- Protocols are interfaces for agent behavior, not just reference prose. They
  make phase boundaries, evidence, stop conditions and escalation explicit,
  rather than leaving gaps for pretrained assumptions.
- Institutional procedure should survive a new model, conversation or team
  member. Protocols preserve conventions otherwise scattered through people's
  memories, reviews, conversations and wikis.
- Discovery and execution solve different problems. `activate` discovers the
  applicable procedure. Once selected, explicit contracts and known links
  guide `forward` transitions; `reward` finalizes the run. Known transitions
  should not repeatedly depend on semantic rediscovery.
- The agent still investigates and reasons where judgment is valuable.
  Contracts can require shell evidence, an MCP result, human input or reasoning
  appropriate to the step. They do not make every judgment mechanically
  provable or guarantee infallibility.

The spirit is: **think inside the correct local context; do not invent the
parts that have already been decided.** Local procedure operates within the
user's instructions and host permissions, not above them.

This brief records product identity, not a second runtime specification.
Operational authority remains in the [KAIROS skill](../../.agents/skills/kairos/SKILL.md)
and [routing reference](../../.agents/skills/kairos/references/action-routing.md).
Interface principles remain in [CONTRIBUTING.md](../../CONTRIBUTING.md).

## Naming constraints

1. Use simple international English or familiar technical vocabulary: easy to
   pronounce, hear, spell, type and remember. Avoid obscure classical roots,
   clever puns and metaphors requiring explanation. Tacitloom fails this test.
2. Seek semantic relevance with a distinctive identity. Do not reduce the
   product to routing, memory, a runbook database, a task manager or execution
   alone. ActionRoute describes the entrance rather than the whole system.
3. Be agent-compatible, not “SEO for LLMs.” Tool descriptions, skills, schemas,
   activation patterns and contracts determine use. Brand tokens do not
   guarantee tool selection or compliance.
4. Avoid crowded AI/Agent/GPT/brain/copilot branding and generic infrastructure
   terms. Do not require a semantic connection to the old KAIROS name.
5. Prefer a clean brand with technical derivatives: `NAME`, `NAME-mcp`,
   `@name/...`, CLI `name`. Use a lowercase ASCII slug suited to packages,
   commands, URI schemes, DNS, containers and GitHub. Adding `-mcp` does not
   establish uniqueness.
6. Survive beyond MCP: it is an interface, not the product's fundamental idea.
7. Treat namespace and related-software collision research as a hard gate
   before recommending a finalist. Semantic appeal alone is insufficient.

## North-star naming test

> A user says “Create PR.” The agent already knows GitHub perfectly.
> Does this name still make conceptual sense as the thing the agent checks
> before trusting its own generic procedure?

If not, the candidate describes the wrong product. Apply this inexpensive test
before registry research. The name should fit a system that uses the model's
intelligence while following **the applicable way of working here**.

## Namespace evidence required before recommendation

Check `.com`, `.dev` and `.io`; GitHub account/organization and repository;
npm unscoped package, organization scope and derived packages; MCP Registry;
Docker Hub, Quay and GHCR as applicable to distribution. Include CLI and URI
collisions, Helm/Artifact Hub, relevant language packages and obvious related
software or trademark conflicts. Account namespaces and repositories are
different resources; derived paths depend on ownership of their parent.

Record exact targets, URLs, timestamps, observations and blocked checks. A
search with no results, an HTTP 404 and confirmed claimability are different
claims. An empty npm name is insufficient if a confusingly similar developer
or agent product exists. Unresolved checks remain unknown; public screening
does not constitute formal trademark clearance or guarantee registration.

## Research state and provenance

- [Current candidate directions](CANDIDATES.md) are hypotheses, not cleared recommendations.
- [Historical candidates](HISTORICAL-CANDIDATES.md) and the
  [superseded recommendation](RECOMMENDATION.md) retain the 2026-09-09 research.
  Original timestamped evidence and probe scripts remain unchanged.
- The initial product snapshot was `5fe75d74dd5a5bf4ee18cde7c7c48154424f080c`.
  This revision records the subsequent “Project Rename Idea” discussion,
  conversation `6abe72f2-fc80-83ed-953d-f86803f99810`, and the user's continuation
  request on PR #737.

No fresh namespace clearance is claimed. Next: apply the north-star and
language tests, screen survivors, then recommend only with dated evidence.
Selection and any later rename are separate decisions.
