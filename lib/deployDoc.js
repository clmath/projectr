var git = require("./helpers/git");
var npm = require("./helpers/npm");
var lang = require("./helpers/lang");
var fs = require("fs-extra");
var q = require("promised-io/promise");
var chalk = require("chalk");
var prompt = require("./helpers/promiseHelper").prompt;
var generateJsdoc = require("./generateJsdoc");
var replace = require("replace");
var exec = require("./helpers/promiseHelper").exec;

function exists(path) {
	var deferred = new q.Deferred();

	fs.exists(path, function (exist) {
		deferred.resolve(exist);
	});

	return deferred.promise;
}

function docCreated(dir, repoName) {
	var deferred = new q.Deferred();
	var result = {};

	git.checkout(dir, repoName, "gh-pages").then(function () {
		return q.all(lang.map(["index.html", /*"community.html",*/ "_config.yml"], function (file) {
			return exists(dir + "/" + repoName + "/" + file);
		}));
	}).then(function (array) {
		result.doc = array.every(function (exist) {
			return exist;
		});
		return exists(dir + "/" + repoName + "/docs/api");
	}).then(function (jsdoc) {
		result.jsdoc = jsdoc;
		return git.checkout(dir, repoName, "master");
	}).then(function () {
		deferred.resolve(result);
	});

	return deferred.promise;
}

/*
 * Convert ibm-js links from .md -> .html
 * Ex: [...](./Container.md), or [...](/decor/docs/master/Stateful.md)
 * However, don't convert absolute URLs that are supposed to go to .md files, like
 * https://github.com/SitePen/dstore/blob/master/README.md
 */
function replaceLinks(path) {
	var common = {
		include: "*.md",
		recursive: true,
		paths: [path],
		silent: true
	};
	replace(lang.mixin({
		regex: /(http.*)\.md/g,
		replacement: "$1.XXX"
	}, common));
	replace(lang.mixin({
		regex: /\.md/g,
		replacement: ".html"
	}, common));
	replace(lang.mixin({
		regex: /\.XXX/g,
		replacement: ".md"
	}, common));

}

function makeUserDoc(cwd, version) {
	var deferred = new q.Deferred();

	console.log("Generating user documentation...");
	var out = cwd + "/docsco/";
	fs.removeSync(out);
	fs.mkdirpSync(out);

	exec("git --work-tree=docsco/ checkout " + /*version*/ "master" + " -- docs", {cwd: cwd}).then(function () {
		replaceLinks(out);

		// Update link with version number

		replace({
			regex: /(<a href="\.\.\/api\/)[^"]*/,
			replacement: "$1" + version + "/",
			paths: [cwd + "/_layouts/doc.html"],
			silent: true
		});
		replace({
			regex: /(docs\/)master(\/index\.html)/,
			replacement: "$1" + version + "$2",
			paths: [cwd + "/_layouts/main.html", cwd + "/index.html"],
			silent: true
		});

		deferred.resolve();
	});

	return deferred.promise;
}


module.exports = function (user, dir, repos) {
	return q.seq(lang.map(repos, function (repoName) {
		return function () {
			var repo = repos[repoName];

			var docDir = dir + "/doc" + repoName + "/";
			var cwd = docDir + "/" + repoName;
			fs.removeSync(docDir);
			fs.mkdirpSync(docDir);
			return git.clone(docDir, user, repoName).then(function () {
				return docCreated(docDir, repoName);
			}).then(function (exist) {
				if (exist.doc) {
					var version;

					var steps = [
						function () {
							return prompt([
								{
									name: "version",
									message: "Which version of " + chalk.green(repoName) +
										" do you want to deploy the doc for ?",
									default: repo.bower.version
								}
							]);
						},
						function (ans) {
							version = ans.version;
							return git.checkout(docDir, repoName, version);
						}
					];

					if (exist.jsdoc) {
						steps.push(function () {
							return npm.install(cwd);
						});
						steps.push(function () {
							return generateJsdoc(user, docDir, repo, repoName);
						});
					}

					steps.push(function () {
						return git.checkout(docDir, repoName, "gh-pages --force");
					});
					steps.push(function () {
						return makeUserDoc(cwd, version);
					});

					return q.seq(steps).then(function () {
						exist.jsdoc && fs.copySync(cwd + "/out/" + repoName, cwd + "/docs/");
						fs.copySync(cwd + "/docsco/docs", cwd + "/docs/" + version);

						return git.add(docDir, repoName, ["index.html", "_layouts/", "docs/", "--all"]);
					}).then(function () {
						return git.commit(docDir, repoName, "update docs to version " + version,
							"Release Script <ibmjs@fr.ibm.com>");
					}).then(function () {
						return git.push(docDir, repoName);
					}).then(function () {
						return git.checkout(docDir, repoName, "master");
					});
				} else {
					console.log(chalk.red("Error: ") + chalk.bold("No existing documentation found for ") +
						chalk.green(repoName) +
						chalk.bold(". Run http://github.com/cjolif/sdk-utils/create-doc.sh first."));
				}
			});
		};
	}));
};