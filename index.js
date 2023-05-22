const fs = require("fs");
const jsondiffpatch = require("jsondiffpatch");

class VersionControl {
  /**
   * Constructs a VersionControl instance with the provided configuration.
   * @param {Object} config - The configuration object.
   * @param {string} config.sourceFilePath - The file path of the source text file.
   * @param {string} config.headFilePath - The file path of the head file.
   * @param {string} config.historyDirectory - The directory path for storing history files.
   * @param {string} config.diffFilePrefix - The prefix for history diff file names.
   */
  constructor(config) {
    this.sourceFilePath = config.sourceFilePath;
    this.headFilePath = config.headFilePath;
    this.historyDirectory = config.historyDirectory;
    this.diffFilePrefix = config.diffFilePrefix;

    // Ensure the history directory exists
    try {
      fs.mkdirSync(this.historyDirectory, { recursive: true });
    } catch (err) {
      console.error(`Error creating history directory: ${err}`);
    }

    // Create an empty head.json file if it doesn't exist
    if (!fs.existsSync(this.headFilePath)) {
      try {
        fs.writeFileSync(this.headFilePath, "{}");
      } catch (err) {
        console.error(`Error creating head file: ${err}`);
      }
    }
  }

  /**
   * Reads JSON data from a file.
   * @param {string} filePath - The file path to read from.
   * @returns {Object|null} - The parsed JSON object, or null if an error occurs.
   */
  readJsonFile(filePath) {
    try {
      const fileContent = fs.readFileSync(filePath, "utf-8");
      return JSON.parse(fileContent);
    } catch (error) {
      console.log(`Error reading JSON file '${filePath}': ${error}`);
      return null;
    }
  }

  /**
   * Writes JSON data to a file.
   * @param {string} filePath - The file path to write to.
   * @param {Object} jsonData - The JSON data to write.
   */
  writeJsonFile(filePath, jsonData) {
    const fileContent = JSON.stringify(jsonData, null, 2);
    fs.writeFileSync(filePath, fileContent);
  }

  /**
   * Calculates the difference between two JSON objects.
   * @param {Object} sourceObj - The source JSON object.
   * @param {Object} targetObj - The target JSON object.
   * @returns {Object} - The diff object representing the changes.
   */
  calculateDiff(sourceObj, targetObj) {
    return jsondiffpatch.diff(sourceObj, targetObj);
  }

  /**
   * Applies the given diff to the source object.
   * @param {Object} sourceObj - The source JSON object.
   * @param {Object} diff - The diff object to apply.
   * @returns {Object} - The patched object.
   */
  applyDiff(sourceObj, diff) {
    return jsondiffpatch.patch(sourceObj, diff);
  }

  /**
   * Get the current version from the head file.
   * @returns {string|null} - The current version, or null if not found.
   */
  getCurrentVersion() {
    const headData = this.readJsonFile(this.headFilePath);
    const version = headData.version;
    return version !== undefined ? String(version) : null;
  }

  /**
   * Get the list of available history versions.
   * @returns {string[]} - The array of history versions sorted in ascending order.
   */
  getHistoryVersions() {
    const fileNames = fs.readdirSync(this.historyDirectory);
    const versionRegex = new RegExp(`^${this.diffFilePrefix}(\\d+)\\.diff$`);
    const versions = [];

    for (const fileName of fileNames) {
      const match = versionRegex.exec(fileName);
      if (match) {
        versions.push(match[1]);
      }
    }

    return versions.sort((a, b) => a - b);
  }

  /**
   * Get the previous version based on the current version.
   * @returns {string|null} - The previous version, or null if not found.
   */
  getPreviousVersion() {
    const currentVersion = this.getCurrentVersion();
    const historyVersions = this.getHistoryVersions();

    if (currentVersion && historyVersions.includes(currentVersion)) {
      const currentIndex = historyVersions.indexOf(currentVersion);
      if (currentIndex > 0) {
        return historyVersions[currentIndex - 1];
      }
    }

    return null;
  }

  /**
   * Get the next version based on the current version.
   * @returns {string|null} - The next version, or null if not found.
   */
  getNextVersion() {
    const currentVersion = this.getCurrentVersion();
    const historyVersions = this.getHistoryVersions();

    if (currentVersion && historyVersions.includes(currentVersion)) {
      const currentIndex = historyVersions.indexOf(currentVersion);
      if (currentIndex < historyVersions.length - 1) {
        return historyVersions[currentIndex + 1];
      }
    }

    return null;
  }

