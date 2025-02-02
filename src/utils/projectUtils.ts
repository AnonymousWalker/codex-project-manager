import { nonCanonicalBookRefs } from "./verseRefUtils/verseData";
import { LanguageMetadata, LanguageProjectStatus, Project } from "codex-types";
import { getAllBookRefs } from "./verseRefUtils";
import * as vscode from "vscode";
import { LanguageCodes } from "./languageUtils";

export interface ProjectDetails {
  projectName?: string;
  projectCategory?: string;
  userName?: string;
  abbreviation?: string;
  sourceLanguage: LanguageMetadata;
  targetLanguage: LanguageMetadata;
}

export async function promptForProjectDetails(): Promise<
  ProjectDetails | undefined
> {
  // Prompt user for project details and return them

  //   const projectCategory = await vscode.window.showQuickPick(
  //     ["Scripture", "Gloss", "Parascriptural", "Peripheral"],
  //     { placeHolder: "Select the project category" }
  //   );
  //   if (!projectCategory) {
  //     return;
  //   }

  //   const projectName = await vscode.window.showInputBox({
  //     prompt: "Enter the project name",
  //   });
  //   if (!projectName) {
  //     return;
  //   }

  //   const userName = await vscode.window.showInputBox({
  //     prompt: "Enter your username",
  //   });
  //   if (!userName) {
  //     return;
  //   }

  //   const abbreviation = await vscode.window.showInputBox({
  //     prompt: "Enter the project abbreviation",
  //     placeHolder: "e.g. KJV, NASB, RSV, etc.",
  //   });
  //   if (!abbreviation) {
  //     return;
  //   }
  const languages = LanguageCodes;
  const sourceLanguagePick = await vscode.window.showQuickPick(
    languages.map((lang: LanguageMetadata) => `${lang.refName} (${lang.tag})`),
    {
      placeHolder: "Select the source language",
    }
  );
  if (!sourceLanguagePick) {
    return;
  }

  const sourceLanguage = languages.find(
    (lang: LanguageMetadata) =>
      `${lang.refName} (${lang.tag})` === sourceLanguagePick
  );
  if (!sourceLanguage) {
    return;
  }

  const targetLanguagePick = await vscode.window.showQuickPick(
    languages.map((lang: LanguageMetadata) => `${lang.refName} (${lang.tag})`),
    {
      placeHolder: "Select the target language",
    }
  );
  if (!targetLanguagePick) {
    return;
  }

  const targetLanguage = languages.find(
    (lang: LanguageMetadata) =>
      `${lang.refName} (${lang.tag})` === targetLanguagePick
  );
  if (!targetLanguage) {
    return;
  }

  // Add project status to the selected languages
  sourceLanguage.projectStatus = LanguageProjectStatus.SOURCE;
  targetLanguage.projectStatus = LanguageProjectStatus.TARGET;

  return {
    // projectName,
    // projectCategory,
    // userName,
    // abbreviation,
    sourceLanguage,
    targetLanguage,
  };
}

export function generateProjectScope(
  skipNonCanonical: boolean = true
): Project["type"]["flavorType"]["currentScope"] {
  /** For now, we are just setting the scope as all books, but allowing the vref.ts file to determine the books.
   * We could add a feature to allow users to select which books they want to include in the project.
   * And we could even drill down to specific chapter/verse ranges.
   *
   * FIXME: need to sort out whether the scope can sometimes be something other than books, like stories, etc.
   */
  const books: string[] = getAllBookRefs();

  // The keys will be the book refs, and the values will be empty arrays
  const projectScope: any = {}; // NOTE: explicit any type here because we are dynamically generating the keys

  skipNonCanonical
    ? books
        .filter((book) => !nonCanonicalBookRefs.includes(book))
        .forEach((book) => {
          projectScope[book] = [];
        })
    : books.forEach((book) => {
        projectScope[book] = [];
      });
  return projectScope;
}

