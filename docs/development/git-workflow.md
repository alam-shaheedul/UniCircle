# Git workflow

## Branch strategy

- `main` contains reviewed, production-ready increments.
- `feature/<feature-name>` contains scoped feature work.
- `fix/<issue-name>` contains scoped corrections.
- A long-lived `develop` branch is optional and should be introduced only if the team needs a separate integration branch.

## Change flow

1. Create or select a task.
2. Branch from the latest `main`.
3. Implement one cohesive change and add appropriate tests.
4. Run formatting, linting, type checking, tests, and builds relevant to the change.
5. Push the branch and open a pull request.
6. Obtain at least one review before merging important changes into `main`.
7. Use squash merge for noisy work-in-progress histories or a normal merge when individual commits are intentionally meaningful.

## Pull-request rules

- Keep unrelated changes out of the pull request.
- Complete the repository pull-request checklist.
- Require passing CI once workflows are added in Phase 11.
- Resolve review conversations before merge.
- Never commit secrets or production data.
- Prefer clear imperative commit subjects, such as `Add frontend loading state convention`.

Repository administrators should configure the GitHub `main` branch to require a pull request, at least one approving review, resolved conversations, and passing status checks once CI exists.

