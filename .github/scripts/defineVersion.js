const parseChangelog = require('changelog-parser');
const semver = require('semver');

async function defineReleaseVersion({ core }, currentVersion, changelogFile) {
  return parseChangelog(changelogFile).then((result) => {
    const unreleased = result.versions.find((entry) => entry.version === null);

    if (!unreleased.parsed) {
      core.error('No unreleased section found', unreleased);
      return;
    }

    const parsedSections = unreleased.parsed;

    const hasAddedSection = parsedSections.Added && parsedSections.Added.length > 0;
    const hasChangedSection = parsedSections.Changed && parsedSections.Changed.length > 0;
    const hasRemovedSection = parsedSections.Removed && parsedSections.Removed.length > 0;

    const hasFixedSection = parsedSections.Fixed && parsedSections.Fixed.length > 0;
    const hasSecurityEntries = parsedSections.Security && parsedSections.Security.length > 0;
    const hasDeprecatedEntries = parsedSections.Deprecated && parsedSections.Deprecated.length > 0;

    if (hasAddedSection || hasChangedSection || hasRemovedSection) {
      const version = semver.inc(currentVersion, 'minor');
      core.info(`Increase version from ${currentVersion} to ${version}`);
      return version;
    } else if (hasFixedSection || hasSecurityEntries || hasDeprecatedEntries) {
      const version = semver.inc(currentVersion, 'patch');
      core.info(`Increase version from ${currentVersion} to ${version}`);
      return version;
    } else {
      core.error('No valid entries to release', unreleased);
    }
  });
}

module.exports.defineReleaseVersion = defineReleaseVersion;
