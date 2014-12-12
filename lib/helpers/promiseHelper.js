var inquirer = require("inquirer");
var exec = require("child_process").exec;
var q = require("promised-io/promise");

module.exports = {
	exec: function (command, options, log) {
		var deferred = new q.Deferred();

		log && console.log(log);

		exec(command, options, function (err, stdout, stderr) {
			if (err) {
				console.log("Err: " + err);
				console.log("stderr: " + stderr);
				console.log("stdout: " + stdout);
				deferred.reject(err);
			} else {
				deferred.resolve(stdout);
			}
		});

		return deferred.promise;
	},

	prompt: function (questions) {
		var deferred = new q.Deferred();

		inquirer.prompt(questions, function (ans) {
			deferred.resolve(ans);
		});

		return deferred.promise;
	},

	wait: function (delay) {
		var deferred = new q.Deferred();
		setTimeout(function () {
			deferred.resolve();
		}, delay);
		return deferred.promise;
	}
};
