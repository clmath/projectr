var fs = require("fs-extra");
var q = require("promised-io/promise");
var lang = require("./lang");
var metaFiles = require("./metaFiles");
var git = require("./git");

function readMetaFiles(dir, repo) {
	return q.all(lang.map(["bower", "npm"], function (type) {
		return metaFiles.read(dir, repo.name, type).then(function (content) {
			repo[type] = content;
		});
	})).then(function () {
		// Check files consistency
		if (repo.bower.version !== repo.npm.version) {
			throw "Version of " + repo.name + " are inconsistent between package.json and bower.json.";
		}
	});
}

module.exports = {
	create: function (dir, user, repoName) {
		var deferred = new q.Deferred();

		var repo = {
			name: repoName
		};

		var dest = dir + "/" + repo.name;

		fs.removeSync(dest);

		git.clone(dir, user, repo.name).then(function () {
			return readMetaFiles(dir, repo);
		}).then(function () {
			deferred.resolve(repo);
		});

		return deferred.promise;
	}
};