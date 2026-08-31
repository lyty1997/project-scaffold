# Product Roadmap

English | [Chinese](content-roadmap-zh.md)

> Note: If your project does not publish content—for example, if it is a pure utility product or an internal system—you can rename this file to `docs/product/roadmap.md` or delete it. Not every product roadmap needs to be organized around "content"; organizing it by feature area or user journey is equally valid.

Status: draft
Last updated: __enter the most recent update date here__

## M0: __describe the positioning of the first usable release here, for example, "minimum viable entry point" or "core-loop validation"__

> Optional example: If your project does have "content" and needs distinct publication stages, you can declare a content-stage enum as shown below. If you do not need it, delete the next line and **also delete the `content_stage` enum from `docs/contracts/contract-terms.json`**. The enum check there depends on all of these values appearing here, and deleting only one side will make `npm run check:contracts` fail.
>
> Content-stage enum: draft, planned, published, archived.

Goals:

- __Describe what the first usable release must accomplish, such as what it presents, to whom, and the smallest problem it solves.__
- __Describe the core information or capability that M0 must establish.__
- __Describe the foundational safeguards M0 must establish, such as quality gates or contract consistency, to prevent later documentation and implementation drift.__

Examples for the initial scope (replace them with your project's actual content):

- __Example: establish executable engineering conventions from scratch.__
- __Example: explain how the product or project evolves from its current stage to the next.__
- __Example: explain how public content and copy distinguish facts, plans, and items awaiting confirmation.__

## M1: __describe the structure or capability to complete in the second phase, for example, "structured core model and list/detail pages"__

Planned capabilities:

- __List the data model or domain model to establish in this phase.__
- __List the key pages or feature paths to support in this phase.__
- __List foundational capabilities to add in this phase, such as SEO, observability, or an authorization model.__

## M2: __describe the boundary to expand in the third phase, for example, "extended services and user-interaction entry points"__

Planned capabilities:

- __Describe the planned service or feature pages.__
- __Describe planned user-interaction entry points such as feedback, discussions, or subscriptions, and first define privacy and data boundaries in the Open Decisions document.__
- __Describe required compliance or explanatory content, such as a privacy notice, service boundaries, or support options.__

## Non-goals

> This is a general pattern: explicitly list what is out of scope now to prevent scope creep and align team expectations. Replace these entries with the actual boundaries of your project.

- __State clearly what is explicitly out of scope now—for example, no authentication, payments, comments, or complex backend—to prevent scope creep.__
- __State clearly which capabilities are not currently promised publicly—for example, do not claim that unreleased product capabilities have been delivered.__
