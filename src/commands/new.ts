/**
 * `quikrun new [name]` — the headline scaffolder.
 *
 * Local-first flow: register a draft snippet server-side, fetch its starter
 * code, then materialise a local project directory (source file, quikrun.json,
 * README) the user can immediately edit and `deploy`.
 */

import { join } from "node:path";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import prompts from "prompts";
import pc from "picocolors";
import {
  apiRequest,
  fail,
  requireToken,
  type CreateSnippetResponse,
  type SnippetDetail,
} from "../api.js";
import { API_URL, writeProjectConfig, type ProjectConfig } from "../config.js";
import {
  extForLanguage,
  isLanguage,
  slugify,
  LANGUAGES,
  type Language,
} from "../util.js";

export interface NewOptions {
  language?: string;
  /** Skip interactive prompts and use defaults. */
  yes?: boolean;
}

const DEFAULT_LANGUAGE: Language = "javascript";
const DEFAULT_VISIBILITY: ProjectConfig["visibility"] = "private";

export async function newSnippet(
  nameArg: string | undefined,
  options: NewOptions,
): Promise<void> {
  // A token is required to register the snippet server-side.
  requireToken();

  // --- 1. Resolve name --------------------------------------------------
  let name = nameArg?.trim();
  if (!name && !options.yes) {
    const res = await prompts(
      {
        type: "text",
        name: "name",
        message: "Snippet name",
        validate: (v: string) => (v.trim() ? true : "Please enter a name"),
      },
      { onCancel: () => fail("Cancelled.") },
    );
    name = (res.name as string | undefined)?.trim();
  }
  if (!name) fail("A snippet name is required. Try: quikrun new my-snippet");

  // --- 2. Resolve language ---------------------------------------------
  let language: Language;
  if (options.language) {
    if (!isLanguage(options.language)) {
      fail(
        `Unknown language "${options.language}". Choose one of: ${LANGUAGES.join(", ")}.`,
      );
    }
    language = options.language;
  } else if (options.yes) {
    language = DEFAULT_LANGUAGE;
  } else {
    const res = await prompts(
      {
        type: "select",
        name: "language",
        message: "Language",
        choices: LANGUAGES.map((l) => ({ title: l, value: l })),
        initial: LANGUAGES.indexOf(DEFAULT_LANGUAGE),
      },
      { onCancel: () => fail("Cancelled.") },
    );
    language = (res.language as Language | undefined) ?? DEFAULT_LANGUAGE;
  }

  // --- 3. Resolve visibility -------------------------------------------
  let visibility: ProjectConfig["visibility"] = DEFAULT_VISIBILITY;
  if (!options.yes) {
    const res = await prompts(
      {
        type: "select",
        name: "visibility",
        message: "Visibility",
        choices: [
          { title: "private", value: "private" },
          { title: "public", value: "public" },
        ],
        initial: 0,
      },
      { onCancel: () => fail("Cancelled.") },
    );
    visibility = (res.visibility as ProjectConfig["visibility"]) ?? DEFAULT_VISIBILITY;
  }

  // --- 4. Guard the target directory before any network work -----------
  const dirName = slugify(name);
  if (!dirName) fail(`"${name}" does not produce a valid directory name.`);
  const targetDir = join(process.cwd(), dirName);
  if (existsSync(targetDir)) {
    fail(`Directory ./${dirName} already exists. Choose another name or remove it.`);
  }

  // --- 5. Register the snippet (creates a server-side draft) -----------
  console.log(pc.dim(`\nCreating snippet on ${API_URL}…`));
  const created = await apiRequest<CreateSnippetResponse>("/api/snippets", {
    method: "POST",
    body: { name, language },
  });
  const slug = created.slug;

  // Create always starts a snippet private; apply the chosen visibility so the
  // prompt is honored (and quikrun.json matches the server state).
  if (visibility !== "private") {
    await apiRequest(`/api/snippets/${encodeURIComponent(slug)}`, {
      method: "PATCH",
      body: { visibility },
    });
  }

  // --- 6. Fetch starter code + runtime meta ----------------------------
  const detail = await apiRequest<SnippetDetail>(
    `/api/snippets/${encodeURIComponent(slug)}`,
  );
  const runtime = detail.snippet?.runtime ?? "";
  const resolvedLanguage = detail.snippet?.language ?? language;
  const code = Array.isArray(detail.code) ? detail.code.join("\n") : "";

  // --- 7. Materialise the local project --------------------------------
  const ext = extForLanguage(resolvedLanguage);
  const fileName = `snippet.${ext}`;
  mkdirSync(targetDir, { recursive: true });

  writeFileSync(join(targetDir, fileName), code.endsWith("\n") ? code : `${code}\n`);

  const projectConfig: ProjectConfig = {
    slug,
    language: resolvedLanguage,
    runtime,
    visibility,
    file: fileName,
  };
  writeProjectConfig(projectConfig, targetDir);

  writeFileSync(join(targetDir, "README.md"), renderReadme(name, slug, fileName));

  // --- 8. Next steps ----------------------------------------------------
  const runUrl = `quik.run/r/${slug}`;
  console.log(pc.green(`\n✔ Created ${pc.bold(name)}`));
  console.log(`  ${pc.dim("slug")}     ${slug}`);
  console.log(`  ${pc.dim("language")} ${resolvedLanguage}`);
  if (runtime) console.log(`  ${pc.dim("runtime")}  ${runtime}`);
  console.log(`  ${pc.dim("run url")}  ${pc.cyan(runUrl)}`);

  console.log(pc.bold("\nNext steps:"));
  console.log(`  ${pc.cyan(`cd ${dirName}`)}`);
  console.log(`  ${pc.dim(`# edit ${fileName}`)}`);
  console.log(`  ${pc.cyan("quikrun deploy")}   ${pc.dim("# ship it live")}`);
  console.log(`  ${pc.cyan("quikrun run")}      ${pc.dim("# test it first")}\n`);
}

/** Build the project README with the run URL and next-step commands. */
function renderReadme(name: string, slug: string, fileName: string): string {
  return `# ${name}

A [QuikRun](https://quik.run) snippet.

- Run URL: https://quik.run/r/${slug}
- Source: \`${fileName}\`

## Commands

\`\`\`bash
quikrun run       # execute the snippet with a test payload
quikrun deploy    # save + deploy the current source live
quikrun pull      # overwrite local source with the deployed version
\`\`\`
`;
}
