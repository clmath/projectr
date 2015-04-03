var fs = require("fs-extra");
var q = require("promised-io/promise");

function getMetaPath(dir, repoName, type) {
	return dir + "/" + repoName + "/" + (type === "npm" ? "package" : type) + ".json";
}

module.exports = {
	read: function (dir, repoName, type) {
		var deferred = new q.Deferred();

		fs.readJSON(getMetaPath(dir, repoName, type), function (err, data) {
			if (err) {
				deferred.reject(err);
				return;
			}
			deferred.resolve(data);
		});

		return deferred.promise;
	},

	write: function (dir, repoName, type, content) {
		var deferred = new q.Deferred();

		fs.writeFile(getMetaPath(dir, repoName, type), content, function (err) {
			if (err) {
				deferred.reject(err);
			} else {
				deferred.resolve();
			}
		});

		return deferred.promise;
	}
};
