var npmLoader = require("npm");
var q = require("promised-io/promise");
var exec = require("./promiseHelper").exec;

module.exports = {
	search: function (name) {
		var deferred = new q.Deferred();

		npmLoader.load(function (err, npm) {
			if (err) {
				deferred.reject(err);
				return;
			}
			npm.commands.search([name], true, function (err, result) {
				if (err) {
					deferred.reject(err);
				} else {
					deferred.resolve(result);
				}
			});
		});

		return deferred.promise;
	},

	publish: function (dir) {
		var deferred = new q.Deferred();

		npmLoader.load(function (err, npm) {
			if (err) {
				deferred.reject(err);
				return;
			}

			npm.commands.publish([dir], function (err, result) {
				if (err) {
					deferred.reject(err);
				} else {
					deferred.resolve(result);
				}
			});
		});

		return deferred.promise;
	},

	install: function (dir) {
		return exec("npm install", {cwd: dir}, "Installing npm dependencies...");
	}
};

