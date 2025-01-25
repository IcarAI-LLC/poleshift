#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import toml from 'toml';     // or 'tomlify-j0.4' for writing, or use regex
import tomlify from 'tomlify-j0.4';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 1. Read root package.json
const rootPkgPath = path.join(__dirname, '..', 'package.json');
const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
const newVersion = rootPkg.version;

// 2. Update sub-package poleshift-app
const appPkgPath = path.join(__dirname, '..', 'apps/poleshift-app/package.json');
const appPkg = JSON.parse(fs.readFileSync(appPkgPath, 'utf8'));
appPkg.version = newVersion;
fs.writeFileSync(appPkgPath, JSON.stringify(appPkg, null, 2));

// 3. Update sub-package poleshift-site
const sitePkgPath = path.join(__dirname, '..', 'apps/poleshift-site/package.json');
const sitePkg = JSON.parse(fs.readFileSync(sitePkgPath, 'utf8'));
sitePkg.version = newVersion;
fs.writeFileSync(sitePkgPath, JSON.stringify(sitePkg, null, 2));

// 4. Update Cargo.toml for Tauri
const cargoPath = path.join(__dirname, '..', 'apps/poleshift-app/src-tauri/Cargo.toml');
let cargoToml = fs.readFileSync(cargoPath, 'utf8');

// A simple regex might do if your Cargo.toml is stable:
cargoToml = cargoToml.replace(
    /(version\s*=\s*")[^"]+(")/,
    `$1${newVersion}$2`
);
fs.writeFileSync(cargoPath, cargoToml);

console.log(`Synced version to ${newVersion} in sub-packages + Cargo.toml`);
