var prompt = require("./helpers/promiseHelper").prompt;
var git = require("./helpers/git");
var lang = require("./helpers/lang");
var q = require("promised-io/promise");
var metaFiles = require("./helpers/metaFiles");
var fs = require("fs-extra");

function readMetaFiles(tmpDir, repo, repoName) {
	return q.all(lang.map(["bower", "npm"], function (type) {
		return metaFiles.read(tmpDir, repoName, type).then(function (content) {
			repo[type] = content;
		});
	})).then(function () {
		// Check files consistency
		if (repo.bower.version !== repo.npm.version) {
			throw "Version of " + repoName + " are inconsistent between package.json and bower.json.";
		}
		repo.oldVersion = repo.bower.version;
	});
}


module.exports = function (dir, skipClone) {
	var deferred = new q.Deferred();

	var answers;
	prompt([{
		name: "user",
		message: "To which user belongs the repositories ?",
		default: GLOBAL.username
	}, {
		name: "repos",
		message: "Which repository do you want to work with ?"
	}]).then(function (ans) {
		answers = {
			user: ans.user.trim(),
			repos: {}
		};
		var repos = ans.repos.trim().split(/\s+/);
		lang.forEach(repos, function (element) {
			answers.repos[element] = {};
		});

		var reposToClone;

		// If user specified skip-clone, check if repos already exist
		if (skipClone) {
			reposToClone = [];
			lang.forEach(answers.repos, function (repoName) {
				if (!fs.existsSync(dir + "/" + repoName + "/.git/")) {
					reposToClone.push(repoName);
				}
			});
		} else {
			fs.removeSync(dir);
			fs.mkdirpSync(dir);
			reposToClone = repos;
		}

		// Clone needed repositories
		return q.all(lang.map(reposToClone, function (repoName) {
			fs.removeSync(dir + "/" + repoName);
			return git.clone(dir, ans.user, repoName);
		}));
	}).then(function () {
		// read all meta data.
		return q.all(lang.map(answers.repos, function (repoName) {
			return readMetaFiles(dir, answers.repos[repoName], repoName);
		}));
	}).then(function () {
		deferred.resolve(answers);
	});

	return deferred.promise;
};
