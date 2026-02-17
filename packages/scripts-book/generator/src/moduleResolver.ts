/**
 * moduleResolver.ts — Resolve template files based on selected modules and profile.
 */

import path from "node:path";
import fs from "fs-extra";
import fg from "fast-glob";

export interface ModuleDefinition {
  name: string;
  description: string;
  chapters: string[];
  docs: string[];
  workflows?: boolean;
  required?: boolean;
  optional?: boolean;
}

export interface ProfileDefinition {
  name: string;
  description: string;
  expected_paths: string[];
  default_app_port: number;
  docker_template: string | null;
  docker_placement: string;
  default_modules: string[];
  generated_files: {
    scripts_book: boolean;
    docs: boolean;
    workflows: boolean;
    dockerfile: boolean;
  };
  notes?: string;
}

/** Load a module definition from modules/<name>/module.json */
export async function loadModule(
  templateRoot: string,
  moduleName: string,
): Promise<ModuleDefinition> {
  const modPath = path.join(templateRoot, "modules", moduleName, "module.json");
  if (!(await fs.pathExists(modPath))) {
    throw new Error(`Module not found: ${moduleName}`);
  }
  return fs.readJson(modPath) as Promise<ModuleDefinition>;
}

/** Load a profile definition from profiles/<name>.json */
export async function loadProfile(
  templateRoot: string,
  profileName: string,
): Promise<ProfileDefinition> {
  const profPath = path.join(templateRoot, "profiles", `${profileName}.json`);
  if (!(await fs.pathExists(profPath))) {
    throw new Error(`Profile not found: ${profileName}`);
  }
  return fs.readJson(profPath) as Promise<ProfileDefinition>;
}

export interface ResolvedFiles {
  /** scripts-book chapter directories to include */
  chapters: string[];
  /** doc files to include */
  docs: string[];
  /** whether to include workflows */
  includeWorkflows: boolean;
  /** docker template file name (or null) */
  dockerTemplate: string | null;
  /** docker placement (root or app path) */
  dockerPlacement: string;
}

/** Resolve all template files that should be generated based on modules + profile. */
export async function resolveFiles(
  templateRoot: string,
  moduleNames: string[],
  profileName: string,
  options: { enable_ci: boolean; enable_deploy_workflows: boolean },
): Promise<ResolvedFiles> {
  const profile = await loadProfile(templateRoot, profileName);
  const chapters = new Set<string>();
  const docs = new Set<string>();
  let includeWorkflows = false;

  for (const modName of moduleNames) {
    const mod = await loadModule(templateRoot, modName);

    for (const ch of mod.chapters) {
      chapters.add(ch);
    }

    if (mod.docs) {
      for (const d of mod.docs) {
        docs.add(d);
      }
    }

    if (mod.workflows) {
      includeWorkflows = true;
    }
  }

  // Always include REBUILD.md
  chapters.add("REBUILD.md");

  return {
    chapters: Array.from(chapters).sort(),
    docs: Array.from(docs),
    includeWorkflows:
      includeWorkflows && (options.enable_ci || options.enable_deploy_workflows),
    dockerTemplate: profile.docker_template,
    dockerPlacement: profile.docker_placement,
  };
}

/** List all actual template files for a given chapter directory. */
export async function listChapterFiles(
  templateRoot: string,
  chapter: string,
): Promise<string[]> {
  const chapterDir = path.join(templateRoot, "template", "scripts-book", chapter);
  if (!(await fs.pathExists(chapterDir))) {
    return [];
  }

  const stat = await fs.stat(chapterDir);
  if (!stat.isDirectory()) {
    // It's a file (like REBUILD.md)
    return [chapter];
  }

  const files = await fg("**/*", { cwd: chapterDir, onlyFiles: true });
  return files.map((f) => path.join(chapter, f));
}
