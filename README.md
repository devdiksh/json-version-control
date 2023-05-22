# json-version-control

json-version-control is a lightweight package that provides version control functionality for JSON files. It allows you to save and manage different versions of JSON data, track changes between versions, and apply specific versions to revert or update the JSON data.

## Features

- Create and save versions of JSON data
- Track changes between versions using diffs
- Revert to previous versions
- Apply specific versions to update the JSON data

## Installation

Install the json-version-control package using npm:

```shell
npm install json-version-control
```

## Usage

To use the json-version-control package, you can refer to the following API reference.

## API Reference

### VersionControl

The `VersionControl` class provides the following methods:

- `saveNewVersion(targetJson)`: Save a new version by calculating the difference between the source object and the target JSON object.

- `getHistoryVersions()`: Get the list of available history versions.

- `getPreviousVersion()`: Get the previous version based on the current version.

- `getNextVersion()`: Get the next version based on the current version.

- `applyVersionToSource(version)`: Apply the specified version to the source.

- `getInitialVersion()`: Get the source object from the initial version.

- `getLatestVersion()`: Get the source object from the latest version.

- `applyInitialVersion()`: Apply the initial version to the source.

- `applyLatestVersion()`: Apply the latest version to the source.

For detailed information about each method and its usage, please refer to the source code documentation.

## Example

Here's an example that demonstrates how to use the json-version-control package:

```javascript
const { VersionControl } = require('json-version-control');

// Initialize the VersionControl instance with the configuration
const config = {
  sourceFilePath: './data/source.json',
  headFilePath: './data/head.json',
  historyDirectory: './data/history',
  diffFilePrefix: 'diff_',
};

const vc = new VersionControl(config);

// Save a new version
const newData = { name: 'John Doe', age: 30 };
vc.saveNewVersion(newData);

// Get the list of available history versions
const historyVersions = vc.getHistoryVersions();
console.log('History Versions:', historyVersions);

// Revert to a previous version
const previousVersion = vc.getPreviousVersion();
if (previousVersion) {
  vc.applyVersionToSource(previousVersion);
  console.log('Reverted to previous version:', previousVersion);
} else {
  console.log('No previous version found.');
}

// Apply the next version
const nextVersion = vc.getNextVersion();
if (nextVersion) {
  vc.applyVersionToSource(nextVersion);
  console.log('Applied next version:', nextVersion);
} else {
  console.log('No next version found.');
}
```
## License

This project is licensed under the ISC License.
