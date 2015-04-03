var ask = require("./helpers/promiseHelper").ask;
// var git = require("./helpers/git");
// var lang = require("./helpers/lang");
var q = require("promised-io/promise");
// var metaFiles = require("./helpers/metaFiles");
// var fs = require("fs-extra");
/*

*/

module.exports = function () {
	var deferred = new q.Deferred();

	ask([{
		name: "user",
		message: "To which user belongs the repository ?",
		default: GLOBAL.username
	}, {
		name: "repo",
		message: "Which repository do you want to work with ?"
	}]).then(function (ans) {
		var answers = {
			user: ans.user.trim(),
			repoName: ans.repo.trim()
		};
		deferred.resolve(answers);
	});

	return deferred.promise;
};
