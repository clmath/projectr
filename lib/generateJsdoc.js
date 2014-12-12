var q = require("promised-io/promise");
var npm = require("./helpers/npm");
var exec = require("./helpers/promiseHelper").exec;
var metaFiles = require("./helpers/metaFiles");
var get = require("./helpers/https").get;
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
		return "../" + dep + "/out";
	});
	var paths = {};
	lang.forEach(deps, function (dep) {
		paths[dep] = "../../../../" + dep + "/docs/api/" + deps[dep] + "/" + dep;
	});

	//TODO There should be a way for a package to specify its src.
	// this is a temporary hack for deliteful
	if (deps.delite && deps.decor) {
		config.src.push("./list");
	}

	exports && fs.mkdirpSync(cwd + "/" + path.dirname(config.dest));

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

function exportDocHelper(repo, user, dir, deps) {
	var deferred = new q.Deferred();

	if (repo.npm.jsdocDependencies) {
		q.all(repo.npm.jsdocDependencies.map(function (dep) {
			return getLatestMatchingRelease(repo.bower.dependencies[dep], user, dep).then(function (version) {
				return exportDoc(user, dir, dep, version, deps);
			});
		})).then(function () {
			deferred.resolve();
		});
	} else {
		deferred.resolve();
	}

	return deferred.promise;
}

function exportDoc(user, dir, dep, version, deps) {
	var repo = {};
	return git.clone(dir, user, dep).then(function () {
		return git.checkout(dir, dep, version);
	}).then(function () {
		return npm.install(dir + dep);
	}).then(function () {
		return q.all(lang.map(["bower", "npm"], function (type) {
			return metaFiles.read(dir, dep, type).then(function (content) {
				repo[type] = content;
			});
		}));
	}).then(function () {
		return exportDocHelper(repo, user, dir, deps);
	}).then(function () {
		return runJsdoc(dir + dep, dep, true, deps);
	}).then(function () {
		deps[dep] = version;
	});
}

function getLatestMatchingRelease(range, user, repoName) {
	var deferred = new q.Deferred();

	get("/repos/" + user + "/" + repoName + "/releases").then(function (releases) {
		releases = JSON.parse(releases);
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



module.exports = function (user, dir, repo, repoName) {
	var cwd = dir + repoName;

	// Store processed deps
	var deps = {};

	return exportDocHelper(repo, user, dir, deps).then(function () {
		removeBuildStatus(cwd);
		return runJsdoc(cwd, repoName, false, deps);
	});
}