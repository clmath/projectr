var metaFiles = require("./helpers/metaFiles");
var ask = require("./helpers/promiseHelper").ask;
var wait = require("./helpers/promiseHelper").wait;
var git = require("./helpers/git");
var lang = require("./helpers/lang");
var q = require("promised-io/promise");
var chalk = require("chalk");


function askVersion(repo) {
	repo.oldVersion = repo.bower.version;

	console.log(chalk.bold("Repository ") + chalk.green(repo.name) + chalk.bold(" is in version ") +
		chalk.green(repo.oldVersion) + chalk.bold("."));

	return ask([{
		name: "newVersion",
		message: "What is the new version of " + repo.name + "?",
		default: repo.oldVersion
	}]).then(function (ans) {
		repo.newVersion = ans.newVersion;

		return q.seq(lang.map(["bower", "npm"], function (type) {
			return function () {
				if (repo[type].dependencies && !lang.isEmpty(repo[type].dependencies)) {
					return askDeps(repo, type);
				}
			};
		}));
	});
}

function askDeps(repo, type) {
	var deps = repo[type].dependencies;
	var depsList = lang.map(deps, function (dep) {
		return {name: dep + ": " + deps[dep], value: dep};
	});

	return ask([{
		type: "checkbox",
		name: "deps",
		choices: depsList,
		message: "Do you want to update some " + repo.name + " " + type + " dependencies ?"
	}]).then(function (ans) {
		return ask(lang.map(ans.deps, function (dep) {
			return {
				name: dep,
				default: deps[dep],
				message: "Enter the new version for " + dep
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

function askConfirm(repo) {
	var deferred = new q.Deferred();

	// List all changes
	console.log("\n" + chalk.bold("Here are the changes that will be applied:"));
	console.log(chalk.bold("For repository ") + chalk.green(repo.name) + ":");
	console.log(chalk.cyan("* ") + chalk.bold("version: ") + repo.oldVersion + " -> " + repo.newVersion);

	repo.newbowerDeps && !lang.isEmpty(repo.newbowerDeps) && logDeps(repo, "bower");
	repo.newnpmDeps && !lang.isEmpty(repo.newnpmDeps) && logDeps(repo, "npm");

	// Confirm prompt
	ask([{
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

function logDeps(repo, type) {
	var deps = repo["new" + type + "Deps"];
	console.log("  " + type[0].toUpperCase() + type.slice(1) + " dependencies:");
	lang.forEach(deps, function (dep) {
		console.log(chalk.cyan("  * ") + chalk.bold(dep) + ": " + repo.bower.dependencies[dep] + " -> " +
			deps[dep]);
	});
}

function performChanges(dir, repo) {
	return q.all(lang.map(["bower", "npm"], function (type) {
		console.log(chalk.bold("Updating " + repo.name + "/" + (type === "npm" ? "package" : type) +
			".json..."));
		return updateMeta(dir, repo, type);
	})).then(function () {
		var steps = [
			function () {
				return git.add(dir, repo.name, ["--all"]);
			},
			function () {
				return git.commit(dir, repo.name, "update to version " + repo.newVersion,
					"Release Script <ibmjs@fr.ibm.com>");
			}
		];
		if (!GLOBAL.dryRun) {
			steps.push(function () {
				return git.push(dir, repo.name);
			});
		}
		return q.seq(steps);
	}).then(function () {
		// To give the github server some time to process the push
		return wait(1000);
	});
}

function updateMeta(dir, repo, type) {
	repo[type].version = repo.newVersion;

	var deps = repo["new" + type + "Deps"];
	deps && lang.forEach(deps, function (dep) {
		repo[type].dependencies[dep] = deps[dep];
	});

	return metaFiles.write(dir, repo.name, type, JSON.stringify(repo[type], null, "\t") + "\n");
}

module.exports = function (dir, repo) {
	return askVersion(repo).then(function () {
		return askConfirm(repo);
	}).then(function () {
		return performChanges(dir, repo);
	});
};
