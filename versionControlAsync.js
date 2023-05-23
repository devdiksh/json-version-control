const fs = require("fs");
const util = require("util");
const path = require("path");
const jsondiffpatch = require("jsondiffpatch");

class VersionControlAsync {
  /**
   * Constructs a VersionControl instance with the provided configuration.
   * @param {Object} config - The configuration object.
   * @param {string} config.sourceFilePath - The file path of the source text file.
   * @param {string} config.headFilePath - The file path of the head file.
   * @param {string} config.historyDirectory - The directory path for storing history files.
   * @param {string} config.diffFilePrefix - The prefix for history diff file names.
   * @param {function} [config.readAsync] - Optional callback function for async file read operation.
   * @param {function} [config.writeAsync] - Optional callback function for async file write operation.
   * @param {function} [config.readdirAsync] - Optional callback function for async directory read operation.
   * @param {function} [config.mkdirAsync] - Optional callback function for async directory create operation.
   */
  constructor(config) {
    // Set the paths and prefixes from the provided config object
    this.sourceFilePath = config.sourceFilePath;
    this.headFilePath = config.headFilePath;
    this.historyDirectory = config.historyDirectory;
    this.diffFilePrefix = config.diffFilePrefix;

    // Promisify the necessary file system functions
    this.readFileAsync = config.readAsync || util.promisify(fs.readFile);
    this.writeFileAsync = config.writeAsync || util.promisify(fs.writeFile);
    this.readdirAsync = config.readdirAsync || util.promisify(fs.readdir);
    this.mkdirAsync = config.mkdirAsync || util.promisify(fs.mkdir);
  }

  /**
   * Initializes the VersionControlAsync instance by ensuring the history directory exists,
   * creating the head file, and creating the source file if it doesn't exist.
   * This method should be called after creating a new instance of VersionControlAsync to set up the necessary files and directories.
   */
  async init() {
    await this.ensureHistoryDirectory();
    await this.createHeadFile();
    await this.createSourceFile();
  }

  /**
   * Creates the source file if it doesn't exist.
   * If the file doesn't exist, it creates an empty JSON object and writes it to the source file.
   */
  async createSourceFile() {
    try {
      const fileExists = await this.fileExistsAsync(this.sourceFilePath);
      if (fileExists) {
        console.log("Source file exists.");
      } else {
        try {
          await this.writeFileAsync(this.sourceFilePath, JSON.stringify({}));
          console.log("Source file created.");
        } catch (error) {
          console.error("Error creating source file:", error);
        }
      }
    } catch (error) {
      console.error("Error checking source file existence:", error);
    }
  }

  /**
   * Ensures the existence of the history directory. Creates the directory if it doesn't exist.
   * @returns {Promise} A promise that resolves when the history directory is created or rejects if an error occurs.
   */
  async ensureHistoryDirectory() {
    try {
      await this.mkdirAsync(this.historyDirectory, { recursive: true });
      console.log("History directory created.");
    } catch (err) {
      console.error(`Error creating history directory: ${err}`);
    }
  }

  /**
   * Checks if a file exists.
   * @param {string} filePath - The file path.
   * @returns {Promise<boolean>} A promise that resolves with true if the file exists, false otherwise.
   */
  async fileExistsAsync(filePath) {
    try {
      await this.readFileAsync(filePath);
      return true;
    } catch (err) {
      return false;
    }
  }

  /**
   * Creates the head file if it doesn't exist.
   * @returns {Promise} A promise that resolves when the head file is created or rejects if an error occurs.
   */
  async createHeadFile() {
    try {
      const isHeadFileExists = await this.fileExistsAsync(this.headFilePath);
      if (!isHeadFileExists) {
        await this.writeFileAsync(
          this.headFilePath,
          JSON.stringify({ version: null })
        );
        console.log("Head file created.");
      }
    } catch (err) {
      console.error(`Error creating head file: ${err}`);
    }
  }

