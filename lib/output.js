'use strict';

const chalk = require('chalk');
const _ = require('lodash');
const table = require('text-table');
const emoji = require('./util/emoji');

function uppercaseFirstLetter(str) {
    return str[0].toUpperCase() + str.substr(1);
}

function render(pkg) {
    const packageName = pkg.moduleName;
    const rows = [];

    // DYLAN: clean this up
    const status = _([
        pkg.notInstalled ? chalk.bgGreen.white.bold(emoji(' :worried: ') + ' MISSING! ') + ' Not installed.' : '',
        pkg.pkgError && !pkg.notInstalled ? chalk.bgGreen.white.bold(emoji(' :worried: ') + ' PKG ERR! ') + ' ' + chalk.red(pkg.pkgError.message) : '',
        pkg.bump && pkg.easyUpgrade ? [
            chalk.bgGreen.white.bold(emoji(' :heart_eyes: ') + ' UPDATE!  ') + ' Your local install is out of date. ' + chalk.blue.underline(pkg.homepage || ''),
            '           ' + emoji('   ') + chalk.green('npm install --save' + (pkg.devDependency ? '-dev' : '') + ' ' + packageName + '@' + pkg.latest) + ' to go from ' + pkg.installed + ' to ' + pkg.latest
        ] : '',
        pkg.bump && !pkg.easyUpgrade ? [
            chalk.white.bold.bgGreen((pkg.bump === 'nonSemver' ? emoji(' :sunglasses: ') + ' new ver! '.toUpperCase() : emoji(' :sunglasses: ') + ' ' + pkg.bump.toUpperCase() + ' UP ')) + ' ' + uppercaseFirstLetter(pkg.bump) + ' update available. ' + chalk.blue.underline(pkg.homepage || ''),
            '           ' + emoji('   ') + chalk.green('npm install --save' + (pkg.devDependency ? '-dev' : '') + ' ' + packageName + '@' + pkg.latest) + ' to go from ' + pkg.installed + ' to ' + pkg.latest
        ] : '',
        pkg.unused ? [chalk.black.bold.bgWhite(emoji(' :confused: ') + ' NOTUSED? ') + ' Possibly not referenced in the code.',
            '           ' + emoji('   ') + chalk.green('npm uninstall --save' + (pkg.devDependency ? '-dev' : '') + ' ' + packageName) + ' to remove.'
        ] : '',
        pkg.mismatch && !pkg.bump ? chalk.bgRed.yellow.bold(emoji(' :interrobang: ') + ' MISMATCH ') + ' Installed version does not match package.json. ' + pkg.installed + ' ≠ ' + pkg.packageJson : '',
        pkg.regError ? chalk.bgRed.white.bold(emoji(' :no_entry: ') + ' NPM ERR! ') + ' ' + chalk.red(pkg.regError) : ''
    ])
    .flatten()
    .compact()
    .valueOf();

    if (!status.length) {
        return false;
    }

    rows.push(
        [
            chalk.yellow(packageName),
            status.shift()
        ]);

    while (status.length) {
        rows.push([
            ' ',
            status.shift()
        ]);
    }

    rows.push(
        [
            ' '
        ]);

    return rows;
}

function outputConsole(currentState) {
    const packages = currentState.get('packages');

    const rows = packages.reduce((acc, pkg) => {
        return acc.concat(render(pkg, currentState));
    }, [])
    .filter(Boolean);

    if (rows.length) {
        const renderedTable = table(rows, {
            stringLength: s => chalk.stripColor(s).length
        });

        console.log('');
        console.log(renderedTable);
        console.log('Use ' + chalk.green('npm-check -u' + (currentState.get('global') ? ' -g' : '')) + ' for interactive update.');
        process.exit(-1);
    } else {
        console.log(`${emoji(':heart:  ')}Your modules look ${chalk.bold('amazing')}. Keep up the great work.${emoji(' :heart:')}`);
        process.exit(0);
    }
}

module.exports = outputConsole;
