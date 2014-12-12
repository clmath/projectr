var q = require("promised-io/promise");
var chalk = require("chalk");
var login = require("./lib/login");
var askRepos = require("./lib/askRepos");
var release = require("./lib/release");
var deployDoc = require("./lib/deployDoc");

var yargs = require("yargs")
	.usage("Usage: node projectr.js [--release] [--doc] [--build] [--dry-run] [--dir path] [--skip-clone]")
	.alias("b", "build")
	.describe("b", "Build, release and deploy minified version")
	.alias("d", "doc")
	.describe("d", "Generate jsdoc and deploy docs on ibm-js.github.io")
	.alias("r", "release")
	.describe("r", "Make a new release on GitHub and Npm")
	.describe("dry-run", "Only perform local changes")
	.describe("dir", "Specify the directory in which the projects are cloned")
	.default("dir", "tmp")
	.describe("skip-clone", "If the repository already exist in the directory, don't clone it again")
	.help("help")
	.argv;

var user,
	repos;

var dir = yargs.dir;

var steps = [
	function () {
		return login();
	},
	function () {
		return askRepos(dir, yargs.skipClone).then(function (ans) {
			repos = ans.repos;
			user = ans.user;
		});
	}
];

var all = !(yargs.release || yargs.doc || yargs.build);

if (all || yargs.release) {
	steps.push(function () {
		return release(dir, user, repos);
	});
}

if (all || yargs.doc) {
	steps.push(function () {
		return deployDoc(user, dir, repos);
	});
}

q.seq(steps).then(function () {
	console.log(chalk.green("All done!"));
});


/*
var askRepos = require("./askRepos");
var updateMetaFiles = require("./updateMetaFiles");
var releaseGH = require("./releaseGH");
var releaseNpm = require("./releaseNpm");
var deployDoc = require("./deployDoc");
var rimraf = require("rimraf");
var q = require("promised-io/promise");

var fs = require("fs");
var chalk = require("chalk");

var tmpDir = "tmpRelease";

var user;
var repos;

var skipClone = process.argv[2] === "true";

if (!skipClone) {
	rimraf.sync(tmpDir);
	fs.mkdirSync(tmpDir);
}

var steps = [
	function () {
		return login();
	},
	function () {
		return askRepos(tmpDir, skipClone);
	},
	function (ans) {
		repos = ans.repos;
		user = ans.user;
		return updateMetaFiles(tmpDir, repos);
	}
];

if (null) {
	steps.push(function () {
		return releaseGH(user, repos);
	});
	steps.push(function () {
		return releaseNpm(tmpDir, repos);
	});
}
steps.push(function () {
	deployDoc(tmpDir, repos);
});

q.seq(steps);*/