  /**
   * Reads JSON data from a file asynchronously.
   * @param {string} filePath - The file path to read from.
   * @returns {Promise<Object|null>} - A promise that resolves with the parsed JSON object, or null if an error occurs.
   */
  async readJsonFile(filePath) {
    try {
      const fileExists = await this.fileExistsAsync(filePath);
      if (!fileExists) {
        console.log(`File '${filePath}' does not exist.`);
        return null;
      }

      const fileContent = await this.readFileAsync(filePath, "utf-8");
      return JSON.parse(fileContent);
    } catch (error) {
      console.log(`Error reading JSON file '${filePath}': ${error}`);
      return null;
    }
  }

  /**
   * Writes JSON data to a file asynchronously.
   * @param {string} filePath - The file path to write to.
   * @param {Object} jsonData - The JSON data to write.
   * @returns {Promise<void>} - A promise that resolves when the write operation is complete.
   */
  async writeJsonFile(filePath, jsonData) {
    const fileContent = JSON.stringify(jsonData, null, 2);
    await this.writeFileAsync(filePath, fileContent);
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
   * Get the current version from the head file asynchronously.
   * @returns {Promise<string|null>} - A promise that resolves to the current version, or null if not found.
   */
  async getCurrentVersion() {
    try {
      const headData = await this.readJsonFile(this.headFilePath);
      const version = headData.version;
      return version !== undefined ? String(version) : null;
    } catch (err) {
      console.error(`Error getting current version: ${err}`);
      return null;
    }
  }

  /**
   * Get the list of available history versions asynchronously.
   * @returns {Promise<string[]>} - A promise that resolves to the array of history versions sorted in ascending order.
   */
  async getHistoryVersions() {
    try {
      const fileNames = await this.readdirAsync(this.historyDirectory);
      const versionRegex = new RegExp(`^${this.diffFilePrefix}(\\d+)\\.diff$`);
      const versions = [];

      for (const fileName of fileNames) {
        const match = versionRegex.exec(fileName);
        if (match) {
          versions.push(match[1]);
        }
      }

      return versions.sort((a, b) => a - b);
    } catch (err) {
      console.error(`Error getting history versions: ${err}`);
      return [];
    }
  }

  /**
   * Get the previous version based on the current version asynchronously.
   * @returns {string|null} - The previous version, or null if not found.
   */
  async getPreviousVersion() {
    try {
      const currentVersion = await this.getCurrentVersion();
      const historyVersions = await this.getHistoryVersions();

      if (currentVersion && historyVersions.includes(currentVersion)) {
        const currentIndex = historyVersions.indexOf(currentVersion);
        if (currentIndex > 0) {
          return historyVersions[currentIndex - 1];
        }
      }

      return null;
    } catch (err) {
      console.error(`Error getting previous version: ${err}`);
      return null;
    }
  }

  /**
   * Get the next version based on the current version asynchronously.
   * @returns {string|null} - The next version, or null if not found.
   */
  async getNextVersion() {
    try {
      const currentVersion = await this.getCurrentVersion();
      const historyVersions = await this.getHistoryVersions();

      if (currentVersion && historyVersions.includes(currentVersion)) {
        const currentIndex = historyVersions.indexOf(currentVersion);
        if (currentIndex < historyVersions.length - 1) {
          return historyVersions[currentIndex + 1];
        }
      }

      return null;
    } catch (err) {
      console.error(`Error getting next version: ${err}`);
      return null;
    }
  }

  /**
   * Save a new version asynchronously by calculating the difference between the source object and the target JSON object,
   * and updating the source text file, diff history, and head file accordingly.
   * If the source text file doesn't exist, it will be created with an empty source object.
   * @param {Object} targetJson - The target JSON object representing the changes for the new version.
   * @returns {Object|null} - The saved source object, or null if version not saved.
   */
  async saveNewVersion(targetJson) {
    try {
      // Check if the source text file exists, and if not, create an empty source object.
      const sourceObj = await this.readJsonFile(this.sourceFilePath);

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
      await this.writeJsonFile(diffFilePath, diff);
      console.log(`Diff file ${diffFilePath} saved.`);

      // Update the head file with the current version.
      await this.writeJsonFile(this.headFilePath, {
        version: String(timestamp),
      });
      console.log(
        `Head file ${this.headFilePath} updated with version ${timestamp}.`
      );

      // Update the source text file with the patched object.
      await this.writeJsonFile(this.sourceFilePath, patchedObj);

      console.log(`Version ${timestamp} saved.`);
      return patchedObj;
    } catch (err) {
      console.error(`Error saving new version: ${err}`);
      return null;
    }
  }

  /**
   * Get the source object from a specific version asynchronously.
   * @param {string} version - The version number.
   * @returns {Object|null} - The source object from the specified version, or null if not found or an error occurs.
   */
  async getSourceFromVersion(version) {
    try {
      const currentVersion = await this.getCurrentVersion();
      const historyVersions = await this.getHistoryVersions();

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
        const diff = await this.readJsonFile(diffFilePath);

        if (!diff) {
          console.log(`Error reading diff file for version ${ver}.`);
          return null;
        }

        patchedObj = this.applyDiff(patchedObj, diff);
      }

      return patchedObj;
    } catch (err) {
      console.error(`Error getting source from version: ${err}`);
      return null;
    }
  }

