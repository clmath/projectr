var prompt = require("./helpers/promiseHelper").prompt;
var q = require("promised-io/promise");

module.exports = function () {
	var deferred = new q.Deferred();

	prompt([{
		type: "input",
		name: "username",
		message: "Enter your Github username:"
	}, {
		type: "password",
		name: "password",
		message: "Enter your Github password:"
	}]).then(function (ans) {
		GLOBAL.username = ans.username;
		GLOBAL.password = ans.password;
		deferred.resolve();
	});

	return deferred.promise;
};