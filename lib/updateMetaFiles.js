var metaFiles = require("./helpers/metaFiles");
var prompt = require("./helpers/promiseHelper").prompt;
var wait = require("./helpers/promiseHelper").wait;
var git = require("./helpers/git");
var lang = require("./helpers/lang");
var q = require("promised-io/promise");
var chalk = require("chalk");


function askVersions(repos) {
	return q.seq(lang.map(repos, function (repoName) {
		return function () {
			var repo = repos[repoName];

			console.log(chalk.bold("Repository ") + chalk.green(repoName) + chalk.bold(" is in version ") +
				chalk.green(repo.oldVersion) + chalk.bold("."));

			return prompt([{
				name: "newVersion",
				message: "What is the new version of " + repoName + "?",
				default: repo.oldVersion
			}]).then(function (ans) {
				repo.newVersion = ans.newVersion;

				return q.seq(lang.map(["bower", "npm"], function (type) {
					return function () {
						if (repo[type].dependencies && !lang.isEmpty(repo[type].dependencies)) {
							return askDeps(repoName, repo, type);
						}
					};
				}));
			});
		};
	}));
}

function askDeps(repoName, repo, type) {
	var deps = repo[type].dependencies;
	var depsList = lang.map(deps, function (dep) {
		return {name: dep + ": " + deps[dep], value: dep};
	});

	return prompt([{
		type: "checkbox",
		name: "deps",
		choices: depsList,
		message: "Do you want to update some " + repoName + " " + type + " dependencies ?"
	}]).then(function (ans) {
		return prompt(lang.map(ans.deps, function (dep) {
			return {
				name: dep,
				default: deps[dep],
				message: "enter the new version of " + dep
			};
		}));
	}).then(function (ans) {
		repo["new" + type + "Deps"] = {};
		lang.forEach(ans, function (dep) {
			repo["new" + type + "Deps"][dep] = ans[dep];
		});
		// add a blank line in the console
		console.log("");
	});
}

function askConfirm(repos) {
	var deferred = new q.Deferred();

	// List all changes
	console.log("\n" + chalk.bold("Here are the changes that will be applied:"));
	lang.forEach(repos, function (repoName) {
		var repo = repos[repoName];
		console.log(chalk.bold("For repository ") + chalk.green(repoName) + ":");
		console.log(chalk.cyan("* ") + chalk.bold("version: ") + repo.oldVersion + " -> " + repo.newVersion);

		repo.newbowerDeps && !lang.isEmpty(repo.newbowerDeps) && logDeps(repo, repoName, "bower");
		repo.newnpmDeps && !lang.isEmpty(repo.newnpmDeps) && logDeps(repo, repoName, "npm");
	});

	// Confirm prompt
	prompt([{
		type: "confirm",
		name: "validate",
		message: "Do you want to perform those changes ?",
		default: false
	}]).then(function (ans) {
		if (!ans.validate) {
			deferred.reject(chalk.red("You aborted the process. Nothing has been done."));
		} else {
			deferred.resolve();
		}
	});

	return deferred.promise;
}

function logDeps(repo, repoName, type) {
	var deps = repo["new" + type + "Deps"];
	console.log("  " + type[0].toUpperCase() + type.slice(1) + " dependencies:");
	lang.forEach(deps, function (dep) {
		console.log(chalk.cyan("  * ") + chalk.bold(dep) + ": " + repo.bower.dependencies[dep] + " -> " +
			deps[dep]);
	});
}

function performChanges(dir, repos, dryRun) {
	return q.all(lang.map(repos, function (repoName) {
		var repo = repos[repoName];

		return q.all(lang.map(["bower", "npm"], function (type) {
			console.log(chalk.bold("Updating " + repoName + "/" + (type === "npm" ? "package" : type) +
				".json..."));
			return updateMeta(dir, repo, repoName, type);
		})).then(function () {
			var steps = [
				function () {
					return git.add(dir, repoName, ["--all"]);
				},
				function () {
					return git.commit(dir, repoName, "update to version " + repo.newVersion,
						"Release Script <ibmjs@fr.ibm.com>");
				}
			];
			if (!dryRun) {
				steps.push(function () {
					return git.push(dir, repoName);
				});
			}
			return q.seq(steps);
		}).then(function () {
			// To give the github server some time to process the push
			return wait(1000);
		});
	}));
}

function updateMeta(dir, repo, repoName, type) {
	repo[type].version = repo.newVersion;

	var deps = repo["new" + type + "Deps"];
	deps && lang.forEach(deps, function (dep) {
		repo[type].dependencies[dep] = deps[dep];
	});

	return metaFiles.write(dir, repoName, type, JSON.stringify(repo[type], null, "\t") + "\n");
}

module.exports = function (dir, repos, dryRun) {
	return askVersions(repos).then(function () {
		return askConfirm(repos);
	}).then(function () {
		return performChanges(dir, repos, dryRun);
	});
};
