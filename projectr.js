// Get command-line arguments
var yargs = require("yargs")
	.usage("Usage: node projectr.js [--release] [--doc] [--build] [--dry-run] [--dir path] [--skip-clone]")
	.alias("b", "build")
	.describe("b", "Build, release and deploy minified version")
	.alias("d", "doc")
	.describe("d", "Generate jsdoc and deploy docs on ibm-js.github.io")
	.alias("r", "release")
	.describe("r", "Make a new release on GitHub and Npm")
	.describe("dry-run", "Only perform local changes")
	.describe("dir", "Specify a tmp directory to work")
	.default("dir", "tmp")
//	.describe("skip-clone", "If the repository already exist in the directory, don't clone it again")
	.help("help")
	.argv;

// Set global configuration variable
GLOBAL.dryRun = yargs.dryRun;
//GLOBAL.skipClone = yargs.skipClone;

// Set local configuration variable
var dir = yargs.dir;
var user,
	repoName;

// Load dependencies once the globals have been set
var q = require("promised-io/promise");
var chalk = require("chalk");
var fs = require("fs-extra");
var askRepo = require("./lib/askRepo");
var deployDoc = require("./lib/deployDoc");
var login = require("./lib/login");
var release = require("./lib/release");

fs.mkdirpSync(dir);

var steps = [
	function () {
		// login() will set GLOBAL.username and GLOBAL.password
		return login();
	},
	function () {
		return askRepo().then(function (ans) {
			repoName = ans.repoName;
			user = ans.user;
		});
	}
];

var all = !(yargs.release || yargs.doc || yargs.build);

if (all || yargs.release) {
	steps.push(function () {
		return release(dir, user, repoName);
	});
}

if (all || yargs.doc) {
	steps.push(function () {
		return deployDoc(dir, user, repoName);
	});
}

//TODO Add a step for the build

q.seq(steps).then(function () {
	console.log(chalk.green("All done!"));
});
