// Weekly docs-feedback triage cadence runner. Invoked by
// `.github/workflows/docs-feedback-cadence.yml` via `actions/github-script`.
//
// Behavior: ensures the `docs-feedback-cadence` and `docs-feedback` labels exist,
// builds a triage report from open `docs-feedback`-labelled issues, then either
// upserts the dated cadence issue or, in dry-run mode, logs the intent.

module.exports = async ({ github, context, core, dryRun }) => {
  const owner = context.repo.owner;
  const repo = context.repo.repo;
  const cadenceLabel = "docs-feedback-cadence";
  const feedbackLabel = "docs-feedback";

  const { data: labels } = await github.rest.issues.listLabelsForRepo({
    owner,
    repo,
    per_page: 100,
  });
  const labelNames = new Set(labels.map((item) => item.name));
  for (const name of [cadenceLabel, feedbackLabel]) {
    if (!labelNames.has(name) && !dryRun) {
      await github.rest.issues.createLabel({
        owner,
        repo,
        name,
        color: name === cadenceLabel ? "5319e7" : "0e8a16",
        description:
          name === cadenceLabel
            ? "Scheduled docs feedback ownership and triage cadence"
            : "Reader feedback for documentation pages",
      });
    }
  }

  const openFeedback = await github.paginate(github.rest.issues.listForRepo, {
    owner,
    repo,
    state: "open",
    labels: feedbackLabel,
    per_page: 100,
  });

  const openFeedbackIssues = openFeedback.filter((item) => !item.pull_request);
  const titleDate = new Date().toISOString().slice(0, 10);
  const cadenceTitle = `Docs feedback triage ${titleDate}`;

  const topItems = openFeedbackIssues.slice(0, 20).map((item) => {
    return `- #${item.number} ${item.title}`;
  });
  const body = [
    "## Docs feedback cadence",
    "",
    `Open docs feedback issues: **${openFeedbackIssues.length}**`,
    "",
    "## Ownership checklist",
    "- [ ] Review all open docs feedback issues",
    "- [ ] Assign owners for actionable items",
    "- [ ] Prioritize by severity and user impact",
    "- [ ] Close stale duplicates",
    "",
    "## Current queue (first 20)",
    ...(topItems.length > 0 ? topItems : ["- No open docs feedback issues."]),
  ].join("\n");

  const existingCadence = await github.paginate(github.rest.issues.listForRepo, {
    owner,
    repo,
    state: "open",
    labels: cadenceLabel,
    per_page: 100,
  });
  const cadenceIssue = existingCadence.find((item) => !item.pull_request);

  if (dryRun) {
    core.notice(`dry_run=true, would upsert cadence issue with title: ${cadenceTitle}`);
    core.notice(`open docs feedback issues: ${openFeedbackIssues.length}`);
    return;
  }

  if (cadenceIssue) {
    await github.rest.issues.update({
      owner,
      repo,
      issue_number: cadenceIssue.number,
      title: cadenceTitle,
      body,
      labels: [cadenceLabel, feedbackLabel],
    });
    core.notice(`Updated cadence issue #${cadenceIssue.number}`);
    return;
  }

  const created = await github.rest.issues.create({
    owner,
    repo,
    title: cadenceTitle,
    body,
    labels: [cadenceLabel, feedbackLabel],
  });
  core.notice(`Created cadence issue #${created.data.number}`);
};