  /**
   * Save a new version by calculating the difference between the source object and the target JSON object,
   * and updating the source text file, diff history, and head file accordingly.
   * If the source text file doesn't exist, it will be created with an empty source object.
   * @param {Object} targetJson - The target JSON object representing the changes for the new version.
   * @returns {Object|null} - The saved source object, or null if version not saved.
   */
  saveNewVersion(targetJson) {
    // Check if the source text file exists, and if not, create an empty source object.
    const sourceObj = fs.existsSync(this.sourceFilePath)
      ? this.readJsonFile(this.sourceFilePath)
      : {};

    // Calculate the difference between the source and target objects.
    const diff = this.calculateDiff(sourceObj, targetJson);

    // If no changes are found, log a message and return.
    if (!diff) {
      console.log("No changes found. Version not saved.");
      return null;
    }

    // Generate a timestamp for the current version.
    const timestamp = Date.now();

    // Create the file path for the diff file using the timestamp.
    const diffFilePath = `${this.historyDirectory}/${this.diffFilePrefix}${timestamp}.diff`;

    // Apply the diff to the source object.
    const patchedObj = this.applyDiff(sourceObj, diff);

    // Save the diff as a separate file in the history directory.
    this.writeJsonFile(diffFilePath, diff);
    console.log(`Diff file ${diffFilePath} saved.`);

    // Update the head file with the current version.
    this.writeJsonFile(this.headFilePath, { version: String(timestamp) });
    console.log(
      `Head file ${this.headFilePath} updated with version ${timestamp}.`
    );

    // Update the source text file with the patched object.
    this.writeJsonFile(this.sourceFilePath, patchedObj);

    console.log(`Version ${timestamp} saved.`);
    return patchedObj;
  }

  /**
   * Get the source object from a specific version.
   * @param {string} version - The version number.
   * @returns {Object|null} - The source object from the specified version, or null if not found or an error occurs.
   */
  getSourceFromVersion(version) {
    const currentVersion = this.getCurrentVersion();
    const historyVersions = this.getHistoryVersions();

    if (!currentVersion || !historyVersions.includes(version)) {
      console.log(`Version ${version} not found in history.`);
      return null;
    }

    const sourceObj = this.readJsonFile(this.sourceFilePath);
    let patchedObj = sourceObj;

    const versionIndex = historyVersions.indexOf(version);
    const versionsToApply = historyVersions.slice(0, versionIndex + 1);

    for (const ver of versionsToApply) {
      const diffFilePath = `${this.historyDirectory}/${this.diffFilePrefix}${ver}.diff`;
      const diff = this.readJsonFile(diffFilePath);

      if (!diff) {
        console.log(`Error reading diff file for version ${ver}.`);
        return null;
      }

      patchedObj = this.applyDiff(patchedObj, diff);
    }

    return patchedObj;
  }

  /**
   * Apply the specified version to the source.
   * @param {string} version - The version number.
   * @returns {Object|null} - The source object for the specified version, or null if version not found.
   */
  applyVersionToSource(version) {
    const sourceObj = this.getSourceFromVersion(version);

    if (!sourceObj) {
      console.log(`Version ${version} not found.`);
      return null;
    }

    this.writeJsonFile(this.sourceFilePath, sourceObj);
    this.writeJsonFile(this.headFilePath, { version });

    console.log(`Applied version ${version} to the source.`);
    return sourceObj;
  }

  /**
   * Apply the previous version to the source.
   * @returns {Object|null} - The source object for the previous version, or null if previous version not found.
   */
  applyPreviousVersion() {
    const previousVersion = this.getPreviousVersion();

    if (!previousVersion) {
      console.log("Previous version not found.");
      return null;
    }

    return this.applyVersionToSource(previousVersion);
  }

  /**
   * Apply the next version to the source.
   * @returns {Object|null} - The source object for the next version, or null if next version not found.
   */
  applyNextVersion() {
    const nextVersion = this.getNextVersion();

    if (!nextVersion) {
      console.log("Next version not found.");
      return null;
    }

    return this.applyVersionToSource(nextVersion);
  }

  /**
   * Get the source object from the initial version.
   * @returns {Object|null} - The source object from the initial version, or null if not found or an error occurs.
   */
  getInitialVersion() {
    const historyVersions = this.getHistoryVersions();

    if (historyVersions.length === 0) {
      console.log("No history versions found.");
      return null;
    }

    const initialVersion = historyVersions[0];
    return this.getSourceFromVersion(initialVersion);
  }

  /**
   * Get the source object from the latest version.
   * @returns {Object|null} - The source object from the latest version, or null if not found or an error occurs.
   */
  getLatestVersion() {
    const historyVersions = this.getHistoryVersions();

    if (historyVersions.length === 0) {
      console.log("No history versions found.");
      return null;
    }

    const latestVersion = historyVersions[historyVersions.length - 1];
    return this.getSourceFromVersion(latestVersion);
  }

  /**
   * Apply the initial version to the source.
   * @returns {Object|null} - The source object for the initial version, or null if initial version not found.
   */
  applyInitialVersion() {
    const historyVersions = this.getHistoryVersions();

    if (historyVersions.length === 0) {
      console.log("No history versions found.");
      return null;
    }

    const initialVersion = historyVersions[0];
    return this.applyVersionToSource(initialVersion);
  }

  /**
   * Apply the latest version to the source.
   * @returns {Object|null} - The source object for the latest version, or null if latest version not found.
   */
  applyLatestVersion() {
    const historyVersions = this.getHistoryVersions();

    if (historyVersions.length === 0) {
      console.log("No history versions found.");
      return null;
    }

    const latestVersion = historyVersions[historyVersions.length - 1];
    return this.applyVersionToSource(latestVersion);
  }
}

module.exports = VersionControl;