export async function initializeProjectMetadata(details: ProjectDetails) {
  // Initialize a new project with the given details and return the project object
  const newProject: Project = {
    format: "scripture burrito",
    projectName:
      details.projectName ||
      vscode.workspace
        .getConfiguration("codex-project-manager")
        .get<string>("projectName") ||
      "Codex Project",
    meta: {
      version: "0.0.0",
      category:
        details.projectCategory ||
        vscode.workspace
          .getConfiguration("codex-project-manager")
          .get<string>("projectCategory") ||
        "Scripture", // fixme: does this needed in multi modal?
      generator: {
        softwareName: "Codex Editor",
        softwareVersion: "0.0.1",
        userName:
          details.userName ||
          vscode.workspace
            .getConfiguration("codex-project-manager")
            .get<string>("userName") ||
          "Unknown",
      },
      defaultLocale: "en",
      dateCreated: new Date().toDateString(),
      normalization: "NFC",
      comments: [],
    },
    idAuthorities: {},
    identification: {},
    languages: [],
    type: {
      flavorType: {
        name: "default",
        flavor: {
          name: "default",
          usfmVersion: "3.0",
          translationType: "unknown",
          audience: "general",
          projectType: "unknown",
        },
        currentScope: generateProjectScope(),
      },
    },
    confidential: false,
    agencies: [],
    targetAreas: [],
    localizedNames: {},
    ingredients: {},
    copyright: {
      shortStatements: [],
    },
  };

  newProject.languages.push(details.sourceLanguage);
  newProject.languages.push(details.targetLanguage);

  const workspaceFolder = vscode.workspace.workspaceFolders
    ? vscode.workspace.workspaceFolders[0].uri.fsPath
    : undefined;

  if (!workspaceFolder) {
    console.error("No workspace folder found.");
    return;
  }

  const WORKSPACE_FOLDER =
    vscode?.workspace?.workspaceFolders &&
    vscode?.workspace?.workspaceFolders[0];

  if (!WORKSPACE_FOLDER) {
    console.error("No workspace folder found.");
    return;
  }

  const projectFilePath = vscode.Uri.joinPath(
    WORKSPACE_FOLDER.uri,
    "metadata.json"
  );
  const projectFileData = Buffer.from(
    JSON.stringify(newProject, null, 4),
    "utf8"
  );

  // FIXME: need to handle the case where the file does not exist
  vscode.workspace.fs
    .writeFile(projectFilePath, projectFileData)
    .then(() =>
      vscode.window.showInformationMessage(
        `Project created at ${projectFilePath.fsPath}`
      )
    );
  return newProject;
}

export async function updateMetadataFile() {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri?.fsPath;

  if (!workspaceFolder) {
    console.error("No workspace folder found.");
    return;
  }

  const projectFilePath = vscode.Uri.joinPath(
    vscode.Uri.file(workspaceFolder),
    "metadata.json"
  );

  let project;
  try {
    const projectFileData = await vscode.workspace.fs.readFile(projectFilePath);
    project = JSON.parse(projectFileData.toString());
  } catch (error) {
    console.warn("Metadata file does not exist, creating a new one.");
    project = {}; // Initialize an empty project object if the file does not exist
  }

  const projectSettings = vscode.workspace.getConfiguration(
    "codex-project-manager"
  );
  const projectName = projectSettings.get("projectName", "");
  console.log("Project name loaded:", projectName);

  project.projectName = projectSettings.get("projectName", "");
  project.meta = project.meta || {}; // Ensure meta object exists
  project.meta.category = projectSettings.get("projectCategory", "");
  project.meta.generator = project.meta.generator || {}; // Ensure generator object exists
  project.meta.generator.userName = projectSettings.get("userName", "");
  // Update other fields as needed
  console.log("Project settings loaded:", { projectSettings, project });
  const updatedProjectFileData = Buffer.from(
    JSON.stringify(project, null, 4),
    "utf8"
  );
  await vscode.workspace.fs.writeFile(projectFilePath, updatedProjectFileData);
  vscode.window.showInformationMessage(
    `Project metadata updated at ${projectFilePath.fsPath}`
  );
}
