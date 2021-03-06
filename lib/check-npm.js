'use strict';

const readPackageJson = require('./util/read-package-json');
const getNpmInfo = require('./npm/get-npm-info');
const _ = require('lodash');
const semver = require('semver');
const semverDiff = require('semver-diff');
const path = require('path');
const pathExists = require('path-exists');
const merge = require('merge-options');
const ora = require('ora');

const spinner = ora(`Checking the npm registry.`);

function processModule(moduleName, currentState) {
    const cwdPackageJson = currentState.get('cwdPackageJson');

    const modulePath = path.join(currentState.get('nodeModulesPath'), moduleName);
    const packageIsInstalled = pathExists.sync(modulePath);
    const modulePackageJson = readPackageJson(path.join(modulePath, 'package.json'));
    const isPrivate = modulePackageJson.private;
    if (isPrivate) {
        return false;
    }

    spinner.text = `Checking registry for ${moduleName}`;

    const unusedDependencies = currentState.get('unusedDependencies');

    return getNpmInfo(moduleName)
        .then(fromRegistry => {
            spinner.text = `Checking registry for ${moduleName} - complete.`;

            const installedVersion = modulePackageJson.version;

            const latest = installedVersion && fromRegistry.latest && fromRegistry.next && semver.gt(installedVersion, fromRegistry.latest) ? fromRegistry.next : fromRegistry.latest;
            const versions = fromRegistry.versions || [];
            const packageJsonVersion = cwdPackageJson.dependencies[moduleName] ||
                cwdPackageJson.devDependencies[moduleName] ||
                currentState.get('globalPackages')[moduleName];
            const versionWanted = semver.maxSatisfying(versions, packageJsonVersion);

            const versionToUse = installedVersion || versionWanted;
            const usingNonSemver = semver.valid(latest) && semver.lt(latest, '1.0.0-pre');

            const bump = semver.valid(latest) &&
                        semver.valid(versionToUse) &&
                        (usingNonSemver && semverDiff(versionToUse, latest) ? 'nonSemver' : semverDiff(versionToUse, latest));

            const unused = _.includes(unusedDependencies, moduleName);

            return {
                // info
                moduleName: moduleName,
                homepage: fromRegistry.homepage,
                regError: fromRegistry.error,
                pkgError: modulePackageJson.error,

                // versions
                latest: latest,
                installed: versionToUse,
                isInstalled: currentState.get('global') || installedVersion,
                notInstalled: !packageIsInstalled,
                packageWanted: versionWanted,
                packageJson: packageJsonVersion,

                // private
                isPrivate: isPrivate,

                // meta
                devDependency: _.has(cwdPackageJson.devDependencies, moduleName),
                usedInScripts: _.findKey(cwdPackageJson.scripts, script => {
                    return script.indexOf(moduleName) !== -1;
                }),
                mismatch: semver.validRange(packageJsonVersion) &&
                    semver.valid(versionToUse) &&
                    !semver.satisfies(versionToUse, packageJsonVersion),
                semverValidRange: semver.validRange(packageJsonVersion),
                semverValid:
                    semver.valid(versionToUse),
                easyUpgrade: semver.validRange(packageJsonVersion) &&
                    semver.valid(versionToUse) &&
                    semver.satisfies(latest, packageJsonVersion) &&
                    bump !== 'major',
                bump: bump,

                unused: unused
            };
        });
}

function processData(currentState) {
    spinner.start();
    const cwdPackageJson = currentState.get('cwdPackageJson');

    function dependencies(pkg) {
        if (currentState.get('global')) {
            return currentState.get('globalPackages');
        }

        if (currentState.get('ignoreDev')) {
            return pkg.dependencies;
        }

        return merge(pkg.dependencies, pkg.devDependencies);
    }

    const allDependencies = Object.keys(dependencies(cwdPackageJson));

    const npmPromises = allDependencies.map(moduleName => processModule(moduleName, currentState));

    return Promise.all(npmPromises)
        .then(arrayOfPackageInfo => {
            const arrayOfPackageInfoCleaned = arrayOfPackageInfo
                    .filter(Boolean);

            currentState.set('packages', arrayOfPackageInfoCleaned);

            spinner.stop();
            return currentState;
        });
}

module.exports = processData;
