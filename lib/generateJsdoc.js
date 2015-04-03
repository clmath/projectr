var q = require("promised-io/promise");
var npm = require("./helpers/npm");
var exec = require("./helpers/promiseHelper").exec;
var createRepo = require("./helpers/repo");
var https = require("./helpers/https");
var lang = require("./helpers/lang");
var semver = require("semver");
var git = require("./helpers/git");
var path = require("path");
var fs = require("fs-extra");
var replace = require("replace");

var config = {
	src: [
		".",
		"./README.md",
		"./package.json"
	],

	dest: "./out/doclets.json",
	packagePathFormat: "${name}/api/${version}",
	includeEventsInTOC: "false"
};

function removeBuildStatus(cwd) {
	replace({
		regex: /\[!\[Build Status]\([^\)]*\)]\([^\)]*\)/,
		replacement: "",
		paths: [cwd + "/README.md"],
		silent: true
	});
}

function runJsdoc(cwd, repoName, exports, deps) {
	var imports = lang.map(deps, function (dep) {
		return "../" + dep + "/out/";
	});
	var paths = {};
	lang.forEach(deps, function (dep) {
		paths[dep] = "../../../../" + dep + "/docs/api/" + deps[dep] + "/" + dep;
	});

	//TODO There should be a way for a package to specify its src.
	// this is a temporary hack for deliteful
	if (deps.delite && deps.decor) {
		config.src.push("./list");
		config.src.push("./Combobox");
	}

	exports && fs.mkdirpSync(cwd + "/" + path.dirname(config.dest));

	imports = [ imports[imports.length - 1] ];

	imports && (process.env.JSDOC_IMPORT_ROOTS = imports.join(path.delimiter));
	paths && (process.env.JSDOC_MODULE_PATHS = JSON.stringify(paths));

	process.env.JSDOC_PACKAGE_PATH_FORMAT = config.packagePathFormat;
	process.env.INCLUDE_EVENTS_IN_TOC = config.includeEventsInTOC;

	var command = "node ./node_modules/jsdoc-amddcl/node_modules/jsdoc/jsdoc.js " + (exports ? "-X " : "") +
		"-c ./node_modules/jsdoc-amddcl/conf.json";

	command += " " + config.src.map(function (file) {
		return JSON.stringify(file);
	}).join(" ");

	command += (exports ? " > " + JSON.stringify(config.dest) : "");
	var log = (exports ? "Exporting" : "Generating") + " " + repoName + " jsdoc...";
	return exec(command, {cwd: cwd}, log);
}

function exportDocHelper(dir, user, repo, deps) {
	var deferred = new q.Deferred();

	if (repo.npm.jsdocDependencies) {
		q.all(repo.npm.jsdocDependencies.map(function (repoName) {
			return getLatestMatchingRelease(repo.bower.dependencies[repoName], user, repoName).then(function (version) {
				return exportDoc(user, dir, repoName, version, deps);
			});
		})).then(function () {
			deferred.resolve();
		});
	} else {
		deferred.resolve();
	}

	return deferred.promise;
}

function exportDoc(user, dir, repoName, version, deps) {
	var repo;
	var cwd = dir + "/" + repoName;

	return createRepo.create(dir, user, repoName).then(function (newRepo) {
		repo = newRepo;
		return git.checkout(dir, repo.name, version);
	}).then(function () {
		return npm.install(cwd);
	}).then(function () {
		return exportDocHelper(dir, user, repo, deps);
	}).then(function () {
		return runJsdoc(cwd, repo.name, true, deps);
	}).then(function () {
		deps[repo.name] = version;
	});
}

function getLatestMatchingRelease(range, user, repoName) {
	var deferred = new q.Deferred();

	https.getJSON("/repos/" + user + "/" + repoName + "/releases").then(function (releases) {
		var tags = lang.map(releases, function (release) {
			/* Disable the not camel case warning on tag_name because it's from the Github api */
			/* jshint -W106 */
			return release.draft ? "draft" : release.tag_name;
			/* jshint +W106 */
		}).filter(function (tag) {
			return tag !== "draft";
		});
		var latest = semver.maxSatisfying(tags, range) || "master";
		console.log("Found " + repoName + " dependency @" + latest);
		deferred.resolve(latest);
	});

	return deferred.promise;
}



module.exports = function (dir, user, repo) {
	var cwd = dir + "/" + repo.name;

	// Store processed deps
	var deps = {};

	return exportDocHelper(dir, user, repo, deps).then(function () {
		removeBuildStatus(cwd);
		return runJsdoc(cwd, repo.name, false, deps);
	});
}