  /**
   * Apply the specified version to the source asynchronously.
   * @param {string} version - The version number.
   * @returns {Object|null} - The source object for the specified version, or null if the version is not found.
   */
  async applyVersionToSource(version) {
    try {
      const sourceObj = await this.getSourceFromVersion(version);

      if (!sourceObj) {
        console.log(`Version ${version} not found.`);
        return null;
      }

      await this.writeJsonFile(this.sourceFilePath, sourceObj);
      await this.writeJsonFile(this.headFilePath, { version });

      console.log(`Applied version ${version} to the source.`);
      return sourceObj;
    } catch (err) {
      console.error(`Error applying version to source: ${err}`);
      return null;
    }
  }

  /**
   * Apply the previous version to the source asynchronously.
   * @returns {Object|null} - The source object for the previous version, or null if previous version not found.
   */
  async applyPreviousVersion() {
    const previousVersion = await this.getPreviousVersion();

    if (!previousVersion) {
      console.log("Previous version not found.");
      return null;
    }

    return await this.applyVersionToSource(previousVersion);
  }

  /**
   * Apply the next version to the source asynchronously.
   * @returns {Object|null} - The source object for the next version, or null if next version not found.
   */
  async applyNextVersion() {
    const nextVersion = await this.getNextVersion();

    if (!nextVersion) {
      console.log("Next version not found.");
      return null;
    }

    return await this.applyVersionToSource(nextVersion);
  }

  /**
   * Get the source object from the initial version asynchronously.
   * @returns {Object|null} - The source object from the initial version, or null if not found or an error occurs.
   */
  async getInitialVersion() {
    const historyVersions = await this.getHistoryVersions();

    if (historyVersions.length === 0) {
      console.log("No history versions found.");
      return null;
    }

    const initialVersion = historyVersions[0];
    return await this.getSourceFromVersion(initialVersion);
  }

  /**
   * Get the source object from the latest version asynchronously.
   * @returns {Object|null} - The source object from the latest version, or null if not found or an error occurs.
   */
  async getLatestVersion() {
    const historyVersions = await this.getHistoryVersions();

    if (historyVersions.length === 0) {
      console.log("No history versions found.");
      return null;
    }

    const latestVersion = historyVersions[historyVersions.length - 1];
    return await this.getSourceFromVersion(latestVersion);
  }

  /**
   * Apply the initial version to the source asynchronously.
   * @returns {Object|null} - The source object for the initial version, or null if initial version not found.
   */
  async applyInitialVersion() {
    const historyVersions = await this.getHistoryVersions();

    if (historyVersions.length === 0) {
      console.log("No history versions found.");
      return null;
    }

    const initialVersion = historyVersions[0];
    return await this.applyVersionToSource(initialVersion);
  }

  /**
   * Apply the latest version to the source asynchronously.
   * @returns {Object|null} - The source object for the latest version, or null if latest version not found.
   */
  async applyLatestVersion() {
    const historyVersions = await this.getHistoryVersions();

    if (historyVersions.length === 0) {
      console.log("No history versions found.");
      return null;
    }

    const latestVersion = historyVersions[historyVersions.length - 1];
    return await this.applyVersionToSource(latestVersion);
  }
}

module.exports = VersionControlAsync;
