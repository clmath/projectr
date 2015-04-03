var https = require("./helpers/https");
var chalk = require("chalk");
var q = require("promised-io/promise");
var npm = require("./helpers/npm");
var git = require("./helpers/git");
var createRepo = require("./helpers/repo");
var updateMetaFiles = require("./updateMetaFiles");
var fs = require("fs-extra");

//Template for changelog:
//#### What's new in this release ?
//
//###### New Features
//
//* Add support for foo ([#12](#12))
//* Bar can do a lot more stuff ([#13](#13))
//
//###### Enhancement
//
//* Foo is faster on ios7 ([#15](#15))
//
//###### Bug fixes
//
//* Fix issue with foo ([#1](#1))
//* Fix issue with bar ([#2](#2))
//* Fix issue with baz ([#3](#3))
function makeIssueList(title, pluralSuffix, issues) {
	var result = "";
	if (issues.length !== 0) {
		result += "###### " + title + (issues.length > 1 ? pluralSuffix : "") + "\n\n";
		issues.forEach(function (issue) {
			/* Disable the not camel case warning on html_url because it's from the Github api */
			/* jshint -W106 */
			result += "* " + issue.title + " ([#" + issue.number + "](" + issue.html_url + "))\n";
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

function milestones(user, repo) {
	var deferred = new q.Deferred();

	var issueList = "#### What's new in this release?\n\n";

	//Get all the milestones to find if one was created for this version
	https.getJSON("/repos/" + user + "/" + repo.name + "/milestones").then(function (milestones) {
		// Milestone titles are guaranteed to be unique hence the [0] at the end.
		var milestone = milestones.filter(function (milestone) {
			return milestone.title === repo.newVersion;
		})[0];

		// If no milestone is found, just skip the whole function.
		if (!milestone) {
			deferred.resolve();
			return;
		}

		// Start to construct the changelog for the release.
		// Begin with features.
		getChangelogIssues(user, repo.name, milestone, "feature").then(function (features) {
			issueList += makeIssueList("New Feature", "s", features);
			// Then get enhancements
			return getChangelogIssues(user, repo.name, milestone, "enhancement");
		}).then(function (enhancements) {
			issueList += makeIssueList("Enhancement", "s", enhancements);
			// Then get bugs
			return getChangelogIssues(user, repo.name, milestone, "bug");
		}).then(function (bugs) {
			issueList += makeIssueList("Bug Fix", "es", bugs);
			return closeMilestone(user, repo.name, milestone);
		}).then(function () {
			return getIssues(user, repo.name, milestone, "", "open");
		}).then(function (issues) {
			if (issues && issues.length) {
				var report = "Issues still open in milestone " + milestone.title + "\n" +
					"Click here to view on Github: https://github.com/" + user + "/" + repo.name +
					"/milestones/" + milestone.title + "\n\n";

				issues.forEach(function (issue) {
					report += "\t* " + issue.title + " (#" + issue.number + ") -\n" +
						"\t\thttps://github.com/" + user + "/" + repo.name + "/issues/" + issue.number + "\n";
				});
				var path = repo.name + "-" + milestone.title + "-openIssues.txt";
				fs.writeFileSync(path, report);
				console.log(chalk.bold("There was open issues for milestone " + milestone.title + ". You " +
					"can find a list of those issue in " + path + "."));
			}
			deferred.resolve(issueList);
			//TODO: update projects.json

		});
	});

	return deferred.promise;
}

function github(dir, user, repo) {
	var diff = repo.oldVersion + "..." + repo.newVersion;
	var changelog = "Changelog: [" + diff + "](../../compare/" + diff + ")";

	// Release on Github
	console.log(chalk.bold("Releasing version " + repo.newVersion + " of " + repo.name + " on GitHub..."));
	return milestones(user, repo).then(function (issueList) {
		/* Disable the not camel case warning on tag_name because it's from the Github api */
		/* jshint -W106 */
		var data = {
			tag_name: repo.newVersion,
			//TODO switch to false when real release
			prerelease: true,
			name: repo.newVersion,
			body: issueList || changelog
		};
		/* jshint +W106 */
		return https.post("/repos/" + user + "/" + repo.name + "/releases", data);
	}).then(function () {
		// get the new release in the repo
		return git.pull(dir, repo.name);
	});
}

function npmRelease(dir, repo) {
	var deferred = new q.Deferred();

	if (!repo.npm.private) {
		var npmName = repo.npm.name;
		console.log(chalk.bold("Publishing new version of " + npmName + " on npm..."));
		npm.publish(dir + "/" + repo.name).then(function () {
			deferred.resolve();
		});
	} else {
		deferred.resolve();
	}

	return deferred.promise;
}


module.exports = function (dir, user, repoName) {
	dir = dir + "/release";
	fs.mkdirpSync(dir);
	var repo;

	var steps = [
		function () {
			return createRepo.create(dir, user, repoName).then(function (newRepo) {
				repo = newRepo;
			});
		},
		function () {
			return updateMetaFiles(dir, repo);
		}
	];
	if (!GLOBAL.dryRun) {
		steps.push(function () {
			return github(dir, user, repo);
		});
		steps.push(function () {
			return npmRelease(dir, repo);
		});
	}
	return q.seq(steps);
};
