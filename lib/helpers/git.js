var exec = require("./promiseHelper").exec;
var chalk = require("chalk");

module.exports = {
	clone: function (dir, user, repoName) {
		var name = user + "/" + repoName;
		return exec("git clone git@github.com:" + name + ".git", {cwd: dir},
			chalk.bold("Cloning " + name + "...")).then(function () {
				return exec("git fetch --all", {cwd: dir + "/" + repoName});
			});
	},
	checkout: function (dir, repoName, branch) {
		return exec("git checkout " + branch, {cwd: dir + "/" + repoName});
	},
	add: function (dir, repoName, args) {
		args.unshift("add");
		return exec("git " + args.join(" "), {cwd: dir + "/" + repoName});
	},
	commit: function (dir, repoName, message, author) {
		return exec("git commit -m \"" + message + "\" --author \"" + author + "\"", {cwd: dir + "/" + repoName},
			chalk.bold("Committing changes in " + repoName + "..."));
	},
	push: function (dir, repoName) {
		return exec("git push", {cwd: dir + "/" + repoName},
			chalk.bold("Pushing changes in " + repoName + "..."));
	},
	pull: function (dir, repoName) {
		return exec("git pull --all", {cwd: dir + "/" + repoName});
	}
};