var lang = require("./helpers/lang");
var https = require("./helpers/https");
var chalk = require("chalk");
var q = require("promised-io/promise");
var npm = require("./helpers/npm");
var git = require("./helpers/git");
var updateMetaFiles = require("./updateMetaFiles");
var fs = require("fs-extra");

//Template for changelog:
//#### What's new in this release ?
//
//###### New Features
//
//* [Add support for foo (#12)](#1)
//* [Bar can do a lot more stuff (#25)](#1)
//
//###### Enhancement
//
//* [Foo is faster on ios7 (#15)](#1)
//
//###### Bug fixes
//
//* [Fix issue with foo (#2)](#1)
//* [Fix issue with bar (#3)](#1)
//* [Fix issue with baz (#4)](#1)
function makeIssueList(title, pluralSuffix, issues) {
	var result = "";
	if (issues.length !== 0) {
		result += "###### " + title + (issues.length > 1 ? pluralSuffix : "") + "\n\n";
		issues.forEach(function (issue) {
			/* Disable the not camel case warning on html_url because it's from the Github api */
			/* jshint -W106 */
			result += "* [" + issue.title + " (#" + issue.number + ")](" + issue.html_url +
				")\n";
			/* jshint +W106 */

		});
		result += "\n";
	}

	return result;
}

function closeMilestone(user, repoName, milestone) {
	var data = {state: "closed"};
	return https.post("/repos/" + user + "/" + repoName + "/milestones/" + milestone.number, data);
}

function getIssues(user, repoName, milestone, labels, state) {
	return https.getJSON("/repos/" + user + "/" + repoName + "/issues?milestone=" + milestone.number +
		"&state=" + state + "&labels=" + labels);
}

function getChangelogIssues(user, repoName, milestone, labels) {
	var invalidLabels = ["wontfix", "invalid", "question", "duplicate"];

	return getIssues(user, repoName, milestone, labels, "closed").then(function (issues) {
		// Remove invalid/wontfix/question/duplicate tickets
		return issues.filter(function (issue) {
			return issue.labels.every(function (label) {
				return invalidLabels.indexOf(label.name) === -1;
			});
		});
	});
}

function milestones(user, repoName, version) {
	var deferred = new q.Deferred();

	var changelog = "#### What's new in this release?\n\n";

	//Get all the milestones to find if one was created for this version
	https.getJSON("/repos/" + user + "/" + repoName + "/milestones").then(function (milestones) {
		// Milestone titles are guaranteed to be unique hence the [0] at the end.
		var milestone = milestones.filter(function (milestone) {
			return milestone.title === version;
		})[0];

		// If no milestone is found, just skip the whole function.
		if (!milestone) {
			deferred.resolve();
			return;
		}

		// Start to construct the changelog for the release.
		// Begin with features.
		getChangelogIssues(user, repoName, milestone, "feature").then(function (features) {
			changelog += makeIssueList("New Feature", "s", features);
			// Then get enhancements
			return getChangelogIssues(user, repoName, milestone, "enhancement");
		}).then(function (enhancements) {
			changelog += makeIssueList("Enhancement", "s", enhancements);
			// Then get bugs
			return getChangelogIssues(user, repoName, milestone, "bug");
		}).then(function (bugs) {
			changelog += makeIssueList("Bug Fix", "es", bugs);
			return closeMilestone(user, repoName, milestone);
		}).then(function () {
			return getIssues(user, repoName, milestone, "", "open");
		}).then(function (issues) {
			var report = "Issues still open in milestone " + milestone.title + "\n" +
					"Click here to view on Github: https://github.com/" + user + "/" + repoName +
					"/milestones/" + milestone.title + "\n\n";

			issues.forEach(function (issue) {
				report += "\t* " + issue.title + " (#" + issue.number + ") -\n" +
					"\t\thttps://github.com/" + user + "/" + repoName + "/issues/" + issue.number + "\n";
			});
			fs.writeFileSync("issues.txt", report);
			deferred.resolve(changelog);
			//TODO: update projects.json

		});
	});

	return deferred.promise;
}

function github(dir, user, repos) {
	return q.all(lang.map(repos, function (repoName) {
		var repo = repos[repoName];
		var newVersion = repo.newVersion;
		var diff = repo.oldVersion + "..." + newVersion;
		var changelog = "Changelog: [" + diff + "](../../compare/" + diff + ")";

		// Release on Github
		console.log(chalk.bold("Releasing version " + newVersion + " of " + repoName + " on GitHub..."));
		return milestones(user, repoName, newVersion).then(function (list) {
			/* Disable the not camel case warning on tag_name because it's from the Github api */
			/* jshint -W106 */
			var data = {
				tag_name: newVersion,
				//TODO switch to false when real release
				prerelease: true,
				name: newVersion,
				body: list || changelog
			};
			/* jshint +W106 */
			return https.post("/repos/" + user + "/" + repoName + "/releases", data);
		}).then(function () {
			// get the new release in the repo
			return git.pull(dir, repoName);
		});
	}));
}

function npmRelease(dir, repos) {
	var npmRepos = [];
	lang.forEach(repos, function (repoName) {
		if (!repos[repoName].npm.private) {
			npmRepos.push(repoName);
		}
	});
	return q.all(lang.map(npmRepos, function (repoName) {
		var npmName = repos[repoName].npm.name;
		console.log(chalk.bold("Publishing new version of " + npmName + " on npm..."));
		return npm.publish(dir + "/" + repoName);
	}));
}

module.exports = function (dir, user, repos, dryRun) {
	var steps = [
		function () {
			return updateMetaFiles(dir, repos, dryRun);
		}
	];
	if (!dryRun) {
		steps = steps.concat([
			function () {
				return github(dir, user, repos);
			},
			function () {
				return npmRelease(dir, repos);
			}
		]);
	}
	return q.seq(steps);
};
