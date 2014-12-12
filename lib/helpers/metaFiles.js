var fs = require("fs");
var q = require("promised-io/promise");

function getMetaPath(tmpDir, repoName, type) {
	return tmpDir + "/" + repoName + "/" + (type === "npm" ? "package" : type) + ".json";
}

module.exports = {
	read: function (tmpDir, repoName, type) {
		var deferred = new q.Deferred();

		fs.readFile(getMetaPath(tmpDir, repoName, type), function (err, data) {
			if (err) {
				deferred.reject(err);
				return;
			}
			deferred.resolve(JSON.parse(data.toString()));
		});

		return deferred.promise;
	},

	write: function (tmpDir, repoName, type, content) {
		var deferred = new q.Deferred();

		fs.writeFile(getMetaPath(tmpDir, repoName, type), content, function (err) {
			if (err) {
				deferred.reject(err);
			} else {
				deferred.resolve();
			}
		});

		return deferred.promise;
	}
};
